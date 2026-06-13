import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../server/app.js';
import {
  getNeonBranchGuardResult,
  readNeonBranchGuardConfig,
} from '../../server/neon-branch-guard.js';

describe('Neon branch startup guard', () => {
  it('defaults to warning in non-production and off in production', () => {
    expect(readNeonBranchGuardConfig({ NODE_ENV: 'development' }).mode).toBe(
      'warn'
    );
    expect(readNeonBranchGuardConfig({ NODE_ENV: 'production' }).mode).toBe(
      'off'
    );
  });

  it('detects a matching configured Neon branch', () => {
    expect(
      getNeonBranchGuardResult({
        env: {
          DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
          NEON_BRANCH_NAME: 'dev-feature-neon-google-auth-prep',
          NEON_BRANCH_GUARD: 'strict',
        },
        gitBranch: 'feature/neon-google-auth-prep',
      })
    ).toEqual({
      ok: true,
      mode: 'strict',
      skipped: false,
      gitBranch: 'feature/neon-google-auth-prep',
      expectedBranchName: 'dev-feature-neon-google-auth-prep',
      configuredBranchName: 'dev-feature-neon-google-auth-prep',
    });
  });

  it('detects a mismatched configured Neon branch', () => {
    const result = getNeonBranchGuardResult({
      env: {
        DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
        NEON_BRANCH_NAME: 'dev-feature-old',
        NEON_BRANCH_GUARD: 'warn',
      },
      gitBranch: 'feature/new',
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'warn',
      skipped: false,
      expectedBranchName: 'dev-feature-new',
      configuredBranchName: 'dev-feature-old',
    });
  });

  it('warns when git branch cannot be determined', () => {
    const result = getNeonBranchGuardResult({
      env: {
        DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
        NEON_BRANCH_NAME: 'dev-feature-old',
        NEON_BRANCH_GUARD: 'warn',
      },
      gitBranch: '',
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'warn',
      skipped: false,
      gitBranch: '',
      expectedBranchName: '',
      configuredBranchName: 'dev-feature-old',
    });
  });

  it('fails strict mode when NEON_BRANCH_NAME is missing', () => {
    const result = getNeonBranchGuardResult({
      env: {
        DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
        NEON_BRANCH_GUARD: 'strict',
      },
      gitBranch: 'feature/new',
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'strict',
      skipped: false,
      expectedBranchName: 'dev-feature-new',
      configuredBranchName: '',
    });
  });

  it('fails Fastify startup when strict mode finds a mismatch', async () => {
    const distDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'scribbledpage-dist-')
    );
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<h1>ScribbledPage</h1>'
    );

    const app = buildServer({
      distDir,
      logger: false,
      database: async () => [],
      gitBranch: 'feature/new',
      env: {
        DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
        NEON_BRANCH_NAME: 'dev-feature-old',
        NEON_BRANCH_GUARD: 'strict',
      },
    });

    try {
      console.info('[TEST] expected strict Neon branch guard startup failure');
      await expect(app.ready()).rejects.toThrow(
        /Configured Neon branch dev-feature-old does not match git branch feature\/new/u
      );
    } finally {
      await app.close();
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  });

  it('still applies strict guard to injected database clients when DATABASE_URL is empty', async () => {
    const distDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'scribbledpage-dist-')
    );
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<h1>ScribbledPage</h1>'
    );

    const app = buildServer({
      distDir,
      logger: false,
      database: async () => [],
      gitBranch: 'feature/new',
      env: {
        DATABASE_URL: '',
        NEON_BRANCH_NAME: 'dev-feature-old',
        NEON_BRANCH_GUARD: 'strict',
      },
    });

    try {
      console.info('[TEST] expected strict Neon branch guard startup failure');
      await expect(app.ready()).rejects.toThrow(
        /Configured Neon branch dev-feature-old does not match git branch feature\/new/u
      );
    } finally {
      await app.close();
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  });

  it('skips strict guard when buildServer explicitly disables database access', async () => {
    const distDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'scribbledpage-dist-')
    );
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<h1>ScribbledPage</h1>'
    );

    const app = buildServer({
      distDir,
      logger: false,
      database: null,
      gitBranch: 'feature/new',
      env: {
        DATABASE_URL: 'postgres://app:secret@example.neon.tech/db',
        NEON_BRANCH_NAME: 'dev-feature-old',
        NEON_BRANCH_GUARD: 'strict',
      },
    });

    try {
      await expect(app.ready()).resolves.toBe(app);
    } finally {
      await app.close();
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  });
});
