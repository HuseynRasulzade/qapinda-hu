/** Device / preference detection shared by all modules. */
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nav = navigator as any;
export const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
export const coarse = matchMedia('(pointer: coarse)').matches;
export const isBot = /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent);
export const lang = () => (document.documentElement.dataset.lang || 'hu') as 'hu' | 'en';

/** Shared mutable input state read by the 3D scene (mouse/gyro, scroll velocity, scripted door opening). */
export const state = { mx: 0, my: 0, scrollV: 0, doorOverride: -1 as number };
