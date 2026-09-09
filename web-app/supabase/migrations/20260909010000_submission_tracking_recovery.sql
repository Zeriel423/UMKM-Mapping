create table public.umkm_submission_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(btrim(business_name)) between 2 and 160),
  owner_name text not null check (char_length(btrim(owner_name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 8 and 40),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint umkm_submission_recovery_handling
    check ((status = 'pending' and handled_at is null and handled_by is null) or status = 'resolved')
);

create index umkm_submission_recovery_requests_status_created_at_idx
  on public.umkm_submission_recovery_requests (status, created_at desc);

alter table public.umkm_submission_recovery_requests enable row level security;

revoke all on table public.umkm_submission_recovery_requests from anon, authenticated;
grant insert on table public.umkm_submission_recovery_requests to anon, authenticated;
grant select, update on table public.umkm_submission_recovery_requests to authenticated;

create policy umkm_submission_recovery_public_insert
on public.umkm_submission_recovery_requests for insert to anon, authenticated
with check (status = 'pending' and handled_at is null and handled_by is null);

create policy umkm_submission_recovery_admin_read
on public.umkm_submission_recovery_requests for select to authenticated
using ((select public.can_manage_umkm()));

create policy umkm_submission_recovery_admin_update
on public.umkm_submission_recovery_requests for update to authenticated
using ((select public.can_manage_umkm()))
with check ((select public.can_manage_umkm()));

create or replace function public.set_submission_recovery_request_handler()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_umkm() then
    raise exception 'Akun tidak memiliki izin untuk memproses pemulihan kode.' using errcode = '42501';
  end if;

  if new.status = 'resolved' and old.status = 'pending' then
    new.handled_at = now();
    new.handled_by = auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function public.set_submission_recovery_request_handler() from public;

create trigger umkm_submission_recovery_requests_set_handler
before update on public.umkm_submission_recovery_requests
for each row execute function public.set_submission_recovery_request_handler();
