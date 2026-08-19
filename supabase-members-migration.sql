-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Multi-member client portals + CEO-only contracts
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add client_role and job_title to profiles
--    'ceo'    = primary account holder, can see everything including contracts
--    'member' = additional team member, cannot see contracts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_role text NOT NULL DEFAULT 'ceo'
  CHECK (client_role IN ('ceo', 'member'));

-- job_title is a display label for team members (e.g. "Marketing Manager", "Designer")
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create project_members table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all memberships
CREATE POLICY "Admins can manage project_members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Members can see their own memberships (needed for portal queries)
CREATE POLICY "Users can view own memberships"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper function: is_project_member(project_id)
--    Returns true if the calling user owns the project OR is a member of it.
--    Used by all child-table RLS policies below.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND client_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update projects SELECT policy to allow members to see the project row
--    (needed so client-side queries can find their project IDs)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
CREATE POLICY "Clients can view own projects"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update child-table policies to allow project members access
--    Contracts stays CEO-only (project owner = client_id only).
--    Everything else is open to all members.
-- ─────────────────────────────────────────────────────────────────────────────

-- ASSETS
DROP POLICY IF EXISTS "Project members can manage assets" ON public.assets;
CREATE POLICY "Project members can manage assets"
  ON public.assets FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- CONTENT ITEMS
DROP POLICY IF EXISTS "Project members can view content" ON public.content_items;
DROP POLICY IF EXISTS "Clients can update content status/feedback" ON public.content_items;
DROP POLICY IF EXISTS "Clients can create content requests" ON public.content_items;
DROP POLICY IF EXISTS "Admins can manage all content" ON public.content_items;

CREATE POLICY "Project members can manage content"
  ON public.content_items FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DOCUMENTS
DROP POLICY IF EXISTS "Project members can manage documents" ON public.documents;
CREATE POLICY "Project members can manage documents"
  ON public.documents FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- FORMS
DROP POLICY IF EXISTS "Project clients can view and fill forms" ON public.forms;
CREATE POLICY "Project members can view and fill forms"
  ON public.forms FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- REPORTS
DROP POLICY IF EXISTS "Project clients can view reports" ON public.reports;
CREATE POLICY "Project members can view reports"
  ON public.reports FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- MILESTONES
DROP POLICY IF EXISTS "Project clients can view milestones" ON public.milestones;
CREATE POLICY "Project members can view milestones"
  ON public.milestones FOR ALL
  USING (
    public.is_project_member(project_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- CONTRACTS: unchanged — only the project owner (CEO) + admins can access
-- The existing policy already enforces: projects.client_id = auth.uid() OR admin
-- No change needed here.

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. After running this:
-- 1. Deploy the app code changes
-- 2. New clients created via the admin panel default to client_role = 'ceo'
-- 3. Members invited via the Members panel get client_role = 'member'
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SECURITY FIX: scope the "assets" storage bucket to project members.
--    Previously any authenticated user could read/overwrite/delete ANY client's
--    files in this bucket, since the policies only checked auth.role() =
--    'authenticated' and not which project the file belonged to. Files are keyed
--    as "{project_id}/{filename}", so we can check membership via that folder.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own assets" ON storage.objects;

CREATE POLICY "Project members can view assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets'
    AND (
      public.is_project_member(((storage.foldername(name))[1])::uuid)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Project members can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND (
      public.is_project_member(((storage.foldername(name))[1])::uuid)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Project members can delete own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets'
    AND (
      public.is_project_member(((storage.foldername(name))[1])::uuid)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BUG FIX: atomic ticket message append.
--    Both the client portal and the admin panel previously read the full
--    `messages` array into local state, appended to it in JS, and wrote the
--    whole array back. If a client and an admin replied at nearly the same
--    time, whichever write landed last silently overwrote the other's message.
--    This RPC appends inside a single UPDATE so concurrent replies can't
--    clobber each other. Existing "manage own tickets" RLS still applies since
--    this runs SECURITY INVOKER.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.append_ticket_message(p_ticket_id uuid, p_message jsonb)
RETURNS public.tickets
LANGUAGE sql
AS $$
  UPDATE public.tickets
  SET messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message)
  WHERE id = p_ticket_id
  RETURNING *;
$$;
