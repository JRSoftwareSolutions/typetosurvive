import { createRoom, joinRoom, leaveRoom, startRoom, subscribeRoomEvents, updatePlayer } from "./api.js";
import { state } from "./state.js";

const FLOW_GAUGE_MAX = 100;
const FLOW_GAUGE_ACTIVATE_AT = 0.5;
const FLOW_STREAK_SOFT_CAP = 8;
const FLOW_FACTORIAL_ADD_CAP = 30;
const FLOW_MIN_MS = 8000;
const FLOW_MAX_MS = 12000;

function lerp(a, b, t) {
  const tt = Math.max(0, Math.min(1, t));
  return a + (b - a) * tt;
}

function factorial(n) {
  let v = 1;
  for (let i = 2; i <= n; i += 1) v *= i;
  return v;
}

const els = {
  letters: document.getElementById("letters"),
  input: document.getElementById("typing-input"),
  healthBar: document.getElementById("health-bar"),
  healthText: document.getElementById("health-text"),
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  threat: document.getElementById("threat-level"),
  lobbyScreen: document.getElementById("lobby-screen"),
  gameOverScreen: document.getElementById("game-over-screen"),
  endScreenTitle: document.getElementById("end-screen-title"),
  lobbyPlayerList: document.getElementById("lobby-player-list"),
  lobbyCodeDisplay: document.getElementById("lobby-code-display"),
  multiplayerSidebar: document.getElementById("multiplayer-sidebar"),
  creatorControls: document.getElementById("creator-controls"),
  finalStats: document.getElementById("final-stats"),
  createBtn: document.getElementById("create-btn"),
  joinBtn: document.getElementById("join-btn"),
  startBtn: document.getElementById("start-btn"),
  leaveBtn: document.getElementById("leave-btn"),
  leaveAfterGameBtn: document.getElementById("leave-after-game-btn"),
  leaveInGameBtn: document.getElementById("leave-in-game-btn"),
  usernameInput: document.getElementById("username-input"),
  roomCodeInput: document.getElementById("join-code-input"),
  particles: document.getElementById("particles"),
  rulesBtn: document.getElementById("rules-btn"),
  rulesScreen: document.getElementById("rules-screen"),
  rulesCloseBtn: document.getElementById("rules-close-btn"),
  rulesContent: document.getElementById("rules-content"),
};

let lastDrainTickAt = 0;

function updateLeaveRoomVisibility() {
  const inRoom = Boolean(state.roomCode && state.myPlayerId);
  const display = inRoom ? "" : "none";
  els.leaveBtn.style.display = display;
  els.leaveAfterGameBtn.style.display = display;
  els.leaveInGameBtn.style.display = display;
}

function getActiveDecoyForMe() {
  const now = Date.now();
  const myId = state.myPlayerId;
  const effects = state.room?.effects || [];
  for (let i = 0; i < effects.length; i += 1) {
    const e = effects[i];
    if (!e || e.type !== "decoyWord" || typeof e.expiresAt !== "number" || e.expiresAt <= now) continue;
    if (e.sourcePlayerId === myId) continue;
    const w = e.payload?.wordsByPlayerId?.[myId];
    const done = e.payload?.completedBy?.[myId];
    if (typeof w === "string" && w.length > 0 && !done) return { effectId: e.id, word: w };
  }
  return null;
}

function typingTargetWord() {
  const decoy = getActiveDecoyForMe();
  if (decoy) return decoy.word;
  return state.currentWord;
}

function ensureEffectBanner() {
  const existing = document.getElementById("effect-banner");
  if (existing) return existing;
  const banner = document.createElement("div");
  banner.id = "effect-banner";
  banner.style.position = "absolute";
  banner.style.left = "50%";
  banner.style.top = "120px";
  banner.style.transform = "translateX(-50%)";
  banner.style.padding = "10px 18px";
  banner.style.border = "3px solid var(--neon-pink)";
  banner.style.borderRadius = "10px";
  banner.style.background = "rgba(0,0,0,0.8)";
  banner.style.color = "#ff00aa";
  banner.style.fontWeight = "800";
  banner.style.letterSpacing = "2px";
  banner.style.textShadow = "0 0 12px #ff00aa";
  banner.style.zIndex = "60";
  banner.style.display = "none";
  banner.textContent = "JAMMED!";
  document.body.appendChild(banner);
  return banner;
}

