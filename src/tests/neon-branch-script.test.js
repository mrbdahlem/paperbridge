import { describe, expect, it } from 'vitest';
import {
  isNeonConflictError,
  maskSecret,
  neonBranchNameFromGitBranch,
  parseArgs,
  roleNameForBranch,
  updateEnvFileContent,
} from '../../scripts/neon-branch.mjs';

describe('Neon branch script helpers', () => {
  it('builds a Neon branch name from a feature branch', () => {
    expect(neonBranchNameFromGitBranch('feature/Neon Google OAuth Prep')).toBe(
      'dev-feature-neon-google-oauth-prep'
    );
  });

  it('keeps generated Neon branch names within Neon-safe length', () => {
    const branchName = neonBranchNameFromGitBranch(
      'feature/this-is-a-very-long-local-branch-name-for-a-preview-database'
    );

    expect(branchName.length).toBeLessThanOrEqual(63);
    expect(branchName).toMatch(/^dev-feature-/u);
    expect(branchName).toMatch(/-[a-f0-9]{8}$/u);
  });

  it('keeps generated Neon branch names safe with a long prefix', () => {
    const branchName = neonBranchNameFromGitBranch(
      'feature/local',
      'development-preview-database-branch-prefix-that-is-too-long-for-neon'
    );

    expect(branchName.length).toBeLessThanOrEqual(63);
    expect(branchName).toMatch(/-[a-f0-9]{8}$/u);
  });

  it('builds branch-specific Postgres role names', () => {
    expect(
      roleNameForBranch(
        'scribbledpage_dev_app',
        'dev-feature-neon-google-oauth-prep'
      )
    ).toBe('scribbledpage_dev_app_feature_neon_google_oaut');
  });

  it('updates existing env file variables and appends missing Neon values', () => {
    const current = [
      'SITE_URL=http://localhost:5173',
      'DATABASE_URL=postgres://old',
      '',
    ].join('\n');

    const next = updateEnvFileContent(current, {
      DATABASE_URL: 'postgres://new',
      DATABASE_MIGRATION_URL: 'postgres://migration',
      NEON_BRANCH_ID: 'br-test',
    });

    expect(next).toContain('SITE_URL=http://localhost:5173');
    expect(next).toContain('DATABASE_URL=postgres://new');
    expect(next).toContain('DATABASE_MIGRATION_URL=postgres://migration');
    expect(next).toContain('NEON_BRANCH_ID=br-test');
    expect(next).toMatch(/\n$/u);
  });

  it('masks database passwords before logging connection URLs', () => {
    expect(maskSecret('postgres://role:secret@example.neon.tech/db')).toBe(
      'postgres://role:********@example.neon.tech/db'
    );
  });

  it('detects Neon conflicting operation errors for retry', () => {
    expect(
      isNeonConflictError(
        new Error(
          'Neon API POST /branches failed: project already has running conflicting operations, scheduling of new ones is prohibited'
        )
      )
    ).toBe(true);
    expect(isNeonConflictError(new Error('something unrelated'))).toBe(false);
  });

  it('parses create command flags', () => {
    expect(
      parseArgs([
        'create',
        '--write-env',
        '--git-branch',
        'feature/local',
        '--env-file',
        '.env.local',
      ])
    ).toEqual({
      command: 'create',
      writeEnv: true,
      printExports: false,
      confirm: false,
      gitBranch: 'feature/local',
      neonBranch: '',
      envFile: '.env.local',
    });
  });
});
