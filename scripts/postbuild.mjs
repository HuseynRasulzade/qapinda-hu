/** Generates a language-aware sitemap.xml (hreflang alternates) into /dist after `astro build`. */
import { writeFileSync } from 'node:fs';

const SITE = 'https://qapinda.hu';
const pages = {
  home: ['', ''], about: ['rolunk', 'about'], how: ['hogyan-mukodik', 'how-it-works'], services: ['szolgaltatasok', 'services'],
  pros: ['szakembereknek', 'for-pros'], reviews: ['velemenyek', 'reviews'], faq: ['gyik', 'faq'], contact: ['kapcsolat', 'contact'],
  privacy: ['adatvedelem', 'privacy'], terms: ['aszf', 'terms'],
};
const url = (slug, lang) => `${SITE}${lang === 'en' ? '/en' : ''}${slug ? '/' + slug : ''}/`;
const entries = Object.values(pages).flatMap(([hu, en]) =>
  [['hu-HU', url(hu, 'hu')], ['en', url(en, 'en')]].map(([, loc]) => `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="hu-HU" href="${url(hu, 'hu')}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${url(en, 'en')}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${url(hu, 'hu')}"/>
  </url>`));
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
console.log('sitemap.xml written');
