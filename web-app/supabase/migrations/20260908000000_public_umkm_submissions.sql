create table public.umkm_submissions (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(btrim(business_name)) between 2 and 160),
  owner_name text not null check (char_length(btrim(owner_name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 8 and 40),
  category text not null check (char_length(btrim(category)) between 2 and 100),
  address text not null check (char_length(btrim(address)) between 8 and 500),
  latitude double precision,
  longitude double precision,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_umkm_id bigint references public.umkm(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint umkm_submissions_coordinates_pair
    check ((latitude is null) = (longitude is null)),
  constraint umkm_submissions_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint umkm_submissions_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint umkm_submissions_pending_review
    check (
      status <> 'pending'
      or (
        reviewed_at is null
        and reviewed_by is null
        and approved_umkm_id is null
        and review_note = ''
      )
    ),
  constraint umkm_submissions_approved_record
    check (status <> 'approved' or approved_umkm_id is not null)
);

create index umkm_submissions_status_created_at_idx
  on public.umkm_submissions (status, created_at desc);

create index umkm_submissions_reviewed_by_idx
  on public.umkm_submissions (reviewed_by)
  where reviewed_by is not null;

create trigger umkm_submissions_set_updated_at
before update on public.umkm_submissions
for each row execute function public.set_updated_at();

alter table public.umkm_submissions enable row level security;

revoke all on table public.umkm_submissions from anon, authenticated;
grant insert on table public.umkm_submissions to anon, authenticated;
grant select on table public.umkm_submissions to authenticated;

create policy umkm_submissions_public_insert
on public.umkm_submissions for insert to anon, authenticated
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and approved_umkm_id is null
  and review_note = ''
);

create policy umkm_submissions_admin_read
on public.umkm_submissions for select to authenticated
using ((select public.can_manage_umkm()));

create or replace function public.review_umkm_submission(
  p_submission_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns public.umkm_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.umkm_submissions%rowtype;
  approved_business public.umkm%rowtype;
  decision text := lower(btrim(coalesce(p_decision, '')));
  reviewed_note text := btrim(coalesce(p_review_note, ''));
begin
  if not public.can_manage_umkm() then
    raise exception 'Akun tidak memiliki izin untuk meninjau pengajuan UMKM.'
      using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Keputusan pengajuan tidak valid.' using errcode = '22023';
  end if;

  if char_length(reviewed_note) > 1000 then
    raise exception 'Catatan peninjauan maksimal 1000 karakter.' using errcode = '22001';
  end if;

  select *
  into submission
  from public.umkm_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Pengajuan UMKM tidak ditemukan.' using errcode = 'P0002';
  end if;

  if submission.status <> 'pending' then
    raise exception 'Pengajuan ini sudah ditinjau.' using errcode = 'P0001';
  end if;

  if decision = 'approved' then
    insert into public.umkm (
      name,
      product_type,
      product_label,
      brand,
      owner,
      address,
      lat,
      lng,
      analysis_lat,
      analysis_lng,
      display_lat,
      display_lng,
      location_accuracy,
      location_area,
      is_active,
      published
    ) values (
      submission.business_name,
      submission.category,
      submission.category,
      submission.business_name,
      submission.owner_name,
      submission.address,
      submission.latitude,
      submission.longitude,
      submission.latitude,
      submission.longitude,
      submission.latitude,
      submission.longitude,
      case when submission.latitude is null then 'belum_terverifikasi' else 'perkiraan_kecamatan' end,
      '',
      true,
      true
    )
    returning * into approved_business;

    update public.umkm_submissions
    set status = 'approved',
        review_note = reviewed_note,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        approved_umkm_id = approved_business.id
    where id = submission.id
    returning * into submission;
  else
    update public.umkm_submissions
    set status = 'rejected',
        review_note = reviewed_note,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = submission.id
    returning * into submission;
  end if;

  return submission;
end;
$$;

revoke all on function public.review_umkm_submission(uuid, text, text) from public;
grant execute on function public.review_umkm_submission(uuid, text, text) to authenticated;
