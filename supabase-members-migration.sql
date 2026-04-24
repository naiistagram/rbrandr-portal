-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Multi-member client portals + CEO-only contracts
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add client_role to profiles
--    'ceo'    = primary account holder, can see everything including contracts
--    'member' = additional team member, cannot see contracts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_role text NOT NULL DEFAULT 'ceo'
  CHECK (client_role IN ('ceo', 'member'));

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
