-- A short, per-content-item message from the admin for client review.
-- Run this in the Supabase SQL editor after the existing portal schema.

alter table public.content_items
  add column if not exists review_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_items_review_note_length_check'
  ) then
    alter table public.content_items
      add constraint content_items_review_note_length_check
      check (review_note is null or char_length(review_note) <= 5000);
  end if;
end;
$$;
