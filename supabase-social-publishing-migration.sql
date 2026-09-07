-- Social publishing connections and audit trail.
-- Run once in the Supabase SQL Editor before enabling the feature.

create table if not exists public.social_connections (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider in ('meta', 'linkedin')),
  platform text not null check (platform in ('Facebook', 'Instagram', 'LinkedIn')),
  account_id text not null,
  account_name text not null,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, platform, account_id)
);

alter table public.social_connections enable row level security;

create policy "Admins can manage social connections"
  on public.social_connections for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create table if not exists public.social_publish_attempts (
  id uuid primary key default uuid_generate_v4(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  platform text not null,
  status text not null check (status in ('pending', 'published', 'failed')),
  external_post_id text,
  external_post_url text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.social_publish_attempts enable row level security;

create policy "Admins can manage social publish attempts"
  on public.social_publish_attempts for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists social_connections_project_id_idx
  on public.social_connections(project_id);
create index if not exists social_publish_attempts_content_item_id_idx
  on public.social_publish_attempts(content_item_id, created_at desc);

-- A short-lived encrypted hand-off used while an admin picks the exact account
-- to attach after Meta returns the Pages they manage.
create table if not exists public.social_connection_candidates (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider in ('meta', 'linkedin')),
  encrypted_payload text not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.social_connection_candidates enable row level security;
create policy "Admins can manage social connection candidates"
  on public.social_connection_candidates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists social_connection_candidates_expiry_idx
  on public.social_connection_candidates(expires_at);

drop trigger if exists social_connections_updated_at on public.social_connections;
create trigger social_connections_updated_at
  before update on public.social_connections
  for each row execute function public.handle_updated_at();
