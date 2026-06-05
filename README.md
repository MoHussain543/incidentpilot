# IncidentPilot

IncidentPilot is a full-stack AI incident triage app that helps developers understand production issues faster, decide the next debugging steps, and refine an analysis when missing evidence is supplied later.

**Live deployment**

- Frontend: [incidentpilot.vercel.app](https://incidentpilot.vercel.app)
- Backend API: `https://incidentpilot-production.up.railway.app`

## What It Does

- Accepts structured incident context from a dedicated intake page
- Runs analysis through a focused loading state, then opens an investigation workspace with the triage report
- Calls the OpenAI Responses API with strict JSON schema output
- Returns a typed triage report with summary, severity, suspected component, probable causes, next steps, confidence, and clarifying questions
- Supports a follow-up refinement loop that creates new report versions instead of overwriting earlier analysis
- Accepts `.log`, `.txt`, and `.md` files on the frontend by folding their text into the incident context
- Persists analyzed incidents and versioned AI reports to Supabase for the signed-in user

## User Flow

1. **Landing page** — public overview of the product, example incident, and sign-up/sign-in
2. **Incident intake** — structured fields for title, service, environment, alert, logs, deploy notes, and optional file upload
3. **Analyzing** — full-screen overlay while the backend reviews the signal
4. **Investigation workspace** — report, clarifying questions, version timeline, export/copy actions
5. **Refine** — submit new evidence to generate the next report version
6. **Reports** — account-wide library of saved incidents; reopen any investigation to continue or review history

## Repo Layout

- `backend/` — Spring Boot API for incident analysis, refinement, and Supabase JWT verification
- `frontend/` — Vite + React + TypeScript UI
- `supabase/` — SQL migrations for profiles, incidents, report versions, and ownership hardening

## Local Setup

### Backend

1. `cd backend`
2. Set environment variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes | OpenAI API key used for analysis |
| `OPENAI_MODEL` | No | Defaults to `gpt-5-mini` |
| `APP_CORS_ALLOWED_ORIGINS` | No | Defaults to `http://localhost:5173` |
| `SUPABASE_URL` | For auth | Project URL, e.g. `https://<ref>.supabase.co` |
| `APP_REQUIRE_AUTH` | No | Set to `false` only for local dev without JWT checks |

3. Run `./mvnw spring-boot:run`

### Frontend

1. `cd frontend`
2. Copy `.env.example` to `.env` and set:

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_API_BASE_URL` | `http://localhost:8080` |

3. Run `npm install`
4. Run `npm run dev`

### Supabase

1. Apply migrations in order (see `supabase/README.md`):
   - `supabase/migrations/001_phase1_persistence.sql`
   - `supabase/migrations/002_phase4_ownership_hardening.sql`
2. Enable Email auth for your project
3. The frontend saves data with the signed-in user's Supabase session; RLS enforces ownership

**Persistence behavior**

- **Analyze** creates a new `incidents` row and `incident_reports` version `1`
- **Refine** appends a new `incident_reports` row with the next version number for the same incident
- AI analysis runs through the Spring Boot API; persistence happens after a successful response
- If saving fails, the investigation view still works and the UI shows a workspace save warning

**Security**

- Supabase RLS + DB trigger enforce per-user incident ownership
- Frontend verifies the signed-in user before every incident/report read or write
- Spring Boot protects `/api/v1/incidents/*` with the signed-in Supabase access token when `SUPABASE_URL` is set
- The backend verifies tokens against Supabase JWKS (RS256 and ES256)
- Set `SUPABASE_JWT_SECRET` only if your project still signs user tokens with the legacy HS256 JWT secret
- Set `APP_REQUIRE_AUTH=false` only for local backend development without JWT validation

## API Contract

### `POST /api/v1/incidents/analyze`

Requires `Authorization: Bearer <supabase-access-token>` when backend auth is enabled.

Request body:

```json
{
  "title": "Checkout failures after deploy",
  "serviceName": "payments",
  "environment": "production",
  "alertMessage": "HTTP 500 spike",
  "logsOrStackTrace": "java.net.UnknownHostException: db.internal",
  "recentDeployNotes": "Released build 204 with payment adapter config changes."
}
```

Response body:

```json
{
  "summary": "Checkout traffic is failing because the payment adapter cannot resolve the configured database host.",
  "severity": "HIGH",
  "suspectedComponent": "payment-adapter",
  "probableCauses": [
    "A bad database host value was deployed",
    "The service is reading a stale secret"
  ],
  "nextSteps": [
    "Compare the deployed DB host with the last known good release",
    "Verify that the payment adapter picked up the newest secret"
  ],
  "confidence": 0.84,
  "clarifyingQuestions": [
    "Did the issue begin immediately after the latest deployment?"
  ]
}
```

### `POST /api/v1/incidents/refine`

Takes the original incident request, the previous report, and user-supplied answers to follow-up questions, then returns the same structured response shape with updated conclusions.

## Deployment

### Frontend (Vercel)

- Root directory: `frontend`
- Framework preset: Vite
- `frontend/vercel.json` is included

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_API_BASE_URL` | Railway backend URL, no trailing slash |

Example:

```bash
VITE_API_BASE_URL=https://incidentpilot-production.up.railway.app
```

Redeploy Vercel after changing any `VITE_*` variable. Vite bakes these into the build at compile time.

### Backend (Railway)

- Root directory: `backend`
- Uses the included [Dockerfile](backend/Dockerfile)

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_MODEL` | Optional, defaults to `gpt-5-mini` |
| `SUPABASE_URL` | Your Supabase project URL |
| `APP_CORS_ALLOWED_ORIGINS` | Exact Vercel site URL |

Example:

```bash
APP_CORS_ALLOWED_ORIGINS=https://incidentpilot.vercel.app
```

Railway sets `PORT` automatically. Redeploy after changing backend variables.

### Deployment troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Preflight response is not successful. Status code: 403` | Frontend origin not allowed by backend CORS | Set `APP_CORS_ALLOWED_ORIGINS` to your exact Vercel URL and redeploy Railway |
| `Could not reach the IncidentPilot API` | Wrong `VITE_API_BASE_URL` or backend not running | Confirm Railway URL, rebuild/redeploy Vercel |
| `The server is missing OPENAI_API_KEY` / HTTP 503 | Backend OpenAI key not configured | Set `OPENAI_API_KEY` on Railway and redeploy |
| HTTP 401 on analyze | Missing or expired Supabase session token | Sign in again; confirm `SUPABASE_URL` on Railway |
| HTTP 502 | OpenAI request failed | Check Railway logs, API key validity, and model name |

Verify CORS after deploy:

```bash
curl -X OPTIONS "https://incidentpilot-production.up.railway.app/api/v1/incidents/analyze" \
  -H "Origin: https://incidentpilot.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" -i
```

A successful preflight returns `200` and `access-control-allow-origin: https://incidentpilot.vercel.app`.

## Development Notes

- Frontend tests: `cd frontend && npm test`
- Backend tests: `cd backend && ./mvnw test`
- Investigation preview in dev: open the app with `?preview=investigation` to inspect the investigation workspace UI with sample data
