import { buildServer } from './app.js';
import { loadServerEnv } from './env-loader.js';

loadServerEnv();
const port = Number(process.env.PORT || 10000);
const host = process.env.HOST || '0.0.0.0';
const server = buildServer();

try {
  await server.listen({ port, host });
} catch (error) {
  server.log.error(error, 'server failed to start');
  process.exit(1);
}
