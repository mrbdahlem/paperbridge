#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const NEON_API_ORIGIN = 'https://console.neon.tech/api/v2';
const DEFAULT_ENV_FILE = '.env.local';
const DEFAULT_BRANCH_PREFIX = 'dev';
const DEFAULT_DATABASE_NAME = 'neondb';
const DEFAULT_RUNTIME_ROLE = 'scribbledpage_dev_app';
const DEFAULT_MIGRATION_ROLE = 'scribbledpage_dev_migration';
const DEFAULT_CONFLICT_RETRY_COUNT = 8;
const DEFAULT_CONFLICT_RETRY_DELAY_MS = 1500;

export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {
    command,
    writeEnv: false,
    printExports: false,
    confirm: false,
    gitBranch: '',
    neonBranch: '',
    envFile: '',
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = rest[index + 1];

    if (arg === '--write-env') {
      options.writeEnv = true;
    } else if (arg === '--print-exports') {
      options.printExports = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--git-branch' && next) {
      options.gitBranch = next;
      index += 1;
    } else if (arg === '--neon-branch' && next) {
      options.neonBranch = next;
      index += 1;
    } else if (arg === '--env-file' && next) {
      options.envFile = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

export function neonBranchNameFromGitBranch(
  gitBranch,
  prefix = DEFAULT_BRANCH_PREFIX
) {
  let safePrefix = slugify(prefix || DEFAULT_BRANCH_PREFIX);
  const safeBranch = slugify(gitBranch);
  const suffix = safeBranch || 'local';
  const candidate = `${safePrefix}-${suffix}`;

  if (candidate.length <= 63) {
    return candidate;
  }

  const hash = createHash('sha1')
    .update(String(gitBranch || 'local'))
    .digest('hex')
    .slice(0, 8);
  let maxSuffixLength = Math.max(0, 63 - safePrefix.length - hash.length - 2);

  if (maxSuffixLength === 0) {
    safePrefix = safePrefix
      .slice(0, Math.max(1, 63 - suffix.length - hash.length - 2))
      .replace(/-+$/u, '');
    maxSuffixLength = Math.max(1, 63 - safePrefix.length - hash.length - 2);
  }

  const trimmedSuffix = suffix.slice(0, maxSuffixLength).replace(/-+$/u, '');

  return `${safePrefix}-${trimmedSuffix}-${hash}`;
}

export function roleNameForBranch(baseRoleName, neonBranchName) {
  const suffix = neonBranchName
    .replace(/^[a-z0-9]+-/iu, '')
    .replace(/[^a-z0-9_]+/giu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 24);
  const roleName = `${baseRoleName}_${suffix || 'local'}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/gu, '_');

  return roleName.slice(0, 63).replace(/_+$/u, '');
}

export function updateEnvFileContent(content, updates) {
  const lines = content.length > 0 ? content.split('\n') : [];
  const seenKeys = new Set();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);

    if (!match || !(match[1] in updates)) {
      return line;
    }

    seenKeys.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });

  const missingEntries = Object.entries(updates)
    .filter(([key]) => !seenKeys.has(key))
    .map(([key, value]) => `${key}=${value}`);

  if (missingEntries.length > 0) {
    if (nextLines.length > 0 && nextLines.at(-1) !== '') {
      nextLines.push('');
    }
    nextLines.push('# Neon short-lived development branch');
    nextLines.push(...missingEntries);
  }

  return `${nextLines.join('\n').replace(/\n+$/u, '')}\n`;
}

export function maskSecret(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.password) url.password = '********';
    return url.toString();
  } catch {
    return value.replace(/:\/\/([^:\s]+):([^@\s]+)@/u, '://$1:********@');
  }
}

export function isNeonConflictError(error) {
  return /conflicting operations|already has running conflicting operations|scheduling of new ones is prohibited/i.test(
    String(error?.message || '')
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-+/gu, '-');
}

function readConfig(env) {
  const projectId = requiredEnv(env, 'NEON_PROJECT_ID');
  const apiKey = requiredEnv(env, 'NEON_API_KEY');
  const branchPrefix = env.NEON_BRANCH_PREFIX || DEFAULT_BRANCH_PREFIX;
  const databaseName = env.NEON_DATABASE_NAME || DEFAULT_DATABASE_NAME;
  const runtimeRoleBase = env.NEON_RUNTIME_ROLE_NAME || DEFAULT_RUNTIME_ROLE;
  const migrationRoleBase =
    env.NEON_MIGRATION_ROLE_NAME || DEFAULT_MIGRATION_ROLE;

  return {
    projectId,
    apiKey,
    parentBranchId: env.NEON_PARENT_BRANCH_ID || '',
    branchPrefix,
    databaseName,
    runtimeRoleBase,
    migrationRoleBase,
    conflictRetryCount: parsePositiveInteger(
      env.NEON_CONFLICT_RETRY_COUNT,
      DEFAULT_CONFLICT_RETRY_COUNT
    ),
    conflictRetryDelayMs: parsePositiveInteger(
      env.NEON_CONFLICT_RETRY_DELAY_MS,
      DEFAULT_CONFLICT_RETRY_DELAY_MS
    ),
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function currentGitBranch() {
  return execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
}

function createClient({ projectId, apiKey }) {
  async function request(path, { method = 'GET', body } = {}) {
    const response = await fetch(
      `${NEON_API_ORIGIN}/projects/${projectId}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `${response.status} ${response.statusText}`;
      throw new Error(`Neon API ${method} ${path} failed: ${message}`);
    }

    return payload;
  }

  return { request };
}