function ensureSecondWindBanner() {
  const existing = document.getElementById("second-wind-banner");
  if (existing) return existing;
  const banner = document.createElement("div");
  banner.id = "second-wind-banner";
  banner.style.position = "absolute";
  banner.style.left = "50%";
  banner.style.top = "160px";
  banner.style.transform = "translateX(-50%)";
  banner.style.padding = "12px 20px";
  banner.style.border = "3px solid #00ff88";
  banner.style.borderRadius = "10px";
  banner.style.background = "rgba(0,0,0,0.82)";
  banner.style.color = "#00ff88";
  banner.style.fontWeight = "900";
  banner.style.letterSpacing = "2px";
  banner.style.textShadow = "0 0 14px rgba(0,255,136,0.7)";
  banner.style.zIndex = "60";
  banner.style.display = "none";
  banner.textContent = "SECOND WIND!";
  document.body.appendChild(banner);
  return banner;
}

function ensureFlowObscureLayer() {
  const existing = document.getElementById("flow-obscure-layer");
  if (existing) return existing;
  const layer = document.createElement("div");
  layer.id = "flow-obscure-layer";
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "40";
  layer.style.display = "none";
  document.body.appendChild(layer);
  return layer;
}

function activeFlowObscureForMe() {
  const effects = Array.isArray(state.activeEffects) ? state.activeEffects : [];
  for (let i = 0; i < effects.length; i += 1) {
    const e = effects[i];
    if (e && e.type === "flowObscure") return e;
  }
  return null;
}

function spawnFlowObscureParticle(layer, intensity) {
  const p = document.createElement("div");
  p.className = "flow-obscure-particle";
  const x = Math.random() * 100;
  const y = Math.random() * 85 + 5;
  const size = 10 + Math.random() * 26 + intensity * 18;
  p.style.left = `${x}%`;
  p.style.top = `${y}%`;
  p.style.width = `${size}px`;
  p.style.height = `${size}px`;
  p.style.opacity = String(0.08 + intensity * 0.18);
  p.style.filter = `blur(${1 + intensity * 1.75}px)`;
  layer.appendChild(p);
  setTimeout(() => p.remove(), 1700);
}

function updateFlowObscureVfx() {
  const layer = ensureFlowObscureLayer();
  const effect = activeFlowObscureForMe();
  if (!effect) {
    layer.style.display = "none";
    return;
  }
  layer.style.display = "block";

  const payload = effect.payload && typeof effect.payload === "object" ? effect.payload : {};
  const remainingTicks = typeof payload.remainingTicks === "number" ? payload.remainingTicks : 0;
  const intensity = Math.max(0, Math.min(1, typeof payload.intensity === "number" ? payload.intensity : 0.25));

  const existingCount = layer.childElementCount;
  const maxParticles = 90;
  if (existingCount >= maxParticles) return;

  const base = 1 + Math.floor(intensity * 3);
  const burst = remainingTicks > 40 ? 1 : remainingTicks > 15 ? 0 : -1;
  const count = Math.max(1, Math.min(4, base + burst));
  for (let i = 0; i < count; i += 1) spawnFlowObscureParticle(layer, intensity);
}

