begin;

create table public.umkm_photos (
  umkm_id bigint primary key references public.umkm(id) on delete cascade,
  photo_path text not null check (char_length(photo_path) between 1 and 500),
  photo_kind text not null check (photo_kind in ('product', 'place'))
);

create index umkm_photos_path_idx on public.umkm_photos (photo_path);
alter table public.umkm_photos enable row level security;
revoke all on public.umkm_photos from public, anon, authenticated;
grant select on public.umkm_photos to anon, authenticated;

create policy umkm_photos_published_read
on public.umkm_photos for select to anon, authenticated
using (exists (
  select 1 from public.umkm as business
  where business.id = umkm_photos.umkm_id
    and business.is_active and business.published
));

create schema if not exists private;

-- Approval copies only photo metadata; submission contact and tracking data stay private.
create function private.sync_approved_umkm_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    if old.approved_umkm_id is not null then
      delete from public.umkm_photos where umkm_id = old.approved_umkm_id;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    if new.status = 'approved' and new.approved_umkm_id is not null and new.photo_path is not null then
      insert into public.umkm_photos (umkm_id, photo_path, photo_kind)
      values (new.approved_umkm_id, new.photo_path, new.photo_kind)
      on conflict (umkm_id) do update
      set photo_path = excluded.photo_path, photo_kind = excluded.photo_kind;
    end if;
    return new;
  end if;
  return old;
end;
$$;

revoke all on function private.sync_approved_umkm_photo() from public, anon, authenticated;

create trigger umkm_submissions_sync_photo
after insert or update or delete on public.umkm_submissions
for each row execute function private.sync_approved_umkm_photo();

insert into public.umkm_photos (umkm_id, photo_path, photo_kind)
select distinct on (approved_umkm_id) approved_umkm_id, photo_path, photo_kind
from public.umkm_submissions
where status = 'approved' and approved_umkm_id is not null and photo_path is not null
order by approved_umkm_id, reviewed_at desc nulls last, id;

create policy umkm_submission_photos_published_read
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'umkm-submission-photos'
  and exists (
    select 1 from public.umkm_photos as photo
    where photo.photo_path = storage.objects.name
  )
);

commit;
