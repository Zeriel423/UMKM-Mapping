begin;

create table public.umkm_sample_details (
  umkm_id bigint primary key references public.umkm(id) on delete cascade,
  maps_category text not null,
  maps_url text not null unique,
  owner_source_url text not null,
  omzet_monthly bigint not null check (omzet_monthly >= 0),
  working_capital_monthly bigint not null check (working_capital_monthly >= 0),
  income_monthly bigint not null check (income_monthly >= omzet_monthly),
  gross_profit_monthly bigint not null check (gross_profit_monthly between 0 and income_monthly),
  net_profit_monthly bigint not null check (net_profit_monthly between 0 and gross_profit_monthly),
  is_financial_simulation boolean not null default true check (is_financial_simulation)
);

alter table public.umkm_sample_details enable row level security;
revoke all on public.umkm_sample_details from public, anon, authenticated;
grant select on public.umkm_sample_details to anon, authenticated;

create policy umkm_sample_details_public_read
on public.umkm_sample_details for select to anon, authenticated
using (exists (
  select 1 from public.umkm as business
  where business.id = umkm_sample_details.umkm_id
    and business.is_active and business.published
));

with samples(name, category_code, category_label, maps_category, owner, address, lat, lng, maps_url, owner_source_url, omzet, modal, pendapatan, laba_kotor, laba_bersih) as (
  values
    ('Kibo Cafe', 'A0004', 'Makanan Olahan', 'Kafe', 'Herman Gozali', 'Jl. Arie Lasut No.58A, Kombos Bar., Kec. Singkil, Kota Manado, Sulawesi Utara 95234', 1.4932717, 124.8514653, 'https://www.google.com/maps/place/Kibo+Cafe/@1.4932717,124.8514653,17z/data=!3m1!4b1!4m6!3m5!1s0x3287755c7420b0bb:0x66d516f5a83ad897!8m2!3d1.4932717!4d124.8514653!16s%2Fg%2F11h0g_25r4', 'https://sipensi.umkm.go.id/tenants/kibo-cafe-3810', 18000000, 8000000, 18000000, 9000000, 4000000),
    ('Odanam Burger', 'A0004', 'Makanan Olahan', 'Restoran Hamburger', 'Hendry Matthew & Angelica Wagiman', 'Jl. Tololiu Supit No.50, Tingkulu, Kec. Wanea, Kota Manado, Sulawesi Utara 95119', 1.4614262, 124.8515233, 'https://www.google.com/maps/place/Odanam+Burger/@1.4614262,124.8515233,17z/data=!3m1!4b1!4m6!3m5!1s0x328775f2b1df0ff1:0x21e48bbf97f4c656!8m2!3d1.4614262!4d124.8515233!16s%2Fg%2F11fp848b3t', 'https://sipensi.umkm.go.id/tenants/odanam-burger-3385', 14000000, 6000000, 14000000, 7000000, 3000000),
    ('QueenJo', 'A0004', 'Makanan Olahan', 'Restoran', 'Laurin Joice Egam', 'Jl. Wolter Monginsidi, Malalayang Satu, Kec. Malalayang, Kota Manado, Sulawesi Utara 95162', 1.4576191, 124.8176741, 'https://www.google.com/maps/place/QueenJo/@1.4576191,124.8176741,17z/data=!3m1!4b1!4m6!3m5!1s0x328775c41ed3438d:0xd0a3971ed5d4b563!8m2!3d1.4576191!4d124.8176741!16s%2Fg%2F11v0jjsp39', 'https://sipensi.umkm.go.id/tenants/queenjo-4624', 16000000, 7000000, 16000000, 8000000, 3500000),
    ('Christine Klappertaart Kairagi', 'A0007', 'Roti, Kue & Biskuit', 'Toko Kue', 'Elsje Crestine Sumangkut', 'Jl. A.A. Maramis Kompleks Perumahan Pemda No.16, Kairagi Weru, Kec. Paal Dua, Kota Manado, Sulawesi Utara 95129', 1.4939672, 124.8726589, 'https://www.google.com/maps/place/Christine+Klappertaart+Kairagi+(Depan+Kantor+NASDEM)/@1.4939672,124.8726589,17z/data=!3m1!4b1!4m6!3m5!1s0x32870aba9610ef33:0x266ad571e8fa8d13!8m2!3d1.4939672!4d124.8726589!16s%2Fg%2F11b6hwk8hg', 'https://www.dgip.go.id/uploads/berita_resmi/file/429c84c07ae8d61fac455876fe5b9d7c.pdf', 35000000, 12000000, 35000000, 17000000, 7000000),
    ('Kios Golden', 'A0004', 'Makanan Olahan', 'Restoran', 'Liem Giem Hwat', 'FRRV+MVC, Jl. Walanda Maramis, Pinaesaan, Kec. Wenang, Kota Manado, Sulawesi Utara', 1.491675, 124.84463, 'https://www.google.com/maps/place/Kios+Golden/data=!4m7!3m6!1s0x32877543e055c637:0x3da3d138382dfdc6!8m2!3d1.491675!4d124.84463!16s%2Fg%2F11c594xppb', 'https://ejournal.unsrat.ac.id/v3/index.php/jisep/article/download/48324/43004/113526', 25000000, 10000000, 25000000, 12000000, 5000000)
), inserted as (
  insert into public.umkm (
    name, product_type, product_label, brand, owner, address,
    lat, lng, analysis_lat, analysis_lng, display_lat, display_lng,
    location_accuracy, location_area, is_active, published
  )
  select name, category_code, category_label, name, owner, address,
    lat, lng, lat, lng, lat, lng,
    'perkiraan_kecamatan', 'Kota Manado', true, true
  from samples
  where not exists (
    select 1 from public.umkm as existing
    where lower(existing.name) = lower(samples.name)
      and lower(existing.address) = lower(samples.address)
  )
  returning id, name, address
)
insert into public.umkm_sample_details (
  umkm_id, maps_category, maps_url, owner_source_url,
  omzet_monthly, working_capital_monthly, income_monthly,
  gross_profit_monthly, net_profit_monthly
)
select inserted.id, samples.maps_category, samples.maps_url, samples.owner_source_url,
  samples.omzet, samples.modal, samples.pendapatan, samples.laba_kotor, samples.laba_bersih
from inserted
join samples on samples.name = inserted.name and samples.address = inserted.address;

commit;