function ensureFlowHud() {
  const existing = document.getElementById("flow-hud");
  if (existing) return existing;

  const wrap = document.createElement("div");
  wrap.id = "flow-hud";
  wrap.style.position = "fixed";
  wrap.style.left = "50%";
  wrap.style.bottom = "22px";
  wrap.style.transform = "translateX(-50%)";
  wrap.style.zIndex = "55";
  wrap.style.pointerEvents = "none";
  wrap.style.display = "none";
  wrap.style.width = "min(640px, calc(100vw - 40px))";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "14px";
  row.style.padding = "10px 12px";
  row.style.border = "3px solid rgba(0, 247, 255, 0.7)";
  row.style.borderRadius = "12px";
  row.style.background = "rgba(0,0,0,0.78)";
  row.style.boxShadow = "0 0 18px rgba(0,247,255,0.25)";

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "6px";
  left.style.minWidth = "160px";

  const title = document.createElement("div");
  title.textContent = "FLOW";
  title.style.color = "#00f7ff";
  title.style.letterSpacing = "0.16em";
  title.style.fontSize = "12px";
  title.style.textShadow = "0 0 10px rgba(0,247,255,0.25)";
  left.appendChild(title);

  const hint = document.createElement("div");
  hint.id = "flow-hint";
  hint.style.fontSize = "10px";
  hint.style.opacity = "0.85";
  hint.style.letterSpacing = "0.08em";
  hint.style.color = "rgba(255,255,255,0.9)";
  left.appendChild(hint);

  const barOuter = document.createElement("div");
  barOuter.style.flex = "1";
  barOuter.style.height = "16px";
  barOuter.style.background = "rgba(17,17,17,0.9)";
  barOuter.style.border = "3px solid rgba(255, 0, 170, 0.65)";
  barOuter.style.borderRadius = "10px";
  barOuter.style.overflow = "hidden";

  const barInner = document.createElement("div");
  barInner.id = "flow-gauge-bar";
  barInner.style.height = "100%";
  barInner.style.width = "0%";
  barInner.style.background = "linear-gradient(90deg, rgba(255,0,170,0.85), rgba(0,247,255,0.9))";
  barInner.style.boxShadow = "0 0 18px rgba(255,0,170,0.35)";
  barInner.style.transition = "width 0.18s ease";
  barOuter.appendChild(barInner);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.alignItems = "flex-end";
  right.style.gap = "6px";
  right.style.minWidth = "110px";

  const pct = document.createElement("div");
  pct.id = "flow-gauge-text";
  pct.style.fontSize = "12px";
  pct.style.letterSpacing = "0.12em";
  pct.style.color = "#ff00aa";
  pct.style.textShadow = "0 0 12px rgba(255,0,170,0.35)";
  right.appendChild(pct);

  const counter = document.createElement("div");
  counter.id = "flow-counter";
  counter.style.fontSize = "14px";
  counter.style.letterSpacing = "0.12em";
  counter.style.color = "#00ff88";
  counter.style.textShadow = "0 0 14px rgba(0,255,136,0.3)";
  counter.style.display = "none";
  right.appendChild(counter);

  row.appendChild(left);
  row.appendChild(barOuter);
  row.appendChild(right);
  wrap.appendChild(row);
  document.body.appendChild(wrap);
  return wrap;
}

function updateFlowHud() {
  const hud = ensureFlowHud();
  const gauge = Math.max(0, Math.min(FLOW_GAUGE_MAX, Number(state.flowGauge) || 0));
  const pct = Math.round((gauge / FLOW_GAUGE_MAX) * 100);
  hud.style.display = state.gameRunning ? "block" : "none";

  const bar = document.getElementById("flow-gauge-bar");
  if (bar) bar.style.width = `${pct}%`;

  const text = document.getElementById("flow-gauge-text");
  if (text) text.textContent = `${String(pct).padStart(3, " ")}%`;

  const hint = document.getElementById("flow-hint");
  if (hint) {
    const canActivate = !state.flowActive && gauge >= FLOW_GAUGE_MAX * FLOW_GAUGE_ACTIVATE_AT;
    hint.textContent = state.flowActive ? "ACTIVE" : canActivate ? "PRESS ENTER" : "BUILD (PERFECT WORDS)";
    hint.style.color = canActivate ? "#fff" : "rgba(255,255,255,0.9)";
    hint.style.textShadow = canActivate ? "0 0 12px rgba(255,255,255,0.35)" : "none";
  }

  const counter = document.getElementById("flow-counter");
  if (counter) {
    if (state.flowActive) {
      counter.style.display = "block";
      const v = Math.trunc(Number(state.flowCounter) || 0);
      counter.textContent = v >= 0 ? `+${v}` : `${v}`;
      counter.style.color = v >= 0 ? "#00ff88" : "#ff0066";
      counter.style.textShadow = v >= 0 ? "0 0 14px rgba(0,255,136,0.3)" : "0 0 14px rgba(255,0,102,0.35)";
    } else {
      counter.style.display = "none";
    }
  }
}

