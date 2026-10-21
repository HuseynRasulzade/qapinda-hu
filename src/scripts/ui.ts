/** Chrome that lives outside the scroll choreography: header, cookie banner, forms, sound button, cursor. */
import gsap from 'gsap';
import * as audio from './audio';
import { lang, isBot } from './env';

/* ---------- header ---------- */
export function initHeader(lenis: any) {
  const header = document.querySelector<HTMLElement>('[data-header]')!;
  const burger = header.querySelector<HTMLButtonElement>('[data-burger]')!;
  const nav = header.querySelector<HTMLElement>('[data-nav]')!;
  nav.id = 'nav';
  const set = (open: boolean) => {
    nav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', burger.dataset[open ? 'close' : 'open']!);
    open ? lenis?.stop() : lenis?.start();
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); burger.focus(); } });
  let last = 0;
  const onScroll = (y: number) => {
    header.classList.toggle('scrolled', y > 30);
    header.classList.toggle('hide', y > last && y > 400 && !nav.classList.contains('open'));
    last = y;
  };
  lenis?.on('scroll', ({ scroll }: any) => onScroll(scroll)); onScroll(scrollY);
  // remember explicit language choice
  header.querySelectorAll<HTMLAnchorElement>('[data-lang]').forEach((a) => a.addEventListener('click', () => { try { localStorage.setItem('q-lang', a.dataset.lang!); } catch {} }));
}

/** Direct visit to "/" with a stored EN choice → go to /en/. Never for crawlers. */
export function maybeRedirectLang() {
  if (isBot || navigator.webdriver) return;
  try {
    const stored = localStorage.getItem('q-lang');
    const samSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (stored && stored !== lang() && location.pathname === '/' && !samSite && !sessionStorage.getItem('q-redirected')) {
      sessionStorage.setItem('q-redirected', '1');
      const a = document.querySelector<HTMLAnchorElement>(`[data-lang="${stored}"]`); if (a) location.replace(a.href);
    }
  } catch {}
}

/* ---------- sound button ---------- */
export function initSound() {
  const btn = document.querySelector<HTMLButtonElement>('[data-sound]'); if (!btn) return;
  const paint = () => {
    const on = audio.isOn(); btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.sound-label')!.textContent = on ? btn.dataset.on! : btn.dataset.off!;
  };
  btn.addEventListener('click', () => { audio.toggle(); paint(); audio.blip('click'); });
  paint();
}
let soundBound = false;
export function bindGlobalBlips() {
  if (soundBound) return; soundBound = true;
  document.addEventListener('pointerenter', (e) => { if ((e.target as HTMLElement).closest?.('a,button')) audio.blip('tick'); }, true);
  document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest?.('.btn')) audio.blip('click'); });
}

