import { execFileSync } from 'node:child_process';
import { neonBranchNameFromGitBranch } from '../scripts/neon-branch.mjs';

const VALID_GUARD_MODES = new Set(['off', 'warn', 'strict']);

export function readNeonBranchGuardConfig(env = process.env) {
  const configuredMode = env.NEON_BRANCH_GUARD?.trim().toLowerCase();
  const mode =
    configuredMode && VALID_GUARD_MODES.has(configuredMode)
      ? configuredMode
      : env.NODE_ENV === 'production'
        ? 'off'
        : 'warn';

  return {
    mode,
    databaseConfigured: Boolean(env.DATABASE_URL?.trim()),
    configuredBranchName: env.NEON_BRANCH_NAME?.trim() || '',
    branchPrefix: env.NEON_BRANCH_PREFIX || 'dev',
  };
}

export function getCurrentGitBranch() {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function getNeonBranchGuardResult({
  env = process.env,
  gitBranch = getCurrentGitBranch(),
} = {}) {
  const config = readNeonBranchGuardConfig(env);

  if (
    config.mode === 'off' ||
    !config.databaseConfigured ||
    !config.configuredBranchName ||
    !gitBranch
  ) {
    return {
      ok: true,
      mode: config.mode,
      skipped: true,
    };
  }

  const expectedBranchName = neonBranchNameFromGitBranch(
    gitBranch,
    config.branchPrefix
  );
  const ok = config.configuredBranchName === expectedBranchName;

  return {
    ok,
    mode: config.mode,
    skipped: false,
    gitBranch,
    expectedBranchName,
    configuredBranchName: config.configuredBranchName,
  };
}

export function assertNeonBranchGuard(result) {
  if (result.ok || result.mode !== 'strict') {
    return;
  }

  throw new Error(
    `Configured Neon branch ${result.configuredBranchName} does not match git branch ${result.gitBranch}; expected ${result.expectedBranchName}. Run npm run db:branch:create or set NEON_BRANCH_GUARD=off.`
  );
}
