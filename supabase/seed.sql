-- TaxiTrack PNG · Seed data for development/demo.
-- Run AFTER the three migrations. Safe to re-run (truncates operational data).
-- Auth users are NOT created here — use scripts/create-users.mjs.

truncate daily_takings, balance_ledger, deductions, pay_periods, service_records,
  downtime_log, compliance_docs, incidents, assignments, drivers, vehicles cascade;

-- ============================================================ vehicles
-- 3 standard (K180) + 2 newer (K210)

insert into vehicles (id, plate_no, make, model, year, vehicle_class, daily_target, odometer_current, status) values
  ('a0000000-0000-0000-0000-000000000001', 'POM 101', 'Toyota', 'Corolla', 2016, 'standard', 180, 148200, 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'POM 102', 'Nissan', 'Tiida', 2015, 'standard', 180, 163400, 'active'),
  ('a0000000-0000-0000-0000-000000000003', 'POM 103', 'Toyota', 'Vitz', 2017, 'standard', 180, 121900, 'active'),
  ('a0000000-0000-0000-0000-000000000004', 'POM 104', 'Toyota', 'Corolla Axio', 2022, 'new', 210, 48100, 'active'),
  ('a0000000-0000-0000-0000-000000000005', 'POM 105', 'Honda', 'Fit', 2023, 'new', 210, 36700, 'off_road');

-- ============================================================ drivers
-- 5 regulars + 1 relief

insert into drivers (id, full_name, phone, license_no, license_expiry, status, date_started) values
  ('d0000000-0000-0000-0000-000000000001', 'John Kaupa',    '+675 7012 3401', 'L-88231', current_date + 320, 'active', '2023-02-06'),
  ('d0000000-0000-0000-0000-000000000002', 'Peter Mek',     '+675 7012 3402', 'L-77120', current_date + 25,  'active', '2023-08-14'),
  ('d0000000-0000-0000-0000-000000000003', 'Michael Temu',  '+675 7012 3403', 'L-90514', current_date + 180, 'active', '2024-01-08'),
  ('d0000000-0000-0000-0000-000000000004', 'Joseph Wari',   '+675 7012 3404', 'L-65087', current_date + 9,   'active', '2022-05-30'),
  ('d0000000-0000-0000-0000-000000000005', 'David Namaliu', '+675 7012 3405', 'L-91772', current_date + 400, 'active', '2024-06-17'),
  ('d0000000-0000-0000-0000-000000000006', 'Steven Kila',   '+675 7012 3406', 'L-83345', current_date + 150, 'active', '2025-03-03');

insert into assignments (driver_id, vehicle_id, start_date) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025-01-06'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '2025-01-06'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '2025-01-06'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '2025-01-06'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', '2025-01-06');
-- Steven Kila has no fixed vehicle: relief driver.

-- ============================================================ takings history
-- ~2 fortnights of entries. Amounts vary around target; drivers rest ~1
-- day a week (no record = no target). Ledger entries auto-write via trigger.

do $$
declare
  d record;
  day date;
  offs int;
  target numeric;
  received numeric;
  declared numeric;
  odo int;
  seed float;
begin
  for d in
    select a.driver_id, a.vehicle_id, v.daily_target, v.odometer_current
      from assignments a join vehicles v on v.id = a.vehicle_id
     where a.end_date is null and v.status = 'active'
  loop
    odo := d.odometer_current - 28 * 190;
    for offs in reverse 27..0 loop
      day := current_date - offs;
      -- pseudo-random but deterministic per driver/day
      seed := abs(sin(extract(epoch from day)::float / 86400.0
                      + ('x' || substr(replace(d.driver_id::text, '-', ''), 27, 6))::bit(24)::int));
      odo := odo + 150 + (seed * 90)::int;
      -- ~1 rest day per week
      continue when (extract(dow from day)::int = 1 and seed < 0.55);
      target := d.daily_target;
      received := round((target - 55 + seed * 130)::numeric, 0);
      declared := case when seed > 0.92 then received + 10 else received end;
      insert into daily_takings
        (date, driver_id, vehicle_id, amount_declared, amount_received,
         target_amount, odometer_reading, checkin_time, checkin_status, entered_by)
      values
        (day, d.driver_id, d.vehicle_id, declared, received, target, odo,
         (day + time '23:00') + make_interval(mins => (seed * 45)::int - 10),
         (case when seed > 0.85 then 'late' else 'on_time' end)::checkin_status, null);
    end loop;
  end loop;
