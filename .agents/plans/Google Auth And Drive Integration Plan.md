# Google Auth And Drive Integration Plan

## Purpose

Make Google authentication the front door for ScribbledPage teacher workflows, while keeping QR scan/submission links usable by students without accounts.

Authenticated teachers should create assignments, generate packets, manage submissions, and authorize Google Drive export. Student scans should resolve opaque QR tokens and write submissions to the owning teacher's configured Drive destination through server-side authorization.

## Product Shape

- Public landing page explains the service and offers a Google sign-in button.
- Teacher dashboard, assignment creation, packet generation, and submission management require an authenticated teacher session.
- QR scan routes remain public capability URLs scoped by opaque tokens, not by teacher or student identity.
- Student-facing scan/upload flows expose only the minimum assignment/packet/page context needed to submit work.
- Google Drive writes use the teacher's stored authorization, not the scanner's identity.

## Security Model

- Keep `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`, `SESSION_SECRET`, database credentials, OAuth tokens, and Drive tokens server-only.
- Never expose OAuth tokens, refresh tokens, database URLs, or session secrets through `VITE_*` variables.
- Use secure, HTTP-only, same-site session cookies.
- Store Google provider identity separately from the internal ScribbledPage user id.
- Treat QR tokens as limited submission capabilities. They must stay opaque and unguessable.
- Scope public scan APIs to token-derived actions only. Do not expose teacher dashboard data from public token routes.
- Encrypt stored Google refresh tokens before production use, or keep the implementation flagged as non-production until token encryption is added.

## Data Model

Add migrations for:

- `users`
  - `id`
  - `email`
  - `display_name`
  - `created_at`
  - `updated_at`

- `google_accounts`
  - `user_id`
  - `google_sub`
  - `email`
  - `display_name`
  - `access_token`
  - `refresh_token`
  - `token_expires_at`
  - `drive_scope_granted`
  - `created_at`
  - `updated_at`

- Assignment ownership
  - Populate and enforce `assignments.owner_user_id`.
  - Existing unauthenticated/local development data may keep `owner_user_id` nullable during the transition.

Later Drive destination fields may belong on `users`, `assignments`, or a separate `drive_destinations` table once folder behavior is clearer.

## Server Work

- Add session cookie infrastructure to Fastify.
- Add Google OAuth routes:
  - `GET /auth/google`
  - `GET /auth/google/callback`
  - `POST /auth/logout`
- Add `GET /api/me` for frontend auth state.
- Add route guards for teacher APIs and app routes.
- Keep `/healthz`, `/api/health`, static assets, OAuth routes, landing page, and scan routes public.
- Update assignment repository methods to filter teacher-owned records by authenticated user id.
- On assignment creation, set `owner_user_id` from the current session.
- Add structured logs for auth success, auth failure, logout, token refresh, and Drive write outcomes without logging secrets or tokens.

## Frontend Work

- Add a public landing page with service description and Google sign-in action.
- Gate dashboard and assignment creation behind `/api/me` auth state.
- Show logged-in teacher identity and logout action in the app shell.
- Keep localStorage fallback only for static/local development when assignment APIs are unavailable.
- Add clear unauthenticated handling for deep links into teacher-only pages.
- Add public scan/submission views separately from teacher dashboard routes.

## Google Drive Work

- Request the narrowest Drive scope that supports the intended export/write behavior.
- Store teacher authorization server-side.
- Refresh Google access tokens server-side when needed.
- For teacher scan/upload workflows, export processed PDFs and summary CSVs to the teacher's selected Drive folder.
- For student QR submissions, resolve the QR token to the teacher-owned assignment and write accepted submissions to that teacher's Drive destination.
- Record Drive export state and errors in durable metadata before exposing submission management UI.

## Local Development

- Use `.env.local` for local server-only auth configuration:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URL`
  - `SESSION_SECRET`
  - `DATABASE_URL`
  - `DATABASE_MIGRATION_URL`
- Use a localhost OAuth redirect such as `http://localhost:3000/auth/google/callback` when running the Fastify server locally.
- Prefer the production-like local path for auth testing:
  - `npm run build`
  - `npm start`
- Keep Vite-only `npm run dev` available for static/frontend work, with API-backed features falling back when routes are unavailable.
- Consider adding `npm run dev:full` after the initial auth path is proven.

## Implementation Checklist

- [ ] Add `users` and `google_accounts` migrations.
- [ ] Add session-cookie dependencies and server configuration.
- [ ] Add Google OAuth start, callback, and logout routes.
- [ ] Add `/api/me`.
- [ ] Add authenticated user context to Fastify requests.
- [ ] Gate teacher APIs and teacher app routes.
- [ ] Associate assignments with authenticated users.
- [ ] Filter assignment list/detail/delete by owner.
- [ ] Add public landing page with Google sign-in.
- [ ] Add app-shell auth state and logout.
- [ ] Add public QR scan/submission route boundaries.
- [ ] Add Drive authorization storage and token refresh.
- [ ] Add Drive export/write service.
- [ ] Add tests for auth routes, API guards, ownership filtering, and public scan access.
- [ ] Update `README.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`, `.env.example`, and `.agents/knowledge/deployment-notes.md` when implementation changes runtime/auth behavior.

## Open Decisions

- Choose the first Drive scope and export behavior: app-created folder only, selected folder, or teacher's root Drive.
- Decide whether Google sign-in and Drive authorization happen together or in two explicit steps.
- Decide local authenticated development port and whether to add `npm run dev:full`.
- Decide production refresh-token encryption approach before storing real teacher Drive refresh tokens.
- Decide whether public scan uploads require any additional anti-abuse control beyond opaque QR tokens and rate limits.
