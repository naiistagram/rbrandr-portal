-- Scheduled publishing metadata. The client-facing approval status remains
-- "approved" until the portal successfully publishes the post.

alter table public.content_items
  add column if not exists publish_at timestamptz,
  add column if not exists publish_started_at timestamptz,
  add column if not exists publish_error text;

create index if not exists content_items_due_publish_idx
  on public.content_items (publish_at)
  where status = 'approved' and publish_at is not null and publish_started_at is null;
