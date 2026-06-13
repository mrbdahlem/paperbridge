import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadServerEnv, parseEnvFile } from '../../server/env-loader.js';

describe('server env loader', () => {
  let cwd;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scribbledpage-env-'));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('parses simple env files', () => {
    expect(
      parseEnvFile(`
        # comment
        DATABASE_URL=postgres://runtime
        DATABASE_MIGRATION_URL="postgres://migration"
        lowercase=ignored
      `)
    ).toEqual({
      DATABASE_URL: 'postgres://runtime',
      DATABASE_MIGRATION_URL: 'postgres://migration',
    });
  });

  it('loads .env.local over .env while preserving shell variables', () => {
    fs.writeFileSync(path.join(cwd, '.env'), 'DATABASE_URL=postgres://base\n');
    fs.writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'DATABASE_URL=postgres://local',
        'DATABASE_MIGRATION_URL=postgres://migration',
      ].join('\n')
    );

    const env = { DATABASE_URL: 'postgres://shell' };

    expect(loadServerEnv({ cwd, env })).toEqual({
      DATABASE_URL: 'postgres://shell',
      DATABASE_MIGRATION_URL: 'postgres://migration',
    });
  });
});
