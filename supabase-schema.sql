-- ================================================================
-- rbrandr Client Portal — Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com > SQL Editor)
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- Runs server-side, bypasses RLS — works even when email confirmation
-- is enabled and the client has no active session at sign-up time.
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, company_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'company_name', ''),
    null,
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  avatar_url text,
  role text not null default 'client' check (role in ('admin', 'client')),
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Admin can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  service_type text not null default 'marketing' check (service_type in ('website', 'marketing', 'both')),
  goals text,
  competition text,
  kpis jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Clients can view own projects"
  on public.projects for select
  using (auth.uid() = client_id);

create policy "Admins can manage all projects"
  on public.projects for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- ASSETS
-- ─────────────────────────────────────────
create table public.assets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name text not null,
  file_url text not null,
  file_type text not null,
  file_size bigint not null,
  category text not null default 'other' check (category in ('logo', 'brand', 'template', 'other')),
  created_at timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "Project members can manage assets"
  on public.assets for all
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- CONTENT ITEMS
-- ─────────────────────────────────────────
create table public.content_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  content_type text not null default 'post' check (content_type in ('post', 'story', 'reel', 'ad', 'email', 'blog', 'other')),
  platform text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected', 'published')),
  scheduled_date date,
  file_urls text[],
  feedback text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_items enable row level security;

create policy "Project members can view content"
  on public.content_items for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Clients can update content status/feedback"
  on public.content_items for update
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
  );

create policy "Admins can manage all content"
  on public.content_items for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_items_updated_at
  before update on public.content_items
  for each row execute function public.handle_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────
-- CONTRACTS
-- ─────────────────────────────────────────
create table public.contracts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  file_url text not null,
  status text not null default 'pending' check (status in ('pending', 'signed', 'expired')),
  signature_data text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.contracts enable row level security;

create policy "Project clients can view and sign contracts"
  on public.contracts for all
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- FORMS
-- ─────────────────────────────────────────
create table public.forms (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  fields jsonb not null default '[]',
  responses jsonb,
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table public.forms enable row level security;

create policy "Project clients can view and submit forms"
  on public.forms for all
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  period text not null,
  file_url text not null,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Project clients can view reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id and client_id = auth.uid()
    )
  );

create policy "Admins can manage reports"
  on public.reports for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'general' check (type in ('content', 'contract', 'form', 'report', 'general')),
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can manage own notifications"
  on public.notifications for all
  using (auth.uid() = user_id);

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
-- Also enable realtime for content_items so status changes appear live
alter publication supabase_realtime add table public.content_items;

-- ─────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────
-- Run these separately in Supabase Storage UI or via API:
-- 1. Create bucket "avatars"  — public: true
-- 2. Create bucket "assets"   — public: true
-- 3. Create bucket "contracts" — public: false (private)
-- 4. Create bucket "reports"  — public: false (private)

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('assets', 'assets', true),
  ('contracts', 'contracts', false),
  ('reports', 'reports', false)
on conflict (id) do nothing;

-- Storage policies for avatars
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for assets
create policy "Authenticated users can view assets"
  on storage.objects for select
  using (bucket_id = 'assets' and auth.role() = 'authenticated');

create policy "Authenticated users can upload assets"
  on storage.objects for insert
  with check (bucket_id = 'assets' and auth.role() = 'authenticated');

create policy "Authenticated users can delete own assets"
  on storage.objects for delete
  using (bucket_id = 'assets' and auth.role() = 'authenticated');

-- Storage policies for contracts (authenticated read, admin write)
create policy "Authenticated users can read contracts"
  on storage.objects for select
  using (bucket_id = 'contracts' and auth.role() = 'authenticated');

