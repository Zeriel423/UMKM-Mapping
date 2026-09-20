alter table public.umkm_submissions
  drop constraint umkm_submissions_approved_record;

alter table public.umkm_submissions
  add constraint umkm_submissions_approved_record
  check (
    status <> 'approved'
    or approved_umkm_id is not null
    or reviewed_at is not null
  );
