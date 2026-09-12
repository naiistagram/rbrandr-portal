-- RBRANDR Portal MFA enforcement
-- Run once in Supabase Dashboard → SQL Editor after enabling App Authenticator
-- (TOTP) under Authentication → Multi-Factor Authentication.
--
-- This policy applies to every existing application table and to storage. It
-- requires an AAL2 JWT, so bypassing the portal UI cannot bypass MFA.

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity
  loop
    execute format('drop policy if exists "MFA required" on public.%I', table_name);
    execute format(
      'create policy "MFA required" on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'') with check ((select auth.jwt()->>''aal'') = ''aal2'')',
      table_name
    );
  end loop;
end $$;

drop policy if exists "MFA required" on storage.objects;
create policy "MFA required"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
