-- TaxiTrack PNG · Migration 8: tighten supervisor permissions.
-- Compliance becomes READ-ONLY for the supervisor: they can view documents
-- and photos but cannot add, renew or edit them. (Reports are owner-only
-- in the app; they are built from data the supervisor already reads for
-- check-in, so there is no separate table to lock here.)

-- compliance_docs: remove the supervisor's write access.
-- Reading stays possible through the existing compliance_select policy.
drop policy if exists compliance_supervisor_insert on compliance_docs;
drop policy if exists compliance_supervisor_update on compliance_docs;

-- Storage: the old shared policy gave staff full access to both buckets.
-- Split it so the supervisor keeps full access to incident photos but
-- only READ on compliance document photos.
drop policy if exists storage_staff_docs_all on storage.objects;

create policy storage_incident_photos_staff on storage.objects
  for all using (bucket_id = 'incident-photos' and is_staff())
  with check (bucket_id = 'incident-photos' and is_staff());

create policy storage_compliance_owner_all on storage.objects
  for all using (bucket_id = 'compliance-docs' and is_owner())
  with check (bucket_id = 'compliance-docs' and is_owner());

create policy storage_compliance_staff_read on storage.objects
  for select using (bucket_id = 'compliance-docs' and is_staff());
