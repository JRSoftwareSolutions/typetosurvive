import { joinRoom, leaveRoom, setPlayerReady, updatePlayer } from "../api";
import {
  DEV_BOT_CHAR_MS,
  DEV_BOT_JITTER_MS,
  DEV_BOT_WORD_PAUSE_MS,
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_MAX,
} from "../constants";
import { els } from "../dom/els";
import { flowDurationMsAtActivation, flowGaugeFillOnPerfectWord } from "../gameLogic";
import { state } from "../state";
import { syncRoom } from "../multiplayer/sync";

const devBotTimersById = new Map<string, number>();
const devBotFlowById = new Map<string, any>();

export function isDevBotsEnabled() {
  try {
    return new URLSearchParams(location.search).get("dev") === "1";
  } catch {
    return false;
  }
}

export function ensureDevBotPanel() {
  const existing = document.getElementById("dev-bot-panel");
  if (existing) return existing;

  const panel = document.createElement("div");
  panel.id = "dev-bot-panel";
  panel.style.marginTop = "12px";
  panel.style.width = "min(640px, 92vw)";
  panel.style.border = "3px dashed rgba(0, 247, 255, 0.55)";
  panel.style.borderRadius = "12px";
  panel.style.padding = "12px";
  panel.style.background = "rgba(0,0,0,0.35)";
  panel.style.boxShadow = "0 0 20px rgba(0, 247, 255, 0.12)";

  const title = document.createElement("div");
  title.textContent = "DEV: BOTS ENABLED";
  title.style.color = "#00f7ff";
  title.style.letterSpacing = "0.12em";
  title.style.textAlign = "center";
  title.style.marginBottom = "10px";
  title.style.textShadow = "0 0 12px rgba(0,247,255,0.22)";
  panel.appendChild(title);

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "10px";
  row.style.justifyContent = "center";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.id = "dev-add-bot-btn";
  addBtn.textContent = "ADD BOT";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.id = "dev-remove-bots-btn";
  removeBtn.textContent = "REMOVE BOTS";
  removeBtn.className = "danger";

  const hint = document.createElement("div");
  hint.id = "dev-bot-hint";
  hint.style.marginTop = "10px";
  hint.style.fontSize = "0.75rem";
  hint.style.opacity = "0.85";
  hint.style.textAlign = "center";
  hint.style.lineHeight = "1.6";
  hint.textContent = "Perfect bot types correct words at a fixed cadence.";

  row.appendChild(addBtn);
  row.appendChild(removeBtn);
  panel.appendChild(row);
  panel.appendChild(hint);

  // Insert above the leave room button in lobby.
  els.lobbyScreen.insertBefore(panel, els.leaveBtn);
  return panel;
}

export function updateDevBotPanel() {
  if (!state.devBotsEnabled) return;
  const panel = ensureDevBotPanel();
  panel.style.display = state.roomCode && state.myPlayerId ? "block" : "none";

  const hint = document.getElementById("dev-bot-hint");
  if (hint) {
    const n = Array.isArray(state.devBotIds) ? state.devBotIds.length : 0;
    hint.textContent = `Perfect bot types correct words at a fixed cadence. Active bots: ${n}.`;
  }
}

function stopDevBotTimer(botId: string) {
  const t = devBotTimersById.get(botId);
  if (typeof t === "number") clearTimeout(t);
  devBotTimersById.delete(botId);
}

function removeDevBotState(botId: string) {
  stopDevBotTimer(botId);
  devBotFlowById.delete(botId);
}

export function stopDevBot(botId: string) {
  removeDevBotState(botId);
}

export async function removeAllDevBots({ leaveServer = true } = {}) {
  const ids = Array.isArray(state.devBotIds) ? [...state.devBotIds] : [];
  ids.forEach((id) => removeDevBotState(id));
  state.devBotIds = [];
  updateDevBotPanel();

  if (!leaveServer || !state.roomCode) return;
  await Promise.all(ids.map((id) => leaveRoom(state.roomCode, id).catch(() => {})));
}

function getDevBotFlow(botId: string) {
  const existing = devBotFlowById.get(botId);
  if (existing) return existing;
  const init = {
    gauge: 0,
    active: false,
    endsAt: 0,
    counter: 0,
  };
  devBotFlowById.set(botId, init);
  return init;
}

