import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSafeIdentifier,
  buildMigrationPlan,
  checksumSql,
  listMigrationFiles,
  readMigrationConfig,
} from '../../scripts/db-migrate.mjs';

describe('database migration script helpers', () => {
  let migrationsDir;

  beforeEach(() => {
    migrationsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'scribbledpage-migrations-')
    );
  });

  afterEach(() => {
    fs.rmSync(migrationsDir, { recursive: true, force: true });
  });

  it('reads migration config from server-only environment variables', () => {
    const config = readMigrationConfig({
      DATABASE_MIGRATION_URL:
        'postgres://migration:secret@example.neon.tech/db',
      DATABASE_MIGRATIONS_DIR: migrationsDir,
      DATABASE_MIGRATIONS_TABLE: 'app_schema_migrations',
    });

    expect(config).toEqual({
      databaseUrl: 'postgres://migration:secret@example.neon.tech/db',
      migrationsDir,
      migrationsTable: 'app_schema_migrations',
    });
  });

  it('lists SQL migrations in deterministic order with checksums', () => {
    fs.writeFileSync(
      path.join(migrationsDir, '202606020002_second.sql'),
      'select 2;\n'
    );
    fs.writeFileSync(path.join(migrationsDir, 'notes.md'), 'not a migration');
    fs.writeFileSync(
      path.join(migrationsDir, '202606020001_first.sql'),
      'select 1;\n'
    );

    const migrations = listMigrationFiles(migrationsDir);

    expect(migrations.map((migration) => migration.fileName)).toEqual([
      '202606020001_first.sql',
      '202606020002_second.sql',
    ]);
    expect(migrations[0]).toMatchObject({
      id: '202606020001_first',
      sql: 'select 1;\n',
      checksum: checksumSql('select 1;\n'),
    });
  });

  it('rejects unsafe migration table identifiers', () => {
    expect(() =>
      assertSafeIdentifier('schema_migrations; drop table users;', 'test')
    ).toThrow(/safe Postgres identifier/u);
  });

  it('builds a pending migration plan', () => {
    const migrations = [
      {
        id: '202606020001_first',
        fileName: '202606020001_first.sql',
        checksum: 'abc',
      },
      {
        id: '202606020002_second',
        fileName: '202606020002_second.sql',
        checksum: 'def',
      },
    ];

    expect(
      buildMigrationPlan(migrations, [
        {
          id: '202606020001_first',
          checksum: 'abc',
          executed_at: new Date('2026-06-02T00:00:00Z'),
        },
      ])
    ).toEqual([migrations[1]]);
  });

  it('fails when an applied migration checksum changes', () => {
    const migrations = [
      {
        id: '202606020001_first',
        fileName: '202606020001_first.sql',
        checksum: 'new-checksum',
      },
    ];

    expect(() =>
      buildMigrationPlan(migrations, [
        {
          id: '202606020001_first',
          checksum: 'old-checksum',
          executed_at: new Date('2026-06-02T00:00:00Z'),
        },
      ])
    ).toThrow(/Migration checksum changed/u);
  });
});
