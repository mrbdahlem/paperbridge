import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { processFileForLanguage } from '../../scripts/generate-i18n-pages.mjs';

describe('generate i18n pages', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('creates the language output directory before writing localized HTML', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-pages-'));
    const langDir = path.join(tempDir, 'ar');

    processFileForLanguage(
      '<!doctype html><html><head><title>View Metadata</title></head><body><a href="/view-metadata">View metadata</a></body></html>',
      'view-metadata.html',
      'ar',
      {
        ar: {
          tools: {
            viewMetadata: {
              name: 'Metadata',
              pageTitle: 'Metadata',
              subtitle: 'Inspect document metadata',
            },
          },
        },
      },
      langDir
    );

    expect(fs.existsSync(path.join(langDir, 'view-metadata.html'))).toBe(true);
  });
});
