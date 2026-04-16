import { createRoom, joinRoom, leaveRoom, startRoom, subscribeRoomEvents, updatePlayer } from "./api";
import {
  DEV_BOT_CHAR_MS,
  DEV_BOT_JITTER_MS,
  DEV_BOT_WORD_PAUSE_MS,
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_ADD_BASE,
  FLOW_GAUGE_ADD_MULT,
  FLOW_GAUGE_MAX,
  FLOW_MAX_MS,
  FLOW_MIN_MS,
  FLOW_STREAK_SOFT_CAP,
} from "./constants";
import { els } from "./dom/els";
import { bindEvents } from "./events/bindEvents";
import { getActiveDecoyForMe, typingTargetWord } from "./effects/decoy";
import { flowGaugeAddForStreak as flowGaugeAddForStreakImpl } from "./gameLogic";
import { leaveRoomAndReload } from "./game/game";
import { state } from "./state";
import { syncRoom } from "./multiplayer/sync";
import { renderWord, updateUI } from "./ui/render";

function flowGaugeAddForStreak(streak: number) {
  return flowGaugeAddForStreakImpl({
    streak,
    softCap: FLOW_STREAK_SOFT_CAP,
    baseAdd: FLOW_GAUGE_ADD_BASE,
    multAdd: FLOW_GAUGE_ADD_MULT,
  });
}

const devBotTimersById = new Map<string, number>();
const devBotFlowById = new Map<string, any>();

function isDevBotsEnabled() {
  try {
    return new URLSearchParams(location.search).get("dev") === "1";
  } catch {
    return false;
  }
}

