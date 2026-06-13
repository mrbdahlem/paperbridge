# Deployment

ScribbledPage deploys as a Render Node web service. The service runs the Fastify server in `server/`, serves the generated Vite `dist/` output, and exposes API routes from the same runtime.

## Render Blueprint

`render.yaml` is the deployment source of truth.

- Runtime: Node 24 or newer
- Build command: `HUSKY=0 npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/healthz`
- Runtime server: Fastify serving the full `dist/` app, including ScribbledPage and PDF tools pages

Render sets `NODE_ENV=production`, but the hosted build still needs dev dependencies because Vite, TypeScript, and build-time plugins live in `devDependencies`. `HUSKY=0` skips local Git hook setup during the hosted install.

The repository uses npm workspaces for the ScribbledPage and BentoPDF tools validation slices, but Render still installs and builds from the repository root. The workspace packages are not separate deployed services.

## Environment

Required or expected Render variables:

- `NODE_ENV=production`
- `NODE_VERSION=24`
- `LOG_LEVEL=info`
- `SITE_URL=https://scribbled.page`
- `VITE_QR_BASE_URL`: configured in Render when QR links should use a deployed base URL
- `DATABASE_URL`: pooled Neon connection string for runtime app traffic
- `DATABASE_MIGRATION_URL`: direct, non-pooled Neon connection string for migration jobs only
- `GOOGLE_CLIENT_ID`: configured when Google OAuth authentication is enabled
- `GOOGLE_CLIENT_SECRET`: configured when Google OAuth authentication is enabled
- `GOOGLE_OAUTH_REDIRECT_URL`: the deployed OAuth callback URL registered with Google
- `SESSION_SECRET`: a long random value used for server-side session signing

Keep `DATABASE_URL` and `DATABASE_MIGRATION_URL` server-only. Do not put database credentials in any `VITE_*` variable because Vite exposes those values to browser code.
Keep Google OAuth secrets and session secrets server-only for the same reason.

Optional database pool tuning variables:

- `DATABASE_POOL_MAX`: maximum Postgres.js connections, defaults to `5`
- `DATABASE_IDLE_TIMEOUT_SECONDS`: idle connection timeout, defaults to `20`
- `DATABASE_CONNECT_TIMEOUT_SECONDS`: connection timeout, defaults to `5`

`/api/health` reports whether database connectivity is configured and reachable. When `DATABASE_URL` is absent, the endpoint stays healthy and reports the database as unconfigured. When `DATABASE_URL` is present but a database check fails, the endpoint returns `503`.
On startup, the Fastify runtime logs whether a database connection is configured without logging the database URL or credentials.

When database access is configured, `/api/assignments` persists ScribbledPage assignment, packet, and QR token metadata in Postgres. `/api/qr-tokens/:token` resolves printed QR tokens server-side. When database access is not configured, these assignment APIs return `503` while the static app and `/api/health` remain available.

Local Node server commands load `.env` and `.env.local` automatically. Shell-provided environment variables take precedence over checked-in or local env files. Hosted Render and GitHub Actions environments should continue to provide secrets through their platform environment-variable systems.

Database migrations must run separately from the Fastify runtime server. The Render web service should use a runtime-only pooled `DATABASE_URL` role for normal app traffic, while migration jobs or release commands should use `DATABASE_MIGRATION_URL` with a direct, non-pooled Neon connection string and a separate migration role with schema change privileges. Do not grant production DDL permissions to the long-running server role.
For Neon, make sure the role inside `DATABASE_MIGRATION_URL` has `CREATE` on the target schema, usually `public`, before running `npm run db:migrate`. Newly generated branch roles may be able to connect before they have DDL privileges. After migrations run, the migration runner grants normal table read/write privileges to the runtime role from `DATABASE_URL`.

`npm run db:migrate` runs ordered `.sql` files from `server/migrations/` and records applied filenames and checksums in the configured migrations table, which defaults to `schema_migrations`. Production migrations run through `.github/workflows/production-migrations.yml` on `push` to `main`, which is the post-merge event for PRs. The workflow uses the GitHub production environment secret `DATABASE_MIGRATION_URL` for migration execution and `DATABASE_URL` only to identify the runtime role that should receive normal table privileges after migrations run.

Production migrations may run before or alongside Render's automatic deploy, so migration files must be backward compatible with the currently deployed app and the new app version. Do not edit a migration after it has run against a shared or production database; add a new migration instead.

Short-lived local or PR development database branches should be created through the Neon API rather than the Neon dashboard. `npm run db:branch:create` reads `NEON_API_KEY`, `NEON_PROJECT_ID`, and optional `NEON_PARENT_BRANCH_ID` from the local shell, derives a Neon branch name from the current git branch, creates branch-local runtime and migration roles, and writes `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEON_BRANCH_ID`, and `NEON_BRANCH_NAME` to `.env.local`. `npm run db:branch:env` prints exportable values without writing a file. `npm run db:branch:delete` removes the matching short-lived Neon branch when the local branch or PR is done. Do not commit `NEON_API_KEY` or generated database URLs.

When `DATABASE_URL` and `NEON_BRANCH_NAME` are configured, non-production server startup compares the configured Neon branch name to the current git branch. `NEON_BRANCH_GUARD` accepts `warn`, `strict`, or `off`; it defaults to `warn` outside production and `off` in production. Use `strict` when local or preview startup should fail fast on a branch mismatch.

Generate a `SESSION_SECRET` value with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Cache Policy

The Fastify server sets cache headers for generated frontend files:

- `*.html`: `Cache-Control: no-cache`
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- `sw.js`, `site.webmanifest`, and `*.worker.*`: `Cache-Control: no-cache`

HTML is revalidated so deploys can update references to the current hashed Vite assets. Hashed assets are immutable because their filenames change when their contents change.

## Localized Pages

Production builds generate localized HTML and sitemap entries for the active ScribbledPage translation set: `en`, `de`, `es`, `fr`, `ja`, and `pt`.

Generated canonical URLs, localized page URLs, and sitemap entries use `SITE_URL`, which defaults to `https://scribbled.page`.

The build language list defaults to locale folders that contain `scribbledpage.json`. To run a one-off build with a different subset, set `I18N_BUILD_LANGUAGES` to a comma-separated list such as `en,es,fr`.

## Validation

Before changing deployment, runtime, build, or server behavior, run:

```bash
npm test
```

For build-related changes, also run:

```bash
npm run build
```

If local port binding is blocked in an agent environment, use tests that inject requests into `buildServer()` instead of relying on a bound socket.
