import fs from 'fs';
import path from 'path';

export const DEFAULT_I18N_NAMESPACE = 'scribbledpage';
export const DEFAULT_LANGUAGE = 'en';

function parseExplicitLanguages(explicitLanguages) {
  return [
    ...new Set(
      explicitLanguages
        .split(',')
        .map((lang) => lang.trim())
        .filter(Boolean)
    ),
  ];
}

export function getI18nBuildLanguages(
  localesDir,
  {
    namespace = process.env.I18N_BUILD_NAMESPACE || DEFAULT_I18N_NAMESPACE,
    explicitLanguages = process.env.I18N_BUILD_LANGUAGES,
  } = {}
) {
  const availableLanguages = fs
    .readdirSync(localesDir)
    .filter((file) => fs.statSync(path.join(localesDir, file)).isDirectory());

  if (!availableLanguages.includes(DEFAULT_LANGUAGE)) {
    throw new Error(
      `Default i18n build language "${DEFAULT_LANGUAGE}" is missing from ${localesDir}`
    );
  }

  const languages = explicitLanguages
    ? parseExplicitLanguages(explicitLanguages)
    : availableLanguages.filter((lang) =>
        fs.existsSync(path.join(localesDir, lang, `${namespace}.json`))
      );

  const missingLanguages = languages.filter(
    (lang) => !availableLanguages.includes(lang)
  );
  if (missingLanguages.length > 0) {
    throw new Error(
      `Unknown i18n build language(s): ${missingLanguages.join(', ')}`
    );
  }

  return [
    DEFAULT_LANGUAGE,
    ...languages
      .filter((lang) => lang !== DEFAULT_LANGUAGE)
      .sort((a, b) => a.localeCompare(b)),
  ];
}
