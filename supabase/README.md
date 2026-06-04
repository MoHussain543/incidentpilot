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
