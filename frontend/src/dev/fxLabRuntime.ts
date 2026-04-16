import { ensureEffectBanner } from "../effects/banners";
import { deriveActiveEffects } from "../gameLogic";
import { activeFlowObscureForMe, updateFlowObscureVfx } from "../flow/obscureVfx";
import { state } from "../state";
import { renderPlayerList, renderWord, updateUI } from "../ui/render";

const ME = "fx-lab-me";
const OTHER = "fx-lab-attacker";

let flowVfxInterval: number | null = null;

function stopFlowVfxLoop() {
  if (flowVfxInterval != null) {
    window.clearInterval(flowVfxInterval);
    flowVfxInterval = null;
  }
}

function startFlowVfxLoop() {
  stopFlowVfxLoop();
  flowVfxInterval = window.setInterval(() => {
    if (!activeFlowObscureForMe()) {
      stopFlowVfxLoop();
      updateFlowObscureVfx();
      return;
    }
    updateFlowObscureVfx();
  }, 160);
}

function refreshFxVisuals() {
  state.lastRenderAt = 0;
  const room = state.room as any;
  const effects = Array.isArray(room?.effects) ? room.effects : [];
  const now = Date.now();
  state.activeEffects = deriveActiveEffects({
    effects,
    myPlayerId: state.myPlayerId,
    now,
  }) as any;

  const banner = ensureEffectBanner();
  banner.style.display = state.activeEffects.some((e: any) => e?.type === "decoyWord") ? "block" : "none";

  updateFlowObscureVfx();
  renderWord();
  renderPlayerList();
  updateUI();
}

function removeEffectsByType(type: string) {
  const room = state.room as any;
  if (!room) return;
  room.effects = (Array.isArray(room.effects) ? room.effects : []).filter((e: any) => e?.type !== type);
}

function mockDecoyWord() {
  const now = Date.now();
  return {
    id: "fx-lab-decoy",
    type: "decoyWord",
    sourcePlayerId: OTHER,
    targets: "others",
    createdAt: now,
    expiresAt: now + 600_000,
    payload: {
      wordsByPlayerId: { [ME]: "FAKEWRD" },
      completedBy: {},
    },
  };
}

function mockFlowObscure(remainingTicks: number, intensity: number) {
  const now = Date.now();
  const tickMs = 500;
  return {
    id: "fx-lab-flow-obscure",
    type: "flowObscure",
    sourcePlayerId: OTHER,
    targets: [ME],
    createdAt: now,
    expiresAt: now + Math.max(1, remainingTicks) * tickMs,
    payload: {
      remainingTicks,
      intensity: Math.max(0, Math.min(1, intensity)),
      lastTickAt: now,
    },
  };
}

function ensureRoom() {
  if (!state.room) {
    state.room = {
      started: true,
      elapsedSeconds: 42,
      effects: [],
      players: {
        [ME]: { username: "You", health: 100, score: 12, threatResetElapsedSeconds: 0 },
        [OTHER]: { username: "Attacker", health: 100, score: 12 },
      },
    };
  }
}

export function bootFxLab() {
  const panel = document.getElementById("fx-lab-panel");
  if (!panel) return;

  state.roomCode = "LAB";
  state.myPlayerId = ME;
  state.myUsername = "You";
  state.gameRunning = true;
  state.currentWord = "SURVIVE";
  state.myCurrentIndex = 0;
  state.health = 100;
  state.score = 0;
  state.timeSurvived = 42;
  state.decoyDeferEffectId = null;
  state.decoyDeferIndex = null;
  state.flowGauge = 0;
  state.flowActive = false;
  state.flowEndsAt = 0;

  ensureRoom();
  (state.room as any).effects = [];

  panel.innerHTML = `
    <h2>FX LAB</h2>
    <div class="fx-lab-row">
      <button type="button" data-testid="fx-lab-btn-clear">Clear FX</button>
    </div>
    <div class="fx-lab-row">
      <button type="button" data-testid="fx-lab-btn-decoy-defer">Jammed (defer)</button>
      <button type="button" data-testid="fx-lab-btn-decoy-typing">Jammed (fake word)</button>
    </div>
    <div class="fx-lab-row">
      <button type="button" data-testid="fx-lab-btn-flow-light">Flow obscure (light)</button>
      <button type="button" data-testid="fx-lab-btn-flow-heavy">Flow obscure (heavy)</button>
    </div>
    <div class="fx-lab-row">
      <button type="button" data-testid="fx-lab-btn-flow-end">Flow end (clear)</button>
    </div>
    <p class="fx-lab-note">
      <strong>Jammed (defer):</strong> banner on, still typing real word index 0.<br />
      <strong>Jammed (fake word):</strong> advance index so decoy word shows (matches multiplayer defer).<br />
      <strong>Flow end:</strong> removes obscurity (jitter + overlay stop); no separate exit burst in code today.
    </p>
  `;

  panel.querySelector('[data-testid="fx-lab-btn-clear"]')?.addEventListener("click", () => {
    stopFlowVfxLoop();
    removeEffectsByType("decoyWord");
    removeEffectsByType("flowObscure");
    state.decoyDeferEffectId = null;
    state.decoyDeferIndex = null;
    state.myCurrentIndex = 0;
    refreshFxVisuals();
  });

  panel.querySelector('[data-testid="fx-lab-btn-decoy-defer"]')?.addEventListener("click", () => {
    stopFlowVfxLoop();
    removeEffectsByType("flowObscure");
    removeEffectsByType("decoyWord");
    state.decoyDeferEffectId = null;
    state.decoyDeferIndex = null;
    state.myCurrentIndex = 0;
    (state.room as any).effects.push(mockDecoyWord());
    refreshFxVisuals();
  });

  panel.querySelector('[data-testid="fx-lab-btn-decoy-typing"]')?.addEventListener("click", () => {
    stopFlowVfxLoop();
    removeEffectsByType("flowObscure");
    const room = state.room as any;
    const hasDecoy = (room.effects || []).some((e: any) => e?.type === "decoyWord");
    if (!hasDecoy) room.effects.push(mockDecoyWord());
    state.myCurrentIndex = 1;
    refreshFxVisuals();
  });

  panel.querySelector('[data-testid="fx-lab-btn-flow-light"]')?.addEventListener("click", () => {
    removeEffectsByType("flowObscure");
    (state.room as any).effects.push(mockFlowObscure(18, 0.22));
    refreshFxVisuals();
    startFlowVfxLoop();
  });

  panel.querySelector('[data-testid="fx-lab-btn-flow-heavy"]')?.addEventListener("click", () => {
    removeEffectsByType("flowObscure");
    (state.room as any).effects.push(mockFlowObscure(72, 0.95));
    refreshFxVisuals();
    startFlowVfxLoop();
  });

  panel.querySelector('[data-testid="fx-lab-btn-flow-end"]')?.addEventListener("click", () => {
    stopFlowVfxLoop();
    removeEffectsByType("flowObscure");
    refreshFxVisuals();
  });

  refreshFxVisuals();
}
