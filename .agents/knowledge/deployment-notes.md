# Deployment Notes

Durable deployment, runtime, and hosting notes for ScribbledPage.

## 2026-05-15 Render and Neon Direction

- ScribbledPage deploys as a Render Node web service instead of a static site so the same service can own future API routes and database access.
- The Render runtime serves Vite's `dist/` output through Fastify and exposes `/healthz` for service health checks.
- Neon credentials must stay server-side in `DATABASE_URL`; browser-facing `VITE_*` variables must not contain database credentials.
- Neon development databases should use branches rather than a shared mutable development database when testing schema/data changes.