async function maybeEndDevBotFlow(botId: string, flow: any) {
  if (!flow.active) return;
  const now = Date.now();
  if (flow.endsAt > 0 && now < flow.endsAt) return;
  flow.active = false;
  flow.endsAt = 0;
  const payout = Math.max(0, Math.trunc(flow.counter || 0));
  flow.counter = 0;
  if (state.roomCode) {
    await updatePlayer(state.roomCode, botId, {
      flowActive: false,
      flowPayout: payout,
      flowLastEndedAt: now,
    }).catch(() => {});
  }
}

async function maybeActivateDevBotFlow(botId: string, flow: any) {
  if (flow.active) return;
  const gauge = Math.max(0, Math.min(FLOW_GAUGE_MAX, Number(flow.gauge) || 0));
  if (gauge < FLOW_GAUGE_MAX * FLOW_GAUGE_ACTIVATE_AT) return;
  const durationMs = flowDurationMsAtActivation(gauge);
  flow.active = true;
  flow.endsAt = Date.now() + durationMs;
  flow.counter = 0;
  flow.gauge = 0;
  if (state.roomCode) {
    await updatePlayer(state.roomCode, botId, { flowActive: true, flowGauge: 0 }).catch(() => {});
  }
}

function scheduleDevBotStep(botId: string) {
  stopDevBotTimer(botId);

  if (!state.roomCode) return;
  if (!(state.room as any)?.started) {
    devBotTimersById.set(botId, window.setTimeout(() => scheduleDevBotStep(botId), 250));
    return;
  }
  const bot: any = (state.room as any)?.players?.[botId];
  if (!bot) return;

  const flow = getDevBotFlow(botId);

  const idx = typeof bot.currentIndex === "number" ? bot.currentIndex : 0;
  const word = (state.room as any)?.wordSequence?.[idx];
  if (typeof word !== "string" || word.length === 0) return;

  const jitter = Math.floor((Math.random() * 2 - 1) * DEV_BOT_JITTER_MS);
  const delay = Math.max(30, word.length * DEV_BOT_CHAR_MS + DEV_BOT_WORD_PAUSE_MS + jitter);

  const handle = window.setTimeout(async () => {
    if (!state.roomCode || !(state.room as any)?.started) return scheduleDevBotStep(botId);
    const b: any = (state.room as any)?.players?.[botId];
    if (!b) return;

    await maybeEndDevBotFlow(botId, flow);
    await maybeActivateDevBotFlow(botId, flow);

    const currentIndex = typeof b.currentIndex === "number" ? b.currentIndex : 0;
    const targetWord = (state.room as any)?.wordSequence?.[currentIndex];
    if (typeof targetWord !== "string" || targetWord.length === 0) return;

    const nextScore = (typeof b.score === "number" ? b.score : 0) + targetWord.length * 18 + 50;
    if (flow.active) {
      flow.counter = (Number(flow.counter) || 0) + targetWord.length;
    } else {
      flow.gauge = flowGaugeFillOnPerfectWord(Number(flow.gauge) || 0, {
        wordLength: targetWord.length,
      });
    }
    try {
      await updatePlayer(state.roomCode, botId, {
        currentIndex: currentIndex + 1,
        lastSuccess: Date.now(),
        score: nextScore,
        health: 100,
        flowGauge: flow.active ? 0 : flow.gauge,
        flowActive: flow.active,
      });
    } catch {
      // no-op
    }

    await maybeEndDevBotFlow(botId, flow);
    scheduleDevBotStep(botId);
  }, delay);

  devBotTimersById.set(botId, handle);
}

export async function addDevBot() {
  if (!state.devBotsEnabled) return;
  if (!state.roomCode) return;
  const n = (Array.isArray(state.devBotIds) ? state.devBotIds.length : 0) + 1;
  const username = `BOT_${n}`;
  try {
    const response = await joinRoom(state.roomCode, username, null);
    const botId = response.playerId;
    if (!Array.isArray(state.devBotIds)) state.devBotIds = [];
    if (!state.devBotIds.includes(botId)) state.devBotIds.push(botId);
    await setPlayerReady(state.roomCode, botId, true).catch(() => {});
    const room = response.room as any;
    const players = { ...(room?.players || {}) };
    if (players[botId]) players[botId] = { ...players[botId], ready: true };
    syncRoom({ ...room, players });
    updateDevBotPanel();
    scheduleDevBotStep(botId);
  } catch (error: any) {
    alert(`Add bot failed: ${error.message}`);
  }
}
