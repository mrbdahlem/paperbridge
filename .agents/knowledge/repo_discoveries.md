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
- `apps/tools/UPSTREAM.md` tracks the BentoPDF fork boundary. Local commit `048049fbe9681d6164795a28014b214a1b52094f` is the practical local divergence marker; the exact upstream commit still needs to be recorded if upstream remote tracking is restored.
- ScribbledPage currently cohosts the tools surface but does not depend on `@scribbledpage/tools` for product behavior. Future work may keep cohosting, link to upstream BentoPDF, link to a dedicated direct fork, or add a narrow shared adapter only if there is a concrete product need.

## 2026-05-14 Google Docs Authoring Copies

- Google Docs assignment markers can be copied with the document, so the marker `assignmentId` can point to an assignment whose registered Google document ID differs from the currently opened Doc.
- The add-on should treat this mismatch as a copied or shared derivative and ask the signed-in instructor whether to create a new ScribbledPage assignment from the current Doc before changing assignment linkage.
- ScribbledPage must not silently attach a copied Google document ID to an assignment owned by another instructor.
- Student Google Doc copies can be registered as document copies or packets, but copied Doc markers cannot carry reliable per page identity. Page numbers should be added only when ScribbledPage exports the Doc to PDF and replaces each repeated placeholder QR.
