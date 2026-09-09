alter table public.umkm_submissions
  add column photo_path text,
  add column photo_kind text,
  add column tracking_code uuid not null default gen_random_uuid(),
  add constraint umkm_submissions_photo_pair
    check ((photo_path is null) = (photo_kind is null)),
  add constraint umkm_submissions_photo_kind
    check (photo_kind is null or photo_kind in ('product', 'place')),
  add constraint umkm_submissions_photo_path_length
    check (photo_path is null or char_length(photo_path) <= 500);

create unique index umkm_submissions_tracking_code_idx
  on public.umkm_submissions (tracking_code);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'umkm-submission-photos',
  'umkm-submission-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy umkm_submission_photos_public_insert
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'umkm-submission-photos'
  and (storage.foldername(name))[1] = 'submissions'
);

create policy umkm_submission_photos_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'umkm-submission-photos'
  and (select public.can_manage_umkm())
);

create or replace function public.get_umkm_submission_status(p_tracking_code uuid)
returns table (
  business_name text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    submission.business_name,
    submission.status,
    submission.review_note,
    submission.created_at,
    submission.reviewed_at
  from public.umkm_submissions as submission
  where submission.tracking_code = p_tracking_code;
$$;

revoke all on function public.get_umkm_submission_status(uuid) from public;
grant execute on function public.get_umkm_submission_status(uuid) to anon, authenticated;
