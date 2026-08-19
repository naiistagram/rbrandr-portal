-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Multi-platform content items
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
--
-- content_items.platform was a single text column, so a content item could
-- only ever be tagged with one platform. This adds a `platforms` array
-- column and backfills it from the existing single-platform data. The old
-- `platform` column is left in place (unused by the app after this migration
-- ships) rather than dropped, so this migration is non-destructive.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}';

UPDATE public.content_items
SET platforms = ARRAY[platform]
WHERE platform IS NOT NULL AND platform <> '' AND platforms = '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. After running this, deploy the app code changes that read/write
-- `platforms` instead of `platform`.
-- ─────────────────────────────────────────────────────────────────────────────
