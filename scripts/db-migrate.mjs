#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_DIR = path.resolve(
  __dirname,
  '..',
  'server',
  'migrations'
);
const DEFAULT_MIGRATIONS_TABLE = 'schema_migrations';

export function checksumSql(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => {
      const filePath = path.join(migrationsDir, fileName);
      const sql = readFileSync(filePath, 'utf8');

      return {
        id: fileName.replace(/\.sql$/u, ''),
        fileName,
        filePath,
        sql,
        checksum: checksumSql(sql),
      };
    });
}

export function readMigrationConfig(env = process.env) {
  return {
    databaseUrl: env.DATABASE_MIGRATION_URL?.trim() || '',
    migrationsDir: env.DATABASE_MIGRATIONS_DIR
      ? path.resolve(env.DATABASE_MIGRATIONS_DIR)
      : DEFAULT_MIGRATIONS_DIR,
    migrationsTable:
      env.DATABASE_MIGRATIONS_TABLE?.trim() || DEFAULT_MIGRATIONS_TABLE,
  };
}

export function assertSafeIdentifier(identifier, label) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) {
    throw new Error(`${label} must be a safe Postgres identifier`);
  }
}

export function buildMigrationPlan(migrations, appliedRows) {
  const applied = new Map(
    appliedRows.map((row) => [
      row.id,
      {
        checksum: row.checksum,
        executedAt: row.executed_at,
      },
    ])
  );
  const pending = [];

  for (const migration of migrations) {
    const appliedMigration = applied.get(migration.id);

    if (!appliedMigration) {
      pending.push(migration);
      continue;
    }

    if (appliedMigration.checksum !== migration.checksum) {
      throw new Error(
        `Migration checksum changed for ${migration.fileName}. Create a new migration instead of editing an applied migration.`
      );
    }
  }

  return pending;
}

export async function runMigrations({
  databaseUrl,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  migrationsTable = DEFAULT_MIGRATIONS_TABLE,
  logger = console,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'Missing required environment variable: DATABASE_MIGRATION_URL'
    );
  }

  assertSafeIdentifier(migrationsTable, 'DATABASE_MIGRATIONS_TABLE');

  const migrations = listMigrationFiles(migrationsDir);
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    await sql`
      create table if not exists ${sql(migrationsTable)} (
        id text primary key,
        file_name text not null,
        checksum text not null,
        executed_at timestamptz not null default now()
      )
    `;

    const appliedRows = await sql`
      select id, checksum, executed_at
      from ${sql(migrationsTable)}
      order by id asc
    `;
    const pending = buildMigrationPlan(migrations, appliedRows);

    if (pending.length === 0) {
      logger.info('No pending database migrations');
      return { applied: 0, pending: 0 };
    }

    for (const migration of pending) {
      logger.info(`Applying database migration ${migration.fileName}`);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration.sql);
        await transaction`
          insert into ${transaction(migrationsTable)}
            (id, file_name, checksum)
          values
            (${migration.id}, ${migration.fileName}, ${migration.checksum})
        `;
      });
    }

    logger.info(`Applied ${pending.length} database migration(s)`);
    return { applied: pending.length, pending: pending.length };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(env = process.env) {
  const config = readMigrationConfig(env);
  await runMigrations(config);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
