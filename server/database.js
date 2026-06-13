import postgres from 'postgres';

const DEFAULT_POOL_MAX = 5;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 5;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function readDatabaseConfig(env = process.env) {
  const url = env.DATABASE_URL?.trim() || '';

  return {
    configured: url.length > 0,
    url,
    poolMax: parsePositiveInteger(env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    idleTimeoutSeconds: parsePositiveInteger(
      env.DATABASE_IDLE_TIMEOUT_SECONDS,
      DEFAULT_IDLE_TIMEOUT_SECONDS
    ),
    connectTimeoutSeconds: parsePositiveInteger(
      env.DATABASE_CONNECT_TIMEOUT_SECONDS,
      DEFAULT_CONNECT_TIMEOUT_SECONDS
    ),
  };
}

export function createDatabaseClient(options = {}) {
  const config = readDatabaseConfig(options.env);

  if (!config.configured) {
    return null;
  }

  return postgres(config.url, {
    max: config.poolMax,
    idle_timeout: config.idleTimeoutSeconds,
    connect_timeout: config.connectTimeoutSeconds,
  });
}

export async function getDatabaseHealthStatus(database) {
  if (!database) {
    return {
      configured: false,
      connected: false,
    };
  }

  try {
    const rows = await database`select 1 as ok`;
    const ok = Number(rows?.[0]?.ok) === 1;

    return {
      configured: true,
      connected: ok,
    };
  } catch (_error) {
    return {
      configured: true,
      connected: false,
      error: 'unavailable',
    };
  }
}

export async function closeDatabaseClient(database) {
  if (database?.end) {
    await database.end({ timeout: DEFAULT_CONNECT_TIMEOUT_SECONDS });
  }
}