end $$;

-- Relief day: Steven Kila drove POM 103 while Michael Temu was off.
delete from daily_takings
 where driver_id = 'd0000000-0000-0000-0000-000000000003' and date = current_date - 3;
insert into daily_takings
  (date, driver_id, vehicle_id, is_relief_driver, amount_declared, amount_received,
   target_amount, odometer_reading, checkin_time, checkin_status)
values
  (current_date - 3, 'd0000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-000000000003', true, 195, 195, 180, 121650,
   (current_date - 3 + time '23:10'), 'on_time');

-- ============================================================ servicing & downtime

insert into service_records (vehicle_id, service_date, odometer_at_service, cost, workshop, notes) values
  ('a0000000-0000-0000-0000-000000000001', current_date - 80, 144100, 420, 'Ela Motors POM', 'Full service, brake pads'),
  ('a0000000-0000-0000-0000-000000000002', current_date - 30, 160900, 380, 'Boroko Motors', 'Oil + filters'),
  ('a0000000-0000-0000-0000-000000000004', current_date - 95, 43800, 510, 'Ela Motors POM', '40k service');

-- POM 105 is in the workshop after an accident — targets suppressed.
insert into downtime_log (vehicle_id, start_date, reason, notes) values
  ('a0000000-0000-0000-0000-000000000005', current_date - 4, 'accident', 'Front bumper repair, waiting on parts');

-- ============================================================ compliance
-- Staggered expiries to exercise the 30/14/7-day alert tiers.

insert into compliance_docs (owner_type, vehicle_id, doc_type, issue_date, expiry_date, reference_no) values
  ('vehicle', 'a0000000-0000-0000-0000-000000000001', 'registration',   current_date - 160, current_date + 205, 'REG-4471'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000001', 'safety_sticker', current_date - 100, current_date + 80,  'SS-2210'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000001', 'mvil_insurance', current_date - 160, current_date + 205, 'MVIL-8830'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000002', 'registration',   current_date - 340, current_date + 25,  'REG-3902'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000002', 'safety_sticker', current_date - 170, current_date + 12,  'SS-1873'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000002', 'mvil_insurance', current_date - 340, current_date + 25,  'MVIL-7752'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000003', 'registration',   current_date - 300, current_date + 65,  'REG-5518'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000003', 'safety_sticker', current_date - 178, current_date + 5,   'SS-3341'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000004', 'registration',   current_date - 20,  current_date + 345, 'REG-6604'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000004', 'mvil_insurance', current_date - 20,  current_date + 345, 'MVIL-9917'),
  ('vehicle', 'a0000000-0000-0000-0000-000000000005', 'registration',   current_date - 368, current_date - 3,   'REG-2280');

insert into compliance_docs (owner_type, driver_id, doc_type, expiry_date, reference_no)
select 'driver', id, 'drivers_license', license_expiry, license_no from drivers;

-- ============================================================ deductions

insert into deductions (driver_id, type, amount, date, description) values
  ('d0000000-0000-0000-0000-000000000002', 'fuel',    40, current_date - 5, 'Fuel advance — Waigani'),
  ('d0000000-0000-0000-0000-000000000004', 'advance', 100, current_date - 8, 'Pay advance'),
  ('d0000000-0000-0000-0000-000000000001', 'fine',    50, current_date - 12, 'Parking fine — Town');
