-- Remove asset photo storage feature (table + storage bucket)

drop policy if exists "asset_photos_select_auth" on public.asset_photos;
drop policy if exists "asset_photos_insert_auth" on public.asset_photos;
drop policy if exists "asset_photos_delete_admin" on public.asset_photos;

drop table if exists public.asset_photos;

drop policy if exists "asset_photos_storage_select" on storage.objects;
drop policy if exists "asset_photos_storage_insert" on storage.objects;
drop policy if exists "asset_photos_storage_delete" on storage.objects;

delete from storage.objects where bucket_id = 'asset-photos';
delete from storage.buckets where id = 'asset-photos';
