-- Restrict unused QR token harvest by non-admins.
-- Exact-token lookup for /q/[token] via SECURITY DEFINER RPC.

create or replace function public.get_qr_by_token(p_token uuid)
returns setof public.qr_codes
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.qr_codes
  where token = p_token
  limit 1;
$$;

revoke all on function public.get_qr_by_token(uuid) from public;
revoke all on function public.get_qr_by_token(uuid) from anon;
grant execute on function public.get_qr_by_token(uuid) to authenticated;

drop policy if exists "qr_codes_select_authenticated" on public.qr_codes;
drop policy if exists "qr_codes_select_admin" on public.qr_codes;
drop policy if exists "qr_codes_select_assigned_or_retired" on public.qr_codes;

create policy "qr_codes_select_admin"
  on public.qr_codes for select to authenticated
  using (public.is_admin());

-- Non-admins: only assigned/retired rows (no unused token listing)
create policy "qr_codes_select_assigned_or_retired"
  on public.qr_codes for select to authenticated
  using (
    not public.is_admin()
    and status in ('assigned', 'retired')
  );
