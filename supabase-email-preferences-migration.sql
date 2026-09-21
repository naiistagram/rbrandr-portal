ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opted_out boolean NOT NULL DEFAULT false;
