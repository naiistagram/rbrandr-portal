-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Time of day for scheduled content
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
--
-- content_items.scheduled_date is a `date` column with no time component.
-- Adds a separate nullable `scheduled_time` text column (stored as "HH:MM",
-- 24-hour) rather than converting scheduled_date to a timestamp — avoids any
-- timezone reinterpretation of the ~50 existing scheduled_date values.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS scheduled_time text;
