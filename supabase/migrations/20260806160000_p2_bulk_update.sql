-- P2: bulk asset update RPC

create or replace function public.bulk_update_assets(
  p_asset_ids uuid[],
  p_status text default null,
  p_location text default null,
  p_department text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_before public.assets%rowtype;
  v_count integer := 0;
  v_changes jsonb;
begin
  if v_user is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  if p_asset_ids is null or coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_IDS');
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) > 100 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY');
  end if;

  if p_status is null and p_location is null and p_department is null then
    return jsonb_build_object('ok', false, 'error', 'NO_CHANGES');
  end if;

  if p_status is not null and p_status not in ('IN_USE', 'IN_STOCK', 'REPAIR', 'DISPOSED') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  end if;

  if p_status in ('REPAIR', 'DISPOSED') and nullif(trim(coalesce(p_reason, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;

  foreach v_id in array p_asset_ids
  loop
    select * into v_before from public.assets where id = v_id for update;
    if not found then
      continue;
    end if;

    v_changes := '{}'::jsonb;

    update public.assets
    set
      status = coalesce(p_status, status),
      location = case when p_location is null then location else nullif(trim(p_location), '') end,
      department = case when p_department is null then department else nullif(trim(p_department), '') end,
      notes = case
        when nullif(trim(coalesce(p_reason, '')), '') is null then notes
        when notes is null or notes = '' then trim(p_reason)
        else notes || E'\n' || trim(p_reason)
      end,
      updated_by = v_user
    where id = v_id;

    if p_status is not null and p_status is distinct from v_before.status then
      v_changes := v_changes || jsonb_build_object(
        'status', jsonb_build_object('from', v_before.status, 'to', p_status)
      );
    end if;
    if p_location is not null and nullif(trim(p_location), '') is distinct from v_before.location then
      v_changes := v_changes || jsonb_build_object(
        'location', jsonb_build_object('from', v_before.location, 'to', nullif(trim(p_location), ''))
      );
    end if;
    if p_department is not null and nullif(trim(p_department), '') is distinct from v_before.department then
      v_changes := v_changes || jsonb_build_object(
        'department', jsonb_build_object('from', v_before.department, 'to', nullif(trim(p_department), ''))
      );
    end if;

    if v_changes <> '{}'::jsonb or nullif(trim(coalesce(p_reason, '')), '') is not null then
      insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
      values (
        v_user,
        'asset.bulk_update',
        'asset',
        v_id,
        jsonb_build_object('changes', v_changes, 'reason', p_reason)
      );
    end if;

    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user,
    'asset.bulk_update_batch',
    'asset',
    null,
    jsonb_build_object(
      'count', v_count,
      'status', p_status,
      'location', p_location,
      'department', p_department,
      'reason', p_reason
    )
  );

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

revoke all on function public.bulk_update_assets(uuid[], text, text, text, text) from public;
revoke all on function public.bulk_update_assets(uuid[], text, text, text, text) from anon;
grant execute on function public.bulk_update_assets(uuid[], text, text, text, text) to authenticated;
