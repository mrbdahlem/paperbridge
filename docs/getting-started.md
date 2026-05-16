# Getting Started

This guide is for working on the ScribbledPage repository locally.

## What Lives Here

- ScribbledPage: the classroom packet/submission workflow under `src/js/scribbledpage/`
- BentoPDF tools: the broader PDF tool surface that is still bundled in the app
- Shared infrastructure: build scripts, translations, docs, and tests used by both surfaces

## Local Setup

Use Node.js 24 or newer.

```bash
git clone https://github.com/mrbdahlem/scribbledpage.git
cd scribbledpage
npm install
```

Start the dev server:

```bash
npm run dev
```

The app is available at `http://localhost:5173` by default.
`npm run preview` uses `http://localhost:4173` by default.
Outside devcontainers both commands bind to `localhost`; devcontainers set `VITE_DEV_HOST=0.0.0.0` and `VITE_PREVIEW_HOST=0.0.0.0` so forwarded ports are reachable from the host machine.

If you need a different dev server port, set `VITE_DEV_PORT` in your shell or `.env.development.local` before starting Vite.
If you need a different preview server port, set `VITE_PREVIEW_PORT` in your shell, `.env.local`, or `.env.production.local` before starting Vite preview.
Dependency discovery and broad pre-bundling are disabled by default to keep local startup memory low; JSZip remains pre-bundled for the ScribbledPage assignment flow.
Set `VITE_ENABLE_DEP_OPTIMIZER=true` to opt into broader Vite pre-bundling for heavier tool-page development.

## Validation Commands

Use the narrowest command that matches your change:

- `npm run ci:scribbledpage` for ScribbledPage-specific work
- `npm run ci:tools` for the BentoPDF tools surface
- `npm test -- --run` for the full repository suite
- `npm run docs:dev` for local docs work

## Project Areas

| Area                    | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `src/js/scribbledpage/` | ScribbledPage assignment, packet, and dashboard flows |
| `src/pages/`            | Tool pages and shared entry pages                     |
| `src/js/logic/`         | BentoPDF tool logic                                   |
| `src/tests/`            | Repository test suite                                 |
| `docs/`                 | Repository documentation                              |

## Next Steps

- [Contributing](/contributing)
- [Architecture](https://github.com/mrbdahlem/scribbledpage/blob/main/ARCHITECTURE.md)
- [Tools Reference](/tools/)
- [Licenses](/licensing)
