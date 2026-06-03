-- Run this in Supabase SQL Editor to add the cached_prefix column
-- This column stores the AES-256-GCM encrypted system prompt for keep-warm replay

ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS cached_prefix text;