function endFlow({ now = Date.now() } = {}) {
  if (!state.flowActive) return;
  state.flowActive = false;
  state.flowEndsAt = 0;

  const payout = Math.max(0, Math.trunc(Number(state.flowCounter) || 0));
  updateUI();

  if (state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, {
      flowActive: false,
      flowPayout: payout,
      flowLastEndedAt: now,
    }).catch(() => {});
  }
}

function maybeEndFlowIfExpired(now = Date.now()) {
  if (!state.flowActive) return;
  const endsAt = Number(state.flowEndsAt) || 0;
  if (endsAt > 0 && now >= endsAt) endFlow({ now });
}

function applyFlowInputDelta(typed, target) {
  if (!state.flowActive) return;

  const now = Date.now();
  maybeEndFlowIfExpired(now);
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
    state.flowCounter = (Number(state.flowCounter) || 0) - 1;
    state.flowLastInputValue = next;
    updateUI();
    endFlow({ now });
    return;
  }

  state.flowLastInputValue = next;
  updateUI();
}

function getWords() {
  return state.room?.wordSequence ?? [];
}

function getMyPlayer() {
  return state.room?.players?.[state.myPlayerId] ?? null;
}

function renderWord() {
  els.letters.innerHTML = "";
  const displayWord = typingTargetWord();
  for (const char of displayWord) {
    const span = document.createElement("span");
    span.className = "letter pending";
    span.textContent = char;
    els.letters.appendChild(span);
  }
}

function renderPlayerList() {
  const now = Date.now();
  if (now - state.lastRenderAt < 50) return;
  state.lastRenderAt = now;

  const players = state.room?.players || {};
  let html = "<div style='color:#ff00aa;margin-bottom:8px'>PLAYERS</div>";
  Object.keys(players).forEach((id) => {
    const player = players[id];
    const hp = Math.max(0, player.health || 0);
    const isMe = id === state.myPlayerId;
    html += `
      <div data-player-id="${id}" style="margin:8px 0">
        <div style="display:flex;justify-content:space-between">
          <span>${player.username} ${isMe ? "(YOU)" : ""}</span>
          <span style="color:#00ff88">${Math.floor(hp)}%</span>
        </div>
        <div style="height:12px;background:#111;border:2px solid var(--neon-cyan)">
          <div style="height:100%;width:${hp}%;background:linear-gradient(90deg,#00ff88,#00cc66);transition:width .3s"></div>
        </div>
      </div>`;
  });

  els.lobbyPlayerList.innerHTML = html;
  els.multiplayerSidebar.innerHTML = `<div style="background:rgba(0,0,0,0.85);padding:15px;border:4px solid var(--neon-cyan);border-radius:8px">${html}</div>`;

}

function updateUI() {
  maybeEndFlowIfExpired();

  const hp = Math.max(0, Math.min(100, state.health));
  els.healthBar.style.width = `${hp}%`;
  els.healthText.textContent = `${Math.floor(hp)}%`;
  els.healthBar.style.background = hp < 30
    ? "linear-gradient(90deg, #ff4444, #ff8800)"
    : "linear-gradient(90deg, #00ff88, #00cc66)";

  els.score.textContent = String(Math.floor(state.score)).padStart(6, "0");
  const minutes = Math.floor(state.timeSurvived / 60);
  const seconds = Math.floor(state.timeSurvived % 60);
  els.time.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const me = getMyPlayer();
  const resetAt = typeof me?.threatResetElapsedSeconds === "number" ? me.threatResetElapsedSeconds : 0;
  const effectiveElapsed = Math.max(0, state.timeSurvived - resetAt);
  const threat = Math.min(15, Math.floor(effectiveElapsed / 22)) + 1;
  els.threat.textContent = String(threat).padStart(2, "0");

  updateFlowHud();
}

function flashPlayer(playerId, className, timeoutMs) {
  const el = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!el) return;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), timeoutMs);
}

