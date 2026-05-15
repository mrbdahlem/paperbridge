import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getI18nBuildLanguages } from '../../scripts/i18n-language-config.mjs';
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

  it('defaults build languages to locales with ScribbledPage translations', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-locales-'));

    for (const lang of ['en', 'de', 'es', 'fr', 'ja', 'pt']) {
      fs.mkdirSync(path.join(tempDir, lang));
      fs.writeFileSync(path.join(tempDir, lang, 'scribbledpage.json'), '{}');
    }

    fs.mkdirSync(path.join(tempDir, 'ar'));
    fs.writeFileSync(path.join(tempDir, 'ar', 'common.json'), '{}');

    expect(getI18nBuildLanguages(tempDir)).toEqual([
      'en',
      'de',
      'es',
      'fr',
      'ja',
      'pt',
    ]);
  });

  it('allows an explicit i18n build language override', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-locales-'));

    for (const lang of ['en', 'es', 'fr']) {
      fs.mkdirSync(path.join(tempDir, lang));
    }

    expect(
      getI18nBuildLanguages(tempDir, { explicitLanguages: 'fr, en, es' })
    ).toEqual(['en', 'es', 'fr']);
  });
});
