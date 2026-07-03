-- TaxiTrack PNG · Migration 5: identity photos & extra details.
-- Drivers: face photo, license photo, province of origin, residence.
-- Vehicles: photo, engine number.

alter table drivers
  add column photo_url text,
  add column license_photo_url text,
  add column province text,
  add column residence text;

alter table vehicles
  add column photo_url text,
  add column engine_no text;

-- Private bucket for driver/vehicle photos (paths: drivers/{id}/face.jpg,
-- drivers/{id}/license.jpg, vehicles/{id}/photo.jpg).
insert into storage.buckets (id, name, public)
values ('fleet-photos', 'fleet-photos', false)
on conflict (id) do nothing;

create policy storage_fleet_photos_staff on storage.objects
  for all using (bucket_id = 'fleet-photos' and is_staff())
  with check (bucket_id = 'fleet-photos' and is_staff());