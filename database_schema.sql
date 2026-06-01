-- ==============================================================================
-- AetherCache One-to-Many Database Schema & Relational Migration Script
-- ==============================================================================
-- INSTRUCTIONS: 
-- 1. Open your Supabase Dashboard -> select your AetherCache Project.
-- 2. Click the SQL Editor tab in the left sidebar (looks like >_).
-- 3. Click "+ New query" (New blank query).
-- 4. Copy and paste this ENTIRE script into the query editor workspace.
-- 5. Click the green "Run" button at the bottom right.
-- ==============================================================================

-- 1. Rename existing gateways table to backup and preserve current configurations
ALTER TABLE IF EXISTS public.gateways RENAME TO gateways_old;

-- 2. Create the new profiles table (One row per user tracking billing plan tier)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text NOT NULL,
  paid boolean DEFAULT false NOT NULL,
  plan_tier text DEFAULT 'free' NOT NULL, -- 'free', 'startup', 'growth', 'scale', 'enterprise'
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the new relational gateways table (One-to-Many configurations per user)
CREATE TABLE IF NOT EXISTS public.gateways (
  gateway_id text NOT NULL PRIMARY KEY, -- e.g. 'ae_live_a8f9c2'
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL, -- e.g. 'Chatbot - Staging'
  active_model text DEFAULT 'claude-sonnet' NOT NULL,
  encrypted_api_key text,
  cached_prefix text, -- AES-256-GCM encrypted system prompt for keep-warm replay
  protection_active boolean DEFAULT true NOT NULL,
  total_requests int8 DEFAULT 0 NOT NULL,
  prompt_tokens int8 DEFAULT 0 NOT NULL,
  cached_prompt_tokens int8 DEFAULT 0 NOT NULL,
  cost_without_caching numeric DEFAULT 0.0 NOT NULL,
  cost_with_caching numeric DEFAULT 0.0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Profiles
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. Create RLS Policies for Gateways
DROP POLICY IF EXISTS "Allow users to read their own gateways" ON public.gateways;
CREATE POLICY "Allow users to read their own gateways" ON public.gateways FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own gateways" ON public.gateways;
CREATE POLICY "Allow users to insert their own gateways" ON public.gateways FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update their own gateways" ON public.gateways;
CREATE POLICY "Allow users to update their own gateways" ON public.gateways FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own gateways" ON public.gateways;
CREATE POLICY "Allow users to delete their own gateways" ON public.gateways FOR DELETE USING (auth.uid() = user_id);

-- 6. Migrate existing users from gateways_old to public.profiles (Safe check for old column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'gateways_old' AND column_name = 'id'
  ) THEN
    INSERT INTO public.profiles (id, email, paid, plan_tier)
    SELECT id, email, paid, CASE WHEN paid THEN 'growth' ELSE 'free' END
    FROM public.gateways_old
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Also seed any remaining auth users who didn't have profiles
INSERT INTO public.profiles (id, email, paid, plan_tier)
SELECT id, email, false, 'free'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 7. Migrate existing gateway configurations, generating a unique ID if missing (Dynamic compilation to prevent syntax errors)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gateways_old') THEN
    
    -- Scenario A: gateways_old is in the old schema format (contains column 'id')
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'gateways_old' AND column_name = 'id'
    ) THEN
      EXECUTE '
        INSERT INTO public.gateways (gateway_id, user_id, name, active_model, encrypted_api_key, protection_active)
        SELECT 
          ''ae_live_'' || substring(md5(random()::text) from 1 for 6),
          id,
          ''Default Gateway'',
          active_model,
          encrypted_api_key,
          protection_active
        FROM public.gateways_old
        ON CONFLICT (gateway_id) DO NOTHING;
      ';
      
    -- Scenario B: gateways_old is in the new schema format (contains column 'gateway_id' from a repeat run)
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'gateways_old' AND column_name = 'gateway_id'
    ) THEN
      
      -- Sub-scenario B1: gateways_old already has telemetry columns (e.g. 'total_requests')
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'gateways_old' AND column_name = 'total_requests'
      ) THEN
        EXECUTE '
          INSERT INTO public.gateways (
            gateway_id, user_id, name, active_model, encrypted_api_key, protection_active,
            total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching,
            created_at, updated_at
          )
          SELECT 
            gateway_id, user_id, name, active_model, encrypted_api_key, protection_active,
            total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching,
            created_at, updated_at
          FROM public.gateways_old
          ON CONFLICT (gateway_id) DO NOTHING;
        ';
      -- Sub-scenario B2: gateways_old is in the new format but lacks telemetry columns
      ELSE
        EXECUTE '
          INSERT INTO public.gateways (
            gateway_id, user_id, name, active_model, encrypted_api_key, protection_active,
            total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching,
            created_at, updated_at
          )
          SELECT 
            gateway_id, user_id, name, active_model, encrypted_api_key, protection_active,
            0, 0, 0, 0.0, 0.0,
            created_at, updated_at
          FROM public.gateways_old
          ON CONFLICT (gateway_id) DO NOTHING;
        ';
      END IF;
      
    END IF;
    
  END IF;
END $$;

-- 8. Clean up backup table (Safe to drop now since we migrated configs)
DROP TABLE IF EXISTS public.gateways_old;

-- 9. Create/update Postgres Signup Trigger to automatically seed profile on account signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_gateway_id text;
BEGIN
  INSERT INTO public.profiles (id, email, paid, plan_tier)
  VALUES (new.id, new.email, false, 'free');
  
  -- Generate a random unique 6-character hex suffix for their default gateway
  new_gateway_id := 'ae_live_' || substring(md5(random()::text) from 1 for 6);
  
  -- Create a default gateway for the new user automatically
  INSERT INTO public.gateways (gateway_id, user_id, name, active_model, protection_active)
  VALUES (
    new_gateway_id,
    new.id,
    'Default Gateway',
    'claude-sonnet',
    true
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 10. Live Cost Telemetry Columns Migration (for existing tables)
-- ==============================================================================
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS total_requests int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS prompt_tokens int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cached_prompt_tokens int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cost_without_caching numeric DEFAULT 0.0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cost_with_caching numeric DEFAULT 0.0 NOT NULL;
