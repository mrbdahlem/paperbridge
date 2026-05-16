# Architecture

ScribbledPage is the primary application in this repository. It currently ships as one deployable Vite/Fastify app that includes the ScribbledPage classroom workflow and a bundled BentoPDF tools surface.

This document describes the current light-pass structure. It also records the intended direction for separating the code into npm workspaces after the current split is validated.

## System Shape

The repository has three runtime-facing surfaces:

- ScribbledPage app: classroom assignment, packet generation, QR stamping, and submission-oriented workflows.
- BentoPDF tools surface: convenience PDF utility pages that remain available inside the same deployed app.
- Fastify runtime: production server that serves the generated Vite `dist/` output and exposes server endpoints such as `/healthz`.

The current deployment still builds one frontend bundle set and serves one `dist/` directory. Source ownership is separated by directory and validation scripts, not by npm workspace package yet.

## Source Boundaries

| Area                        | Ownership                                                    |
| --------------------------- | ------------------------------------------------------------ |
| `src/js/scribbledpage/`     | Primary ScribbledPage application logic                      |
| `index.html`                | ScribbledPage dashboard entry                                |
| `create-assignment.html`    | ScribbledPage assignment creation entry                      |
| `src/pages/`                | BentoPDF tool pages                                          |
| `src/js/logic/`             | BentoPDF page controllers and tool workflows                 |
| `src/js/utils/`             | PDF utility helpers currently shared by tools                |
| `src/js/types/`             | Tool and PDF utility types                                   |
| `src/js/config/`            | Tool configuration and runtime constants                     |
| `src/css/scribbledpage.css` | ScribbledPage visual system                                  |
| `src/css/styles.css`        | Broader tools/shared styling                                 |
| `server/`                   | Fastify production runtime                                   |
| `scripts/`                  | Build, i18n, sitemap, packaging, and docs glue               |
| `public/`                   | Static assets, workers, locales, and vendored browser assets |

ScribbledPage source should not import BentoPDF page controllers from `src/js/logic/`. When ScribbledPage needs reusable PDF behavior, prefer extracting the reusable behavior out of tool-specific modules first.

BentoPDF tool pages may continue to use BentoPDF branding where the user-facing page is a PDF utility. Repository workflow, deployment, and contributor documentation should use ScribbledPage as the primary project identity.

## Build And Routing

`vite.config.ts` is the current build source of truth. It defines:

- app and tool HTML inputs
- `BUILD_TARGET=scribbledpage` filtering for the ScribbledPage slice
- `BUILD_TARGET=tools` filtering for the bundled tools surface
- localized route handling for development and preview
- static asset copying and compression

Production builds emit localized ScribbledPage pages for the active language set. `scripts/generate-i18n-pages.mjs`, `scripts/generate-sitemap.mjs`, and `scripts/generate-security-headers.mjs` run after the Vite build in the root `npm run build` pipeline.

The production server in `server/` serves the full `dist/` output. Deployment details, environment variables, and cache behavior live in [DEPLOYMENT.md](DEPLOYMENT.md).

## Validation Boundaries

The root package currently owns all scripts:

- `npm run ci:scribbledpage` validates the ScribbledPage slice.
- `npm run ci:tools` validates the BentoPDF tools slice.
- `npm test -- --run` runs the full repository test suite.

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

The first pass intentionally keeps the root package and deployment pipeline intact. The next phase should introduce npm workspaces only after the source boundaries and validation paths remain stable.

Recommended migration order:

1. Move ScribbledPage entries, source, styles, and tests into `apps/scribbledpage/`.
2. Move BentoPDF pages, controllers, styles, and tests into `apps/tools/`.
3. Extract reusable PDF primitives into `packages/shared/`.
4. Add npm workspace package manifests and update root scripts to orchestrate workspace checks.
5. Keep `vite.config.ts`, deployment docs, env templates, and tests aligned with the new workspace paths in the same change.

Do not move code into `packages/shared/` just because both surfaces might use it later. Shared packages should contain behavior with a concrete consumer on both sides or a clear extraction target from existing duplication.

## Documentation Sources Of Truth

- [README.md](README.md): repository overview and common commands
- [docs/getting-started.md](docs/getting-started.md): local setup
- [docs/contributing.md](docs/contributing.md): contributor workflow
- [DEPLOYMENT.md](DEPLOYMENT.md): deployment, runtime, environment, and cache behavior
- `.agents/knowledge/`: durable implementation notes for future maintenance
