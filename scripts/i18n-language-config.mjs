import fs from 'fs';
import path from 'path';

export const DEFAULT_I18N_NAMESPACE = 'scribbledpage';
export const DEFAULT_LANGUAGE = 'en';

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

  const languages = explicitLanguages
    ? explicitLanguages
        .split(',')
        .map((lang) => lang.trim())
        .filter(Boolean)
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