function syncRoom(nextRoom) {
  const prevStarted = Boolean(state.room?.started);
  const prevPlayers = state.room?.players || {};
  const nextPlayers = nextRoom?.players || {};
  const prevTypingTarget = typingTargetWord();
  state.room = nextRoom;

  const me = getMyPlayer();
  if (me && typeof me.health === "number") state.health = me.health;
  if (typeof state.room?.elapsedSeconds === "number") state.timeSurvived = state.room.elapsedSeconds;

  // Second wind local flash (only for this client)
  const prevMe = prevPlayers?.[state.myPlayerId] || {};
  const didSecondWind = Boolean(me?.secondWindUsed) && !Boolean(prevMe?.secondWindUsed);
  if (didSecondWind) {
    const sw = ensureSecondWindBanner();
    sw.style.display = "block";
    clearTimeout(state.secondWindFlashTimeout);
    state.secondWindFlashTimeout = setTimeout(() => {
      sw.style.display = "none";
    }, 1400);
  }

  const now = Date.now();
  const effects = Array.isArray(state.room?.effects) ? state.room.effects : [];
  const myId = state.myPlayerId;
  const active = effects.filter((e) => {
    if (!e || typeof e.expiresAt !== "number" || e.expiresAt <= now) return false;
    if (e.targets === "others") return e.sourcePlayerId !== myId;
    if (Array.isArray(e.targets)) return e.targets.includes(myId);
    return false;
  });
  state.activeEffects = active;
  updateFlowObscureVfx();

  const banner = ensureEffectBanner();
  const decoyActive = Boolean(getActiveDecoyForMe());
  if (decoyActive) banner.style.display = "block";
  else banner.style.display = "none";
  if (typingTargetWord() !== prevTypingTarget) renderWord();

  if (state.gameRunning && state.room?.matchEnded) {
    if (state.room.matchWinnerId === state.myPlayerId) endVictory();
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

  if (state.room?.started && !prevStarted && !state.gameRunning) {
    startMultiplayerGame();
  }

  updateLeaveRoomVisibility();
}

function showLobby() {
  els.lobbyCodeDisplay.textContent = state.roomCode || "- - - -";
  els.lobbyScreen.classList.add("show");
  const isCreator = state.room?.creatorId === state.myPlayerId;
  els.creatorControls.style.display = isCreator ? "block" : "none";
}

function createBonusPopup(bonus) {
  const popup = document.createElement("div");
  popup.className = "bonus-popup";
  popup.textContent = `+${bonus} HP`;
  popup.style.left = `${Math.random() * 60 + 20}%`;
  popup.style.top = `${35 + Math.random() * 15}%`;
  popup.style.position = "absolute";
  popup.style.color = "#00ff88";
  popup.style.fontSize = "1.4rem";
  popup.style.fontWeight = "bold";
  popup.style.textShadow = "0 0 20px #00ff88";
  popup.style.pointerEvents = "none";
  popup.style.zIndex = "20";
  els.particles.appendChild(popup);
  setTimeout(() => popup.remove(), 1300);
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
  } catch (error) {
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
  } catch (error) {
    alert(`Join room failed: ${error.message}`);
  }
}

async function startGameHandler() {
  if (!state.roomCode || !state.myPlayerId) return;
  try {
    await startRoom(state.roomCode, state.myPlayerId);
  } catch (error) {
    alert(error.message);
  }
}

function startMultiplayerGame() {
  if (state.gameRunning) return;

  state.gameRunning = true;
  document.body.classList.add("in-game");
  state.myCurrentIndex = 0;
  state.score = 0;
  state.currentWord = getWords()[0] || "survive";
  state.flowGauge = 0;
  state.flowStreakPerfectWords = 0;
  state.flowWordHadTypo = false;
  state.flowActive = false;
  state.flowEndsAt = 0;
  state.flowCounter = 0;
  state.flowLastInputValue = "";
  state.flowLastCharEffectAt = 0;
  els.lobbyScreen.classList.remove("show");
  els.gameOverScreen.classList.remove("show");
  if (els.endScreenTitle) {
    els.endScreenTitle.textContent = "GAME OVER";
    els.endScreenTitle.className = "title danger-title";
  }
  els.input.value = "";
  els.input.focus();
  renderWord();
  updateUI();
  startTimer();
}

