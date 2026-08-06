-- Security hardening against external intrusion via PostgREST/Data API
-- 1) Revoke PUBLIC/anon execute on SECURITY DEFINER RPCs
-- 2) Prevent privilege escalation via profiles.role self-update
-- 3) Fix mutable search_path on trigger function
-- 4) Tighten table grants for anon

-- ---------------------------------------------------------------------------
-- Function search_path
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Revoke broad EXECUTE; grant only what is needed
-- ---------------------------------------------------------------------------
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
revoke all on function public.is_admin() from authenticated;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.assign_qr_and_create_asset(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, numeric
) from public;
revoke all on function public.assign_qr_and_create_asset(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, numeric
) from anon;
grant execute on function public.assign_qr_and_create_asset(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, numeric
) to authenticated;

revoke all on function public.link_asset_to_qr(uuid, uuid) from public;
revoke all on function public.link_asset_to_qr(uuid, uuid) from anon;
grant execute on function public.link_asset_to_qr(uuid, uuid) to authenticated;

revoke all on function public.import_assets_batch(jsonb) from public;
revoke all on function public.import_assets_batch(jsonb) from anon;
grant execute on function public.import_assets_batch(jsonb) to authenticated;

revoke all on function public.get_dashboard_stats(text, text, text) from public;
revoke all on function public.get_dashboard_stats(text, text, text) from anon;
grant execute on function public.get_dashboard_stats(text, text, text) to authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

-- ---------------------------------------------------------------------------
-- profiles: block role self-escalation
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;

-- Authenticated users may only change display_name; role stays immutable via RLS
create policy "profiles_update_display_name_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Extra defense: column privileges (role/id/created_at not updatable by clients)
revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- anon must not have table DML (RLS already has no anon policies; revoke grants)
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon;
revoke all on table public.assets from anon;
revoke all on table public.qr_codes from anon;
revoke all on table public.qr_batches from anon;
revoke all on table public.import_jobs from anon;
revoke all on table public.import_rows from anon;
revoke all on table public.audit_logs from anon;

-- Ensure authenticated has expected privileges (Supabase defaults + our policies)
grant select, insert, update on table public.assets to authenticated;
grant select on table public.qr_codes to authenticated;
grant insert, update on table public.qr_codes to authenticated;
grant select, insert on table public.qr_batches to authenticated;
grant select, insert, update, delete on table public.import_jobs to authenticated;
grant select, insert, update, delete on table public.import_rows to authenticated;
grant select, insert on table public.audit_logs to authenticated;
grant select on table public.profiles to authenticated;

-- Block client deletes/truncates on sensitive tables
revoke delete, truncate on table public.assets from authenticated;
revoke delete, truncate on table public.qr_codes from authenticated;
revoke delete, truncate on table public.qr_batches from authenticated;
revoke delete, truncate on table public.profiles from authenticated;
revoke delete, truncate on table public.audit_logs from authenticated;
revoke truncate on table public.import_jobs from authenticated;
revoke truncate on table public.import_rows from authenticated;

-- ---------------------------------------------------------------------------
-- Harden is_admin: stable + fixed search_path (already set; recreate for clarity)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Block role/id mutation even if grants/policies regress
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'ROLE_CHANGE_FORBIDDEN';
  end if;
  if new.id is distinct from old.id then
    raise exception 'PROFILE_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

revoke all on function public.prevent_profile_role_change() from public;
revoke all on function public.prevent_profile_role_change() from anon;
revoke all on function public.prevent_profile_role_change() from authenticated;
