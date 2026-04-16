import { state } from "../state";

type DecoyActive = { effectId: string; word: string };

export function getActiveDecoyForMe(): DecoyActive | null {
  const now = Date.now();
  const myId = state.myPlayerId;
  const effects = (state.room as any)?.effects || [];
  for (let i = 0; i < effects.length; i += 1) {
    const e = effects[i];
    if (!e || e.type !== "decoyWord" || typeof e.expiresAt !== "number" || e.expiresAt <= now) continue;
    if (e.sourcePlayerId === myId) continue;
    const w = e.payload?.wordsByPlayerId?.[myId as any];
    const done = e.payload?.completedBy?.[myId as any];
    if (typeof w === "string" && w.length > 0 && !done) return { effectId: e.id, word: w };
  }
  return null;
}

export function getDecoyTypingState() {
  const decoy = getActiveDecoyForMe();
  if (!decoy) {
    state.decoyDeferEffectId = null;
    state.decoyDeferIndex = null;
    return { decoy: null as DecoyActive | null, useDecoyWord: false };
  }
  if (state.decoyDeferEffectId !== decoy.effectId) {
    state.decoyDeferEffectId = decoy.effectId;
    state.decoyDeferIndex = state.myCurrentIndex;
  }
  const useDecoyWord = state.decoyDeferIndex != null && state.myCurrentIndex > state.decoyDeferIndex;
  return { decoy, useDecoyWord };
}

export function isDecoyTypingActive() {
  return getDecoyTypingState().useDecoyWord;
}

export function typingTargetWord() {
  const { decoy, useDecoyWord } = getDecoyTypingState();
  if (!decoy || !useDecoyWord) return state.currentWord;
  return decoy.word;
}

