-- TaxiTrack PNG · Migration 4: keep vehicles.odometer_current fresh from
-- nightly takings entries. SECURITY DEFINER so supervisor check-ins can
-- bump the odometer even though direct vehicle updates are owner-only.

create or replace function bump_vehicle_odometer()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update vehicles
     set odometer_current = new.odometer_reading
   where id = new.vehicle_id
     and odometer_current < new.odometer_reading;
  return new;
end $$;

create trigger daily_takings_odometer
  after insert or update of odometer_reading on daily_takings
  for each row execute function bump_vehicle_odometer();
