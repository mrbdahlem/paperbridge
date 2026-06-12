import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../server/app.js';
import { AssignmentValidationError } from '../../server/assignment-repository.js';
import { readDatabaseConfig } from '../../server/database.js';

function makeAssignmentDetail(overrides = {}) {
  const assignment = {
    id: 'assignment_1',
    title: 'EX10 Relays',
    classLabel: 'Period 4',
    pageCount: 2,
    qrMode: 'anonymous',
    packetCount: 1,
    templateVersion: 1,
    ownerUserId: null,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides.assignment,
  };
  const packets = overrides.packets ?? [
    {
      id: 'packet_1',
      assignmentId: assignment.id,
      packetCode: '9X7K2VBM',
      mode: 'anonymous',
      studentId: null,
      createdAt: assignment.createdAt,
    },
  ];
  const tokens = overrides.tokens ?? [
    {
      token: '9X7K2VBM-P1',
      assignmentId: assignment.id,
      templateVersion: 1,
      packetId: 'packet_1',
      pageNumber: 1,
      expiresAt: null,
      createdAt: assignment.createdAt,
    },
  ];

  return { assignment, packets, tokens };
}

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
    app = buildServer({ distDir, logger: false, database: null });
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

  it('serves the API health endpoint without a configured database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'scribbledpage-api',
      database: {
        configured: false,
        connected: false,
      },
    });
  });

  it('reports a healthy configured database through API health', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: async () => [{ ok: 1 }],
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'scribbledpage-api',
      database: {
        configured: true,
        connected: true,
      },
    });
  });

  it('reports a failing configured database through API health', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: async () => {
        console.info('[TEST] expected database health failure');
        throw new Error('expected database health failure');
      },
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      service: 'scribbledpage-api',
      database: {
        configured: true,
        connected: false,
        error: 'unavailable',
      },
    });
  });

  it('parses database connection settings', () => {
    const config = readDatabaseConfig({
      DATABASE_URL: 'postgres://user:password@example.com/db',
      DATABASE_POOL_MAX: '12',
      DATABASE_IDLE_TIMEOUT_SECONDS: '30',
      DATABASE_CONNECT_TIMEOUT_SECONDS: '7',
    });

    expect(config).toEqual({
      configured: true,
      url: 'postgres://user:password@example.com/db',
      poolMax: 12,
      idleTimeoutSeconds: 30,
      connectTimeoutSeconds: 7,
    });
  });

  it('uses conservative database connection defaults', () => {
    const config = readDatabaseConfig({
      DATABASE_URL: '',
      DATABASE_POOL_MAX: '0',
      DATABASE_IDLE_TIMEOUT_SECONDS: 'not-a-number',
      DATABASE_CONNECT_TIMEOUT_SECONDS: '-1',
    });

    expect(config).toEqual({
      configured: false,
      url: '',
      poolMax: 5,
      idleTimeoutSeconds: 20,
      connectTimeoutSeconds: 5,
    });
  });

  it('returns 503 for assignment APIs when the database is not configured', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/assignments',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Database Not Configured',
      statusCode: 503,
    });
  });

  it('lists assignments through the assignment repository', async () => {
    await app.close();
    const detail = makeAssignmentDetail();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        listAssignments: async () => [detail.assignment],
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/assignments',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      assignments: [detail.assignment],
    });
  });

  it('creates assignments with packets and QR tokens', async () => {
    await app.close();
    const detail = makeAssignmentDetail();
    let receivedBody;
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        createAssignment: async (body) => {
          receivedBody = body;
          return detail;
        },
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      payload: detail,
    });

    expect(response.statusCode).toBe(201);
    expect(receivedBody).toEqual(detail);
    expect(response.json()).toEqual(detail);
  });

  it('returns 400 when assignment creation validation fails', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        createAssignment: async () => {
          console.info('[TEST] expected assignment create validation failure');
          throw new AssignmentValidationError('assignment.title is required');
        },
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'assignment.title is required',
      statusCode: 400,
    });
  });

  it('returns 500 when assignment creation fails unexpectedly', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        createAssignment: async () => {
          console.info('[TEST] expected assignment create unexpected failure');
          throw new Error('unexpected');
        },
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      payload: makeAssignmentDetail(),
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      statusCode: 500,
    });
  });

  it('gets and deletes assignment details', async () => {
    await app.close();
    const detail = makeAssignmentDetail();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        getAssignment: async (id) =>
          id === detail.assignment.id ? detail : null,
        deleteAssignment: async (id) => id === detail.assignment.id,
      },
    });
    await app.ready();

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/assignments/${detail.assignment.id}`,
    });
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/assignments/${detail.assignment.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual(detail);
    expect(deleteResponse.statusCode).toBe(204);
    expect(deleteResponse.body).toBe('');
  });

  it('returns 404 for missing assignments', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        getAssignment: async () => null,
        deleteAssignment: async () => false,
      },
    });
    await app.ready();

    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/assignments/missing',
    });
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/assignments/missing',
    });

    expect(getResponse.statusCode).toBe(404);
    expect(getResponse.json()).toEqual({
      error: 'Assignment Not Found',
      statusCode: 404,
    });
    expect(deleteResponse.statusCode).toBe(404);
    expect(deleteResponse.json()).toEqual({
      error: 'Assignment Not Found',
      statusCode: 404,
    });
  });

  it('resolves QR tokens through the assignment repository', async () => {
    await app.close();
    const detail = makeAssignmentDetail();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        resolveQRToken: async (token) =>
          token === detail.tokens[0].token ? detail.tokens[0] : null,
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: `/api/qr-tokens/${detail.tokens[0].token}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ token: detail.tokens[0] });
  });

  it('returns 404 for missing QR tokens', async () => {
    await app.close();
    app = buildServer({
      distDir,
      logger: false,
      database: null,
      assignmentRepository: {
        resolveQRToken: async () => null,
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/qr-tokens/missing',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'QR Token Not Found',
      statusCode: 404,
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
