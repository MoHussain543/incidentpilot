# IncidentPilot

IncidentPilot is a full-stack AI incident triage app that helps developers understand production issues faster, decide the next debugging steps, and refine an analysis when missing evidence is supplied later.

## What It Does

- Accepts structured incident context from a web UI
- Calls the OpenAI Responses API with strict JSON schema output
- Returns a typed triage report with summary, severity, suspected component, probable causes, next steps, confidence, and clarifying questions
- Supports a follow-up refinement loop instead of a generic chatbot flow
- Accepts `.log`, `.txt`, and `.md` files on the frontend by folding their text into the incident context
- Persists analyzed incidents and versioned AI reports to Supabase for the signed-in user (Phase 1)

## Repo Layout

- `backend/`: Spring Boot API for incident analysis and refinement
- `frontend/`: Vite + React + TypeScript UI
- `supabase/`: SQL migrations for profiles, incidents, and incident report versions

## Local Setup

### Backend

1. `cd backend`
2. Set environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` optional, defaults to `gpt-5-mini`
   - `APP_CORS_ALLOWED_ORIGINS` optional, defaults to `http://localhost:5173`
3. Run `./mvnw spring-boot:run`

### Frontend

1. `cd frontend`
2. Copy `.env.example` to `.env` and set Supabase + API values
3. Run `npm install`
4. Run `npm run dev`

### Supabase (Phase 1 persistence)

1. Apply `supabase/migrations/001_phase1_persistence.sql` in the Supabase SQL editor (see `supabase/README.md`)
2. Ensure Email auth is enabled for your project
3. The frontend saves data with the signed-in user's Supabase session (RLS enforces ownership)

**Persistence behavior**

- **Analyze** creates a new `incidents` row and `incident_reports` version `1`
- **Refine** appends a new `incident_reports` row with the next version number for the same incident
- AI analysis still runs through the Spring Boot API; persistence happens after a successful response
- If saving fails, the on-screen analysis still works and the UI shows a workspace save warning

## API Contract

### `POST /api/v1/incidents/analyze`

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

## Deployment Notes

- Frontend target: Vercel, with the root directory set to `frontend`
- Backend target: Railway, with the root directory set to `backend`
- Set `VITE_API_BASE_URL` in the frontend deployment to the Railway backend URL
- Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `APP_CORS_ALLOWED_ORIGINS` in the backend deployment
- A backend [Dockerfile](/Users/bilalhussain/Documents/GitHub/incidentpilot/backend/Dockerfile) is included for container-based Railway deployment
