-- Phase 1: incident + report persistence for authenticated users.
-- Apply in the Supabase SQL editor or via Supabase CLI.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  service_name text not null,
  environment text not null,
  alert_message text not null,
  logs_or_stack_trace text not null,
  recent_deploy_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.incidents
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  summary text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  suspected_component text not null,
  probable_causes jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  clarifying_questions jsonb not null default '[]'::jsonb,
  follow_up_answers jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint incident_reports_incident_version_unique unique (incident_id, version)
);

alter table public.incident_reports
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.incident_reports
  add column if not exists version integer;

alter table public.incident_reports
  add column if not exists follow_up_answers jsonb;

update public.incident_reports as incident_reports
set
  user_id = incidents.user_id,
  version = 1
from public.incidents as incidents
where incident_reports.incident_id = incidents.id
  and (incident_reports.user_id is null or incident_reports.version is null);

alter table public.incident_reports
  alter column user_id set not null;

alter table public.incident_reports
  alter column version set not null;

alter table public.incident_reports
  alter column version set default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'incident_reports_incident_version_unique'
      and conrelid = 'public.incident_reports'::regclass
  ) then
    alter table public.incident_reports
      add constraint incident_reports_incident_version_unique unique (incident_id, version);
  end if;
end
$$;

create index if not exists incidents_user_id_created_at_idx
  on public.incidents (user_id, created_at desc);

create index if not exists incident_reports_incident_id_version_idx
  on public.incident_reports (incident_id, version desc);

create index if not exists incident_reports_user_id_incident_id_version_idx
  on public.incident_reports (user_id, incident_id, version desc);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row
execute function public.handle_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_reports enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Incidents are readable by owner" on public.incidents;
create policy "Incidents are readable by owner"
  on public.incidents
  for select
  using (auth.uid() = user_id);

drop policy if exists "Incidents are insertable by owner" on public.incidents;
create policy "Incidents are insertable by owner"
  on public.incidents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Incidents are updatable by owner" on public.incidents;
create policy "Incidents are updatable by owner"
  on public.incidents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Incidents are deletable by owner" on public.incidents;
create policy "Incidents are deletable by owner"
  on public.incidents
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Incident reports are readable by owner" on public.incident_reports;
create policy "Incident reports are readable by owner"
  on public.incident_reports
  for select
  using (auth.uid() = user_id);

drop policy if exists "Incident reports are insertable by owner" on public.incident_reports;
create policy "Incident reports are insertable by owner"
  on public.incident_reports
  for insert
  with check (auth.uid() = user_id);
