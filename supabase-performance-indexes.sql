-- Run once in the Supabase SQL editor. These indexes match the portal's
-- common project-scoped filters and ordering, avoiding table scans as data grows.

CREATE INDEX IF NOT EXISTS project_members_user_id_idx
  ON public.project_members (user_id);
CREATE INDEX IF NOT EXISTS projects_client_id_created_at_idx
  ON public.projects (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_items_project_id_updated_at_idx
  ON public.content_items (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS forms_project_id_status_idx
  ON public.forms (project_id, status);
CREATE INDEX IF NOT EXISTS contracts_project_id_status_idx
  ON public.contracts (project_id, status);
CREATE INDEX IF NOT EXISTS tickets_project_id_status_idx
  ON public.tickets (project_id, status);
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);
