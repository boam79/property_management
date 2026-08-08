-- Remove asset photo storage feature (table + storage policies)
-- Note: storage.objects direct DELETE is blocked by Supabase; empty bucket may remain.

drop policy if exists "asset_photos_select_auth" on public.asset_photos;
drop policy if exists "asset_photos_insert_auth" on public.asset_photos;
drop policy if exists "asset_photos_delete_admin" on public.asset_photos;

drop table if exists public.asset_photos;

drop policy if exists "asset_photos_storage_select" on storage.objects;
drop policy if exists "asset_photos_storage_insert" on storage.objects;
drop policy if exists "asset_photos_storage_delete" on storage.objects;
