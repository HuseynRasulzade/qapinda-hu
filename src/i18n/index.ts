/**
 * i18n core: locales, translated slugs, URL helpers.
 * Texts live in src/locales/{hu,en}.json. To add/rename a page edit PAGES below.
 */
import hu from '../locales/hu.json';
import en from '../locales/en.json';

export type Lang = 'hu' | 'en';
export const LANGS: Lang[] = ['hu', 'en'];
export const DEFAULT_LANG: Lang = 'hu';
export const SITE = 'https://qapinda.hu';

export const dict = { hu, en } as const;
export type Dict = typeof hu;

/** page key → slug per language ('' = language root). */
export const PAGES = {
  home: { hu: '', en: '' },
  about: { hu: 'rolunk', en: 'about' },
  how: { hu: 'hogyan-mukodik', en: 'how-it-works' },
  services: { hu: 'szolgaltatasok', en: 'services' },
  pros: { hu: 'szakembereknek', en: 'for-pros' },
  reviews: { hu: 'velemenyek', en: 'reviews' },
  faq: { hu: 'gyik', en: 'faq' },
  contact: { hu: 'kapcsolat', en: 'contact' },
  privacy: { hu: 'adatvedelem', en: 'privacy' },
  terms: { hu: 'aszf', en: 'terms' },
  notfound: { hu: '404', en: '404' },
} as const;
export type PageKey = keyof typeof PAGES;

/** Camera/scene preset name per page (see scripts/scene.ts). */
export const SCENE: Record<PageKey, string> = {
  home: 'home', about: 'about', how: 'how', services: 'services', pros: 'pros',
  reviews: 'reviews', faq: 'faq', contact: 'contact', privacy: 'calm', terms: 'calm', notfound: 'lost',
};

export const t = (lang: Lang): Dict => dict[lang] as unknown as Dict;

/** Absolute path for a page, e.g. path('about','en') → /en/about/ */
export function path(key: PageKey, lang: Lang): string {
  const slug = PAGES[key][lang];
  const prefix = lang === DEFAULT_LANG ? '' : `/${lang}`;
  return slug ? `${prefix}/${slug}/` : `${prefix}/` || '/';
}

export const abs = (key: PageKey, lang: Lang) => SITE + path(key, lang);

/** Static paths for [...path].astro */
export function allRoutes() {
  const routes: { params: { path: string | undefined }; props: { key: PageKey; lang: Lang } }[] = [];
  for (const lang of LANGS) {
    for (const key of Object.keys(PAGES) as PageKey[]) {
      if (key === 'notfound' && lang === DEFAULT_LANG) continue; // src/pages/404.astro
      const p = path(key, lang).replace(/^\/|\/$/g, '');
      routes.push({ params: { path: p || undefined }, props: { key, lang } });
    }
  }
  return routes;
}
