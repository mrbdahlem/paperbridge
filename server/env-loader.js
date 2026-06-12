import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!/^[A-Z0-9_]+$/u.test(key)) {
      continue;
    }

    entries[key] = unquoteEnvValue(rawValue);
  }

  return entries;
}

export function loadServerEnv({
  cwd = process.cwd(),
  env = process.env,
  files = ['.env', '.env.local'],
} = {}) {
  const fileEnv = {};

  for (const file of files) {
    const filePath = path.resolve(cwd, file);

    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(fileEnv, parseEnvFile(readFileSync(filePath, 'utf8')));
  }

  for (const [key, value] of Object.entries(fileEnv)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  return env;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
