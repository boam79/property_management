-- Purchase history module (ADMIN-only, separate from assets)

create table if not exists public.purchase_histories (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  purchase_date date not null,
  department text not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_histories_item_name_nonempty check (length(trim(item_name)) > 0),
  constraint purchase_histories_department_nonempty check (length(trim(department)) > 0)
);

create index if not exists purchase_histories_purchase_date_idx
  on public.purchase_histories (purchase_date desc);

create index if not exists purchase_histories_department_idx
  on public.purchase_histories (department);

create index if not exists purchase_histories_item_name_idx
  on public.purchase_histories (item_name);

drop trigger if exists purchase_histories_set_updated_at on public.purchase_histories;
create trigger purchase_histories_set_updated_at
  before update on public.purchase_histories
  for each row execute function public.set_updated_at();

alter table public.purchase_histories enable row level security;

drop policy if exists "purchase_histories_select_admin" on public.purchase_histories;
drop policy if exists "purchase_histories_insert_admin" on public.purchase_histories;
drop policy if exists "purchase_histories_update_admin" on public.purchase_histories;
drop policy if exists "purchase_histories_delete_admin" on public.purchase_histories;

create policy "purchase_histories_select_admin"
  on public.purchase_histories for select to authenticated
  using (public.is_admin());

create policy "purchase_histories_insert_admin"
  on public.purchase_histories for insert to authenticated
  with check (public.is_admin() and user_id = auth.uid());

create policy "purchase_histories_update_admin"
  on public.purchase_histories for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "purchase_histories_delete_admin"
  on public.purchase_histories for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.purchase_histories to authenticated;
