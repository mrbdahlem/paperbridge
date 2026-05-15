# Deployment Notes

Durable deployment, runtime, and hosting notes for ScribbledPage.

## 2026-05-15 Render and Neon Direction

- ScribbledPage deploys as a Render Node web service instead of a static site so the same service can own future API routes and database access.
- Runtime environments should use Node.js 24 or newer across Render, GitHub Actions, and devcontainers.
- The Render runtime serves Vite's `dist/` output through Fastify and exposes `/healthz` for service health checks.
- Render uses the full production build so the ScribbledPage dashboard, assignment flow, PDF tools index, and individual PDF tool pages are all available from the same deployed service.
- Render builds with `HUSKY=0 npm ci --include=dev && npm run build` so hosted installs skip local Git hook setup while still installing the devDependencies required by Vite and TypeScript under `NODE_ENV=production`.
- Fastify marks generated HTML, `sw.js`, `site.webmanifest`, and `*.worker.*` files as `Cache-Control: no-cache`, and hashed files under `/assets/` as `public, max-age=31536000, immutable`, to avoid stale entrypoints after deploys while keeping Vite assets cacheable.
- Production i18n page and sitemap generation defaults to locale folders with `scribbledpage.json`, currently `en`, `de`, `es`, `fr`, `ja`, and `pt`; `I18N_BUILD_LANGUAGES` can override this for one-off builds.
- The bundled PDF tools chrome is fixed to BentoPDF branding and should not consume Render's ScribbledPage environment variables; the Render environment no longer requires `VITE_BRAND_NAME`.
- Neon credentials must stay server-side in `DATABASE_URL`; browser-facing `VITE_*` variables must not contain database credentials.
- Neon development databases should use branches rather than a shared mutable development database when testing schema/data changes.
