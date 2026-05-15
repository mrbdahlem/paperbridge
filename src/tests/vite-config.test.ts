import { readFileSync } from 'node:fs';
import type { UserConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

const ORIGINAL_ENV = { ...process.env };
const VITE_CONFIG_ENV_KEYS = [
  'VITE_DEV_HOST',
  'VITE_PREVIEW_HOST',
  'VITE_DEV_PORT',
  'VITE_PREVIEW_PORT',
  'VITE_ENABLE_DEP_OPTIMIZER',
] as const;

function loadConfig(mode = 'test'): UserConfig {
  if (typeof viteConfig !== 'function') {
    throw new Error('Expected Vite config to export a config factory');
  }

  return viteConfig({
    command: 'serve',
    mode,
    isPreview: false,
    isSsrBuild: false,
  });
}

function resetViteConfigEnv(
  overrides: Partial<Record<(typeof VITE_CONFIG_ENV_KEYS)[number], string>> = {}
): void {
  for (const key of VITE_CONFIG_ENV_KEYS) {
    process.env[key] = overrides[key] ?? '';
  }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetViteConfigEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Vite devcontainer host binding', () => {
  it('binds dev and preview servers to localhost by default', () => {
    const config = loadConfig();

    expect(config.server?.host).toBe('localhost');
    expect(config.preview?.host).toBe('localhost');
  });

  it('keeps development mode loopback-only with controlled host env', () => {
    const config = loadConfig('development');

    expect(config.server?.host).toBe('localhost');
    expect(config.preview?.host).toBe('localhost');
  });

  it('does not check in development host overrides', () => {
    const developmentEnv = readFileSync('.env.development', 'utf8');

    expect(developmentEnv).not.toMatch(/^VITE_DEV_HOST\s*=/m);
    expect(developmentEnv).not.toMatch(/^VITE_PREVIEW_HOST\s*=/m);
  });

  it('allows devcontainer host overrides for forwarded port access', () => {
    resetViteConfigEnv({
      VITE_DEV_HOST: '0.0.0.0',
      VITE_PREVIEW_HOST: '0.0.0.0',
    });

    const config = loadConfig();

    expect(config.server?.host).toBe('0.0.0.0');
    expect(config.preview?.host).toBe('0.0.0.0');
  });
});

describe('Vite server ports', () => {
  it('pins default dev and preview ports with strict port binding', () => {
    const config = loadConfig();

    expect(config.server?.port).toBe(5173);
    expect(config.server?.strictPort).toBe(true);
    expect(config.preview?.port).toBe(4173);
    expect(config.preview?.strictPort).toBe(true);
  });

  it('uses validated port overrides', () => {
    resetViteConfigEnv({
      VITE_DEV_PORT: '5180',
      VITE_PREVIEW_PORT: '4180',
    });

    const config = loadConfig();

    expect(config.server?.port).toBe(5180);
    expect(config.preview?.port).toBe(4180);
  });

  it.each([
    ['VITE_DEV_PORT', 'abc'],
    ['VITE_DEV_PORT', '0'],
    ['VITE_DEV_PORT', '70000'],
    ['VITE_PREVIEW_PORT', 'abc'],
    ['VITE_PREVIEW_PORT', '0'],
    ['VITE_PREVIEW_PORT', '70000'],
  ] as const)('rejects invalid %s values', (envName, value) => {
    resetViteConfigEnv({ [envName]: value });

    expect(() => loadConfig()).toThrow(
      `${envName} must be an integer between 1 and 65535`
    );
  });
});

describe('Vite dependency optimizer defaults', () => {
  it('keeps JSZip pre-bundled for default dev server entries', () => {
    const config = loadConfig();

    expect(config.optimizeDeps).toMatchObject({
      noDiscovery: true,
      include: ['jszip', 'pako'],
    });
  });

  it('enables broader pre-bundling when requested', () => {
    resetViteConfigEnv({ VITE_ENABLE_DEP_OPTIMIZER: 'true' });

    const config = loadConfig();

    expect(config.optimizeDeps).toMatchObject({
      entries: ['index.html', 'create-assignment.html'],
      include: [
        'pdfkit',
        'blob-stream',
        'jszip',
        'pako',
        'sortablejs',
        'node-forge',
      ],
      exclude: ['coherentpdf', 'wasm-vips'],
    });
  });
});