function stopGameLoops() {
  clearInterval(state.drainInterval);
  clearInterval(state.timerInterval);
  state.drainInterval = null;
  state.timerInterval = null;
}

function renderLeaderboardHtml() {
  const room = state.room;
  const participants = room?.participants && typeof room.participants === "object" ? room.participants : {};
  const ids = Object.keys(participants);
  if (ids.length === 0) return "";
  const startedAt = typeof room?.startedAt === "number" ? room.startedAt : null;
  const matchNowAt = startedAt != null && typeof room?.elapsedSeconds === "number"
    ? startedAt + room.elapsedSeconds * 1000
    : Date.now();

  const rows = ids.map((playerId) => {
    const p = participants[playerId] || {};
    const username = typeof p.username === "string" && p.username.length ? p.username : playerId;
    const score = typeof p.score === "number" ? p.score : 0;
    const deadAt = typeof p.deadAt === "number" ? p.deadAt : null;
    const leftAt = typeof p.leftAt === "number" ? p.leftAt : null;
    const status = deadAt ? "DEAD" : leftAt ? "LEFT" : "ALIVE";
    const outAt = deadAt ?? leftAt ?? matchNowAt;
    const isAlive = !deadAt && !leftAt;
    const isMe = playerId === state.myPlayerId;
    const survivedSeconds = startedAt == null ? 0 : Math.max(0, Math.floor((outAt - startedAt) / 1000));
    const threat = Math.max(1, Math.floor(survivedSeconds / 25) + 1);
    return { playerId, username, score, status, outAt, isAlive, isMe, survivedSeconds, threat };
  });

  rows.sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    if (a.outAt !== b.outAt) return b.outAt - a.outAt;
    if (a.score !== b.score) return b.score - a.score;
    return a.username.localeCompare(b.username);
  });

  const body = rows.map((r, idx) => {
    const name = `${r.username}${r.isMe ? " (YOU)" : ""}`;
    const winnerId = typeof room?.matchWinnerId === "string" ? room.matchWinnerId : null;
    const statusIcon = r.status === "LEFT"
      ? "⇦"
      : winnerId && r.playerId !== winnerId
        ? "☠"
        : "♥";
    return `
      <div class="leaderboard-row">
        <div class="leaderboard-rank">${idx + 1}</div>
        <div class="leaderboard-name">${name}</div>
        <div class="leaderboard-status" title="${r.status}">${statusIcon}</div>
        <div class="leaderboard-survived">${String(Math.floor(r.survivedSeconds)).padStart(4, "0")}s</div>
        <div class="leaderboard-threat">${String(Math.floor(r.threat)).padStart(2, "0")}</div>
        <div class="leaderboard-score">${String(Math.floor(r.score)).padStart(6, "0")}</div>
      </div>
    `;
  }).join("");

  const html = `
    <div class="leaderboard">
      <div class="leaderboard-title">LEADERBOARD</div>
      <div class="leaderboard-body">
        <div class="leaderboard-header">
          <div class="leaderboard-rank">#</div>
          <div class="leaderboard-name">NAME</div>
          <div class="leaderboard-status leaderboard-icon" title="Status">♥</div>
          <div class="leaderboard-survived leaderboard-icon" title="Survived seconds">⏱</div>
          <div class="leaderboard-threat leaderboard-icon" title="Threat level">!</div>
          <div class="leaderboard-score leaderboard-icon" title="Score">🏁</div>
        </div>
        ${body}
      </div>
    </div>
  `;

  return html;
}

function endGame() {
  state.gameRunning = false;
  document.body.classList.remove("in-game");
  stopGameLoops();
  state.flowActive = false;

  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem("typeToSurviveHighScore", String(state.highScore));
  }

  if (els.endScreenTitle) {
    els.endScreenTitle.textContent = "GAME OVER";
    els.endScreenTitle.className = "title danger-title";
  }
  els.finalStats.innerHTML = `
    HIGH SCORE: ${String(state.highScore).padStart(6, "0")}
    ${renderLeaderboardHtml()}
  `;
  els.gameOverScreen.classList.add("show");
}