create policy "Admins can upload contracts"
  on storage.objects for insert
  with check (bucket_id = 'contracts' and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Storage policies for reports (authenticated read, admin write)
create policy "Authenticated users can read reports"
  on storage.objects for select
  using (bucket_id = 'reports' and auth.role() = 'authenticated');

create policy "Admins can upload reports"
  on storage.objects for insert
  with check (bucket_id = 'reports' and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Storage policies for documents
create policy "Authenticated users can read documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Authenticated users can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- SCHEMA UPDATES (run after initial setup)
-- ─────────────────────────────────────────

-- Update projects service_type to support brand package
alter table public.projects
  drop constraint if exists projects_service_type_check;
alter table public.projects
  add constraint projects_service_type_check
  check (service_type in ('website', 'marketing', 'both', 'social_media', 'brand'));

-- Add type column to contracts for T&Cs vs contracts
alter table public.contracts
  add column if not exists type text not null default 'contract'
  check (type in ('contract', 'terms'));

-- Make contracts, reports, and documents buckets publicly readable via URL
update storage.buckets set public = true where id in ('contracts', 'reports', 'documents');

-- Add documents bucket (public so PDFs are viewable in iframe)
insert into storage.buckets (id, name, public) values
  ('documents', 'documents', true)
on conflict (id) do update set public = true;

-- ─────────────────────────────────────────
-- MILESTONES (project timeline for brand clients)
-- ─────────────────────────────────────────
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy "Project clients can view milestones"
  on public.milestones for select
  using (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can manage milestones"
  on public.milestones for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ─────────────────────────────────────────
-- TICKETS
-- ─────────────────────────────────────────
create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  submitted_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets enable row level security;

create policy "Project clients can manage own tickets"
  on public.tickets for all
  using (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  file_url text not null,
  file_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Project members can manage documents"
  on public.documents for all
  using (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─────────────────────────────────────────
-- FEEDBACK
-- ─────────────────────────────────────────
create table if not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  submitted_by uuid references public.profiles(id) on delete set null,
  rating int check (rating between 1 and 5),
  message text not null,
  category text not null default 'general' check (category in ('general', 'service', 'platform', 'other')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Project clients can submit feedback"
  on public.feedback for insert
  with check (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
  );

create policy "Admins can view all feedback"
  on public.feedback for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Clients can view own feedback"
  on public.feedback for select
  using (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
  );

-- ─────────────────────────────────────────
-- CRITICAL: MIGRATIONS — Run in Supabase SQL Editor
-- ─────────────────────────────────────────

-- 0a. Add brief jsonb column to projects (target audience, messaging, channels)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS brief jsonb;

-- 0b. Fix service_type constraint to include social_media + brand
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_service_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_service_type_check
  CHECK (service_type IN ('website', 'marketing', 'both', 'social_media', 'brand'));

-- 0c. Add file_urls to tickets so clients can attach screenshots/files
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS file_urls text[];

-- 0g. Add service_type to profiles (account-level, drives portal sidebar nav)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'social_media'
  CHECK (service_type IN ('website', 'marketing', 'both', 'social_media', 'brand'));

-- 0e. Add 'draft' to project status constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'draft'));

-- 0f. Add admin_response column to tickets (admin feedback on resolution)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS admin_response text;

-- 0d. Make documents bucket public (so PDFs can be viewed in browser iframe)
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- 1. Set your admin account's role to 'admin'
--    (All new users default to 'client' via the trigger above)
--    Replace the email below with your actual admin email:
UPDATE public.profiles SET role = 'admin' WHERE email = 'nai@rbrandr.com';

-- 2. Allow admins to insert notifications for any user
--    (Without this, admin cannot notify clients after uploading contracts/reports)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications'
    and policyname = 'Admins can insert notifications for any user'
  ) then
    execute $policy$
      create policy "Admins can insert notifications for any user"
        on public.notifications for insert
        with check (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
        )
    $policy$;
  end if;
end;
$$;

-- 3. Notify admins when a CLIENT changes content status
--    Uses security definer so it can insert notifications bypassing RLS
create or replace function public.notify_admins_on_content_change()
returns trigger as $$
declare
  changer_role text;
begin
  if old.status <> new.status then
    select role into changer_role from public.profiles where id = auth.uid();
    if changer_role = 'client' then
      insert into public.notifications (user_id, title, message, type, read, link)
      select
        p.id,
        'Content Feedback: ' || new.title,
        '"' || new.title || '" was marked as ' || replace(new.status, '_', ' '),
        'content',
        false,
        '/admin/clients'
      from public.profiles p
      where p.role = 'admin';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists content_status_change_notify on public.content_items;
create trigger content_status_change_notify
  after update of status on public.content_items
  for each row execute function public.notify_admins_on_content_change();
