-- Intrusion / data-theft hardening
-- 1) Stop unused QR token enumeration by non-admins
-- 2) Block direct asset INSERT; lock qr_code_id / created_by updates
-- 3) Tighten asset-photos storage path ownership
-- 4) Token lookup only via SECURITY DEFINER RPC

-- ---------------------------------------------------------------------------
-- get_qr_by_token: exact-token lookup for /q/[token] (no list harvest)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- qr_codes SELECT: admin sees all; others only assigned/retired (no unused tokens)
-- ---------------------------------------------------------------------------
drop policy if exists "qr_codes_select_authenticated" on public.qr_codes;

create policy "qr_codes_select_admin"
  on public.qr_codes for select to authenticated
  using (public.is_admin());

create policy "qr_codes_select_assigned_or_retired"
  on public.qr_codes for select to authenticated
  using (
    not public.is_admin()
    and status in ('assigned', 'retired')
  );

-- ---------------------------------------------------------------------------
-- assets: no client INSERT (creation only via SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------
drop policy if exists "assets_insert_authenticated" on public.assets;

revoke insert on table public.assets from authenticated;

-- Keep UPDATE policy but strip sensitive columns from client UPDATEs
revoke update on table public.assets from authenticated;
grant update (
  asset_no,
  name,
  asset_type,
  category,
  status,
  serial_no,
  manufacturer,
  model_name,
  location,
  department,
  assignee_name,
  notes,
  purchase_date,
  purchase_price,
  updated_by
) on table public.assets to authenticated;

-- SELECT remains for authenticated (org inventory); policy unchanged

-- ---------------------------------------------------------------------------
-- Storage: asset-photos path must start with auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists "asset_photos_storage_select" on storage.objects;
drop policy if exists "asset_photos_storage_insert" on storage.objects;
drop policy if exists "asset_photos_storage_delete" on storage.objects;

-- 조직 내 조회는 허용 (자산 상세 공유). 업로드 경로는 본인 uid 하위로 강제.
create policy "asset_photos_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'asset-photos');

create policy "asset_photos_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'asset-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "asset_photos_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'asset-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
