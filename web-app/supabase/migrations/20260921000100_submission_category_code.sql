alter table public.umkm_submissions
  add column category_code text
  check (category_code is null or char_length(category_code) between 1 and 20);

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
      coalesce(submission.category_code, submission.category),
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
