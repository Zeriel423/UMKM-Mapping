-- Migration: 20261111000000_privacy_and_import_improvements.sql
-- Tujuan:
-- 1. Menambahkan kolom privat (bpjph, sumber_data) pada tabel public.umkm.
-- 2. Memisahkan hak akses data publik dan privat pada level database:
--    - Membuat view public.public_umkm yang hanya mengekspos kolom publik.
--    - Membatasi akses SELECT role 'anon' hanya pada kolom publik (kolom privat owner, bpjph, sumber_data hanya untuk admin).
-- 3. Memperbaiki fungsi import_umkm_batch:
--    - Menerima koordinat terverifikasi (akurasi 'tepat') tanpa melempar pengecualian.
--    - Memproteksi koordinat yang sudah akurat/terverifikasi agar tidak tertimpa koordinat kosong/default.
--    - Mempertahankan informasi privat asli tanpa menggantinya dengan tanda titik (.) atau XXXX.

-- 1. Tambah kolom privat pada tabel umkm
alter table public.umkm add column if not exists bpjph text not null default '';
alter table public.umkm add column if not exists sumber_data text not null default '';

-- 2. View publik yang aman (hanya berisi kolom publik, tanpa informasi privat pemilik/BPJPH/sumber)
create or replace view public.public_umkm
with (security_invoker = false)
as
select
  id,
  brand,
  product_type,
  product_label,
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
from public.umkm
where is_active = true and published = true;

revoke all on public.public_umkm from public;
grant select on public.public_umkm to anon, authenticated;

-- 3. Batasi akses anonim pada tabel fisik umkm hanya ke kolom publik
revoke select on public.umkm from anon;
grant select (
  id,
  brand,
  product_type,
  product_label,
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
  published,
  created_at,
  updated_at
) on public.umkm to anon;

-- Pastikan policy admin tetap dapat membaca seluruh kolom termasuk data privat
drop policy if exists umkm_admin_read on public.umkm;
create policy umkm_admin_read
on public.umkm for select to authenticated
using ((select public.is_admin()));

