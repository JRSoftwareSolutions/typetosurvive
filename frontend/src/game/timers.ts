import { updatePlayer } from "../api";
import { flowGaugeElasticStep } from "../gameLogic";
import { state } from "../state";

let lastDrainTickAt = 0;

export function stopGameLoops() {
  if (state.drainInterval != null) clearInterval(state.drainInterval);
  if (state.timerInterval != null) clearInterval(state.timerInterval);
  state.drainInterval = null;
  state.timerInterval = null;
}

export function drainHealth(updateUI: () => void, endGame: () => void) {
  if (!state.gameRunning) return;
  const now = Date.now();
  const dt = lastDrainTickAt ? now - lastDrainTickAt : 85;
  lastDrainTickAt = now;

  const me: any = (state.room as any)?.players?.[state.myPlayerId as any] ?? null;
  const resetAt = typeof me?.threatResetElapsedSeconds === "number" ? me.threatResetElapsedSeconds : 0;
  const effectiveElapsed = Math.max(0, state.timeSurvived - resetAt);
  const threat = Math.min(15, Math.floor(effectiveElapsed / 22)) + 1;

  // Drain scales with threat; dt normalization keeps behavior stable if interval jitters.
  const drainPerSecond = 0.75 + threat * 0.18;
  const drain = (drainPerSecond * dt) / 1000;
  state.health = Math.max(0, state.health - drain);

  if (state.health <= 0) {
    updateUI();
    endGame();
    return;
  }

  // Elastic Flow gauge drift (paused while Flow is active so duration matches activation snapshot).
  if (!state.flowActive) {
    const prevGauge = Number(state.flowGauge) || 0;
    state.flowGauge = flowGaugeElasticStep(prevGauge, dt);
    if (
      state.roomCode &&
      state.myPlayerId &&
      now - state.lastFlowGaugeSentAt > 350 &&
      state.flowGauge !== prevGauge
    ) {
      updatePlayer(state.roomCode, state.myPlayerId, { flowGauge: state.flowGauge }).catch(() => {});
      state.lastFlowGaugeSentAt = now;
    }
  }

  if (now - state.lastHealthUpdateAt > 350 && state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, { health: Math.max(0, state.health) }).catch(() => {});
    state.lastHealthUpdateAt = now;
  }

  updateUI();
}

export function startDrain(updateUI: () => void, endGame: () => void) {
  lastDrainTickAt = 0;
  state.drainInterval = setInterval(() => drainHealth(updateUI, endGame), 85);
}

export function startTimer(updateUI: () => void) {
  state.timerInterval = setInterval(() => {
    if (!state.gameRunning) return;
    updateUI();
  }, 1000);
}

