import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('BentoPDF tool chrome branding', () => {
  const toolChromeFiles = [
    'src/partials/navbar.html',
    'src/partials/navbar-simple.html',
    'src/partials/footer.html',
    'src/partials/footer-simple.html',
    'src/pages/pdf-multi-tool.html',
    'simple-index.html',
  ];

  const deprecatedBrandingExpressions = [
    '{{#if brandName}}',
    '{{brandName}}',
    '{{#if brandLogo}}',
    '{{brandLogo}}',
    '{{#if footerText}}',
    '{{#unless footerText}}',
    '{{footerText}}',
  ];

  it('does not use ScribbledPage deployment branding in BentoPDF chrome', () => {
    for (const file of toolChromeFiles) {
      const content = readRepoFile(file);

      for (const expression of deprecatedBrandingExpressions) {
        expect(
          content,
          `${file} should not use deprecated Handlebars branding expression ${expression}`
        ).not.toContain(expression);
      }
    }
  });

  it('does not define dead deployment branding env vars', () => {
    const deploymentConfig = `${readRepoFile('render.yaml')}\n${readRepoFile(
      '.env.example'
    )}`;

    expect(deploymentConfig).not.toContain('VITE_BRAND_NAME');
    expect(deploymentConfig).not.toContain('VITE_BRAND_LOGO');
    expect(deploymentConfig).not.toContain('VITE_FOOTER_TEXT');
  });

  it('links tool GitHub chrome to the upstream BentoPDF repository', () => {
    const navbar = readRepoFile('src/partials/navbar.html');
    const footer = readRepoFile('src/partials/footer.html');
    const mainScript = readRepoFile('src/js/main.ts');

    expect(`${navbar}\n${footer}\n${mainScript}`).not.toContain(
      'github.com/mrbdahlem/scribbledpage'
    );
    expect(navbar).toContain('https://github.com/alam00000/bentopdf');
    expect(footer).toContain('https://github.com/alam00000/bentopdf');
    expect(mainScript).toContain(
      'https://api.github.com/repos/alam00000/bentopdf'
    );
  });

  it('uses BentoPDF logo assets in tool chrome', () => {
    const toolChrome = [
      readRepoFile('src/partials/navbar.html'),
      readRepoFile('src/partials/navbar-simple.html'),
      readRepoFile('src/partials/footer.html'),
      readRepoFile('src/partials/footer-simple.html'),
      readRepoFile('simple-index.html'),
      readRepoFile('src/pages/pdf-multi-tool.html'),
    ].join('\n');

    expect(toolChrome).toContain('images/bentopdf-logo-no-bg.svg');
    expect(toolChrome).toContain('images/bentopdf-logo.svg');
    expect(toolChrome).not.toContain(
      'src="{{baseUrl}}images/favicon-no-bg.svg"'
    );
    expect(toolChrome).not.toContain('src="{{baseUrl}}images/favicon.svg"');
  });
});
