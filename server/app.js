import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify from 'fastify';
import fastifySensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import {
  closeDatabaseClient,
  createDatabaseClient,
  getDatabaseHealthStatus,
  readDatabaseConfig,
} from './database.js';
import {
  AssignmentValidationError,
  createAssignmentRepository,
} from './assignment-repository.js';
import {
  assertNeonBranchGuard,
  getNeonBranchGuardResult,
} from './neon-branch-guard.js';

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
  const env = options.env ?? process.env;
  const databaseConfig = readDatabaseConfig(env);
  const database =
    options.database === undefined
      ? createDatabaseClient({ env })
      : options.database;
  const databaseConfigured =
    options.database === undefined
      ? databaseConfig.configured
      : Boolean(database);
  const assignmentRepository =
    options.assignmentRepository === undefined && database
      ? createAssignmentRepository(database)
      : (options.assignmentRepository ?? null);
  const ownsDatabase = options.database === undefined && Boolean(database);
  const app = fastify({
    logger:
      options.logger ??
      (env.NODE_ENV === 'production'
        ? { level: env.LOG_LEVEL || 'info' }
        : false),
  });

  app.register(fastifySensible);
  app.decorate('database', database);
  app.decorate('assignmentRepository', assignmentRepository);

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
  });

  app.addHook('onReady', async () => {
    const neonBranchGuard = getNeonBranchGuardResult({
      env,
      gitBranch: options.gitBranch,
    });

    assertNeonBranchGuard(neonBranchGuard);

    app.log.info(
      {
        database: {
          configured: databaseConfigured,
        },
      },
      databaseConfigured
        ? 'database connection configured'
        : 'database connection not configured'
    );

    if (!neonBranchGuard.ok) {
      app.log.warn(
        {
          neonBranchGuard: {
            mode: neonBranchGuard.mode,
            gitBranch: neonBranchGuard.gitBranch,
            expectedBranchName: neonBranchGuard.expectedBranchName,
            configuredBranchName: neonBranchGuard.configuredBranchName,
          },
        },
        'configured Neon branch does not match current git branch'
      );
    }
  });

  app.addHook('onClose', async () => {
    if (ownsDatabase) {
      await closeDatabaseClient(database);
    }
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

  app.get('/api/health', async (request, reply) => {
    const databaseStatus = await getDatabaseHealthStatus(app.database);
    const ok = !databaseStatus.configured || databaseStatus.connected;
    const body = {
      ok,
      service: 'scribbledpage-api',
      database: databaseStatus,
    };

    if (!ok) {
      request.log.warn(
        {
          database: databaseStatus,
          requestId: request.id,
        },
        'database health check failed'
      );

      return reply.status(503).send(body);
    }

    return body;
  });

  function requireAssignmentRepository(reply) {
    if (app.assignmentRepository) {
      return app.assignmentRepository;
    }

    reply.status(503).send({
      error: 'Database Not Configured',
      statusCode: 503,
    });
    return null;
  }

  app.get('/api/assignments', async (_request, reply) => {
    const repository = requireAssignmentRepository(reply);
    if (!repository) return undefined;

    const assignments = await repository.listAssignments();
    return { assignments };
  });

  app.post('/api/assignments', async (request, reply) => {
    const repository = requireAssignmentRepository(reply);
    if (!repository) return undefined;

    try {
      const result = await repository.createAssignment(request.body);

      request.log.info(
        {
          assignmentId: result.assignment.id,
          packetCount: result.packets.length,
          tokenCount: result.tokens.length,
          requestId: request.id,
        },
        'assignment created'
      );

      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof AssignmentValidationError) {
        request.log.warn(
          {
            err: {
              message: error.message,
              name: error.name,
            },
            operation: 'createAssignment',
            requestId: request.id,
          },
          'assignment create request rejected'
        );

        return reply.status(400).send({
          error: error.message,
          statusCode: 400,
        });
      }

      request.log.error(
        {
          err: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          operation: 'createAssignment',
          requestId: request.id,
        },
        'assignment create request failed'
      );

      return reply.status(500).send({
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }
  });

  app.get('/api/assignments/:id', async (request, reply) => {
    const repository = requireAssignmentRepository(reply);
    if (!repository) return undefined;

    const result = await repository.getAssignment(request.params.id);
    if (!result) {
      return reply.status(404).send({
        error: 'Assignment Not Found',
        statusCode: 404,
      });
    }

    return result;
  });

  app.delete('/api/assignments/:id', async (request, reply) => {
    const repository = requireAssignmentRepository(reply);
    if (!repository) return undefined;

    const deleted = await repository.deleteAssignment(request.params.id);

    request.log.info(
      {
        assignmentId: request.params.id,
        deleted,
        requestId: request.id,
      },
      'assignment delete requested'
    );

    if (!deleted) {
      return reply.status(404).send({
        error: 'Assignment Not Found',
        statusCode: 404,
      });
    }

    return reply.status(204).send();
  });

  app.get('/api/qr-tokens/:token', async (request, reply) => {
    const repository = requireAssignmentRepository(reply);
    if (!repository) return undefined;

    const token = await repository.resolveQRToken(request.params.token);
    if (!token) {
      return reply.status(404).send({
        error: 'QR Token Not Found',
        statusCode: 404,
      });
    }

    return { token };
  });

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
