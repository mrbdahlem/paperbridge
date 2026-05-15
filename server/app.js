import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify from 'fastify';
import fastifySensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.resolve(__dirname, '..', 'dist');
const HTML_CACHE_CONTROL = 'no-cache';
const IMMUTABLE_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function getStaticCacheControl(filePath) {
  const fileName = path.basename(filePath);

  if (path.extname(filePath) === '.html') {
    return HTML_CACHE_CONTROL;
  }

  if (filePath.split(path.sep).includes('assets')) {
    return IMMUTABLE_ASSET_CACHE_CONTROL;
  }

  if (
    fileName === 'sw.js' ||
    fileName === 'site.webmanifest' ||
    fileName.includes('.worker.')
  ) {
    return HTML_CACHE_CONTROL;
  }

  return undefined;
}

export function buildServer(options = {}) {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  const notFoundPagePath = path.join(distDir, '404.html');
  const app = fastify({
    logger:
      options.logger ??
      (process.env.NODE_ENV === 'production'
        ? { level: process.env.LOG_LEVEL || 'info' }
        : false),
  });

  app.register(fastifySensible);

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        requestId: request.id,
        route: request.routeOptions.url,
      },
      'request failed'
    );

    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      statusCode,
    });
  });

  app.get('/healthz', async () => ({
    ok: true,
    service: 'scribbledpage',
  }));

  app.get('/api/health', async () => ({
    ok: true,
    service: 'scribbledpage-api',
  }));

  app.register(fastifyStatic, {
    root: distDir,
    index: 'index.html',
    wildcard: false,
    cacheControl: false,
    setHeaders(response, filePath) {
      const cacheControl = getStaticCacheControl(filePath);
      if (cacheControl) {
        response.setHeader('Cache-Control', cacheControl);
      }
    },
  });

  app.get('/p/:token', async (_request, reply) => {
    return reply.type('text/html').sendFile('index.html');
  });

  app.setNotFoundHandler((request, reply) => {
    if (
      request.raw.method === 'GET' &&
      request.headers.accept?.includes('text/html') &&
      fs.existsSync(notFoundPagePath)
    ) {
      return reply.type('text/html').status(404).sendFile('404.html');
    }

    return reply.status(404).send({
      error: 'Not Found',
      statusCode: 404,
    });
  });

  return app;
}
