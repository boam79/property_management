-- QR Asset Manager MVP schema
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'REGISTER' check (role in ('REGISTER', 'ADMIN')),
  display_name text,
  created_at timestamptz not null default now()
);

create table public.qr_batches (
  id uuid primary key default gen_random_uuid(),
  quantity integer not null check (quantity > 0),
  label_format text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  display_code text not null unique,
  status text not null default 'unused'
    check (status in ('unused', 'assigned', 'retired')),
  asset_id uuid unique,
  batch_id uuid references public.qr_batches (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  assigned_at timestamptz
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_no text not null unique,
  name text not null,
  asset_type text not null check (asset_type in ('GENERAL', 'IT')),
  category text not null,
  status text not null
    check (status in ('IN_USE', 'IN_STOCK', 'REPAIR', 'DISPOSED')),
  serial_no text,
  manufacturer text,
  model_name text,
  location text,
  department text,
  assignee_name text,
  notes text,
  purchase_date date,
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  qr_code_id uuid unique references public.qr_codes (id),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qr_codes
  add constraint qr_codes_asset_id_fkey
  foreign key (asset_id) references public.assets (id) on delete set null;

create unique index assets_serial_no_unique
  on public.assets (serial_no)
  where serial_no is not null;

create index assets_asset_type_idx on public.assets (asset_type);
create index assets_status_idx on public.assets (status);
create index assets_location_idx on public.assets (location);
create index assets_created_at_idx on public.assets (created_at desc);
create index assets_qr_code_id_idx on public.assets (qr_code_id);
create index qr_codes_status_idx on public.qr_codes (status);
create index qr_codes_batch_id_idx on public.qr_codes (batch_id);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  file_name text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'validated', 'committed', 'failed', 'expired')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  storage_path text,
  error_storage_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'valid', 'error', 'imported')),
  errors jsonb not null default '[]'::jsonb,
  created_asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index import_rows_job_id_idx on public.import_rows (job_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- role은 user_metadata로 설정하지 않음 (클라이언트가 변조 가능). 기본 REGISTER, ADMIN은 운영자가 SQL로 승격.
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'REGISTER',
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: assign QR + create asset (atomic)
-- ---------------------------------------------------------------------------

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

  if p_asset_type not in ('GENERAL', 'IT') then
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

revoke all on function public.assign_qr_and_create_asset from public;
grant execute on function public.assign_qr_and_create_asset to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: link unused QR to unlinked asset
-- ---------------------------------------------------------------------------

create or replace function public.link_asset_to_qr(
  p_asset_id uuid,
  p_qr_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_qr public.qr_codes%rowtype;
begin
  if v_user is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ASSET_NOT_FOUND');
  end if;

  if v_asset.qr_code_id is not null then
    return jsonb_build_object('ok', false, 'error', 'ASSET_ALREADY_LINKED');
  end if;

  select * into v_qr from public.qr_codes where id = p_qr_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_FOUND');
  end if;

  if v_qr.status <> 'unused' then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_UNUSED');
  end if;

  update public.qr_codes
  set status = 'assigned', asset_id = p_asset_id, assigned_at = now()
  where id = p_qr_id and status = 'unused';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'QR_NOT_UNUSED');
  end if;

  update public.assets
  set qr_code_id = p_qr_id, updated_by = v_user
  where id = p_asset_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    v_user, 'asset.link_qr', 'asset', p_asset_id,
    jsonb_build_object('qr_id', p_qr_id)
  );

  return jsonb_build_object('ok', true, 'asset_id', p_asset_id, 'qr_id', p_qr_id);
end;
$$;

revoke all on function public.link_asset_to_qr from public;
grant execute on function public.link_asset_to_qr to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: import assets batch (all-or-nothing)
-- ---------------------------------------------------------------------------

create or replace function public.import_assets_batch(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row jsonb;
  v_asset_id uuid;
  v_qr_id uuid;
  v_qr_token text;
  v_count integer := 0;
  v_ids uuid[] := '{}';
begin
  if v_user is null or not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_qr_id := null;
    v_qr_token := nullif(v_row->>'qr_token', '');

    if v_qr_token is not null then
      select id into v_qr_id
      from public.qr_codes
      where token::text = v_qr_token and status = 'unused'
      for update;

      if v_qr_id is null then
        raise exception 'QR_UNAVAILABLE:%', v_qr_token;
      end if;

      update public.qr_codes
      set status = 'assigned', assigned_at = now()
      where id = v_qr_id and status = 'unused';

      if not found then
        raise exception 'QR_UNAVAILABLE:%', v_qr_token;
      end if;
    end if;

    insert into public.assets (
      asset_no, name, asset_type, category, status,
      serial_no, manufacturer, model_name, location, department,
      assignee_name, notes, purchase_date, purchase_price,
      qr_code_id, created_by, updated_by
    ) values (
      v_row->>'asset_no',
      v_row->>'name',
      v_row->>'asset_type',
      v_row->>'category',
      v_row->>'status',
      nullif(v_row->>'serial_no', ''),
      nullif(v_row->>'manufacturer', ''),
      nullif(v_row->>'model_name', ''),
      nullif(v_row->>'location', ''),
      nullif(v_row->>'department', ''),
      nullif(v_row->>'assignee_name', ''),
      nullif(v_row->>'notes', ''),
      nullif(v_row->>'purchase_date', '')::date,
      case
        when nullif(v_row->>'purchase_price', '') is null then null
        else (v_row->>'purchase_price')::numeric
      end,
      v_qr_id,
      v_user,
      v_user
    )
    returning id into v_asset_id;

    if v_qr_id is not null then
      update public.qr_codes set asset_id = v_asset_id where id = v_qr_id;
    end if;

    v_ids := array_append(v_ids, v_asset_id);
    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, payload)
  values (
    v_user, 'asset.import_batch', 'import',
    jsonb_build_object('count', v_count)
  );

  return jsonb_build_object('ok', true, 'count', v_count, 'asset_ids', to_jsonb(v_ids));
end;
$$;

revoke all on function public.import_assets_batch from public;
grant execute on function public.import_assets_batch to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: dashboard stats (admin only)
-- ---------------------------------------------------------------------------

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

revoke all on function public.get_dashboard_stats from public;
grant execute on function public.get_dashboard_stats to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.qr_codes enable row level security;
alter table public.qr_batches enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- assets: authenticated CRUD (update/insert for registered users)
create policy "assets_select_authenticated"
  on public.assets for select to authenticated
  using (true);

create policy "assets_insert_authenticated"
  on public.assets for insert to authenticated
  with check (true);

create policy "assets_update_authenticated"
  on public.assets for update to authenticated
  using (true)
  with check (true);

-- qr_codes
create policy "qr_codes_select_authenticated"
  on public.qr_codes for select to authenticated
  using (true);

create policy "qr_codes_insert_admin"
  on public.qr_codes for insert to authenticated
  with check (public.is_admin());

create policy "qr_codes_update_admin"
  on public.qr_codes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- qr_batches
create policy "qr_batches_select_admin"
  on public.qr_batches for select to authenticated
  using (public.is_admin());

create policy "qr_batches_insert_admin"
  on public.qr_batches for insert to authenticated
  with check (public.is_admin());

-- import
create policy "import_jobs_admin_all"
  on public.import_jobs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "import_rows_admin_all"
  on public.import_rows for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- audit logs: admin read, authenticated insert via RPC mostly
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());
