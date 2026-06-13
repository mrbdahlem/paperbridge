<p align="center"><img src="public/images/favicon-no-bg.svg" width="80"></p>
<h1 align="center">ScribbledPage</h1>

ScribbledPage is the primary project in this repository. It focuses on printable PDF assignments, QR-stamped packet generation, and submission workflows for paper-first classrooms.

This repository also still ships the BentoPDF tool surface as a secondary capability. Public tool pages can remain BentoPDF-branded where they describe those PDF utilities.

## Repository Scope

- ScribbledPage application code lives under `src/js/scribbledpage/`.
- Forked BentoPDF tool pages remain available in the broader app as an optional cohosted convenience surface.
- Repository documentation now focuses on development and maintenance, not commercial terms, deployment recipes, or external agreement processes.

## Development

Use Node.js 24 or newer.

```bash
git clone https://github.com/mrbdahlem/scribbledpage.git
cd scribbledpage
npm install
npm run dev
```

By default, `npm run dev` serves on `http://localhost:5173` and `npm run preview` serves on `http://localhost:4173`.
Outside devcontainers both bind to `localhost`; devcontainers set `VITE_DEV_HOST=0.0.0.0` and `VITE_PREVIEW_HOST=0.0.0.0` so forwarded ports are reachable from the host machine.
Set `VITE_DEV_PORT` in your shell or `.env.development.local` if you need a different dev server port.
Set `VITE_PREVIEW_PORT` in your shell, `.env.local`, or `.env.production.local` if you need a different preview server port.
Dependency discovery and broad pre-bundling are disabled by default to keep local startup memory low; JSZip remains pre-bundled for the ScribbledPage assignment flow.
Set `VITE_ENABLE_DEP_OPTIMIZER=true` to opt into broader Vite pre-bundling for heavier tool-page development.
Production i18n page generation currently emits the active ScribbledPage language set: English, German, Spanish, French, Japanese, and Portuguese.

Backend persistence is prepared through a server-only `DATABASE_URL`, intended for a Neon Postgres pooled connection string in deployed environments. Database migrations use server-only `DATABASE_MIGRATION_URL`, intended for a direct, non-pooled Neon connection string. Google OAuth setup uses server-only `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`, and `SESSION_SECRET` values. Do not prefix secrets with `VITE_`; Vite exposes those variables to browser code.
Run database migrations separately from the long-running Node/Render web server, using `npm run db:migrate` with a dedicated migration role rather than the runtime server role. Production migrations run from `.github/workflows/production-migrations.yml` after changes land on `main`.
The first durable paper-submission records are `assignments`, `packets`, and `qr_tokens`, exposed through server-only Fastify APIs under `/api/assignments` and `/api/qr-tokens/:token`.
The role in `DATABASE_MIGRATION_URL` must have schema DDL privileges, such as `CREATE` on `public`, before migrations can create tables.
Generate a local `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

For branch-isolated Neon development, set `NEON_API_KEY`, `NEON_PROJECT_ID`, and usually `NEON_PARENT_BRANCH_ID` in your local shell, then run `npm run db:branch:create`. The script derives a Neon branch name from the current git branch, creates branch-local runtime and migration roles, and writes `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEON_BRANCH_ID`, and `NEON_BRANCH_NAME` to `.env.local`. Local server startup compares `NEON_BRANCH_NAME` to the current git branch when `DATABASE_URL` is configured; use `NEON_BRANCH_GUARD=warn`, `strict`, or `off` to control that check. Use `npm run db:branch:env` to print shell exports for the current branch, and `npm run db:branch:delete` when the short-lived Neon branch is no longer needed.
Node server commands such as `npm start` and `npm run db:migrate` load `.env` and `.env.local` automatically, with real shell variables taking precedence.

Useful scripts:

- `npm run ci:scribbledpage` runs lint, typecheck, tests, and build for the ScribbledPage slice.
- `npm run ci:tools` runs lint, typecheck, tests, and build for the bundled PDF tools surface.
- `npm run ci -w @scribbledpage/app` and `npm run ci -w @scribbledpage/tools` run the same checks through the npm workspace packages.
- `npm test -- --run` runs the full repository test suite.
- `npm run db:branch:create` creates or reuses a short-lived Neon branch for the current git branch and updates `.env.local`.
- `npm run db:branch:env` prints shell exports for the current git branch's Neon connection strings.
- `npm run db:branch:delete` deletes the current git branch's matching short-lived Neon branch.
- `npm run db:migrate` runs ordered SQL migrations from `server/migrations/` using `DATABASE_MIGRATION_URL`.
- `npm run docs:dev` starts the docs site.
- `npm start` serves the production `dist/` build through the Fastify server.

## Deployment

ScribbledPage deploys as a Render Node web service using `render.yaml`. The Fastify runtime serves the full `dist/` app, including ScribbledPage and PDF tools pages, and exposes `/healthz` for service health checks.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render blueprint, environment variables, cache policy, and validation steps.

## Documentation

- [docs/getting-started.md](docs/getting-started.md) covers local repository setup.
- [docs/contributing.md](docs/contributing.md) covers the lightweight project workflow.
- [ARCHITECTURE.md](ARCHITECTURE.md) covers current source boundaries and the workspace migration direction.
- [apps/tools/UPSTREAM.md](apps/tools/UPSTREAM.md) covers the BentoPDF fork boundary and upstream tracking notes.
- [DEPLOYMENT.md](DEPLOYMENT.md) covers Render deployment and runtime behavior.
- [docs/licensing.md](docs/licensing.md) and [licensing.html](licensing.html) summarize the repository license notices.

## Project Workflow

Use [CONTRIBUTING.md](CONTRIBUTING.md) for issue, pull request, and validation expectations.

## License

See [LICENSE](LICENSE) for the repository license terms.
