# Supabase schema

## Phase 1 persistence

Run the migration in your Supabase project before using saved incidents in the app:

1. Open the Supabase dashboard for your project.
2. Go to **SQL Editor**.
3. Paste and run `migrations/001_phase1_persistence.sql`.

Or, with the Supabase CLI linked to the project:

```bash
supabase db push
```

## Tables

- `profiles` — one row per authenticated user (`id` = `auth.users.id`)
- `incidents` — intake payload per investigation (`user_id` scopes ownership)
- `incident_reports` — versioned AI output per incident (`version` starts at 1; refine appends new rows)

Row Level Security restricts all reads and writes to the signed-in user.

## Phase 4 ownership hardening

Run `migrations/002_phase4_ownership_hardening.sql` after Phase 1 to:

- Require `incident_reports` inserts to reference an incident owned by `auth.uid()`
- Block report updates and deletes (immutable version history)
- Enforce `incident_reports.user_id = incidents.user_id` via database trigger

## Backend JWT verification

The frontend uses the signed-in user's Supabase access token when it calls the Spring Boot API.

For backend JWT enforcement with Supabase signing keys:

- Set `SUPABASE_URL=https://<project-ref>.supabase.co` in the backend environment
- Spring Boot derives:
  - issuer: `https://<project-ref>.supabase.co/auth/v1`
  - JWKS: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
- Only use `SUPABASE_JWT_ISSUER` or `SUPABASE_JWKS_URL` if you need to override those defaults
- Set `APP_REQUIRE_AUTH=false` only for local development if you intentionally want the backend to skip JWT checks
