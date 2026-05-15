import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../server/app.js';

describe('Fastify server', () => {
  let app;
  let distDir;

  beforeEach(async () => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scribbledpage-dist-'));
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<h1>ScribbledPage</h1>'
    );
    fs.writeFileSync(path.join(distDir, '404.html'), '<h1>Not found</h1>');
    fs.writeFileSync(path.join(distDir, 'asset.txt'), 'asset body');
    fs.writeFileSync(path.join(distDir, 'sw.js'), 'self.skipWaiting();');
    fs.writeFileSync(path.join(distDir, 'site.webmanifest'), '{}');
    fs.mkdirSync(path.join(distDir, 'workers'));
    fs.writeFileSync(
      path.join(distDir, 'workers', 'merge.worker.js'),
      'self.onmessage = () => {};'
    );
    fs.mkdirSync(path.join(distDir, 'assets'));
    fs.writeFileSync(
      path.join(distDir, 'assets', 'main-abc123.js'),
      'console.log("asset")'
    );
    app = buildServer({ distDir, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the Render health check endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'scribbledpage',
    });
  });

  it('serves the API health endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'scribbledpage-api',
    });
  });

  it('serves built frontend assets', async () => {
    const response = await app.inject({ method: 'GET', url: '/asset.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('asset body');
  });

  it('revalidates HTML responses so deploys can update asset references', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: {
        accept: 'text/html',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed asset responses as immutable', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/assets/main-abc123.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  it('revalidates non-hashed service worker and worker entrypoints', async () => {
    const serviceWorker = await app.inject({ method: 'GET', url: '/sw.js' });
    const manifest = await app.inject({
      method: 'GET',
      url: '/site.webmanifest',
    });
    const worker = await app.inject({
      method: 'GET',
      url: '/workers/merge.worker.js',
    });

    expect(serviceWorker.statusCode).toBe(200);
    expect(serviceWorker.headers['cache-control']).toBe('no-cache');
    expect(manifest.statusCode).toBe(200);
    expect(manifest.headers['cache-control']).toBe('no-cache');
    expect(worker.statusCode).toBe(200);
    expect(worker.headers['cache-control']).toBe('no-cache');
  });

  it('serves the app shell for QR token routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/p/9X7K2VBM-P2' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.body).toContain('ScribbledPage');
  });

  it('returns JSON for missing API routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Not Found',
      statusCode: 404,
    });
  });

  it('returns JSON for missing HTML routes when no 404 page exists', async () => {
    fs.rmSync(path.join(distDir, '404.html'));

    const response = await app.inject({
      method: 'GET',
      url: '/missing',
      headers: {
        accept: 'text/html',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Not Found',
      statusCode: 404,
    });
  });
});
