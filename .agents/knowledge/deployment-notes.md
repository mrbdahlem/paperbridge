# Deployment Notes

Durable deployment, runtime, and hosting notes for ScribbledPage.

## 2026-05-15 Render and Neon Direction

- ScribbledPage deploys as a Render Node web service instead of a static site so the same service can own future API routes and database access.
- Runtime environments should use Node.js 24 or newer across Render, GitHub Actions, and devcontainers.
- The Render runtime serves Vite's `dist/` output through Fastify and exposes `/healthz` for service health checks.
- Render uses the full production build so the ScribbledPage dashboard, assignment flow, PDF tools index, and individual PDF tool pages are all available from the same deployed service.
- Render builds with `HUSKY=0 npm ci --include=dev && npm run build` so hosted installs skip local Git hook setup while still installing the devDependencies required by Vite and TypeScript under `NODE_ENV=production`.
- Render sets `SITE_URL=https://scribbled.page`; sitemap generation, localized canonical URLs, and SEO audit checks default to that same public domain when `SITE_URL` is not set.
- Fastify marks generated HTML, `sw.js`, `site.webmanifest`, and `*.worker.*` files as `Cache-Control: no-cache`, and hashed files under `/assets/` as `public, max-age=31536000, immutable`, to avoid stale entrypoints after deploys while keeping Vite assets cacheable.
- Production i18n page and sitemap generation defaults to locale folders with `scribbledpage.json`, currently `en`, `de`, `es`, `fr`, `ja`, and `pt`; `I18N_BUILD_LANGUAGES` can override this for one-off builds.
- The bundled PDF tools chrome is fixed to BentoPDF branding and should not consume Render's ScribbledPage environment variables; the Render environment no longer requires `VITE_BRAND_NAME`.
- Neon credentials must stay server-side in `DATABASE_URL`; browser-facing `VITE_*` variables must not contain database credentials.
- Neon development databases should use branches rather than a shared mutable development database when testing schema/data changes.

## 2026-05-16 Database Connection Prep

- Server-side database access is initialized in the Fastify runtime with Postgres.js using `DATABASE_URL`.
- Deployed Neon connections should use the pooled connection string unless a future workload requires direct connections.
- `/api/health` returns database status. Missing `DATABASE_URL` is treated as an unconfigured optional dependency; a configured but unreachable database returns `503`.
- Server startup logs whether database access is configured but must not log `DATABASE_URL` or credentials.
- Database migrations run separately from the long-running Node/Render server and should use `DATABASE_MIGRATION_URL`, a direct/non-pooled Neon connection string for a dedicated migration role with DDL privileges.
- Google OAuth and session values are server-only: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`, and `SESSION_SECRET`.

## 2026-06-02 Neon Branch Automation

- `scripts/neon-branch.mjs` manages short-lived local/PR Neon branches through the Neon API and is wired through `npm run db:branch:create`, `npm run db:branch:env`, and `npm run db:branch:delete`.
- Local branch setup requires `NEON_API_KEY` and `NEON_PROJECT_ID`; `NEON_PARENT_BRANCH_ID` should point at the production parent branch when creating dev branches from production.
- `db:branch:create` derives the Neon branch name from the current git branch, creates branch-local runtime and migration roles, and writes `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEON_BRANCH_ID`, and `NEON_BRANCH_NAME` to `.env.local`.
- Generated database URLs and `NEON_API_KEY` must stay out of committed env files and logs; the script masks connection-string passwords in normal output.
- Non-production server startup checks configured `NEON_BRANCH_NAME` against the current git branch when `DATABASE_URL` is set. `NEON_BRANCH_GUARD` defaults to `warn` outside production and `off` in production; `strict` fails startup on mismatch.
- `npm run db:migrate` runs ordered SQL migrations from `server/migrations/` with `DATABASE_MIGRATION_URL` and records applied filenames/checksums in `schema_migrations`.
- `.github/workflows/production-migrations.yml` runs production migrations on `push` to `main` and manual dispatch through the GitHub production environment. Migrations must be backward compatible with the currently deployed app because they may run before Render finishes deploying the new version.
