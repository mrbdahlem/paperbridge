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

  it('does not use ScribbledPage deployment branding in BentoPDF chrome', () => {
    for (const file of toolChromeFiles) {
      const content = readRepoFile(file);

      expect(content, `${file} should not use VITE_BRAND_NAME`).not.toContain(
        'brandName'
      );
      expect(content, `${file} should not use VITE_BRAND_LOGO`).not.toContain(
        'brandLogo'
      );
      expect(content, `${file} should not use VITE_FOOTER_TEXT`).not.toContain(
        'footerText'
      );
    }
  });

  it('links tool GitHub chrome to the upstream BentoPDF repository', () => {
    const navbar = readRepoFile('src/partials/navbar.html');
    const footer = readRepoFile('src/partials/footer.html');
    const mainScript = readRepoFile('src/js/main.ts');

    expect(`${navbar}\n${footer}\n${mainScript}`).not.toContain(
      'github.com/mrbdahlem/paperbridge'
    );
    expect(navbar).toContain('https://github.com/alam00000/bentopdf');
    expect(footer).toContain('https://github.com/alam00000/bentopdf');
    expect(mainScript).toContain(
      'https://api.github.com/repos/alam00000/bentopdf'
    );
  });
});
