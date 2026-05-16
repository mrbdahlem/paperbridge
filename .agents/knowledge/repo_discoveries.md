# Repository Discoveries

Durable notes about repository structure and migration decisions.

## 2026-05-13 ScribbledPage Migration Scope

- ScribbledPage is the primary project identity for repository workflow, CI, issue templates, security notes, and maintainer-facing docs.
- BentoPDF references remain valid when they describe the bundled PDF tools surface, tool-specific docs, upstream package names, or runtime components used by those tools.
- Legacy BentoPDF deployment artifacts were removed from the active repository surface: Docker/Helm release workflows, Helm chart files, Docker Compose/Unraid descriptors, container entrypoint/nginx files, and the air-gapped deployment script.

## 2026-05-13 Vite Local Ports

- Vite dev defaults to port 5173 and reads `VITE_DEV_PORT` from the active dev-mode env files such as `.env.development.local`.
- Vite preview defaults to port 4173 and runs in production mode by default, so `VITE_PREVIEW_PORT` belongs in the shell, `.env.local`, or `.env.production.local`.
- Dependency discovery and broad pre-bundling are disabled by default in `vite.config.ts` to keep local startup memory low; set `VITE_ENABLE_DEP_OPTIMIZER=true` to opt into broader pre-bundling for heavier tool-page development.
- Default dev optimization still includes `jszip` because ScribbledPage `create-assignment.html` imports it directly and needs browser ESM conversion even when dependency discovery is disabled.
- Vite dev and preview bind to `localhost` by default outside devcontainers. Devcontainer config sets `VITE_DEV_HOST=0.0.0.0` and `VITE_PREVIEW_HOST=0.0.0.0` so forwarded ports are reachable from the host machine.
- `docs/.vitepress/dist/**` is generated docs output and is ignored by ESLint; source docs remain linted where applicable.

## 2026-05-16 ScribbledPage Source Naming

- The primary app source directory is `src/js/scribbledpage/`; older `paperbridge` path references were removed as part of the workspace cleanup pass.
- The first workspace cleanup intentionally kept the root build pipeline intact. The npm workspace pass added `@scribbledpage/app` and `@scribbledpage/tools` packages that delegate to root configs while source paths remain stable.
- `ARCHITECTURE.md` is now the source of truth for current source boundaries and the intended `apps/` plus `packages/` workspace direction.
