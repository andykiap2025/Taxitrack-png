-- TaxiTrack PNG · Migration 1: enums, tables, computed columns, triggers.
-- Business rules (see CLAUDE.md): takings are recorded AGAINST THE DRIVER,
-- one record per (driver_id, date); target rates are snapshotted per record;
-- shortfalls/surpluses auto-write to balance_ledger via trigger.

-- ============================================================ enums

create type user_role as enum ('owner', 'supervisor', 'driver');
create type vehicle_class as enum ('standard', 'new');
create type vehicle_status as enum ('active', 'in_service', 'off_road', 'retired');
create type driver_status as enum ('active', 'inactive', 'suspended');
create type checkin_status as enum ('on_time', 'late', 'missed');
create type ledger_entry_type as enum ('shortfall', 'surplus');
create type ledger_status as enum ('outstanding', 'offset', 'deducted', 'paid_bonus', 'waived', 'carried');
create type deduction_type as enum ('fuel', 'advance', 'fine', 'repair', 'shortfall', 'other');
create type pay_period_status as enum ('open', 'finalised', 'paid');
create type downtime_reason as enum ('service', 'accident', 'other');
create type doc_owner_type as enum ('vehicle', 'driver');
create type doc_type as enum ('registration', 'safety_sticker', 'mvil_insurance', 'drivers_license', 'taxi_permit');
create type incident_type as enum ('accident', 'fine', 'damage', 'theft', 'other');
create type shortfall_policy as enum ('deduct', 'carry_forward', 'flag_only');
create type surplus_policy as enum ('offset', 'pay_through', 'bonus');

-- ============================================================ profiles

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role user_role not null default 'driver',
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when an auth user is created; role comes from
-- user metadata (set by the admin create-users script), defaults to driver.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'driver')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================ core fleet

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null unique,
  make text not null default '',
  model text not null default '',
  year int,
  vehicle_class vehicle_class not null default 'standard',
  daily_target numeric(10,2) not null default 180.00,
  odometer_current int not null default 0,
  status vehicle_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  license_no text,
  license_expiry date,
  status driver_status not null default 'active',
  date_started date,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers (id) on delete cascade,
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  start_date date not null default current_date,
  end_date date, -- null = current assignment
  created_at timestamptz not null default now()
);

create index assignments_driver_idx on assignments (driver_id, end_date);
create index assignments_vehicle_idx on assignments (vehicle_id, end_date);

-- ============================================================ daily takings

-- One record per DRIVER per working day. No record = driver didn't work,
-- no target applies. Targets and payroll compute from amount_received
-- (cash actually handed in); variance flags declared-vs-received gaps.
-- target_amount is a SNAPSHOT (null = target suppressed, e.g. downtime).
create table daily_takings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  driver_id uuid not null references drivers (id) on delete restrict,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  is_relief_driver boolean not null default false,
  amount_declared numeric(10,2) not null check (amount_declared >= 0),
  amount_received numeric(10,2) not null check (amount_received >= 0),
  variance numeric(10,2) generated always as (amount_declared - amount_received) stored,
  target_amount numeric(10,2) check (target_amount is null or target_amount >= 0),
  target_met boolean generated always as (
    case when target_amount is null then null
         else amount_received >= target_amount end
  ) stored,
  shortfall_amount numeric(10,2) generated always as (
    case when target_amount is null then 0
         else greatest(target_amount - amount_received, 0) end
  ) stored,
  surplus_amount numeric(10,2) generated always as (
    case when target_amount is null then 0
         else greatest(amount_received - target_amount, 0) end
  ) stored,
  odometer_reading int not null check (odometer_reading >= 0),
  checkin_time timestamptz,
  checkin_status checkin_status not null default 'on_time',
  notes text,
  entered_by uuid references auth.users (id) on delete set null,
  locked boolean not null default false,
  unlocked_until timestamptz,
  unlocked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, date)
);

create index daily_takings_date_idx on daily_takings (date);
create index daily_takings_vehicle_idx on daily_takings (vehicle_id, date);
create index daily_takings_driver_idx on daily_takings (driver_id, date);

-- ============================================================ balance ledger

-- Driver-based two-sided ledger: shortfall debits, surplus credits.
-- Running balance per driver = sum(credits) - sum(debits).
create table balance_ledger (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers (id) on delete cascade,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  takings_id uuid references daily_takings (id) on delete cascade,
  date date not null,
  entry_type ledger_entry_type not null,
  amount numeric(10,2) not null check (amount > 0),
  status ledger_status not null default 'outstanding',
  offset_against_id uuid references balance_ledger (id) on delete set null,
  resolved_in_pay_period_id uuid, -- FK added after pay_periods exists
  created_at timestamptz not null default now()
);

create index balance_ledger_driver_idx on balance_ledger (driver_id, date);
create index balance_ledger_takings_idx on balance_ledger (takings_id);

-- Auto-sync ledger from takings: refresh the outstanding auto entry
-- whenever a takings record is inserted or its amounts change.
create or replace function sync_balance_ledger()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from balance_ledger
   where takings_id = new.id and status = 'outstanding';

  if new.shortfall_amount > 0 then
    insert into balance_ledger (driver_id, vehicle_id, takings_id, date, entry_type, amount)
    values (new.driver_id, new.vehicle_id, new.id, new.date, 'shortfall', new.shortfall_amount);
  elsif new.surplus_amount > 0 then
    insert into balance_ledger (driver_id, vehicle_id, takings_id, date, entry_type, amount)
    values (new.driver_id, new.vehicle_id, new.id, new.date, 'surplus', new.surplus_amount);
  end if;
  return new;
