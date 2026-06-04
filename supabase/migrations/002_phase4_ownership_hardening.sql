-- Phase 4: ownership hardening for incidents and immutable report history.

drop policy if exists "Incident reports are insertable by owner" on public.incident_reports;
create policy "Incident reports are insertable by owner"
  on public.incident_reports
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.incidents
      where incidents.id = incident_id
        and incidents.user_id = auth.uid()
    )
  );

drop policy if exists "Incident reports are not updatable" on public.incident_reports;
create policy "Incident reports are not updatable"
  on public.incident_reports
  for update
  using (false)
  with check (false);

drop policy if exists "Incident reports are not deletable" on public.incident_reports;
create policy "Incident reports are not deletable"
  on public.incident_reports
  for delete
  using (false);

create or replace function public.enforce_incident_report_owner()
returns trigger
language plpgsql
as $$
declare
  incident_owner uuid;
begin
  select user_id
  into incident_owner
  from public.incidents
  where id = new.incident_id;

  if incident_owner is null then
    raise exception 'Incident % does not exist', new.incident_id;
  end if;

  if incident_owner <> new.user_id then
    raise exception 'incident_reports.user_id must match incidents.user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists incident_reports_enforce_owner on public.incident_reports;
create trigger incident_reports_enforce_owner
before insert on public.incident_reports
for each row
execute function public.enforce_incident_report_owner();
