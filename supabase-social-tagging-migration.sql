-- Social tagging: a directory of taggable people/companies and a record of
-- every Instagram photo tag and LinkedIn mention placed on content.
-- Run once in the Supabase SQL Editor before enabling the feature.

create table if not exists public.social_people (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null check (char_length(display_name) between 1 and 120),
  kind text not null default 'person' check (kind in ('person', 'organization')),
  -- Instagram handle without the @. Only public accounts can be photo-tagged.
  instagram_username text check (instagram_username is null or instagram_username ~ '^[A-Za-z0-9._]{1,30}$'),
  -- urn:li:person:{id} (from the person connecting LinkedIn) or urn:li:organization:{id}.
  linkedin_urn text check (linkedin_urn is null or linkedin_urn ~ '^urn:li:(person|organization):[A-Za-z0-9_-]+$'),
  -- The exact LinkedIn display name. Mentions only link when this matches LinkedIn.
  linkedin_name text,
  linkedin_connected_at timestamptz,
  -- Set when the person is a portal user, so they can manage their own handles.
  profile_id uuid unique references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_people enable row level security;

drop policy if exists "Admins can manage social people" on public.social_people;
create policy "Admins can manage social people"
  on public.social_people for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop trigger if exists social_people_updated_at on public.social_people;
create trigger social_people_updated_at
  before update on public.social_people
  for each row execute function public.handle_updated_at();

create table if not exists public.content_tags (
  id uuid primary key default uuid_generate_v4(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  -- Kept as null if the person is later removed, so tag history survives.
  social_person_id uuid references public.social_people(id) on delete set null,
  platform text not null check (platform in ('Instagram', 'LinkedIn')),
  -- Instagram photo-tag position, as a fraction of the image (0 = left/top).
  media_index integer not null default 0 check (media_index >= 0),
  x numeric(5,4) check (x is null or (x >= 0 and x <= 1)),
  y numeric(5,4) check (y is null or (y >= 0 and y <= 1)),
  -- Snapshots of what was actually sent, in case the person record changes.
  display_name text not null,
  handle text,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  external_post_id text,
  error_message text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_tags_unique_person_platform
  on public.content_tags(content_item_id, social_person_id, platform)
  where social_person_id is not null;
create index if not exists content_tags_person_idx
  on public.content_tags(social_person_id, created_at desc);

alter table public.content_tags enable row level security;

drop policy if exists "Admins can manage content tags" on public.content_tags;
create policy "Admins can manage content tags"
  on public.content_tags for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop trigger if exists content_tags_updated_at on public.content_tags;
create trigger content_tags_updated_at
  before update on public.content_tags
  for each row execute function public.handle_updated_at();
