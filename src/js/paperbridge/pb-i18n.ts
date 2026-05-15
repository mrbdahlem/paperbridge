import { initI18n, applyTranslations } from '../i18n/index.js';
import i18next from 'i18next';

export { t } from '../i18n/index.js';

export async function initPbI18n(): Promise<void> {
  await initI18n();
  await i18next.loadNamespaces('scribbledpage');
  applyTranslations();
}

export function pt(key: string, opts?: Record<string, unknown>): string {
  return i18next.t(`scribbledpage:${key}`, { ns: 'scribbledpage', ...opts });
}