function endVictory() {
  state.gameRunning = false;
  document.body.classList.remove("in-game");
  stopGameLoops();
  state.flowActive = false;

  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem("typeToSurviveHighScore", String(state.highScore));
  }

  const me = getMyPlayer();
  const name = me?.username ? String(me.username) : "YOU";

  if (els.endScreenTitle) {
    els.endScreenTitle.textContent = "VICTORY";
    els.endScreenTitle.className = "title victory-title";
  }
  els.finalStats.innerHTML = `
    YOU WON — ${name}<br><br>
    HIGH SCORE: ${String(state.highScore).padStart(6, "0")}
    ${renderLeaderboardHtml()}
  `;
  els.gameOverScreen.classList.add("show");
}

function drainHealth() {
  if (!state.gameRunning) return;
  const threat = Math.min(15, Math.floor(state.timeSurvived / 22));
  state.health -= 0.92 + threat * 0.24;

  if (Date.now() - state.lastHealthUpdateAt > 350 && state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, { health: Math.max(0, state.health) }).catch(() => {});
    state.lastHealthUpdateAt = Date.now();
  }

  updateUI();
  if (state.health <= 0) endGame();
}

function startDrain() {
  state.drainInterval = setInterval(drainHealth, 85);
}

function startTimer() {
  state.timerInterval = setInterval(() => {
    if (!state.gameRunning) return;
    updateUI();
  }, 1000);
}

