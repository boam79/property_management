-- Import Storage bucket + 7-day cleanup RPC
-- Applied on remote as migration: import_storage_and_cleanup

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  5242880,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

drop policy if exists "imports_admin_select" on storage.objects;
drop policy if exists "imports_admin_insert" on storage.objects;
drop policy if exists "imports_admin_update" on storage.objects;
drop policy if exists "imports_admin_delete" on storage.objects;

create policy "imports_admin_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.is_admin());

create policy "imports_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.is_admin());

create policy "imports_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'imports' and public.is_admin())
  with check (bucket_id = 'imports' and public.is_admin());

create policy "imports_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and public.is_admin());

create or replace function public.cleanup_expired_import_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  for r in
    select id, storage_path, error_storage_path
    from public.import_jobs
    where expires_at < now() and status <> 'expired'
  loop
    if r.storage_path is not null then
      delete from storage.objects
      where bucket_id = 'imports' and name = r.storage_path;
    end if;
    if r.error_storage_path is not null then
      delete from storage.objects
      where bucket_id = 'imports' and name = r.error_storage_path;
    end if;
    delete from public.import_rows where job_id = r.id;
    update public.import_jobs
      set status = 'expired', completed_at = coalesce(completed_at, now())
      where id = r.id;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'expired_jobs', v_count);
end;
$$;

revoke all on function public.cleanup_expired_import_jobs() from public;
revoke all on function public.cleanup_expired_import_jobs() from anon;
grant execute on function public.cleanup_expired_import_jobs() to authenticated;
