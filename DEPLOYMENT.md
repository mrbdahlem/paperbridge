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

## Environment

Required or expected Render variables:

- `NODE_ENV=production`
- `NODE_VERSION=24`
- `LOG_LEVEL=info`
- `VITE_BRAND_NAME=ScribbledPage`
- `VITE_QR_BASE_URL`: configured in Render when QR links should use a deployed base URL
- `DATABASE_URL`: configured in Render when backend persistence is added

Keep `DATABASE_URL` server-only. Do not put database credentials in any `VITE_*` variable because Vite exposes those values to browser code.

## Cache Policy

The Fastify server sets cache headers for generated frontend files:

- `*.html`: `Cache-Control: no-cache`
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- `sw.js`, `site.webmanifest`, and `*.worker.*`: `Cache-Control: no-cache`

HTML is revalidated so deploys can update references to the current hashed Vite assets. Hashed assets are immutable because their filenames change when their contents change.

## Localized Pages

Production builds generate localized HTML and sitemap entries for the active ScribbledPage translation set: `en`, `de`, `es`, `fr`, `ja`, and `pt`.

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
