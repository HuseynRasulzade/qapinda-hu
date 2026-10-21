/**
 * Per-page scroll choreography. Call initPage() on every page load; it returns a
 * cleanup that main.ts runs before the DOM swap. Consistent language:
 *   ease expo.out · reveal 32px · stagger 0.045 (words) / 0.08 (cards)
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { coarse, state } from './env';

gsap.registerPlugin(ScrollTrigger);

/** Wrap words in masked spans. Original text kept for screen readers; layout-safe for long Hungarian words. */
function split(el: HTMLElement) {
  const text = (el.textContent || '').trim();
  el.textContent = '';
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text; el.appendChild(sr);
  const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true'); el.appendChild(vis);
  text.split(/\s+/).forEach((w, i, a) => {
    const o = document.createElement('span'); o.className = 'split-w'; const n = document.createElement('span'); n.className = 'split-i'; n.textContent = w;
    o.appendChild(n); vis.appendChild(o); if (i < a.length - 1) vis.appendChild(document.createTextNode(' '));
  });
  // overflow guard: shrink until the longest word fits its container
  const box = (el.parentElement || el) as HTMLElement;
  let guard = 8; const fs = () => parseFloat(getComputedStyle(el).fontSize);
  while (guard-- > 0 && [...vis.querySelectorAll<HTMLElement>('.split-w')].some((w) => w.offsetWidth > box.clientWidth - 2)) el.style.fontSize = fs() * 0.9 + 'px';
  return [...vis.querySelectorAll<HTMLElement>('.split-i')];
}

export function initPage() {
  const ctx = gsap.context(() => {
    const st = (trigger: Element, start = 'top 88%') => ({ trigger, start, once: true });

    document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
      const words = split(el);
      gsap.fromTo(words, { yPercent: 110, y: 0 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045, scrollTrigger: st(el, 'top 92%') });
    });
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: st(el) });
    });
    document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((box) => {
      gsap.fromTo(box.children, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: st(box, 'top 85%') });
    });

    /* card tilt + spotlight (mouse only) */
    if (!coarse) {
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
        gsap.set(card, { transformPerspective: 900 });
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          ry((px - 0.5) * 10); rx(-(py - 0.5) * 10); card.style.setProperty('--mx', px * 100 + '%'); card.style.setProperty('--my', py * 100 + '%');
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
      /* magnetic buttons */
      document.querySelectorAll<HTMLElement>('[data-magnetic],[data-magnetic-soft]').forEach((b) => {
        const k = b.hasAttribute('data-magnetic-soft') ? 0.18 : 0.32;
        const x = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'elastic.out(1,0.5)' }), y = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'elastic.out(1,0.5)' });
        b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - (r.left + r.width / 2)) * k); y((e.clientY - (r.top + r.height / 2)) * k); });
        b.addEventListener('pointerleave', () => { x(0); y(0); });
      });
    }

    /* FAQ accordions */
    document.querySelectorAll<HTMLElement>('[data-faq]').forEach((root) => {
      root.querySelectorAll<HTMLButtonElement>('.faq-q').forEach((q) => {
        const a = document.getElementById(q.getAttribute('aria-controls')!)!;
        q.addEventListener('click', () => {
          const open = q.getAttribute('aria-expanded') === 'true';
          q.setAttribute('aria-expanded', String(!open));
          if (!open) { a.hidden = false; gsap.fromTo(a, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out' }); }
          else gsap.to(a, { height: 0, opacity: 0, duration: 0.4, ease: 'expo.inOut', onComplete: () => { a.hidden = true; } });
        });
      });
    });

    /* How it works: pinned 3-step walkthrough, door opens with scroll */
    const walk = document.querySelector<HTMLElement>('[data-walk]');
    if (walk) {
      const steps = [...walk.querySelectorAll<HTMLElement>('.walk-step')], dots = [...walk.querySelectorAll<HTMLElement>('.walk-dots li')];
      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      steps.forEach((s, i) => { if (i === 0) return; tl.to(steps[i - 1], { opacity: 0, y: -40, duration: 0.35 }, i - 0.45).fromTo(s, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35 }, i - 0.35); });
      tl.to({}, { duration: 0.4 }, steps.length - 1);
      ScrollTrigger.create({
        trigger: walk, start: 'top top', end: 'bottom bottom', animation: tl, scrub: 0.6,
        onUpdate: (self) => {
          state.doorOverride = 0.05 + self.progress * 0.95;
          const idx = Math.min(steps.length - 1, Math.round(self.progress * (steps.length - 1)));
          dots.forEach((d, i) => d.classList.toggle('on', i <= idx));
        },
        onToggle: (self) => { if (!self.isActive) state.doorOverride = -1; },
      });
      dots[0]?.classList.add('on');
    }

    /* About: scroll-driven timeline */
    const tl2 = document.querySelector<HTMLElement>('[data-timeline]');
    if (tl2) {
      const items = [...tl2.querySelectorAll<HTMLElement>('.tl-item')];
      gsap.to(tl2.querySelector('[data-tl-fill]'), { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl2.querySelector('.timeline'), start: 'top 60%', end: 'bottom 70%', scrub: 0.5 } });
      items.forEach((it) => ScrollTrigger.create({ trigger: it, start: 'top 65%', onToggle: (s) => it.classList.toggle('on', s.progress > 0 || s.isActive) }));
    }

    /* Reviews: marquee driven by scroll velocity */
    const mq = document.querySelector<HTMLElement>('[data-marquee] .marquee-track');
    if (mq) {
      const loop = gsap.to(mq, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
      ScrollTrigger.create({ onUpdate: (s) => { gsap.to(loop, { timeScale: 1 + Math.abs(s.getVelocity()) / 400, duration: 0.2, overwrite: true }); gsap.to(loop, { timeScale: 1, duration: 1, delay: 0.25, overwrite: 'auto' }); } });
    }

    /* Home story: gentle parallax on the big title */
    const story = document.querySelector<HTMLElement>('[data-story]');
    if (story) gsap.fromTo(story.querySelector('.story-title'), { x: -40 }, { x: 40, ease: 'none', scrollTrigger: { trigger: story, scrub: 0.8, start: 'top bottom', end: 'bottom top' } });

    /* 404: nudge digits on pointer move */
    const nf = document.querySelector<HTMLElement>('.nf-code');
    if (nf) addEventListener('pointermove', (e) => gsap.to(nf.children, { x: (e.clientX / innerWidth - 0.5) * 30, y: (e.clientY / innerHeight - 0.5) * 20, duration: 0.8, stagger: 0.04, overwrite: 'auto' }));
  });
  return () => ctx.revert();
}
