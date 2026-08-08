-- Add MEDICAL (의료장비) asset type

alter table public.assets
  drop constraint if exists assets_asset_type_check;

alter table public.assets
  add constraint assets_asset_type_check
  check (asset_type in ('GENERAL', 'IT', 'MEDICAL'));

create or replace function public.assign_qr_and_create_asset(
  p_token uuid,
  p_asset_no text,
  p_name text,
  p_asset_type text,
  p_category text,
  p_status text,
  p_serial_no text default null,
  p_manufacturer text default null,
  p_model_name text default null,
  p_location text default null,
  p_department text default null,
  p_assignee_name text default null,
  p_notes text default null,
  p_purchase_date date default null,
  p_purchase_price numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.qr_codes%rowtype;
  v_asset_id uuid;
  v_existing_asset_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED');
  end if;

  if p_asset_type not in ('GENERAL', 'IT', 'MEDICAL') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ASSET_TYPE');
  end if;

  if p_status not in ('IN_USE', 'IN_STOCK', 'REPAIR', 'DISPOSED') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  end if;

  select * into v_qr from public.qr_codes where token = p_token for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_FOUND');
  end if;

  if v_qr.status = 'retired' then
    return jsonb_build_object('ok', false, 'error', 'QR_RETIRED');
  end if;

  if v_qr.status = 'assigned' then
    return jsonb_build_object(
      'ok', false,
      'error', 'QR_ALREADY_ASSIGNED',
      'existing_asset_id', v_qr.asset_id
    );
  end if;

  update public.qr_codes
  set status = 'assigned', assigned_at = now()
  where id = v_qr.id and status = 'unused'
  returning * into v_qr;

  if not found then
    select asset_id into v_existing_asset_id
    from public.qr_codes where token = p_token;
    return jsonb_build_object(
      'ok', false,
      'error', 'QR_ALREADY_ASSIGNED',
      'existing_asset_id', v_existing_asset_id
    );
  end if;

  insert into public.assets (
    asset_no, name, asset_type, category, status,
    serial_no, manufacturer, model_name, location, department,
    assignee_name, notes, purchase_date, purchase_price,
    qr_code_id, created_by, updated_by
  ) values (
    p_asset_no, p_name, p_asset_type, p_category, p_status,
    nullif(p_serial_no, ''), p_manufacturer, p_model_name, p_location, p_department,
    p_assignee_name, p_notes, p_purchase_date, p_purchase_price,
    v_qr.id, v_user, v_user
  )
  returning id into v_asset_id;

  update public.qr_codes
  set asset_id = v_asset_id
  where id = v_qr.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user, 'asset.register_via_qr', 'asset', v_asset_id,
    jsonb_build_object('qr_id', v_qr.id, 'token', p_token)
  );

  return jsonb_build_object('ok', true, 'asset_id', v_asset_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_VALUE', 'detail', SQLERRM);
end;
$$;

create or replace function public.get_dashboard_stats(
  p_asset_type text default null,
  p_status text default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  with filtered as (
    select *
    from public.assets a
    where (p_asset_type is null or p_asset_type = '' or a.asset_type = p_asset_type)
      and (p_status is null or p_status = '' or a.status = p_status)
      and (
        p_location is null or p_location = ''
        or coalesce(a.location, '미지정') = p_location
      )
  ),
  summary as (
    select
      count(*)::int as total,
      count(*) filter (where asset_type = 'GENERAL')::int as general_count,
      count(*) filter (where asset_type = 'IT')::int as it_count,
      count(*) filter (where asset_type = 'MEDICAL')::int as medical_count,
      count(*) filter (where status = 'IN_USE')::int as in_use_count,
      count(*) filter (where status = 'REPAIR')::int as repair_count,
      count(*) filter (where qr_code_id is null)::int as unlinked_qr_count
    from filtered
  ),
  by_type as (
    select coalesce(jsonb_agg(jsonb_build_object('key', asset_type, 'count', c) order by asset_type), '[]'::jsonb) as data
    from (
      select asset_type, count(*)::int as c from filtered group by asset_type
    ) t
  ),
  by_status as (
    select coalesce(jsonb_agg(jsonb_build_object('key', status, 'count', c) order by status), '[]'::jsonb) as data
    from (
      select status, count(*)::int as c from filtered group by status
    ) t
  ),
  by_location as (
    select coalesce(jsonb_agg(jsonb_build_object('key', loc, 'count', c) order by c desc), '[]'::jsonb) as data
    from (
      select coalesce(nullif(location, ''), '미지정') as loc, count(*)::int as c
      from filtered
      group by 1
      order by c desc
      limit 10
    ) t
  ),
  by_qr_link as (
    select jsonb_build_array(
      jsonb_build_object('key', 'linked', 'count', (select count(*)::int from filtered where qr_code_id is not null)),
      jsonb_build_object('key', 'unlinked', 'count', (select count(*)::int from filtered where qr_code_id is null))
    ) as data
  ),
  daily_created as (
    select coalesce(jsonb_agg(jsonb_build_object('date', d::text, 'count', c) order by d), '[]'::jsonb) as data
    from (
      select date_trunc('day', created_at)::date as d, count(*)::int as c
      from filtered
      where created_at >= (now() - interval '30 days')
      group by 1
      order by 1
    ) t
  ),
  recent as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) as data
    from (
      select * from filtered order by created_at desc limit 10
    ) r
  )
  select jsonb_build_object(
    'total', s.total,
    'general_count', s.general_count,
    'it_count', s.it_count,
    'medical_count', s.medical_count,
    'in_use_count', s.in_use_count,
    'repair_count', s.repair_count,
    'unlinked_qr_count', s.unlinked_qr_count,
    'by_type', bt.data,
    'by_status', bs.data,
    'by_location', bl.data,
    'by_qr_link', bq.data,
    'daily_created', dc.data,
    'recent', r.data
  )
  into v_result
  from summary s, by_type bt, by_status bs, by_location bl, by_qr_link bq, daily_created dc, recent r;

  return v_result;
end;
$$;
