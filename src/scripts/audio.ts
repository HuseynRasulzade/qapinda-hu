/** Optional synthesized sound (no audio files). OFF by default; user toggles in the header. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = false;
let nodes: OscillatorNode[] = [];

function build() {
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.connect(master);
  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  // warm drone: A1 + E2 + A2 (slightly detuned)
  for (const [f, d] of [[55, 0], [82.4, 4], [110, -5], [164.8, 7]] as const) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d;
    const g = ctx.createGain(); g.gain.value = f > 100 ? 0.18 : 0.4; o.connect(g); g.connect(lp); o.start(); nodes.push(o);
  }
}

export function isOn() { return on; }
export function toggle(): boolean {
  if (!ctx) build();
  on = !on;
  ctx!.resume();
  master!.gain.cancelScheduledValues(ctx!.currentTime);
  master!.gain.linearRampToValueAtTime(on ? 0.07 : 0, ctx!.currentTime + 1.2);
  return on;
}

/** Short UI blip. kind: 'tick' (hover) | 'click' | 'whoosh' (page change) */
export function blip(kind: 'tick' | 'click' | 'whoosh' = 'tick') {
  if (!on || !ctx) return;
  const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
  const [f0, f1, dur, vol] = kind === 'click' ? [520, 780, 0.12, 0.08] : kind === 'whoosh' ? [180, 60, 0.5, 0.06] : [880, 920, 0.05, 0.025];
  o.type = kind === 'whoosh' ? 'triangle' : 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