/* ---------- cookie consent + analytics (only after consent) ---------- */
function loadAnalytics() {
  const id = (import.meta as any).env?.PUBLIC_GA_ID as string | undefined; // set PUBLIC_GA_ID in .env
  if (!id || (window as any).__gaLoaded) return; (window as any).__gaLoaded = true;
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`; document.head.appendChild(s);
  (window as any).dataLayer = (window as any).dataLayer || [];
  const gtag = function (..._a: any[]) { (window as any).dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', id, { anonymize_ip: true });
}
export function initCookie() {
  const box = document.querySelector<HTMLElement>('[data-cookie]'); if (!box) return;
  let c: string | null = null; try { c = localStorage.getItem('q-consent'); } catch {}
  if (c === 'all') loadAnalytics();
  if (c) return;
  setTimeout(() => { box.hidden = false; gsap.from(box, { y: 40, opacity: 0, duration: 0.8, ease: 'expo.out' }); }, 3200);
  box.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem('q-consent', b.dataset.consent!); } catch {}
    if (b.dataset.consent === 'all') loadAnalytics();
    gsap.to(box, { y: 30, opacity: 0, duration: 0.5, onComplete: () => (box.hidden = true) });
  }));
}

/* ---------- forms (contact + waitlist) ---------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function initForms() {
  document.querySelectorAll<HTMLFormElement>('[data-form]').forEach((form) => {
    const ts = form.querySelector<HTMLInputElement>('[data-ts]'); if (ts) ts.value = String(Date.now());
    const err = (name: string) => form.dataset['err' + name[0].toUpperCase() + name.slice(1)] || '';
    const mark = (input: HTMLElement | null, msg: string) => {
      const box = input?.closest('.field') || form; const p = box.querySelector<HTMLElement>('.field-error');
      box.classList.toggle('invalid', !!msg); if (p) p.textContent = msg; input?.setAttribute('aria-invalid', String(!!msg));
    };
    const validate = () => {
      let ok = true;
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[required],textarea[required]').forEach((el) => {
        let msg = '';
        if (el.type === 'checkbox') { if (!(el as HTMLInputElement).checked) msg = err('consent'); }
        else if (!el.value.trim()) msg = err('required');
        else if (el.type === 'email' && !EMAIL.test(el.value.trim())) msg = err('email');
        else if (el.tagName === 'TEXTAREA' && el.value.trim().length < 10) msg = err('short');
        if (form.dataset.form === 'waitlist') { const p = form.querySelector<HTMLElement>('.field-error'); if (p) p.textContent = msg; } else mark(el, msg);
        if (msg) ok = false;
      });
      return ok;
    };
    form.addEventListener('input', (e) => { const t = e.target as HTMLElement; if (t.closest('.invalid')) validate(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!validate()) { (form.querySelector('.invalid input, .invalid textarea') as HTMLElement | null)?.focus(); return; }
      const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!; const label = btn.textContent; btn.disabled = true;
      if (form.dataset.sending) btn.textContent = form.dataset.sending;
      const fail = (m: string) => { const p = form.querySelector<HTMLElement>('[data-form-error], .field-error'); if (p) p.textContent = m; };
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error('server');
        success(form);
      } catch (x) {
        // Local dev/preview has no PHP: simulate success so the UI can be reviewed.
        if (['localhost', '127.0.0.1'].includes(location.hostname)) { console.info('[dev] contact.php unavailable locally – simulating success'); success(form); }
        else fail(navigator.onLine ? err('server') : err('network'));
      } finally { btn.disabled = false; btn.textContent = label; }
    });
    form.querySelector('[data-again]')?.addEventListener('click', () => { form.reset(); form.querySelector<HTMLElement>('.form-success')!.hidden = true; if (ts) ts.value = String(Date.now()); });
  });
}
function success(form: HTMLFormElement) {
  const s = form.querySelector<HTMLElement>('.form-success')!; s.hidden = false;
  gsap.fromTo(s, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' });
  if (form.dataset.form === 'waitlist') form.querySelector<HTMLElement>('.wait-row, .form-note')?.setAttribute('hidden', '');
  s.focus({ preventScroll: true });
}

/* ---------- custom cursor (fine pointers) ---------- */
export function initCursor(state: { mx: number; my: number }) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches; if (!fine) return;
  const root = document.querySelector<HTMLElement>('.cursor')!;
  document.documentElement.classList.add('cursor-on');
  const dot = root.querySelector<HTMLElement>('.cursor-dot')!, ring = root.querySelector<HTMLElement>('.cursor-ring')!;
  const dx = gsap.quickTo(dot, 'x', { duration: 0.1 }), dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); state.mx = (e.clientX / innerWidth - 0.5) * 2; state.my = -(e.clientY / innerHeight - 0.5) * 2; });
  document.addEventListener('pointerover', (e) => root.classList.toggle('hover', !!(e.target as HTMLElement).closest?.('a,button,[data-tilt],summary,label')));
  document.addEventListener('pointerleave', () => (root.style.opacity = '0')); document.addEventListener('pointerenter', () => (root.style.opacity = '1'));
}

/** Touch devices: gyroscope parallax (iOS needs a permission tap). */
export function initGyro(state: { mx: number; my: number }) {
  if (!matchMedia('(pointer: coarse)').matches || !('DeviceOrientationEvent' in window)) return;
  const listen = () => addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null) return;
    state.mx = Math.max(-1, Math.min(1, e.gamma / 28)); state.my = Math.max(-1, Math.min(1, -(e.beta - 50) / 28));
  });
  const DOE = (window as any).DeviceOrientationEvent;
  if (typeof DOE.requestPermission === 'function') {
    addEventListener('touchend', () => DOE.requestPermission().then((r: string) => r === 'granted' && listen()).catch(() => {}), { once: true });
  } else listen();
  // fallback: finger drag parallax
  addEventListener('touchmove', (e) => { const t = e.touches[0]; state.mx = (t.clientX / innerWidth - 0.5) * 2; state.my = -(t.clientY / innerHeight - 0.5) * 2; }, { passive: true });
}
