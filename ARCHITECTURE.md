# Architecture

ScribbledPage is the primary application in this repository. It currently ships as one deployable Vite/Fastify app that includes the ScribbledPage classroom workflow and a bundled BentoPDF tools surface.

This document describes the current workspace structure and records the intended direction for moving source files into the workspace directories after the package boundaries are validated.

## System Shape

The repository has three runtime-facing surfaces:

- ScribbledPage app: classroom assignment, packet generation, QR stamping, and submission-oriented workflows.
- BentoPDF tools surface: forked convenience PDF utility pages that remain available inside the same deployed app.
- Fastify runtime: production server that serves the generated Vite `dist/` output and exposes server endpoints such as `/healthz`.
- Postgres persistence: server-only database access prepared for Neon-hosted Postgres through runtime `DATABASE_URL` and migration-only `DATABASE_MIGRATION_URL`.

The current deployment still builds one frontend bundle set and serves one `dist/` directory. npm workspaces now provide package-level validation boundaries while source files remain in their current root-level paths.

## Source Boundaries

| Area                        | Ownership                                                              |
| --------------------------- | ---------------------------------------------------------------------- |
| `apps/scribbledpage/`       | npm workspace package for the primary app validation scripts           |
| `apps/tools/`               | npm workspace package for the forked BentoPDF tools validation scripts |
| `src/js/scribbledpage/`     | Primary ScribbledPage application logic                                |
| `index.html`                | ScribbledPage dashboard entry                                          |
| `create-assignment.html`    | ScribbledPage assignment creation entry                                |
| `src/pages/`                | BentoPDF tool pages                                                    |
| `src/js/logic/`             | BentoPDF page controllers and tool workflows                           |
| `src/js/utils/`             | PDF utility helpers currently shared by tools                          |
| `src/js/types/`             | Tool and PDF utility types                                             |
| `src/js/config/`            | Tool configuration and runtime constants                               |
| `src/css/scribbledpage.css` | ScribbledPage visual system                                            |
| `src/css/styles.css`        | Broader tools/shared styling                                           |
| `server/`                   | Fastify production runtime                                             |
| `scripts/`                  | Build, i18n, sitemap, packaging, and docs glue                         |
| `public/`                   | Static assets, workers, locales, and vendored browser assets           |

ScribbledPage source should not import BentoPDF page controllers from `src/js/logic/`. The current relationship is cohosting only: ScribbledPage links to the tools surface, but does not depend on the tools workspace for product behavior.

BentoPDF tool pages may continue to use BentoPDF branding where the user-facing page is a PDF utility. Repository workflow, deployment, and contributor documentation should use ScribbledPage as the primary project identity.

`@scribbledpage/tools` is a maintained fork boundary, not first-party ScribbledPage product code. Fork metadata and maintenance policy live in [apps/tools/UPSTREAM.md](apps/tools/UPSTREAM.md). Do not introduce a ScribbledPage dependency on the tools workspace unless there is a concrete product need; if that need appears, create a narrow shared adapter/package rather than importing BentoPDF page controllers directly.

## Build And Routing

`vite.config.ts` is the current build source of truth. It defines:

- app and tool HTML inputs
- `BUILD_TARGET=scribbledpage` filtering for the ScribbledPage slice
- `BUILD_TARGET=tools` filtering for the bundled tools surface
- localized route handling for development and preview
- static asset copying and compression

Production builds emit localized ScribbledPage pages for the active language set. `scripts/generate-i18n-pages.mjs`, `scripts/generate-sitemap.mjs`, and `scripts/generate-security-headers.mjs` run after the Vite build in the root `npm run build` pipeline.

The production server in `server/` serves the full `dist/` output. Deployment details, environment variables, and cache behavior live in [DEPLOYMENT.md](DEPLOYMENT.md).

Database access is owned by the Fastify runtime in `server/`. Browser code must not import database helpers or receive database credentials. The current database client uses Postgres.js against pooled runtime `DATABASE_URL`, which keeps the runtime compatible with Neon while avoiding a Neon-specific application dependency.
Assignment, packet, and QR token metadata is persisted through server-side repository helpers and exposed through Fastify JSON routes. Browser code should call those APIs instead of talking to Postgres directly.

Schema migrations are a separate Node/Render execution path from the long-running
Fastify server. The server runtime should use a least-privilege database role
for app traffic, while migration commands use a dedicated migration role with
DDL privileges through direct, non-pooled `DATABASE_MIGRATION_URL`.
Migration files live in `server/migrations/` and run through `npm run
db:migrate`; GitHub Actions runs the same command against production after
changes land on `main`.
Short-lived local and PR development databases are expected to use Neon branches
created from the production parent branch through `scripts/neon-branch.mjs`,
which keeps branch setup in source-controlled automation instead of relying on
manual dashboard steps. Non-production server startup validates configured
`NEON_BRANCH_NAME` against the current git branch when database access is
configured, with `NEON_BRANCH_GUARD` controlling warn, strict, or off behavior.

## Validation Boundaries

The root package orchestrates workspace scripts:

- `npm run ci:scribbledpage` validates the ScribbledPage slice.
- `npm run ci:tools` validates the BentoPDF tools slice.
- `npm test -- --run` runs the full repository test suite.

The scoped CI commands delegate to `@scribbledpage/app` and `@scribbledpage/tools` through npm workspaces. The workspace packages intentionally call back into the root Vite, TypeScript, ESLint, and Vitest configs until source files are physically moved.

ScribbledPage-specific tests use the `src/tests/scribbledpage-*.test.ts` naming pattern. Tool tests and shared utility tests remain in `src/tests/` until the later workspace migration.

When changing shared build, runtime, docs, or test configuration, run the full test suite in addition to the relevant scoped CI command.

## Workspace Direction

The desired end state is a clearer physical split:

```text
apps/
  scribbledpage/
  tools/
packages/
  shared/
```

The first npm workspace pass intentionally keeps the root deployment pipeline and source paths intact. The next phase should move source files into the workspace directories after the workspace scripts remain stable.

Recommended migration order:

1. Keep `apps/scribbledpage/` and `apps/tools/` workspace scripts green while they point at root-level source paths.
2. Move ScribbledPage entries, source, styles, and tests into `apps/scribbledpage/`.
3. Move BentoPDF pages, controllers, styles, and tests into `apps/tools/`.
4. Extract reusable PDF primitives into `packages/shared/` only if both surfaces have a concrete need for them.
5. Keep `vite.config.ts`, deployment docs, env templates, lockfiles, and tests aligned with the new workspace paths in the same change.

Do not move code into `packages/shared/` just because both surfaces might use it later. Shared packages should contain behavior with a concrete consumer on both sides or a clear extraction target from existing duplication.

The cohosted tools surface may eventually be removed from this repository and replaced with a link to upstream BentoPDF or a dedicated direct fork. When upstream BentoPDF functionality is needed locally, prefer upstream `@bentopdf/*` engine/runtime packages where they expose stable APIs or assets. Keep forked UI/page code contained in `@scribbledpage/tools`.

## Documentation Sources Of Truth

- [README.md](README.md): repository overview and common commands
- [docs/getting-started.md](docs/getting-started.md): local setup
- [docs/contributing.md](docs/contributing.md): contributor workflow
- [DEPLOYMENT.md](DEPLOYMENT.md): deployment, runtime, environment, and cache behavior
- `.agents/knowledge/`: durable implementation notes for future maintenance
