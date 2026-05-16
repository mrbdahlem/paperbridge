<p align="center"><img src="public/images/favicon-no-bg.svg" width="80"></p>
<h1 align="center">ScribbledPage</h1>

ScribbledPage is the primary project in this repository. It focuses on printable PDF assignments, QR-stamped packet generation, and submission workflows for paper-first classrooms.

This repository also still ships the BentoPDF tool surface as a secondary capability. Public tool pages can remain BentoPDF-branded where they describe those PDF utilities.

## Repository Scope

- ScribbledPage application code lives under `src/js/scribbledpage/`.
- Shared tool pages and PDF utilities remain available in the broader app.
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

Useful scripts:

- `npm run ci:scribbledpage` runs lint, typecheck, tests, and build for the ScribbledPage slice.
- `npm run ci:tools` runs lint, typecheck, tests, and build for the bundled PDF tools surface.
- `npm test -- --run` runs the full repository test suite.
- `npm run docs:dev` starts the docs site.
- `npm start` serves the production `dist/` build through the Fastify server.

## Deployment

ScribbledPage deploys as a Render Node web service using `render.yaml`. The Fastify runtime serves the full `dist/` app, including ScribbledPage and PDF tools pages, and exposes `/healthz` for service health checks.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render blueprint, environment variables, cache policy, and validation steps.

## Documentation

- [docs/getting-started.md](docs/getting-started.md) covers local repository setup.
- [docs/contributing.md](docs/contributing.md) covers the lightweight project workflow.
- [ARCHITECTURE.md](ARCHITECTURE.md) covers current source boundaries and the workspace migration direction.
- [DEPLOYMENT.md](DEPLOYMENT.md) covers Render deployment and runtime behavior.
- [docs/licensing.md](docs/licensing.md) and [licensing.html](licensing.html) summarize the repository license notices.

## Project Workflow

Use [CONTRIBUTING.md](CONTRIBUTING.md) for issue, pull request, and validation expectations.

## License

See [LICENSE](LICENSE) for the repository license terms.
