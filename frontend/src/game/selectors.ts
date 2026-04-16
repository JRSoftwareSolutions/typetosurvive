import { state } from "../state";

export function getWords() {
  return (state.room as any)?.wordSequence ?? [];
}

export function getMyPlayer() {
  const id = state.myPlayerId as any;
  return (state.room as any)?.players?.[id] ?? null;
}

