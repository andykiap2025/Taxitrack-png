-- TaxiTrack PNG · Migration 6: odometer no longer captured at nightly
-- check-in (owner decision) — the reading is now optional. Service records
-- still capture the odometer, which keeps the 5,000 km due-tracking alive.
-- The odometer bump trigger is already null-safe (null compares to false).

alter table daily_takings
  alter column odometer_reading drop not null;
