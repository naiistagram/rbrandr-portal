-- Daily social analytics retained independently of a connection's token.
-- Run this after supabase-social-publishing-migration.sql.

create table if not exists public.social_metric_snapshots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  provider text not null check (provider in ('meta', 'linkedin')),
  platform text not null check (platform in ('Facebook', 'Instagram', 'LinkedIn')),
  account_id text not null,
  metric text not null,
  metric_date date not null,
  value numeric not null check (value >= 0),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, platform, account_id, metric, metric_date)
);

alter table public.social_metric_snapshots enable row level security;

create policy "Admins can manage social metric snapshots"
  on public.social_metric_snapshots for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists social_metric_snapshots_project_date_idx
  on public.social_metric_snapshots(project_id, metric_date desc);

create table if not exists public.social_analytics_syncs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider in ('meta', 'linkedin')),
  status text not null check (status in ('success', 'partial', 'failed')),
  metrics_written integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);

alter table public.social_analytics_syncs enable row level security;

create policy "Admins can manage social analytics syncs"
  on public.social_analytics_syncs for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists social_analytics_syncs_project_created_idx
  on public.social_analytics_syncs(project_id, created_at desc);
