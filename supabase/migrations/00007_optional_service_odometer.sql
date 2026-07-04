-- TaxiTrack PNG · Migration 7: odometer fully optional (this operation
-- doesn't track km). Service records no longer require a reading; the
-- next-due odometer is only computed when a reading is given, so service
-- scheduling falls back to the 3-month rule alone.

alter table service_records
  alter column odometer_at_service drop not null;

create or replace function set_service_next_due()
returns trigger
language plpgsql as $$
begin
  new.next_due_date := (new.service_date + interval '3 months')::date;
  new.next_due_odometer := case
    when new.odometer_at_service is null then null
    else new.odometer_at_service + 5000
  end;
  return new;
end $$;
