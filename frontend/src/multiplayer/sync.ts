import { deriveActiveEffects } from "../gameLogic";
import { ensureEffectBanner, ensureSecondWindBanner } from "../effects/banners";
import { typingTargetWord } from "../effects/decoy";
import { updateFlowObscureVfx } from "../flow/obscureVfx";
import { endGame, endVictory, startMultiplayerGame } from "../game/game";
import { getMyPlayer } from "../game/selectors";
import { state } from "../state";
import { flashPlayer, renderPlayerList, renderWord } from "../ui/render";
import { updateLeaveRoomVisibility } from "../ui/visibility";

export function syncRoom(nextRoom: any) {
  const prevStarted = Boolean((state.room as any)?.started);
  const prevPlayers = (state.room as any)?.players || {};
  const nextPlayers = nextRoom?.players || {};
  const prevTypingTarget = typingTargetWord();
  state.room = nextRoom;

  const me: any = getMyPlayer();
  if (me && typeof me.health === "number") state.health = me.health;
  if (typeof (state.room as any)?.elapsedSeconds === "number") state.timeSurvived = (state.room as any).elapsedSeconds;

  // Second wind local flash (only for this client)
  const prevMe = prevPlayers?.[state.myPlayerId as any] || {};
  const didSecondWind = Boolean(me?.secondWindUsed) && !Boolean(prevMe?.secondWindUsed);
  if (didSecondWind) {
    const sw = ensureSecondWindBanner();
    sw.style.display = "block";
    clearTimeout(state.secondWindFlashTimeout as any);
    state.secondWindFlashTimeout = window.setTimeout(() => {
      sw.style.display = "none";
    }, 1400);
  }

  const now = Date.now();
  const effects = Array.isArray((state.room as any)?.effects) ? (state.room as any).effects : [];
  const myId = state.myPlayerId;
  const active = deriveActiveEffects({ effects, myPlayerId: myId, now });
  state.activeEffects = active as any;
  updateFlowObscureVfx();

  const banner = ensureEffectBanner();
  const jammedActive = active.some((e: any) => e?.type === "decoyWord");
  banner.style.display = jammedActive && !state.flowActive ? "block" : "none";

  if (typingTargetWord() !== prevTypingTarget) renderWord();

  if (state.gameRunning && (state.room as any)?.matchEnded) {
    if ((state.room as any).matchWinnerId === state.myPlayerId) endVictory();
    else endGame();
    updateLeaveRoomVisibility();
    return;
  }

  if (state.gameRunning && me && (me.deadAt || (typeof me.health === "number" && me.health <= 0))) {
    endGame();
    updateLeaveRoomVisibility();
    return;
  }

  renderPlayerList();

  Object.keys(nextPlayers).forEach((playerId) => {
    const prev = prevPlayers[playerId] || {};
    const next = nextPlayers[playerId] || {};
    if (next.lastTypo && next.lastTypo !== prev.lastTypo) flashPlayer(playerId, "typo-flash", 800);
    if (next.lastSuccess && next.lastSuccess !== prev.lastSuccess) flashPlayer(playerId, "correct-flash", 1000);
  });

  if ((state.room as any)?.started && !prevStarted && !state.gameRunning) {
    startMultiplayerGame();
  }

  updateLeaveRoomVisibility();
}

