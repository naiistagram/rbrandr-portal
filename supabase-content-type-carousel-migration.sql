-- Allow carousel as a content type for existing projects.
alter table public.content_items drop constraint if exists content_items_content_type_check;
alter table public.content_items add constraint content_items_content_type_check
  check (content_type in ('post', 'story', 'reel', 'carousel', 'ad', 'email', 'blog', 'other'));
