-- TaxiTrack PNG · Migration 2: Row Level Security.
-- owner: full access · supervisor: enter takings, view fleet, service &
-- compliance — no payroll, no settings · driver: read own records only.

-- ============================================================ helpers

-- Role of the calling user (null for anon). SECURITY DEFINER so it can
-- read profiles regardless of the caller's own RLS visibility.
create or replace function app_role()
returns text
language sql stable security definer set search_path = public as $$
  select role::text from profiles where id = auth.uid()
$$;

-- The drivers.id linked to the calling auth user (null if none).
create or replace function current_driver_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where user_id = auth.uid()
$$;

create or replace function is_owner()
returns boolean language sql stable as $$ select app_role() = 'owner' $$;

create or replace function is_staff() -- owner or supervisor
returns boolean language sql stable as $$ select app_role() in ('owner', 'supervisor') $$;

-- ============================================================ enable RLS

alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table assignments enable row level security;
alter table daily_takings enable row level security;
alter table balance_ledger enable row level security;
alter table deductions enable row level security;
alter table pay_periods enable row level security;
alter table service_records enable row level security;
alter table downtime_log enable row level security;
alter table compliance_docs enable row level security;
alter table incidents enable row level security;
alter table audit_log enable row level security;
alter table app_settings enable row level security;

-- ============================================================ profiles

create policy profiles_select_own on profiles
  for select using (id = auth.uid() or is_owner());
create policy profiles_owner_write on profiles
  for all using (is_owner()) with check (is_owner());

-- ============================================================ vehicles

-- Vehicle basics (plate/model) are needed to render any takings row,
-- including a driver's own history — read is open to authenticated users.
create policy vehicles_select on vehicles
  for select using (auth.uid() is not null);
create policy vehicles_owner_write on vehicles
  for all using (is_owner()) with check (is_owner());

-- ============================================================ drivers

create policy drivers_select_staff on drivers
  for select using (is_staff() or user_id = auth.uid());
create policy drivers_owner_write on drivers
  for all using (is_owner()) with check (is_owner());

-- ============================================================ assignments

create policy assignments_select on assignments
  for select using (is_staff() or driver_id = current_driver_id());
create policy assignments_owner_write on assignments
  for all using (is_owner()) with check (is_owner());

-- ============================================================ daily_takings

create policy takings_select on daily_takings
  for select using (is_staff() or driver_id = current_driver_id());

create policy takings_owner_all on daily_takings
  for all using (is_owner()) with check (is_owner());

create policy takings_supervisor_insert on daily_takings
  for insert with check (app_role() = 'supervisor');

-- Supervisors may correct an entry only while it is unlocked and less
-- than 24h old (or within an audited owner-granted unlock window).
create policy takings_supervisor_update on daily_takings
  for update using (
    app_role() = 'supervisor'
    and locked = false
    and (created_at > now() - interval '24 hours'
         or (unlocked_until is not null and now() < unlocked_until))
  ) with check (app_role() = 'supervisor');

-- ============================================================ balance_ledger

-- Rows are written by the SECURITY DEFINER takings trigger; direct writes
-- (offsets, waivers) are owner-only.
create policy ledger_select on balance_ledger
  for select using (is_staff() or driver_id = current_driver_id());
create policy ledger_owner_write on balance_ledger
  for all using (is_owner()) with check (is_owner());

-- ============================================================ deductions

create policy deductions_select on deductions
  for select using (is_staff() or driver_id = current_driver_id());
create policy deductions_owner_write on deductions
  for all using (is_owner()) with check (is_owner());

-- ============================================================ pay_periods

-- Supervisors have NO payroll access (per RBAC).
create policy pay_periods_owner on pay_periods
  for all using (is_owner()) with check (is_owner());
create policy pay_periods_driver_select on pay_periods
  for select using (driver_id = current_driver_id());

-- ============================================================ service_records

create policy service_select on service_records
  for select using (is_staff());
create policy service_owner_all on service_records
  for all using (is_owner()) with check (is_owner());
create policy service_supervisor_insert on service_records
  for insert with check (app_role() = 'supervisor');
create policy service_supervisor_update on service_records
  for update using (app_role() = 'supervisor') with check (app_role() = 'supervisor');

-- ============================================================ downtime_log

create policy downtime_select on downtime_log
  for select using (is_staff());
create policy downtime_owner_all on downtime_log
  for all using (is_owner()) with check (is_owner());
create policy downtime_supervisor_insert on downtime_log
  for insert with check (app_role() = 'supervisor');
create policy downtime_supervisor_update on downtime_log
  for update using (app_role() = 'supervisor') with check (app_role() = 'supervisor');

-- ============================================================ compliance_docs

create policy compliance_select on compliance_docs
  for select using (
    is_staff()
    or (owner_type = 'driver' and driver_id = current_driver_id())
  );
create policy compliance_owner_all on compliance_docs
  for all using (is_owner()) with check (is_owner());
create policy compliance_supervisor_insert on compliance_docs
  for insert with check (app_role() = 'supervisor');
create policy compliance_supervisor_update on compliance_docs
  for update using (app_role() = 'supervisor') with check (app_role() = 'supervisor');

-- ============================================================ incidents

create policy incidents_select on incidents
  for select using (is_staff());
create policy incidents_owner_all on incidents
  for all using (is_owner()) with check (is_owner());
create policy incidents_supervisor_insert on incidents
  for insert with check (app_role() = 'supervisor');

-- ============================================================ audit_log

-- Written only by SECURITY DEFINER triggers; owner can review.
create policy audit_owner_select on audit_log
  for select using (is_owner());

-- ============================================================ app_settings

create policy settings_select on app_settings
  for select using (auth.uid() is not null);
create policy settings_owner_update on app_settings
  for update using (is_owner()) with check (is_owner());
