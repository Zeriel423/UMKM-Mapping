begin;

create table public.umkm_gallery_photos (
  id bigint generated always as identity primary key,
  umkm_id bigint not null references public.umkm(id) on delete cascade,
  photo_path text not null unique check (char_length(photo_path) between 1 and 500),
  created_at timestamptz not null default now()
);

create index umkm_gallery_photos_umkm_id_idx on public.umkm_gallery_photos (umkm_id);
alter table public.umkm_gallery_photos enable row level security;
revoke all on public.umkm_gallery_photos from public, anon, authenticated;
grant select on public.umkm_gallery_photos to anon, authenticated;
grant insert, delete on public.umkm_gallery_photos to authenticated;
grant usage, select on sequence public.umkm_gallery_photos_id_seq to authenticated;

create policy umkm_gallery_photos_public_read
on public.umkm_gallery_photos for select to anon, authenticated
using (exists (
  select 1 from public.umkm as business
  where business.id = umkm_gallery_photos.umkm_id
    and business.is_active and business.published
));

create policy umkm_gallery_photos_admin_read
on public.umkm_gallery_photos for select to authenticated
using ((select public.is_admin()));

create policy umkm_gallery_photos_admin_insert
on public.umkm_gallery_photos for insert to authenticated
with check (
  (select public.can_manage_umkm())
  and photo_path like 'admin/' || umkm_id::text || '/%'
);

create policy umkm_gallery_photos_admin_delete
on public.umkm_gallery_photos for delete to authenticated
using ((select public.can_manage_umkm()));

create policy umkm_gallery_storage_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'umkm-submission-photos'
  and (storage.foldername(name))[1] = 'admin'
  and (select public.can_manage_umkm())
);

create policy umkm_gallery_storage_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'umkm-submission-photos'
  and (storage.foldername(name))[1] = 'admin'
  and (select public.can_manage_umkm())
);

create policy umkm_gallery_storage_published_read
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'umkm-submission-photos'
  and exists (
    select 1 from public.umkm_gallery_photos as photo
    where photo.photo_path = storage.objects.name
  )
);

commit;
