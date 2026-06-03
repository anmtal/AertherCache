-- ==============================================================================
-- AETHERCACHE MIGRATION: MULTIPLE CACHED PROMPTS & PER-PROMPT ANALYTICS
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Repeat-Run Resilience: 100% safe to run multiple times.
-- ==============================================================================

-- 1. Create the cached_prompts table if it does not exist
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

-- Create a unique constraint index to prevent duplicate entries of the same prompt on a gateway
CREATE UNIQUE INDEX IF NOT EXISTS unique_gateway_prompt ON public.cached_prompts(gateway_id, prompt_hash);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.cached_prompts ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Access Rules
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

-- 4. Define the atomic telemetry sync function
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

-- 5. Fallback Migration: Seed the cached_prompts table with any legacy gateways.cached_prefix values
DO $$
DECLARE
  gw RECORD;
  new_prompt_hash text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'gateways' AND column_name = 'cached_prefix'
  ) THEN
    FOR gw IN 
      SELECT gateway_id, cached_prefix, total_requests, prompt_tokens, cached_prompt_tokens, cost_without_caching, cost_with_caching, updated_at
      FROM public.gateways
      WHERE cached_prefix IS NOT NULL AND cached_prefix != ''
    LOOP
      new_prompt_hash := md5(gw.cached_prefix);
      
      INSERT INTO public.cached_prompts (
        gateway_id, prompt_hash, encrypted_prompt, total_requests, prompt_tokens, cached_prompt_tokens,
        cost_without_caching, cost_with_caching, last_used_at, created_at
      )
      VALUES (
        gw.gateway_id, new_prompt_hash, gw.cached_prefix, gw.total_requests, gw.prompt_tokens, gw.cached_prompt_tokens,
        gw.cost_without_caching, gw.cost_with_caching, gw.updated_at, gw.updated_at
      )
      ON CONFLICT (gateway_id, prompt_hash) DO NOTHING;
    END LOOP;
  END IF;
END $$;