function updateLetterColors(typed) {
  const typedLower = typed.toLowerCase();
  const wordLower = typingTargetWord().toLowerCase();
  const spans = els.letters.querySelectorAll(".letter");
  let hasTypo = false;

  spans.forEach((span, index) => {
    if (index < typedLower.length) {
      if (typedLower[index] === wordLower[index]) span.className = "letter correct";
      else {
        span.className = "letter incorrect";
        hasTypo = true;
      }
    } else span.className = "letter pending";
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

function success() {
  if (!state.flowActive) {
    if (!state.flowWordHadTypo) {
      state.flowStreakPerfectWords = Math.max(0, (Number(state.flowStreakPerfectWords) || 0) + 1);
      const n = Math.min(FLOW_STREAK_SOFT_CAP, state.flowStreakPerfectWords);
      const add = Math.min(factorial(n), FLOW_FACTORIAL_ADD_CAP);
      state.flowGauge = Math.min(FLOW_GAUGE_MAX, (Number(state.flowGauge) || 0) + add);
    } else {
      state.flowStreakPerfectWords = 0;
      state.flowGauge = 0;
    }
  }
  state.flowWordHadTypo = false;

  const len = state.currentWord.length;
  let bonus = 15 + len * 7;
  if (len >= 10) bonus += 28;
  if (len >= 13) bonus += 22;

  state.health = Math.min(100, state.health + bonus);
  state.score += len * 18 + 50;
  state.myCurrentIndex += 1;
  state.currentWord = getWords()[state.myCurrentIndex] || "you-survived-gg";

  if (state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, {
      health: state.health,
      score: state.score,
      currentIndex: state.myCurrentIndex,
      lastSuccess: Date.now(),
      flowGauge: state.flowGauge,
    }).catch(() => {});
  }

  createBonusPopup(bonus);
  updateUI();
  els.input.value = "";
  renderWord();
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
  try {
    if (state.roomCode && state.myPlayerId) await leaveRoom(state.roomCode, state.myPlayerId);
  } catch {
    // no-op
  } finally {
    if (state.eventSource) state.eventSource.close();
    location.reload();
  }
}

const RULE_ITEMS = [
  { id: "secondWind", kind: "buff", title: "SECOND WIND", subtitle: "Threat reset", implemented: true },
  { id: "comingSoonBuff1", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "comingSoonBuff2", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "decoyWord", kind: "debuff", title: "DECOY WORD", subtitle: "Fake target word", implemented: true },
  { id: "comingSoonDebuff1", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
  { id: "comingSoonDebuff2", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
];

function rulesIndexHtml() {
  const buffs = RULE_ITEMS.filter((i) => i.kind === "buff");
  const debuffs = RULE_ITEMS.filter((i) => i.kind === "debuff");
  const card = (i) => `
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

function rulesDetailHtml(itemId) {
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
        <div class="rules-p"><span class="rules-k">Effect</span>: you’re forced to type a fake word instead of the real one until you complete it.</div>
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

function closeRules({ restoreFocus = true } = {}) {
  if (!els.rulesScreen) return;
  els.rulesScreen.classList.remove("show");
  if (restoreFocus && els.lobbyScreen?.classList.contains("show")) {
    els.usernameInput?.focus?.();
  }
}

function bindEvents() {
  els.usernameInput.addEventListener("input", () => {
    const original = els.usernameInput.value;
    const sanitized = original.replace(/[^a-z0-9]/gi, "");
    if (sanitized !== original) els.usernameInput.value = sanitized;
  });

  els.createBtn.addEventListener("click", createRoomHandler);
  els.joinBtn.addEventListener("click", joinRoomHandler);
  els.startBtn.addEventListener("click", startGameHandler);
  els.leaveBtn.addEventListener("click", leaveRoomHandler);
  els.leaveAfterGameBtn.addEventListener("click", leaveRoomHandler);
  els.leaveInGameBtn.addEventListener("click", leaveRoomHandler);
  els.rulesBtn?.addEventListener("click", openRules);
  els.rulesCloseBtn?.addEventListener("click", () => closeRules());
  els.rulesScreen?.addEventListener("click", (e) => {
    if (e.target === els.rulesScreen) closeRules();
  });
  els.rulesContent?.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const back = target.closest("[data-rules-action='back']");
    if (back) {
      state.rulesView = "index";
      state.rulesSelectedId = null;
      renderRules();
      return;
    }
    const card = target.closest("[data-rules-id]");
    if (card) {
      const id = card.getAttribute("data-rules-id");
      if (!id) return;
      state.rulesIndexScrollTop = els.rulesContent?.scrollTop ?? 0;
      state.rulesView = "detail";
      state.rulesSelectedId = id;
      renderRules();
    }
  });

  els.input.addEventListener("input", (e) => {
    if (!state.gameRunning) return;
    const typed = e.target.value.trim();
    updateLetterColors(typed);
    const target = typingTargetWord();
    applyFlowInputDelta(typed, target);
    if (typed.toLowerCase() === target.toLowerCase()) {
      if (getActiveDecoyForMe()) void onDecoySuccess();
      else success();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!state.gameRunning) return;
      if (els.rulesScreen?.classList.contains("show")) return;
      if (document.activeElement !== els.input) return;

      const gauge = Math.max(0, Math.min(FLOW_GAUGE_MAX, Number(state.flowGauge) || 0));
      const canActivate = !state.flowActive && gauge >= FLOW_GAUGE_MAX * FLOW_GAUGE_ACTIVATE_AT;
      if (!canActivate) return;

      e.preventDefault();
      state.flowActive = true;
      state.flowCounter = 0;
      state.flowLastInputValue = String(els.input.value || "");
      state.flowLastCharEffectAt = 0;
      const durationMs = Math.floor(lerp(FLOW_MIN_MS, FLOW_MAX_MS, gauge / FLOW_GAUGE_MAX));
      state.flowEndsAt = Date.now() + durationMs;
      state.flowGauge = 0;
      state.flowStreakPerfectWords = 0;
      state.flowWordHadTypo = false;

      updateUI();

      if (state.roomCode && state.myPlayerId) {
        updatePlayer(state.roomCode, state.myPlayerId, {
          flowGauge: state.flowGauge,
          flowActive: true,
        }).catch(() => {});
      }
      return;
    }
    if (e.key !== "Escape") return;
    if (els.rulesScreen?.classList.contains("show")) {
      closeRules();
      return;
    }
    if (state.gameRunning) endGame();
  });

  updateLeaveRoomVisibility();
}

bindEvents();

const versionEl = document.getElementById("app-version");
if (versionEl) {
  const v = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  versionEl.textContent = `v${v}`;
}
