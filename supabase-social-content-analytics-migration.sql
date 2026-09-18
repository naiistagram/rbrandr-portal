-- Per-post performance for the Instagram-style top-content reporting blocks.
-- Run after supabase-social-analytics-migration.sql.

create table if not exists public.social_content_metrics (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  provider text not null check (provider in ('meta', 'linkedin')),
  platform text not null check (platform in ('Facebook', 'Instagram', 'LinkedIn')),
  account_id text not null,
  external_post_id text not null,
  content_type text not null check (content_type in ('post', 'reel', 'carousel', 'story')),
  title text not null,
  permalink text,
  thumbnail_url text,
  published_at timestamptz not null,
  views numeric not null default 0 check (views >= 0),
  reach numeric not null default 0 check (reach >= 0),
  interactions numeric not null default 0 check (interactions >= 0),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, platform, account_id, external_post_id)
);

alter table public.social_content_metrics enable row level security;

create policy "Admins can manage social content metrics"
  on public.social_content_metrics for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists social_content_metrics_project_published_idx
  on public.social_content_metrics(project_id, published_at desc);
