import { state } from "../state";
import { els } from "../dom/els";
import { typingTargetWord } from "../effects/decoy";
import { updateForesightPreview } from "../flow/foresight";
import { maybeEndFlowIfExpired } from "../flow/flow";
import { updateFlowHud } from "../flow/hud";
import { FLOW_GAUGE_ACTIVATE_AT, FLOW_GAUGE_MAX } from "../constants";
import { getMyPlayer } from "../game/selectors";

export function renderWord() {
  els.letters.innerHTML = "";
  const displayWord = typingTargetWord();
  for (const char of displayWord) {
    const span = document.createElement("span");
    span.className = "letter pending";
    span.textContent = char;
    els.letters.appendChild(span);
  }
  updateForesightPreview();
}

function allPlayersReady(room: any): boolean {
  const players = room?.players || {};
  const ids = Object.keys(players);
  return ids.length > 0 && ids.every((pid) => players[pid]?.ready === true);
}

export function updateLobbyControls() {
  const room: any = state.room;
  const inRoom = Boolean(state.roomCode && state.myPlayerId && room);
  const inLobby = inRoom && !state.gameRunning && !room?.started;
  const btn = els.readyToggleBtn;
  if (!btn) return;

  if (!inLobby) {
    btn.disabled = true;
    btn.textContent = "READY";
    btn.classList.remove("player-ready-on");
    return;
  }

  btn.disabled = false;
  const me: any = getMyPlayer();
  const ready = Boolean(me?.ready);
  btn.textContent = ready ? "NOT READY" : "READY";
  btn.classList.toggle("player-ready-on", ready);

  const isCreator = room?.creatorId === state.myPlayerId;
  if (isCreator) {
    els.startBtn.disabled = !allPlayersReady(room);
  }
}

export function renderPlayerList() {
  if (!state.gameRunning) {
    updateLobbyControls();
  }

  const now = Date.now();
  if (now - state.lastRenderAt < 50) return;
  state.lastRenderAt = now;

  const room: any = state.room;
  const players = room?.players || {};
  const inLobby = !state.gameRunning && !room?.started;

  let html = "<div style='color:#ff00aa;margin-bottom:8px'>PLAYERS</div>";
  Object.keys(players).forEach((id) => {
    const player = players[id];
    const hp = Math.max(0, player.health || 0);
    const isMe = id === state.myPlayerId;
    const statusRight = inLobby
      ? player.ready === true
        ? "<span style='color:#00ff88;font-size:0.65rem'>READY</span>"
        : "<span style='opacity:0.65;font-size:0.65rem'>WAITING</span>"
      : `<span style="color:#00ff88">${Math.floor(hp)}%</span>`;
    const barRow = inLobby
      ? ""
      : `<div style="height:12px;background:#111;border:2px solid var(--neon-cyan)">
          <div style="height:100%;width:${hp}%;background:linear-gradient(90deg,#00ff88,#00cc66);transition:width .3s"></div>
        </div>`;
    html += `
      <div data-player-id="${id}" data-testid="player-row" style="margin:8px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>${player.username} ${isMe ? "(YOU)" : ""}</span>
          ${statusRight}
        </div>
        ${barRow}
      </div>`;
  });

  els.lobbyPlayerList.innerHTML = html;
  els.multiplayerSidebar.innerHTML =
    `<div style="background:rgba(0,0,0,0.85);padding:15px;border:4px solid var(--neon-cyan);border-radius:8px">${html}</div>`;
}

export function updateUI() {
  maybeEndFlowIfExpired(updateUI);

  const hp = Math.max(0, Math.min(100, state.health));
  els.healthBar.style.width = `${hp}%`;
  els.healthText.textContent = `${Math.floor(hp)}%`;
  els.healthBar.style.background =
    hp < 30
      ? "linear-gradient(90deg, #ff4444, #ff8800)"
      : "linear-gradient(90deg, #00ff88, #00cc66)";

  els.score.textContent = String(Math.floor(state.score)).padStart(6, "0");
  const minutes = Math.floor(state.timeSurvived / 60);
  const seconds = Math.floor(state.timeSurvived % 60);
  els.time.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const me: any = getMyPlayer();
  const resetAt = typeof me?.threatResetElapsedSeconds === "number" ? me.threatResetElapsedSeconds : 0;
  const effectiveElapsed = Math.max(0, state.timeSurvived - resetAt);
  const threat = Math.min(15, Math.floor(effectiveElapsed / 22)) + 1;
  els.threat.textContent = String(threat).padStart(2, "0");

  updateFlowHud({ max: FLOW_GAUGE_MAX, activateAt: FLOW_GAUGE_ACTIVATE_AT });
  updateForesightPreview();
}

export function flashPlayer(playerId: string, className: string, timeoutMs: number) {
  const el = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!el) return;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), timeoutMs);
}

export function createBonusPopup(bonus: number) {
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

export function renderLeaderboardHtml() {
  const room: any = state.room;
  const participants = room?.participants && typeof room.participants === "object" ? room.participants : {};
  const ids = Object.keys(participants);
  if (ids.length === 0) return "";
  const startedAt = typeof room?.startedAt === "number" ? room.startedAt : null;
  const matchNowAt =
    startedAt != null && typeof room?.elapsedSeconds === "number"
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
    const survivedSeconds =
      startedAt == null ? 0 : Math.max(0, Math.floor((outAt - startedAt) / 1000));
    const threat = Math.max(1, Math.floor(survivedSeconds / 25) + 1);
    return { playerId, username, score, status, outAt, isAlive, isMe, survivedSeconds, threat };
  });

  rows.sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    if (a.outAt !== b.outAt) return b.outAt - a.outAt;
    if (a.score !== b.score) return b.score - a.score;
    return a.username.localeCompare(b.username);
  });

  const winnerId = typeof room?.matchWinnerId === "string" ? room.matchWinnerId : null;
  const body = rows
    .map((r, idx) => {
      const name = `${r.username}${r.isMe ? " (YOU)" : ""}`;
      const statusIcon =
        r.status === "LEFT" ? "⇦" : winnerId && r.playerId !== winnerId ? "☠" : "♥";
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
    })
    .join("");

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