async function listBranches(client) {
  const payload = await client.request('/branches');
  return payload.branches || [];
}

async function findBranchByName(client, name) {
  const branches = await listBranches(client);
  return branches.find((branch) => branch.name === name) || null;
}

async function ensureBranch(client, { name, parentBranchId }) {
  const existing = await findBranchByName(client, name);
  if (existing) {
    return { branch: existing, created: false };
  }

  const body = {
    branch: {
      name,
      ...(parentBranchId ? { parent_id: parentBranchId } : {}),
    },
    endpoints: [{ type: 'read_write' }],
  };
  const payload = await client.request('/branches', {
    method: 'POST',
    body,
  });

  return { branch: payload.branch, created: true };
}

async function ensureRole(client, branchId, roleName) {
  const payload = await client.request(`/branches/${branchId}/roles`);
  const roles = payload.roles || [];

  if (roles.some((role) => role.name === roleName)) {
    return { roleName, created: false };
  }

  await client.request(`/branches/${branchId}/roles`, {
    method: 'POST',
    body: { role: { name: roleName } },
  });
  return { roleName, created: true };
}

async function connectionUri(
  client,
  { branchId, databaseName, roleName, pooled }
) {
  const params = new URLSearchParams({
    branch_id: branchId,
    database_name: databaseName,
    role_name: roleName,
    pooled: pooled ? 'true' : 'false',
  });
  const payload = await client.request(`/connection_uri?${params.toString()}`);
  const uri = payload.uri || payload.connection_uri;

  if (!uri) {
    throw new Error('Neon API did not return a connection URI');
  }

  return uri;
}

async function withConflictRetry(
  operation,
  { retryCount, retryDelayMs, label, onRetry = () => {} }
) {
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isNeonConflictError(error) || attempt === retryCount) {
        throw error;
      }

      onRetry({
        attempt: attempt + 1,
        retryCount,
        retryDelayMs,
        label,
      });
      await sleep(retryDelayMs);
    }
  }
}

async function setupBranch(options, env) {
  const config = readConfig(env);
  const client = createClient(config);
  const gitBranch = options.gitBranch || currentGitBranch();
  const neonBranch =
    options.neonBranch ||
    neonBranchNameFromGitBranch(gitBranch, config.branchPrefix);
  const runtimeRole = roleNameForBranch(config.runtimeRoleBase, neonBranch);
  const migrationRole = roleNameForBranch(config.migrationRoleBase, neonBranch);
  const retryOptions = {
    retryCount: config.conflictRetryCount,
    retryDelayMs: config.conflictRetryDelayMs,
    onRetry({ attempt, retryCount, retryDelayMs, label }) {
      console.log(
        `Neon is still finishing ${label}; retry ${attempt}/${retryCount} in ${retryDelayMs}ms`
      );
    },
  };
  const { branch, created } = await withConflictRetry(
    () =>
      ensureBranch(client, {
        name: neonBranch,
        parentBranchId: config.parentBranchId,
      }),
    {
      ...retryOptions,
      label: `branch setup for ${neonBranch}`,
    }
  );

  const runtimeRoleResult = await withConflictRetry(
    () => ensureRole(client, branch.id, runtimeRole),
    {
      ...retryOptions,
      label: `runtime role setup for ${neonBranch}`,
    }
  );
  const migrationRoleResult = await withConflictRetry(
    () => ensureRole(client, branch.id, migrationRole),
    {
      ...retryOptions,
      label: `migration role setup for ${neonBranch}`,
    }
  );
  const databaseUrl = await withConflictRetry(
    () =>
      connectionUri(client, {
        branchId: branch.id,
        databaseName: config.databaseName,
        roleName: runtimeRole,
        pooled: true,
      }),
    {
      ...retryOptions,
      label: `pooled connection lookup for ${neonBranch}`,
    }
  );
  const migrationUrl = await withConflictRetry(
    () =>
      connectionUri(client, {
        branchId: branch.id,
        databaseName: config.databaseName,
        roleName: migrationRole,
        pooled: false,
      }),
    {
      ...retryOptions,
      label: `migration connection lookup for ${neonBranch}`,
    }
  );

  return {
    gitBranch,
    neonBranch,
    branchId: branch.id,
    branchCreated: created,
    runtimeRole: runtimeRoleResult,
    migrationRole: migrationRoleResult,
    env: {
      DATABASE_URL: databaseUrl,
      DATABASE_MIGRATION_URL: migrationUrl,
      NEON_BRANCH_ID: branch.id,
      NEON_BRANCH_NAME: neonBranch,
    },
  };
}

