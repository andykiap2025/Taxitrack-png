-- TaxiTrack PNG · Migration 3: private storage buckets + policies.
-- payslips        → PDF payslips, one folder per driver id
-- compliance-docs → photos/scans of rego, stickers, MVIL, licenses
-- incident-photos → incident evidence photos

insert into storage.buckets (id, name, public)
values
  ('payslips', 'payslips', false),
  ('compliance-docs', 'compliance-docs', false),
  ('incident-photos', 'incident-photos', false)
on conflict (id) do nothing;

-- Staff (owner/supervisor) manage compliance and incident files.
create policy storage_staff_docs_all on storage.objects
  for all using (
    bucket_id in ('compliance-docs', 'incident-photos') and is_staff()
  ) with check (
    bucket_id in ('compliance-docs', 'incident-photos') and is_staff()
  );

-- Payslips: owner writes; a driver can read files in their own folder
-- (object path convention: {driver_id}/{period_start}.pdf).
create policy storage_payslips_owner on storage.objects
  for all using (bucket_id = 'payslips' and is_owner())
  with check (bucket_id = 'payslips' and is_owner());

create policy storage_payslips_driver_read on storage.objects
  for select using (
    bucket_id = 'payslips'
    and (storage.foldername(name))[1] = current_driver_id()::text
  );
