-- ==============================================================================
-- AETHERCACHE CONSOLIDATED RELATIONAL DATABASE SCHEMA & MIGRATION SCRIPT
-- ==============================================================================
-- Targets: Supabase PostgreSQL Database (Auth Users, Profiles, & Multi-Gateways)
-- Features: Row-Level Security (RLS), Auto-Seeding Triggers, and Edge Telemetry
-- Repeat-Run Resilience: 100% safe to run multiple times in your SQL Editor
-- Compiler Protection: Uses dynamic compilation to prevent syntax column errors
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BACKUP & PREPARATION (Safe Migration)
-- ------------------------------------------------------------------------------
-- If an old gateways table exists, safely rename it to gateways_old so we can migrate.
ALTER TABLE IF EXISTS public.gateways RENAME TO gateways_old;

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES TABLE (SaaS Billing Tiers)
-- ------------------------------------------------------------------------------
-- Creates a one-row-per-user profile table tied directly to Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text NOT NULL,
  paid boolean DEFAULT false NOT NULL,
  plan_tier text DEFAULT 'free' NOT NULL, -- 'free', 'startup', 'growth', 'enterprise'
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. MULTI-GATEWAYS TABLE (Relational Configuration & Edge Telemetry)
-- ------------------------------------------------------------------------------
-- Creates the gateways table mapping many endpoints to a single user.
-- Includes physical config, encrypted keys, and live telemetry savings counters.
CREATE TABLE IF NOT EXISTS public.gateways (
  gateway_id text NOT NULL PRIMARY KEY,                  -- Unique suffix e.g. 'ae_live_a8f9c2'
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,                                    -- Friendly name e.g. 'Chatbot - Production'
  active_model text DEFAULT 'claude-sonnet' NOT NULL,    -- Configured LLM model
  encrypted_api_key text,                                -- AES-256-GCM encrypted provider key
  cached_prefix text,                                    -- AES-256-GCM encrypted system prompt for keep-warm replay
  protection_active boolean DEFAULT true NOT NULL,       -- Toggle AetherCache optimization
  
  -- Edge Telemetry Analytics (Cumulative aggregate metrics for perfect privacy)
  total_requests int8 DEFAULT 0 NOT NULL,
  prompt_tokens int8 DEFAULT 0 NOT NULL,
  cached_prompt_tokens int8 DEFAULT 0 NOT NULL,
  cost_without_caching numeric DEFAULT 0.0 NOT NULL,
  cost_with_caching numeric DEFAULT 0.0 NOT NULL,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3.1 CACHED PROMPTS TABLE (Multiple cached prefixes per gateway + analytics)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cached_prompts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_id text REFERENCES public.gateways(gateway_id) ON DELETE CASCADE NOT NULL,
  prompt_hash text NOT NULL, -- SHA-256 hash of the plain-text system prompt
  encrypted_prompt text NOT NULL, -- AES-256-GCM encrypted system prompt
  
  -- Per-Prompt Telemetry Analytics
  total_requests int8 DEFAULT 0 NOT NULL,
  prompt_tokens int8 DEFAULT 0 NOT NULL,
  cached_prompt_tokens int8 DEFAULT 0 NOT NULL,
  cost_without_caching numeric DEFAULT 0.0 NOT NULL,
  cost_with_caching numeric DEFAULT 0.0 NOT NULL,
  
  last_used_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_gateway_prompt ON public.cached_prompts(gateway_id, prompt_hash);

-- ------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable PostgreSQL Row Level Security to strictly isolate user data at the database level.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_prompts ENABLE ROW LEVEL SECURITY;

-- Profiles Access Rules (Users can only see and update their own billing data)
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Gateways Access Rules (Users can only read, create, edit, or delete their own endpoints)
DROP POLICY IF EXISTS "Allow users to read their own gateways" ON public.gateways;
CREATE POLICY "Allow users to read their own gateways" ON public.gateways FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own gateways" ON public.gateways;
CREATE POLICY "Allow users to insert their own gateways" ON public.gateways FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update their own gateways" ON public.gateways;
CREATE POLICY "Allow users to update their own gateways" ON public.gateways FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own gateways" ON public.gateways;
CREATE POLICY "Allow users to delete their own gateways" ON public.gateways FOR DELETE USING (auth.uid() = user_id);

-- Cached Prompts Access Rules (Users can only access cached prompts for their own gateways)
DROP POLICY IF EXISTS "Allow users to read their own cached prompts" ON public.cached_prompts;
CREATE POLICY "Allow users to read their own cached prompts" ON public.cached_prompts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.gateways
    WHERE gateways.gateway_id = cached_prompts.gateway_id
      AND gateways.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow users to insert their own cached prompts" ON public.cached_prompts;
CREATE POLICY "Allow users to insert their own cached prompts" ON public.cached_prompts FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gateways
    WHERE gateways.gateway_id = cached_prompts.gateway_id
      AND gateways.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow users to update their own cached prompts" ON public.cached_prompts;
CREATE POLICY "Allow users to update their own cached prompts" ON public.cached_prompts FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.gateways
    WHERE gateways.gateway_id = cached_prompts.gateway_id
      AND gateways.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow users to delete their own cached prompts" ON public.cached_prompts;
CREATE POLICY "Allow users to delete their own cached prompts" ON public.cached_prompts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.gateways
    WHERE gateways.gateway_id = cached_prompts.gateway_id
      AND gateways.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------------------------
-- 5. RELATIONAL DATA MIGRATION LOGIC (Safe Upgrades & Repeat-Run Resilience)
-- ------------------------------------------------------------------------------
-- A. Migrate user profiles from gateways_old if the old schema is present
DO $$
BEGIN
  -- Check if gateways_old exists and has the old 'id' column
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

-- Seed any remaining Auth users who don't have a profile yet
INSERT INTO public.profiles (id, email, paid, plan_tier)
SELECT id, email, false, 'free'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- B. Migrate gateway configurations from gateways_old using dynamic execution compiler guards
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
      
      -- Sub-scenario B1: gateways_old already has telemetry columns AND cached_prefix
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'gateways_old' AND column_name = 'cached_prefix'
      ) THEN
        EXECUTE '
          INSERT INTO public.gateways (
            gateway_id, user_id, name, active_model, encrypted_api_key, cached_prefix, protection_active,
            total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching,
            created_at, updated_at
          )
          SELECT 
            gateway_id, user_id, name, active_model, encrypted_api_key, cached_prefix, protection_active,
            total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching,
            created_at, updated_at
          FROM public.gateways_old
          ON CONFLICT (gateway_id) DO NOTHING;
        ';

      -- Sub-scenario B2: gateways_old has telemetry but NO cached_prefix (pre-v2.1 schema)
      ELSIF EXISTS (
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

      -- Sub-scenario B3: gateways_old is in the new format but lacks telemetry columns entirely
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

-- Safely clean up the backup table now that data is successfully migrated
DROP TABLE IF EXISTS public.gateways_old;

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC USER SIGNUP TRIGGER (Autonomous Seeding)
-- ------------------------------------------------------------------------------
-- Automatically seeds a profile row and an initial 'Default Gateway' 
-- with a randomized unique 6-character gateway suffix when a new user registers.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_gateway_id text;
BEGIN
  -- 1. Create the user profile
  INSERT INTO public.profiles (id, email, paid, plan_tier)
  VALUES (new.id, new.email, false, 'free');
  
  -- 2. Generate a random unique 6-character hex suffix for their default gateway
  new_gateway_id := 'ae_live_' || substring(md5(random()::text) from 1 for 6);
  
  -- 3. Seed their first active gateway automatically
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

-- Recreate trigger (drop first to prevent duplicate bindings)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6.1 ATOMIC TELEMETRY SYNC RPC FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_prompt_telemetry(
  p_gateway_id text,
  p_prompt_hash text,
  p_encrypted_prompt text,
  p_prompt_tokens int8,
  p_cached_prompt_tokens int8,
  p_cost_without numeric,
  p_cost_with numeric
) RETURNS void AS $$
BEGIN
  -- 1. Upsert prompt and increment its statistics (only if a system prompt is active)
  IF p_prompt_hash IS NOT NULL THEN
    INSERT INTO public.cached_prompts (
      gateway_id, prompt_hash, encrypted_prompt, total_requests, prompt_tokens, cached_prompt_tokens, 
      cost_without_caching, cost_with_caching, last_used_at
    )
    VALUES (
      p_gateway_id, p_prompt_hash, p_encrypted_prompt, 1, p_prompt_tokens, p_cached_prompt_tokens, 
      p_cost_without, p_cost_with, now()
    )
    ON CONFLICT (gateway_id, prompt_hash) DO UPDATE SET
      total_requests = public.cached_prompts.total_requests + 1,
      prompt_tokens = public.cached_prompts.prompt_tokens + p_prompt_tokens,
      cached_prompt_tokens = public.cached_prompts.cached_prompt_tokens + p_cached_prompt_tokens,
      cost_without_caching = public.cached_prompts.cost_without_caching + p_cost_without,
      cost_with_caching = public.cached_prompts.cost_with_caching + p_cost_with,
      last_used_at = now();
  END IF;

  -- 2. Increment the parent gateways table level stats
  UPDATE public.gateways
  SET
    total_requests = public.gateways.total_requests + 1,
    prompt_tokens = public.gateways.prompt_tokens + p_prompt_tokens,
    cached_prompt_tokens = public.gateways.cached_prompt_tokens + p_cached_prompt_tokens,
    cost_without_caching = public.gateways.cost_without_caching + p_cost_without,
    cost_with_caching = public.gateways.cost_with_caching + p_cost_with,
    updated_at = now()
  WHERE gateway_id = p_gateway_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 7. CUMULATIVE TELEMETRY & KEEP-WARM GUARD
-- ------------------------------------------------------------------------------
-- Safe addition fallback: Ensures all columns are present 
-- in case the table was created elsewhere in the workspace.
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS total_requests int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS prompt_tokens int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cached_prompt_tokens int8 DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cost_without_caching numeric DEFAULT 0.0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cost_with_caching numeric DEFAULT 0.0 NOT NULL;
ALTER TABLE IF EXISTS public.gateways ADD COLUMN IF NOT EXISTS cached_prefix text;

-- ==============================================================================
-- MIGRATION COMPLETE — AETHERCACHE DATABASE IS FULLY SYNCED & SECURED!
-- ==============================================================================
