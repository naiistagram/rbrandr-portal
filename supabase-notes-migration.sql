-- Shared notes between admins and client project members.
-- Run this in the Supabase SQL editor after the existing portal schema.

create table if not exists public.portal_notes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_note_comments (
  id uuid primary key default uuid_generate_v4(),
  note_id uuid references public.portal_notes(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists portal_notes_project_updated_idx
  on public.portal_notes (project_id, updated_at desc);
create index if not exists portal_note_comments_note_created_idx
  on public.portal_note_comments (note_id, created_at asc);

alter table public.portal_notes enable row level security;
alter table public.portal_note_comments enable row level security;

drop policy if exists "Project members can view portal notes" on public.portal_notes;
create policy "Project members can view portal notes"
  on public.portal_notes for select
  using (
    exists (select 1 from public.projects where id = project_id and client_id = auth.uid())
    or exists (select 1 from public.project_members where project_id = portal_notes.project_id and user_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Project members can view portal note comments" on public.portal_note_comments;
create policy "Project members can view portal note comments"
  on public.portal_note_comments for select
  using (
    exists (
      select 1 from public.portal_notes n
      join public.projects p on p.id = n.project_id
      where n.id = portal_note_comments.note_id
        and (p.client_id = auth.uid() or exists (
          select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid()
        ))
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop trigger if exists portal_notes_updated_at on public.portal_notes;
create trigger portal_notes_updated_at
  before update on public.portal_notes
  for each row execute function public.handle_updated_at();
