/**
 * Entry point (bundled once; survives client-side navigations).
 * Boot order: env → Lenis → WebGL scene → cursor/gyro → preloader → per-page init on every `astro:page-load`.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initPage } from './motion';
import * as ui from './ui';
import * as audio from './audio';
import { reduced, weak, state } from './env';

gsap.registerPlugin(ScrollTrigger);
const html = document.documentElement;
if (reduced) html.classList.add('no-anim');

/* ---------- smooth scroll (Lenis) driving ScrollTrigger ---------- */
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
// scroll velocity → shaders (smoothed)
let v = 0;
gsap.ticker.add(() => { const target = lenis ? Math.max(-1, Math.min(1, lenis.velocity / 40)) : 0; v += (target - v) * 0.1; state.scrollV = v; });

/* ---------- WebGL ---------- */
const canvas = document.getElementById('gl') as HTMLCanvasElement;
// three.js is a separate chunk: skipped entirely for reduced-motion / weak devices, loaded without blocking first paint otherwise
let world: { setScene: (n: string) => void } | null = null;
if (!reduced && !weak) {
  import('./scene').then((m) => { world = m.initScene(canvas); world?.setScene(document.body.dataset.scene || 'home'); }).catch(() => {});
}
ui.initCursor(state); ui.initGyro(state); ui.bindGlobalBlips();

/* ---------- preloader (once per session, skippable) ---------- */
const introDone = new Promise<void>((resolve) => {
  const pre = document.querySelector<HTMLElement>('[data-preloader]');
  if (!pre || html.classList.contains('intro-done')) return resolve();
  lenis?.stop();
  const counter = pre.querySelector<HTMLElement>('[data-count]')!;
  const o = { n: 0 }; let finished = false;
  const finish = () => {
    if (finished) return; finished = true; tween.kill();
    counter.textContent = '100';
    try { sessionStorage.setItem('q-intro', '1'); } catch {}
    const doors = pre.querySelectorAll('.pre-door i');
    gsap.timeline({ onComplete: () => { pre.remove(); html.classList.add('intro-done'); lenis?.start(); resolve(); } })
      .to(pre.querySelectorAll('.pre-brand, .pre-count, .pre-skip'), { opacity: 0, y: -20, duration: 0.25, ease: 'power2.in' })
      .to(doors[0], { xPercent: -100, duration: 0.7, ease: 'expo.inOut' }, 0.15)
      .to(doors[1], { xPercent: 100, duration: 0.7, ease: 'expo.inOut' }, 0.15)
      .to(pre, { backgroundColor: 'transparent', duration: 0.1 }, 0.15);
  };
  const tween = gsap.to(o, { n: 100, duration: reduced ? 0.3 : 0.9, ease: 'power2.inOut', onUpdate: () => (counter.textContent = String(Math.round(o.n))), onComplete: finish });
  pre.querySelector('[data-skip]')!.addEventListener('click', finish);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  pre.querySelector<HTMLElement>('[data-skip]')!.focus({ preventScroll: true });
});

/* ---------- page transitions: branded wipe; the canvas persists underneath ---------- */
const wipe = () => document.querySelector<HTMLElement>('.wipe')!;
document.addEventListener('astro:before-preparation', (e: any) => {
  const load = e.loader;
  e.loader = async () => {
    audio.blip('whoosh');
    const w = wipe(); w.classList.remove('fx-done');
    const covered = gsap.fromTo(w, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: reduced ? 0.01 : 0.45, ease: 'expo.inOut' });
    // race: never let a throttled/background tab block navigation
    await Promise.all([load(), Promise.race([covered.then(), new Promise((r) => setTimeout(r, 1200))])]);
  };
});
let cleanup: (() => void) | null = null;
document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = null; });
document.addEventListener('astro:after-swap', () => {
  lenis?.scrollTo(0, { immediate: true }); window.scrollTo(0, 0);
  world?.setScene(document.body.dataset.scene || 'home');
});

let first = true;
document.addEventListener('astro:page-load', async () => {
  world?.setScene(document.body.dataset.scene || 'home');
  ui.initHeader(lenis); ui.initSound(); ui.initCookie(); ui.initForms();
  if (first) ui.maybeRedirectLang();
  await introDone;
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 300))]);
  cleanup = initPage();
  ScrollTrigger.refresh();
  // reveal: wipe leaves upward
  const w = wipe();
  if (!first) {
    gsap.to(w, { clipPath: 'inset(0% 0% 100% 0%)', duration: reduced ? 0.01 : 0.55, ease: 'expo.inOut', onComplete: () => { gsap.set(w, { clipPath: 'inset(100% 0% 0% 0%)' }); } });
    // announce new page + move focus for screen readers
    const a = document.getElementById('announcer'); if (a) { a.textContent = ''; setTimeout(() => (a.textContent = document.title), 60); }
    document.getElementById('main')?.focus({ preventScroll: true });
  }
  first = false;
});
