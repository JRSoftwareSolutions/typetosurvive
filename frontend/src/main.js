import { createRoom, joinRoom, leaveRoom, startRoom, subscribeRoomEvents, updatePlayer } from "./api.js";
import { state } from "./state.js";

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
};

let lastDrainTickAt = 0;

function getWords() {
  return state.room?.wordSequence ?? [];
}

function getMyPlayer() {
  return state.room?.players?.[state.myPlayerId] ?? null;
}

function renderWord() {
  els.letters.innerHTML = "";
  for (const char of state.currentWord) {
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
  els.threat.textContent = String(Math.max(1, Math.floor(state.timeSurvived / 25) + 1)).padStart(2, "0");
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
  state.room = nextRoom;

  const me = getMyPlayer();
  if (me && typeof me.health === "number") state.health = me.health;
  if (typeof state.room?.elapsedSeconds === "number") state.timeSurvived = state.room.elapsedSeconds;

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
  state.myCurrentIndex = 0;
  state.score = 0;
  state.currentWord = getWords()[0] || "survive";
  els.lobbyScreen.classList.remove("show");
  els.gameOverScreen.classList.remove("show");
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

function endGame() {
  state.gameRunning = false;
  stopGameLoops();

  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem("typeToSurviveHighScore", String(state.highScore));
  }

  els.finalStats.innerHTML = `
    SURVIVED: ${Math.floor(state.timeSurvived)}s<br>
    THREAT: ${String(Math.max(1, Math.floor(state.timeSurvived / 25) + 1)).padStart(2, "0")}<br>
    SCORE: ${String(Math.floor(state.score)).padStart(6, "0")}<br>
    HIGH SCORE: ${String(state.highScore).padStart(6, "0")}
  `;
  els.gameOverScreen.classList.add("show");
}

function drainHealth() {
  if (!state.gameRunning) return;
  // #region agent log
  const now = Date.now();
  const dtMs = lastDrainTickAt ? now - lastDrainTickAt : null;
  lastDrainTickAt = now;
  fetch("http://127.0.0.1:7592/ingest/90bdd843-c9a6-45be-955a-c3b716a803a5", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4a5832" },
    body: JSON.stringify({
      sessionId: "4a5832",
      runId: "tab-throttle-audit-1",
      hypothesisId: "H1",
      location: "frontend/src/main.js:drainHealth",
      message: "drain tick",
      data: {
        dtMs,
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        health: state.health,
        timeSurvived: state.timeSurvived,
      },
      timestamp: now,
    }),
  }).catch(() => {});
  // #endregion

  const threat = Math.min(15, Math.floor(state.timeSurvived / 22));
  state.health -= 0.92 + threat * 0.24;

  if (Date.now() - state.lastHealthUpdateAt > 350 && state.roomCode && state.myPlayerId) {
    // #region agent log
    fetch("http://127.0.0.1:7592/ingest/90bdd843-c9a6-45be-955a-c3b716a803a5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4a5832" },
      body: JSON.stringify({
        sessionId: "4a5832",
        runId: "tab-throttle-audit-1",
        hypothesisId: "H2",
        location: "frontend/src/main.js:drainHealth",
        message: "health PATCH scheduled",
        data: {
          visibilityState: document.visibilityState,
          roomCode: state.roomCode,
          playerId: state.myPlayerId,
          health: Math.max(0, state.health),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
  const wordLower = state.currentWord.toLowerCase();
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

  if (hasTypo && state.roomCode && state.myPlayerId) {
    updatePlayer(state.roomCode, state.myPlayerId, { lastTypo: Date.now() }).catch(() => {});
  }
}

function success() {
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
    }).catch(() => {});
  }

  createBonusPopup(bonus);
  updateUI();
  els.input.value = "";
  renderWord();
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

function bindEvents() {
  // #region agent log
  document.addEventListener("visibilitychange", () => {
    fetch("http://127.0.0.1:7592/ingest/90bdd843-c9a6-45be-955a-c3b716a803a5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4a5832" },
      body: JSON.stringify({
        sessionId: "4a5832",
        runId: "tab-throttle-audit-1",
        hypothesisId: "H3",
        location: "frontend/src/main.js:visibilitychange",
        message: "tab visibility changed",
        data: { visibilityState: document.visibilityState, hidden: document.hidden },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  });
  // #endregion

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

  els.input.addEventListener("input", (e) => {
    if (!state.gameRunning) return;
    const typed = e.target.value.trim();
    updateLetterColors(typed);
    if (typed.toLowerCase() === state.currentWord.toLowerCase()) success();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.gameRunning) endGame();
  });
}

bindEvents();