async function deleteBranch(options, env) {
  const config = readConfig(env);
  const client = createClient(config);
  const gitBranch = options.gitBranch || currentGitBranch();
  const neonBranch =
    options.neonBranch ||
    neonBranchNameFromGitBranch(gitBranch, config.branchPrefix);
  const existing = await findBranchByName(client, neonBranch);

  if (!existing) {
    return { deleted: false, neonBranch };
  }

  await client.request(`/branches/${existing.id}`, { method: 'DELETE' });
  return { deleted: true, neonBranch, branchId: existing.id };
}

function writeEnvFile(path, updates) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const next = updateEnvFileContent(current, updates);
  writeFileSync(path, next);
}

function printBranchResult(result, { printExports }) {
  if (printExports) {
    for (const [key, value] of Object.entries(result.env)) {
      console.log(`export ${key}=${shellQuote(value)}`);
    }
    return;
  }

  console.log(
    `${result.branchCreated ? 'Created' : 'Reused'} Neon branch ${result.neonBranch}`
  );
  console.log(`Branch id: ${result.branchId}`);
  console.log(
    `${result.runtimeRole.created ? 'Created' : 'Reused'} runtime role ${result.runtimeRole.roleName}`
  );
  console.log(
    `${result.migrationRole.created ? 'Created' : 'Reused'} migration role ${result.migrationRole.roleName}`
  );
  console.log(`DATABASE_URL=${maskSecret(result.env.DATABASE_URL)}`);
  console.log(
    `DATABASE_MIGRATION_URL=${maskSecret(result.env.DATABASE_MIGRATION_URL)}`
  );
}

function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

function printHelp() {
  console.log(`Usage:
  node scripts/neon-branch.mjs create [--write-env] [--print-exports]
  node scripts/neon-branch.mjs env [--write-env] [--print-exports]
  node scripts/neon-branch.mjs delete --confirm

Options:
  --git-branch <name>    Use a git branch name instead of the current branch.
  --neon-branch <name>   Use an explicit Neon branch name.
  --env-file <path>      Write env values to this file. Defaults to .env.local.

Required env:
  NEON_API_KEY
  NEON_PROJECT_ID

Optional env:
  NEON_PARENT_BRANCH_ID
  NEON_DATABASE_NAME
  NEON_BRANCH_PREFIX
  NEON_RUNTIME_ROLE_NAME
  NEON_MIGRATION_ROLE_NAME
  NEON_CONFLICT_RETRY_COUNT
  NEON_CONFLICT_RETRY_DELAY_MS`);
}

async function main(argv, env) {
  const options = parseArgs(argv);

  if (options.command === 'help' || options.command === '--help') {
    printHelp();
    return;
  }

  if (options.command === 'create' || options.command === 'env') {
    const result = await setupBranch(options, env);
    const envFile = options.envFile || env.NEON_ENV_FILE || DEFAULT_ENV_FILE;

    if (options.writeEnv) {
      writeEnvFile(envFile, result.env);
      console.log(`Updated ${envFile} for Neon branch ${result.neonBranch}`);
    }

    printBranchResult(result, options);
    return;
  }

  if (options.command === 'delete') {
    if (!options.confirm) {
      throw new Error('Refusing to delete a Neon branch without --confirm');
    }
    const result = await deleteBranch(options, env);
    console.log(
      result.deleted
        ? `Deleted Neon branch ${result.neonBranch}`
        : `No matching Neon branch found for ${result.neonBranch}`
    );
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
