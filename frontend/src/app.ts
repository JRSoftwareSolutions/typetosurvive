import { createRoom, joinRoom, startRoom, subscribeRoomEvents, updatePlayer } from "./api";
import { FLOW_GAUGE_MAX, FLOW_TYPO_GAUGE_MULT } from "./constants";
import { els } from "./dom/els";
import { bindEvents } from "./events/bindEvents";
import { getActiveDecoyForMe, typingTargetWord } from "./effects/decoy";
import { leaveRoomAndReload } from "./game/game";
import { state } from "./state";
import { syncRoom } from "./multiplayer/sync";
import { renderWord, updateUI } from "./ui/render";
import {
  addDevBot,
  ensureDevBotPanel,
  isDevBotsEnabled,
  removeAllDevBots,
  stopDevBot,
  updateDevBotPanel,
} from "./dev/devBots";
import { closeRules, openRules } from "./ui/rules";

function showLobby() {
  state.devBotsEnabled = isDevBotsEnabled();
  if (state.devBotsEnabled) updateDevBotPanel();
  els.lobbyCodeDisplay.textContent = state.roomCode || "- - - -";
  els.lobbyScreen.classList.add("show");
  const isCreator = (state.room as any)?.creatorId === state.myPlayerId;
  els.creatorControls.style.display = isCreator ? "block" : "none";
}

async function createRoomHandler() {
  try {
    els.createBtn.disabled = true;
    state.myUsername = els.usernameInput.value.trim() || `Player${Math.floor(Math.random() * 999)}`;
    const response = await createRoom(state.myUsername);
    state.roomCode = response.roomCode;
    state.myPlayerId = response.playerId;
    syncRoom(response.room);

    if (state.eventSource) state.eventSource.close();
    state.eventSource = subscribeRoomEvents(state.roomCode, syncRoom);
    showLobby();
  } catch (error: any) {
    alert(`Create room failed: ${error.message}`);
  } finally {
    els.createBtn.disabled = false;
  }
}

async function joinRoomHandler() {
  try {
    const roomCode = els.roomCodeInput.value.trim().toUpperCase();
    if (!roomCode) return alert("Please enter a room code");

    state.myUsername = els.usernameInput.value.trim() || `Player${Math.floor(Math.random() * 999)}`;
    const response = await joinRoom(roomCode, state.myUsername, state.myPlayerId);

    state.roomCode = roomCode;
    state.myPlayerId = response.playerId;
    syncRoom(response.room);

    if (state.eventSource) state.eventSource.close();
    state.eventSource = subscribeRoomEvents(state.roomCode, syncRoom);
    showLobby();
  } catch (error: any) {
    alert(`Join room failed: ${error.message}`);
  }
}

async function startGameHandler() {
  if (!state.roomCode || !state.myPlayerId) return;
  try {
    await startRoom(state.roomCode, state.myPlayerId);
  } catch (error: any) {
    alert(error.message);
  }
}

function updateLetterColors(typed: string) {
  const typedLower = typed.toLowerCase();
  const wordLower = typingTargetWord().toLowerCase();
  const spans = els.letters.querySelectorAll(".letter");
  let hasTypo = false;

  spans.forEach((span, index) => {
    if (index < typedLower.length) {
      if (typedLower[index] === wordLower[index]) (span as HTMLElement).className = "letter correct";
      else {
        (span as HTMLElement).className = "letter incorrect";
        hasTypo = true;
      }
    } else (span as HTMLElement).className = "letter pending";
  });

  if (hasTypo && !state.flowWordHadTypo) {
    if (!state.flowActive) {
      state.flowWordHadTypo = true;
      state.flowGauge = Math.max(
        0,
        Math.min(FLOW_GAUGE_MAX, (Number(state.flowGauge) || 0) * FLOW_TYPO_GAUGE_MULT),
      );
      if (state.roomCode && state.myPlayerId) {
        updatePlayer(state.roomCode, state.myPlayerId, { flowGauge: state.flowGauge }).catch(() => {});
      }
    }
  }

  if (hasTypo && state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, { lastTypo: Date.now() }).catch(() => {});
  }
}

async function onDecoySuccess() {
  const d = getActiveDecoyForMe();
  if (!d || !state.roomCode || !state.myPlayerId) return;
  try {
    await updatePlayer(state.roomCode, state.myPlayerId, { decoyTypedEffectId: d.effectId });
  } catch {
    // no-op
  }
  els.input.value = "";
  renderWord();
  updateUI();
}

async function leaveRoomHandler() {
  await leaveRoomAndReload(removeAllDevBots);
}

bindEvents({
  createRoomHandler,
  joinRoomHandler,
  startGameHandler,
  leaveRoomHandler,
  openRules,
  closeRules,
  onDecoySuccess,
  updateLetterColors,
  isDevBotsEnabled,
  updateDevBotPanel,
  ensureDevBotPanel,
  addDevBot: () => addDevBot(),
  removeAllDevBots,
  stopDevBot,
});

const versionEl = document.getElementById("app-version");
if (versionEl) {
  const v = typeof __APP_VERSION__ !== "undefined" ? (__APP_VERSION__ as any) : "dev";
  versionEl.textContent = `v${v}`;
}

// Dev-only: expose state for e2e debugging/polling.
if (import.meta.env.DEV) {
  (window as any).__T4YL_STATE__ = state;
}
