import { state } from "../state";

const FLOW_OBSCURE_LAYER_Z = "75";

let flowInterferencePreviewUntil = 0;
let flowInterferencePreviewInterval: number | null = null;
let flowInterferencePreviewZRestore: string | null = null;

function stopFlowInterferencePreview() {
  flowInterferencePreviewUntil = 0;
  if (flowInterferencePreviewInterval != null) {
    window.clearInterval(flowInterferencePreviewInterval);
    flowInterferencePreviewInterval = null;
  }
  const layer = document.getElementById("flow-obscure-layer");
  if (layer && flowInterferencePreviewZRestore != null) {
    layer.style.zIndex = flowInterferencePreviewZRestore;
    flowInterferencePreviewZRestore = null;
  }
}

function tickFlowObscureSpawns(layer: HTMLElement, remainingTicks: number, intensity: number) {
  const existingCount = layer.childElementCount;
  const maxParticles = 90;
  if (existingCount >= maxParticles) return;

  const base = 4 + Math.floor(intensity * 8);
  const burst = remainingTicks > 40 ? 4 : remainingTicks > 15 ? 2 : 1;
  const count = Math.max(4, Math.min(14, base + burst));
  for (let i = 0; i < count; i += 1) spawnFlowObscureGlitch(layer, intensity);

  const doSweep = Math.random() < 0.28 + intensity * 0.35;
  if (doSweep) spawnFlowObscureSweep(layer, intensity);
}

/** Short full-screen sample of Flow interference (for Rules UI). No-ops if a real effect is already active. */
export function previewFlowInterferenceFromRules() {
  if (activeFlowObscureForMe()) return;

  stopFlowInterferencePreview();

  const durationMs = 1750;
  const tickMs = 160;
  const intensity = 0.62;
  const remainingTicks = 55;

  const layer = ensureFlowObscureLayer();
  flowInterferencePreviewZRestore = layer.style.zIndex || FLOW_OBSCURE_LAYER_Z;
  layer.style.zIndex = "110";

  flowInterferencePreviewUntil = Date.now() + durationMs;

  const runTick = () => {
    if (activeFlowObscureForMe()) {
      stopFlowInterferencePreview();
      updateFlowObscureVfx();
      return;
    }
    if (Date.now() >= flowInterferencePreviewUntil) {
      stopFlowInterferencePreview();
      updateFlowObscureVfx();
      return;
    }
    layer.style.display = "block";
    document.body.classList.add("flow-obscured");
    tickFlowObscureSpawns(layer, remainingTicks, intensity);
  };

  runTick();
  flowInterferencePreviewInterval = window.setInterval(runTick, tickMs);
}

export function ensureFlowObscureLayer() {
  const existing = document.getElementById("flow-obscure-layer");
  if (existing) return existing;
  const layer = document.createElement("div");
  layer.id = "flow-obscure-layer";
  layer.dataset.testid = "flow-obscure-layer";
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  // Foreground over gameplay; still under menus (overlay uses z-index:100).
  layer.style.zIndex = FLOW_OBSCURE_LAYER_Z;
  layer.style.display = "none";
  document.body.appendChild(layer);
  return layer;
}

export function activeFlowObscureForMe() {
  const effects = Array.isArray(state.activeEffects) ? state.activeEffects : [];
  for (let i = 0; i < effects.length; i += 1) {
    const e: any = effects[i];
    if (e && e.type === "flowObscure") return e;
  }
  return null;
}

export function spawnFlowObscureGlitch(layer: HTMLElement, intensity: number) {
  const el = document.createElement("div");
  el.className = "flow-obscure-glitch";

  // Bias towards the word + input area (center-ish), but still anywhere on screen.
  const x = 10 + Math.random() * 80;
  const y = 14 + Math.random() * 66;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;

  const w = 6 + Math.random() * (18 + intensity * 22); // vw-ish units via % + px
  const h = 8 + Math.random() * (18 + intensity * 22);
  el.style.width = `${w.toFixed(1)}vmin`;
  el.style.height = `${h.toFixed(1)}vmin`;

  const dur = 240 + Math.random() * 320 + intensity * 220;
  const dx = (Math.random() * 2 - 1) * (18 + intensity * 34);
  const hue = Math.floor(160 + Math.random() * 80); // neon cyan→pink band
  const alpha = 0.22 + intensity * 0.28;
  el.style.setProperty("--gx-dur", `${Math.round(dur)}ms`);
  el.style.setProperty("--gx-dx", `${dx.toFixed(1)}px`);
  el.style.setProperty("--gx-hue", String(hue));
  el.style.setProperty("--gx-a", alpha.toFixed(3));

  layer.appendChild(el);
  setTimeout(() => el.remove(), Math.round(dur) + 60);
}

export function spawnFlowObscureSweep(layer: HTMLElement, intensity: number) {
  const el = document.createElement("div");
  el.className = "flow-obscure-sweep";
  const y = 12 + Math.random() * 76;
  el.style.top = `${y}%`;
  const h = 10 + intensity * 14 + Math.random() * 8;
  el.style.height = `${h.toFixed(1)}px`;
  const dur = 260 + Math.random() * 260 + intensity * 220;
  el.style.setProperty("--sw-dur", `${Math.round(dur)}ms`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), Math.round(dur) + 80);
}

export function updateFlowObscureVfx() {
  const layer = ensureFlowObscureLayer();
  const effect: any = activeFlowObscureForMe();
  const previewOn = Date.now() < flowInterferencePreviewUntil;

  if (!effect && !previewOn) {
    layer.style.display = "none";
    document.body.classList.remove("flow-obscured");
    return;
  }

  if (effect) {
    layer.style.display = "block";
    document.body.classList.add("flow-obscured");

    const payload = effect.payload && typeof effect.payload === "object" ? effect.payload : {};
    const remainingTicks = typeof payload.remainingTicks === "number" ? payload.remainingTicks : 0;
    const intensity = Math.max(0, Math.min(1, typeof payload.intensity === "number" ? payload.intensity : 0.25));

    tickFlowObscureSpawns(layer, remainingTicks, intensity);
  }
}