-- 4. Perbaikan fungsi batch import dengan proteksi koordinat dan integritas data privat
create or replace function public.import_umkm_batch(
  p_source_name text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.import_batches%rowtype;
  item jsonb;
  total_count integer := coalesce(
    case
      when p_records is null or jsonb_typeof(p_records) <> 'array' then 0
      else jsonb_array_length(p_records)
    end,
    0
  );
  inserted_count integer := 0;
  updated_count integer := 0;
  current_row integer := 0;
  imported_id bigint;
  imported_name text;
  imported_product_type text;
  imported_product_label text;
  imported_brand text;
  imported_owner text;
  imported_bpjph text;
  imported_sumber_data text;
  imported_address text;
  imported_analysis_lat double precision;
  imported_analysis_lng double precision;
  imported_display_lat double precision;
  imported_display_lng double precision;
  imported_accuracy text;
  imported_area text;
  imported_is_active boolean;
  imported_published boolean;
begin
  if not public.can_manage_umkm() then
    raise exception 'Akun tidak memiliki izin untuk mengimpor data UMKM.'
      using errcode = '42501';
  end if;

  insert into public.import_batches (
    source_name,
    total_rows,
    valid_rows,
    invalid_rows,
    status,
    error_message,
    imported_by
  ) values (
    coalesce(nullif(btrim(p_source_name), ''), 'Impor tanpa nama'),
    total_count,
    0,
    0,
    'processing',
    null,
    auth.uid()
  ) returning * into batch;

  begin
    if p_records is null or jsonb_typeof(p_records) <> 'array' then
      raise exception 'Payload records harus berupa array JSON.'
        using errcode = '22023';
    end if;

    lock table public.umkm in share row exclusive mode;

    for item in
      select value from jsonb_array_elements(p_records)
    loop
      current_row := current_row + 1;

      if jsonb_typeof(item) <> 'object' then
        raise exception 'Baris % bukan objek JSON.', current_row
          using errcode = '22023';
      end if;

      imported_id := nullif(item ->> 'id', '')::bigint;
      imported_name := coalesce(
        nullif(btrim(item ->> 'name'), ''),
        nullif(btrim(item ->> 'sumber_data'), ''),
        nullif(btrim(item ->> 'brand'), ''),
        'Data UMKM'
      );
      imported_product_type := coalesce(btrim(item ->> 'product_type'), '');
      imported_product_label := coalesce(btrim(item ->> 'product_label'), '');
      imported_brand := coalesce(
        nullif(btrim(item ->> 'brand'), ''),
        nullif(btrim(item ->> 'name'), ''),
        'UMKM'
      );
      imported_owner := coalesce(
        nullif(btrim(item ->> 'owner'), ''),
        nullif(btrim(item ->> 'nama_pemilik'), ''),
        ''
      );
      imported_bpjph := coalesce(
        nullif(btrim(item ->> 'bpjph'), ''),
        ''
      );
      imported_sumber_data := coalesce(
        nullif(btrim(item ->> 'sumber_data'), ''),
        nullif(btrim(item ->> 'name'), ''),
        ''
      );
      imported_address := coalesce(btrim(item ->> 'address'), '');
      imported_analysis_lat := coalesce(
        nullif(item ->> 'analysis_lat', '')::double precision,
        nullif(item ->> 'lat', '')::double precision
      );
      imported_analysis_lng := coalesce(
        nullif(item ->> 'analysis_lng', '')::double precision,
        nullif(item ->> 'lng', '')::double precision
      );
      imported_display_lat := coalesce(
        nullif(item ->> 'display_lat', '')::double precision,
        nullif(item ->> 'lat', '')::double precision,
        imported_analysis_lat
      );
      imported_display_lng := coalesce(
        nullif(item ->> 'display_lng', '')::double precision,
        nullif(item ->> 'lng', '')::double precision,
        imported_analysis_lng
      );
      imported_accuracy := coalesce(
        nullif(btrim(item ->> 'location_accuracy'), ''),
        'belum_terverifikasi'
      );
      imported_area := coalesce(btrim(item ->> 'location_area'), '');
      imported_is_active := coalesce(
        nullif(item ->> 'is_active', '')::boolean,
        true
      );
      imported_published := coalesce(
        nullif(item ->> 'published', '')::boolean,
        true
      );

      if imported_id is null then
        insert into public.umkm (
          name, product_type, product_label, brand, owner, bpjph, sumber_data, address,
          lat, lng, analysis_lat, analysis_lng, display_lat, display_lng,
          location_accuracy, location_area, is_active, published
        ) values (
          imported_name, imported_product_type, imported_product_label,
          imported_brand, imported_owner, imported_bpjph, imported_sumber_data, imported_address,
          imported_display_lat, imported_display_lng,
          imported_analysis_lat, imported_analysis_lng,
          imported_display_lat, imported_display_lng,
          imported_accuracy, imported_area,
          imported_is_active, imported_published
        );
        inserted_count := inserted_count + 1;
      else
        insert into public.umkm (
          id, name, product_type, product_label, brand, owner, bpjph, sumber_data, address,
          lat, lng, analysis_lat, analysis_lng, display_lat, display_lng,
          location_accuracy, location_area, is_active, published
        ) values (
          imported_id, imported_name, imported_product_type,
          imported_product_label, imported_brand, imported_owner, imported_bpjph, imported_sumber_data,
          imported_address, imported_display_lat, imported_display_lng,
          imported_analysis_lat, imported_analysis_lng,
          imported_display_lat, imported_display_lng,
          imported_accuracy, imported_area,
          imported_is_active, imported_published
        )
        on conflict (id) do update
        set name = case when excluded.name <> '' and excluded.name <> 'Data UMKM' then excluded.name else public.umkm.name end,
            product_type = case when excluded.product_type <> '' then excluded.product_type else public.umkm.product_type end,
            product_label = case when excluded.product_label <> '' then excluded.product_label else public.umkm.product_label end,
            brand = case when excluded.brand <> '' and excluded.brand <> 'UMKM' then excluded.brand else public.umkm.brand end,
            owner = case when excluded.owner <> '' then excluded.owner else public.umkm.owner end,
            bpjph = case when excluded.bpjph <> '' then excluded.bpjph else public.umkm.bpjph end,
            sumber_data = case when excluded.sumber_data <> '' then excluded.sumber_data else public.umkm.sumber_data end,
            address = case when excluded.address <> '' then excluded.address else public.umkm.address end,
            lat = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.lat
              else coalesce(excluded.lat, public.umkm.lat)
            end,
            lng = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.lng
              else coalesce(excluded.lng, public.umkm.lng)
            end,
            analysis_lat = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.analysis_lat
              else coalesce(excluded.analysis_lat, public.umkm.analysis_lat)
            end,
            analysis_lng = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.analysis_lng
              else coalesce(excluded.analysis_lng, public.umkm.analysis_lng)
            end,
            display_lat = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.display_lat
              else coalesce(excluded.display_lat, public.umkm.display_lat)
            end,
            display_lng = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.display_lng
              else coalesce(excluded.display_lng, public.umkm.display_lng)
            end,
            location_accuracy = case
              when public.umkm.location_accuracy = 'tepat' and excluded.location_accuracy <> 'tepat' then public.umkm.location_accuracy
              else excluded.location_accuracy
            end,
            location_area = case
              when public.umkm.location_accuracy = 'tepat' and (excluded.location_area is null or excluded.location_area = '') then public.umkm.location_area
              else coalesce(nullif(excluded.location_area, ''), public.umkm.location_area)
            end,
            is_active = excluded.is_active,
            published = excluded.published;
        updated_count := updated_count + 1;
      end if;
    end loop;

    perform setval(
      pg_get_serial_sequence('public.umkm', 'id'),
      greatest(
        coalesce((select max(id) from public.umkm), 0) + 1,
        1
      ),
      false
    );

    update public.import_batches
    set valid_rows = current_row,
        invalid_rows = 0,
        status = 'completed',
        error_message = null
    where id = batch.id
    returning * into batch;

  exception when others then
    update public.import_batches
    set status = 'failed',
        error_message = format('[baris %s] %s', current_row, sqlerrm)
    where id = batch.id;
    raise;
  end;

  return jsonb_build_object(
    'batch_id', batch.id,
    'status', batch.status,
    'total_rows', batch.total_rows,
    'valid_rows', batch.valid_rows,
    'invalid_rows', batch.invalid_rows
  );
end;
$$;

revoke all on function public.import_umkm_batch(text, jsonb) from public;
grant execute on function public.import_umkm_batch(text, jsonb) to authenticated;
