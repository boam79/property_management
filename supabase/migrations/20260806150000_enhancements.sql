-- P0/P1 enhancements: QR unlink/retire, asset photos, admin role setter

-- ---------------------------------------------------------------------------
-- RPC: unlink asset ↔ QR (assigned → unused)
-- ---------------------------------------------------------------------------
create or replace function public.unlink_asset_from_qr(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_qr_id uuid;
begin
  if v_user is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ASSET_NOT_FOUND');
  end if;

  if v_asset.qr_code_id is null then
    return jsonb_build_object('ok', false, 'error', 'ASSET_NOT_LINKED');
  end if;

  v_qr_id := v_asset.qr_code_id;

  update public.qr_codes
  set status = 'unused', asset_id = null, assigned_at = null
  where id = v_qr_id and status = 'assigned';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_ASSIGNED');
  end if;

  update public.assets
  set qr_code_id = null, updated_by = v_user
  where id = p_asset_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user, 'asset.unlink_qr', 'asset', p_asset_id,
    jsonb_build_object('qr_id', v_qr_id)
  );

  return jsonb_build_object('ok', true, 'asset_id', p_asset_id, 'qr_id', v_qr_id);
end;
$$;

revoke all on function public.unlink_asset_from_qr(uuid) from public;
revoke all on function public.unlink_asset_from_qr(uuid) from anon;
grant execute on function public.unlink_asset_from_qr(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: retire QR (unused|assigned → retired; clears asset link if any)
-- ---------------------------------------------------------------------------
create or replace function public.retire_qr_code(p_qr_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.qr_codes%rowtype;
  v_asset_id uuid;
begin
  if v_user is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select * into v_qr from public.qr_codes where id = p_qr_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_FOUND');
  end if;

  if v_qr.status = 'retired' then
    return jsonb_build_object('ok', false, 'error', 'QR_ALREADY_RETIRED');
  end if;

  v_asset_id := v_qr.asset_id;

  if v_asset_id is not null then
    update public.assets
    set qr_code_id = null, updated_by = v_user
    where id = v_asset_id;
  end if;

  update public.qr_codes
  set status = 'retired', asset_id = null, assigned_at = null
  where id = p_qr_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user, 'qr.retire', 'qr', p_qr_id,
    jsonb_build_object(
      'previous_status', v_qr.status,
      'asset_id', v_asset_id,
      'display_code', v_qr.display_code
    )
  );

  return jsonb_build_object(
    'ok', true,
    'qr_id', p_qr_id,
    'previous_status', v_qr.status,
    'asset_id', v_asset_id
  );
end;
$$;

revoke all on function public.retire_qr_code(uuid) from public;
revoke all on function public.retire_qr_code(uuid) from anon;
grant execute on function public.retire_qr_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: admin set profile role (no self-change)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_profile_role(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_admin_count integer;
begin
  if v_user is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  if p_role not in ('REGISTER', 'ADMIN') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  end if;

  if p_user_id = v_user then
    return jsonb_build_object('ok', false, 'error', 'CANNOT_CHANGE_OWN_ROLE');
  end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;

  if v_target.role = 'ADMIN' and p_role = 'REGISTER' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'ADMIN';
    if v_admin_count <= 1 then
      return jsonb_build_object('ok', false, 'error', 'LAST_ADMIN');
    end if;
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user, 'profile.set_role', 'profile', p_user_id,
    jsonb_build_object(
      'from', v_target.role,
      'to', p_role,
      'display_name', v_target.display_name
    )
  );

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', p_role);
end;
$$;

revoke all on function public.admin_set_profile_role(uuid, text) from public;
revoke all on function public.admin_set_profile_role(uuid, text) from anon;
grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;

-- Allow admin RPC to change *other* users' roles (column grants still block clients)
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null
       or auth.uid() = new.id
       or not public.is_admin() then
      raise exception 'ROLE_CHANGE_FORBIDDEN';
    end if;
  end if;
  if new.id is distinct from old.id then
    raise exception 'PROFILE_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- asset_photos table
-- ---------------------------------------------------------------------------
create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists asset_photos_asset_id_idx
  on public.asset_photos (asset_id);

alter table public.asset_photos enable row level security;

drop policy if exists "asset_photos_select_auth" on public.asset_photos;
drop policy if exists "asset_photos_insert_auth" on public.asset_photos;
drop policy if exists "asset_photos_delete_admin" on public.asset_photos;

create policy "asset_photos_select_auth"
  on public.asset_photos for select to authenticated
  using (true);

create policy "asset_photos_insert_auth"
  on public.asset_photos for insert to authenticated
  with check (created_by = auth.uid());

create policy "asset_photos_delete_admin"
  on public.asset_photos for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

grant select, insert, delete on table public.asset_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket: asset-photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-photos',
  'asset-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "asset_photos_storage_select" on storage.objects;
drop policy if exists "asset_photos_storage_insert" on storage.objects;
drop policy if exists "asset_photos_storage_delete" on storage.objects;

create policy "asset_photos_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'asset-photos');

create policy "asset_photos_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'asset-photos');

create policy "asset_photos_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'asset-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
