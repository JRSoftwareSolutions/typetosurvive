/** Short Web Audio cues for Flow / Foresight (no asset files). */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") {
    return null;
  }
  const Ctx = AudioContext || (window as any).webkitAudioContext;
  if (!sharedCtx || sharedCtx.state === "closed") {
    try {
      sharedCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function resume(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

function beep(ctx: AudioContext, freq: number, duration: number, gain = 0.08) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime;
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playFlowStartCue() {
  const ctx = getAudioContext();
  if (!ctx) return;
  resume(ctx);
  beep(ctx, 660, 0.12, 0.07);
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    beep(ctx, 880, 0.14, 0.06);
  }, 70);
}

export function playFlowEndCue() {
  const ctx = getAudioContext();
  if (!ctx) return;
  resume(ctx);
  beep(ctx, 520, 0.1, 0.055);
  window.setTimeout(() => {
    if (ctx.state === "closed") return;
    beep(ctx, 320, 0.16, 0.05);
  }, 60);
}
