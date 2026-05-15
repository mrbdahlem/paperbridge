export const DEFAULT_SITE_URL = 'https://scribbled.page';

export function getSiteUrl(env = process.env) {
  return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}