function ensureDevBotPanel() {
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

function updateDevBotPanel() {
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

function stopDevBot(botId: string) {
  removeDevBotState(botId);
}

async function removeAllDevBots({ leaveServer = true } = {}) {
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
    streak: 0,
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

function lerp(a: number, b: number, t: number) {
  const tt = Math.max(0, Math.min(1, t));
  return a + (b - a) * tt;
}

async function maybeActivateDevBotFlow(botId: string, flow: any) {
  if (flow.active) return;
  const gauge = Math.max(0, Math.min(FLOW_GAUGE_MAX, Number(flow.gauge) || 0));
  if (gauge < FLOW_GAUGE_MAX * FLOW_GAUGE_ACTIVATE_AT) return;
  const durationMs = Math.floor(lerp(FLOW_MIN_MS, FLOW_MAX_MS, gauge / FLOW_GAUGE_MAX));
  flow.active = true;
  flow.endsAt = Date.now() + durationMs;
  flow.counter = 0;
  flow.gauge = 0;
  flow.streak = 0;
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
      flow.streak = Math.max(0, (Number(flow.streak) || 0) + 1);
      const add = flowGaugeAddForStreak(flow.streak);
      flow.gauge = Math.min(FLOW_GAUGE_MAX, (Number(flow.gauge) || 0) + add);
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

async function addDevBot() {
  if (!state.devBotsEnabled) return;
  if (!state.roomCode) return;
  const n = (Array.isArray(state.devBotIds) ? state.devBotIds.length : 0) + 1;
  const username = `BOT_${n}`;
  try {
    const response = await joinRoom(state.roomCode, username, null);
    const botId = response.playerId;
    if (!Array.isArray(state.devBotIds)) state.devBotIds = [];
    if (!state.devBotIds.includes(botId)) state.devBotIds.push(botId);
    syncRoom(response.room);
    updateDevBotPanel();
    scheduleDevBotStep(botId);
  } catch (error: any) {
    alert(`Add bot failed: ${error.message}`);
  }
}

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
    state.flowWordHadTypo = true;
    state.flowGauge = 0;
    state.flowStreakPerfectWords = 0;
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

// Rules UI is still embedded here for now; it will get its own module later if desired.
const RULE_ITEMS = [
  { id: "secondWind", kind: "buff", title: "SECOND WIND", subtitle: "Threat reset", implemented: true },
  { id: "comingSoonBuff1", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "comingSoonBuff2", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "decoyWord", kind: "debuff", title: "DECOY WORD", subtitle: "Fake next word", implemented: true },
  { id: "comingSoonDebuff1", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
  { id: "comingSoonDebuff2", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
];

function rulesIndexHtml() {
  const buffs = RULE_ITEMS.filter((i) => i.kind === "buff");
  const debuffs = RULE_ITEMS.filter((i) => i.kind === "debuff");
  const card = (i: any) => `
    <button class="rules-card" type="button" data-rules-id="${i.id}">
      <div class="rules-card-title">${i.title}</div>
      <div class="rules-card-sub">${i.subtitle}</div>
      ${i.implemented ? "" : `<div class="rules-card-tag">COMING SOON</div>`}
    </button>
  `;

  return `
    <div class="rules-section">
      <div class="rules-h">GOAL</div>
      <div class="rules-p">Type words to survive longer than your opponents.</div>
      <div class="rules-p"><span class="rules-k">WIN</span>: be the last player alive. <span class="rules-k">LOSE</span>: your health reaches 0.</div>
    </div>

    <div class="rules-section">
      <div class="rules-h">THREAT LEVEL</div>
      <div class="rules-p">Threat increases over time and makes health drain faster.</div>
      <div class="rules-p">Threat ramps about every <span class="rules-k">22 seconds</span> (capped). <span class="rules-k">Second Wind</span> resets your threat back to 01 once per match.</div>
    </div>

    <div class="rules-section">
      <div class="rules-h">SCORE</div>
      <div class="rules-p">Score increases when you complete a word.</div>
      <div class="rules-p">On each success: <span class="rules-k">score += wordLength * 18 + 50</span></div>
    </div>

    <div class="rules-section">
      <div class="rules-h">BUFFS & DEBUFFS</div>
      <div class="rules-grid">
        <div class="rules-col">
          <div class="rules-col-title">BUFFS</div>
          ${buffs.map(card).join("")}
        </div>
        <div class="rules-col">
          <div class="rules-col-title">DEBUFFS</div>
          ${debuffs.map(card).join("")}
        </div>
      </div>
    </div>
  `;
}

function rulesDetailHtml(itemId: string) {
  const item = RULE_ITEMS.find((i) => i.id === itemId) ?? null;
  const title = item?.title ?? "DETAILS";
  if (!item) {
    return `
      <button class="rules-back" type="button" data-rules-action="back">← BACK</button>
      <div class="rules-section">
        <div class="rules-h">${title}</div>
        <div class="rules-p">Not found.</div>
      </div>
    `;
  }

  if (!item.implemented) {
    return `
      <button class="rules-back" type="button" data-rules-action="back">← BACK</button>
      <div class="rules-section">
        <div class="rules-h">${title}</div>
        <div class="rules-p">Coming soon.</div>
      </div>
    `;
  }

  if (item.id === "secondWind") {
    return `
      <button class="rules-back" type="button" data-rules-action="back">← BACK</button>
      <div class="rules-section">
        <div class="rules-h">SECOND WIND</div>
        <div class="rules-p"><span class="rules-k">Once per match</span>.</div>
        <div class="rules-p"><span class="rules-k">Trigger</span>: health drops below <span class="rules-k">20%</span>, then you recover to <span class="rules-k">80%+</span> within <span class="rules-k">2 seconds</span>.</div>
        <div class="rules-p"><span class="rules-k">Effect</span>: your threat resets to <span class="rules-k">01</span> and ramps again.</div>
      </div>
    `;
  }

  if (item.id === "decoyWord") {
    return `
      <button class="rules-back" type="button" data-rules-action="back">← BACK</button>
      <div class="rules-section">
        <div class="rules-h">DECOY WORD</div>
        <div class="rules-p"><span class="rules-k">Trigger</span>: an opponent gets <span class="rules-k">3 successes within 5 seconds</span> (with a short cooldown).</div>
        <div class="rules-p"><span class="rules-k">Effect</span>: after you finish the word you’re on when it hits, your <span class="rules-k">next</span> target becomes a fake word until you complete it.</div>
      </div>
    `;
  }

  return `
    <button class="rules-back" type="button" data-rules-action="back">← BACK</button>
    <div class="rules-section">
      <div class="rules-h">${title}</div>
      <div class="rules-p">Details unavailable.</div>
    </div>
  `;
}

function renderRules() {
  if (!els.rulesContent) return;
  if (state.rulesView === "detail" && typeof state.rulesSelectedId === "string") {
    els.rulesContent.innerHTML = rulesDetailHtml(state.rulesSelectedId);
    return;
  }
  els.rulesContent.innerHTML = rulesIndexHtml();
  els.rulesContent.scrollTop = typeof state.rulesIndexScrollTop === "number" ? state.rulesIndexScrollTop : 0;
}

function openRules() {
  if (!els.rulesScreen) return;
  state.rulesView = "index";
  state.rulesSelectedId = null;
  renderRules();
  els.rulesScreen.classList.add("show");
}

function closeRules({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
  if (!els.rulesScreen) return;
  els.rulesScreen.classList.remove("show");
  if (restoreFocus && els.lobbyScreen?.classList.contains("show")) {
    els.usernameInput?.focus?.();
  }
}

bindEvents({
  createRoomHandler,
  joinRoomHandler,
  startGameHandler,
  leaveRoomHandler,
  openRules,
  closeRules,
  renderRules,
  onDecoySuccess,
  updateLetterColors,
  flowGaugeAddForStreak,
  isDevBotsEnabled,
  updateDevBotPanel,
  ensureDevBotPanel,
  addDevBot,
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

