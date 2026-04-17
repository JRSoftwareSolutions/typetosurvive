import { updatePlayer } from "../api";
import { playFlowEndCue } from "./flowAudio";
import { clearForesightPreview } from "./foresight";
import { state } from "../state";

export function endFlow(
  updateUI: () => void,
  { now = Date.now() }: { now?: number } = {},
) {
  if (!state.flowActive) return;
  state.flowActive = false;
  state.flowEndsAt = 0;

  const payout = Math.max(0, Math.trunc(Number(state.flowCounter) || 0));
  clearForesightPreview({ animate: true });
  playFlowEndCue();
  updateUI();

  if (state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, {
      flowActive: false,
      flowPayout: payout,
      flowLastEndedAt: now,
    }).catch(() => {});
  }
}

export function maybeEndFlowIfExpired(updateUI: () => void, now = Date.now()) {
  if (!state.flowActive) return;
  const endsAt = Number(state.flowEndsAt) || 0;
  if (endsAt > 0 && now >= endsAt) endFlow(updateUI, { now });
}

export function applyFlowInputDelta(
  updateUI: () => void,
  typed: string,
  target: string,
) {
  if (!state.flowActive) return;

  const now = Date.now();
  maybeEndFlowIfExpired(updateUI, now);
  if (!state.flowActive) return;

  const prev = String(state.flowLastInputValue || "");
  const next = String(typed || "");
  if (next === prev) return;

  const prevLower = prev.toLowerCase();
  const nextLower = next.toLowerCase();
  const targetLower = String(target || "").toLowerCase();

  // Backspace / edits: update baseline but don’t modify counter (tuning knob).
  if (nextLower.length <= prevLower.length) {
    state.flowLastInputValue = next;
    updateUI();
    return;
  }

  // Compute newly-added suffix (assumes typical append typing).
  let prefixLen = 0;
  const maxPrefix = Math.min(prevLower.length, nextLower.length);
  while (prefixLen < maxPrefix && prevLower[prefixLen] === nextLower[prefixLen]) prefixLen += 1;

  for (let i = prefixLen; i < nextLower.length; i += 1) {
    const tChar = targetLower[i] ?? "";
    const nChar = nextLower[i] ?? "";
    const correct = tChar && nChar === tChar;
    if (correct) {
      state.flowCounter = (Number(state.flowCounter) || 0) + 1;
      continue;
    }
    state.flowLastInputValue = next;
    updateUI();
    endFlow(updateUI, { now });
    return;
  }

  state.flowLastInputValue = next;
  updateUI();
}