end $$;

create trigger daily_takings_ledger_sync
  after insert or update of amount_received, target_amount, driver_id, vehicle_id, date
  on daily_takings
  for each row execute function sync_balance_ledger();

-- ============================================================ payroll

create table pay_periods (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_takings numeric(12,2) not null default 0,
  commission_rate numeric(6,4) not null default 0.29, -- snapshot
  gross_pay numeric(12,2) not null default 0,
  total_shortfalls numeric(12,2) not null default 0,
  total_surpluses numeric(12,2) not null default 0,
  net_balance numeric(12,2) not null default 0,
  shortfall_deduction numeric(12,2) not null default 0,
  surplus_bonus numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  status pay_period_status not null default 'open',
  paid_date date,
  payslip_url text,
  finalised_at timestamptz,
  finalised_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, period_start),
  check (period_end > period_start)
);

alter table balance_ledger
  add constraint balance_ledger_pay_period_fk
  foreign key (resolved_in_pay_period_id) references pay_periods (id) on delete set null;

create table deductions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers (id) on delete cascade,
  pay_period_id uuid references pay_periods (id) on delete set null,
  type deduction_type not null,
  amount numeric(10,2) not null check (amount > 0),
  date date not null default current_date,
  description text,
  entered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index deductions_driver_idx on deductions (driver_id, date);

-- ============================================================ servicing & downtime

create table service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  service_date date not null default current_date,
  odometer_at_service int not null check (odometer_at_service >= 0),
  cost numeric(10,2) not null default 0,
  workshop text,
  notes text,
  next_due_date date,      -- auto: +3 months (trigger)
  next_due_odometer int,   -- auto: +5,000 km (trigger)
  created_at timestamptz not null default now()
);

create or replace function set_service_next_due()
returns trigger
language plpgsql as $$
begin
  new.next_due_date := (new.service_date + interval '3 months')::date;
  new.next_due_odometer := new.odometer_at_service + 5000;
  return new;
end $$;

create trigger service_records_next_due
  before insert or update of service_date, odometer_at_service
  on service_records
  for each row execute function set_service_next_due();

create index service_records_vehicle_idx on service_records (vehicle_id, service_date desc);

-- While a downtime entry is open (end_date null), daily targets are
-- suppressed for that vehicle (app writes target_amount = null).
create table downtime_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  reason downtime_reason not null default 'other',
  notes text,
  created_at timestamptz not null default now()
);

create index downtime_vehicle_idx on downtime_log (vehicle_id, end_date);

-- ============================================================ compliance

create table compliance_docs (
  id uuid primary key default gen_random_uuid(),
  owner_type doc_owner_type not null,
  vehicle_id uuid references vehicles (id) on delete cascade,
  driver_id uuid references drivers (id) on delete cascade,
  doc_type doc_type not null,
  issue_date date,
  expiry_date date not null,
  reference_no text,
  document_url text,
  created_at timestamptz not null default now(),
  check (
    (owner_type = 'vehicle' and vehicle_id is not null and driver_id is null) or
    (owner_type = 'driver' and driver_id is not null and vehicle_id is null)
  )
);

create index compliance_expiry_idx on compliance_docs (expiry_date);

-- ============================================================ incidents

create table incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  driver_id uuid references drivers (id) on delete set null,
  date date not null default current_date,
  type incident_type not null,
  description text,
  cost numeric(10,2) not null default 0,
  police_report_no text,
  photos text[] not null default '{}',
  deduction_id uuid references deductions (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================ audit log

create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index audit_log_record_idx on audit_log (table_name, record_id);

-- Mandatory audit trail on daily_takings and pay_periods edits.
create or replace function write_audit_log()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, record_id, action, old_value, new_value, user_id)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

create trigger daily_takings_audit
  after insert or update or delete on daily_takings
  for each row execute function write_audit_log();

create trigger pay_periods_audit
  after insert or update or delete on pay_periods
  for each row execute function write_audit_log();

-- ============================================================ settings

-- Single-row configuration table.
create table app_settings (
  id int primary key default 1 check (id = 1),
  commission_rate numeric(6,4) not null default 0.29,
  target_standard numeric(10,2) not null default 180.00,
  target_new numeric(10,2) not null default 210.00,
  shortfall_policy shortfall_policy not null default 'deduct',
  surplus_policy surplus_policy not null default 'offset',
  surplus_bonus_rate numeric(6,4) not null default 0,
  carry_forward_balance boolean not null default false,
  checkin_time time not null default '23:00',
  checkin_grace_minutes int not null default 30,
  alert_days int[] not null default '{30,14,7}',
  pay_period_anchor date not null default '2026-01-05', -- a known fortnight start (Monday)
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1);

-- ============================================================ updated_at

create or replace function touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger vehicles_touch before update on vehicles
  for each row execute function touch_updated_at();
create trigger drivers_touch before update on drivers
  for each row execute function touch_updated_at();
create trigger daily_takings_touch before update on daily_takings
  for each row execute function touch_updated_at();
create trigger pay_periods_touch before update on pay_periods
  for each row execute function touch_updated_at();
create trigger app_settings_touch before update on app_settings
  for each row execute function touch_updated_at();
