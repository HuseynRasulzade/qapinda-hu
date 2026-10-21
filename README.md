# Qapinda.hu

Bilingual (HU default, EN), multi-page, static site: **Astro 5 + Three.js + GSAP/ScrollTrigger + Lenis**.
Why Astro: built-in static output, zero-JS pages by default, and `<ClientRouter/>` keeps the WebGL canvas
alive across navigation (one continuous 3D world) while still shipping plain HTML to shared hosting.

## Commands
```bash
npm install
npm run dev        # http://localhost:4321 (contact.php is simulated on localhost)
npm run build      # → /dist (+ sitemap.xml via scripts/postbuild.mjs)
npm run preview    # serve /dist locally
```

## Deploy to shared hosting (Apache)
1. `npm run build`
2. Upload the **contents** of `dist/` into `public_html/` (includes `.htaccess`, `contact.php`, `robots.txt`, `sitemap.xml`, `404.html`).
3. Edit `contact.php` (`$TO`, `$FROM`) before building (it lives in `public/`). `$FROM` must be an address on your domain.
4. Enable HTTPS (the `.htaccess` forces https + non-www). Clean URLs work out of the box (`/rolunk/`, `/en/about/`).
5. Submit `https://qapinda.hu/sitemap.xml` in Google Search Console.
Nginx: `try_files $uri $uri/ =404; error_page 404 /404.html;` and `/en/` → `/en/404/index.html`.

## Where to edit
| What | Where |
|---|---|
| Hungarian text (all pages, meta, form errors, cookie banner, legal) | `src/locales/hu.json` |
| English text | `src/locales/en.json` |
| URL slugs / add a page | `src/i18n/index.ts` (`PAGES`) + a view in `src/views/` |
| Colours | `:root` tokens at top of `src/styles/global.css` (`--bg`, `--brand`, `--accent`…) and the 3 hex values in `src/scripts/scene.ts` (door/light) |
| Fonts | `@fontsource` imports in `src/layouts/Base.astro` (self-hosted, no Google requests) |
| 3D scene, camera per page, door opening | `src/scripts/scene.ts` (`PRESETS`) |
| Scroll animations / split text | `src/scripts/motion.ts` (`data-split`, `data-reveal`, `data-stagger`, `data-tilt`, `data-magnetic` attributes in views) |
| Page wipe, preloader, language memory | `src/scripts/main.ts`, `src/scripts/ui.ts` |
| Sound (synthesized, off by default) | `src/scripts/audio.ts` |
| Analytics | set `PUBLIC_GA_ID=G-XXXX` in `.env`; loads only after cookie consent |
| Replace 3D with your own GLB | load it with `GLTFLoader` + `DRACOLoader` in `scene.ts` in place of the door group |

## Before launch checklist
- Replace `[PLACEHOLDER]` company data in the legal pages (`legal.*` in both JSON files) and have a lawyer review them.
- Sample professionals/reviews are flagged "Minta tartalom / Sample content": replace or remove.
- Set real contact email/address, social links (Contact view), `og.svg` → a 1200×630 PNG/JPG for better social previews.
- Language: choice is stored in `localStorage`; only a direct visit to `/` by a non-bot with stored `en` is redirected. Crawlers are never redirected.
