-- RBRANDR Portal security hardening
-- Run this in Supabase SQL Editor before making the buckets private in production.

-- Clients update their profile through /api/profile. Do not let browser-side
-- PostgREST updates change role, service level, or other privileged columns.
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Client content mutations are authorised and field-limited by /api/content.
-- This prevents a user from directly changing titles, files, schedules, or
-- publishing state through the browser's Supabase client.
drop policy if exists "Clients can update content status/feedback" on public.content_items;
revoke insert, update, delete on public.content_items from anon, authenticated;

-- Storage object URLs must not be bearer credentials. These policies scope
-- private files to the project encoded as the first path segment.
create or replace function public.has_project_access(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = project_uuid
      and (
        project.client_id = auth.uid()
        or exists (
          select 1 from public.project_members member
          where member.project_id = project.id and member.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles profile
          where profile.id = auth.uid() and profile.role = 'admin'
        )
      )
  );
$$;

revoke all on function public.has_project_access(uuid) from public;
grant execute on function public.has_project_access(uuid) to authenticated;

drop policy if exists "Authenticated users can read contracts" on storage.objects;
drop policy if exists "Authenticated users can read reports" on storage.objects;
drop policy if exists "Authenticated users can read documents" on storage.objects;
drop policy if exists "Authenticated users can upload documents" on storage.objects;

create policy "Project members can read private portal files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('contracts', 'reports', 'documents')
    and public.has_project_access(((storage.foldername(name))[1])::uuid)
  );

update storage.buckets
set public = false
where id in ('contracts', 'reports', 'documents');
