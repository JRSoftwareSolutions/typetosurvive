import { leaveRoom, updatePlayer } from "../api";
import { FLOW_GAUGE_MAX, FLOW_HEALTH_MULT_WHILE_ACTIVE } from "../constants";
import { els } from "../dom/els";
import { flowGaugeFillOnPerfectWord } from "../gameLogic";
import { state } from "../state";
import { getWords } from "./selectors";
import { createBonusPopup, renderLeaderboardHtml, renderWord, updateUI } from "../ui/render";
import { startDrain, startTimer, stopGameLoops } from "./timers";

export function startMultiplayerGame() {
  if (state.gameRunning) return;

  state.gameRunning = true;
  document.body.classList.add("in-game");
  state.myCurrentIndex = 0;
  state.decoyDeferEffectId = null;
  state.decoyDeferIndex = null;
  state.score = 0;
  state.currentWord = getWords()[0] || "survive";
  state.flowGauge = 0;
  state.flowWordHadTypo = false;
  state.flowActive = false;
  state.flowEndsAt = 0;
  state.flowCounter = 0;
  state.flowLastInputValue = "";
  state.flowLastCharEffectAt = 0;
  state.lastFlowGaugeSentAt = 0;
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
  startTimer(updateUI);
  startDrain(updateUI, endGame);
}

export function endGame() {
  if (!state.gameRunning) return;
  state.gameRunning = false;
  stopGameLoops();
  document.body.classList.remove("in-game");
  els.input.blur();

  try {
    state.highScore = Math.max(state.highScore, state.score);
    localStorage.setItem("typeToSurviveHighScore", String(state.highScore));
  } catch {
    // no-op
  }

  if (els.finalStats) {
    els.finalStats.innerHTML = `
      <div class="final-line"><span>YOUR SCORE</span><span>${Math.floor(state.score)}</span></div>
      <div class="final-line"><span>HIGH SCORE</span><span>${Math.floor(state.highScore)}</span></div>
      ${renderLeaderboardHtml()}
    `;
  }
  els.gameOverScreen.classList.add("show");
}

export function endVictory() {
  if (!state.gameRunning) return;
  state.gameRunning = false;
  stopGameLoops();
  document.body.classList.remove("in-game");
  els.input.blur();

  try {
    state.highScore = Math.max(state.highScore, state.score);
    localStorage.setItem("typeToSurviveHighScore", String(state.highScore));
  } catch {
    // no-op
  }

  if (els.endScreenTitle) {
    els.endScreenTitle.textContent = "VICTORY!";
    els.endScreenTitle.className = "title victory-title";
  }
  if (els.finalStats) {
    els.finalStats.innerHTML = `
      <div class="final-line"><span>YOUR SCORE</span><span>${Math.floor(state.score)}</span></div>
      <div class="final-line"><span>HIGH SCORE</span><span>${Math.floor(state.highScore)}</span></div>
      ${renderLeaderboardHtml()}
    `;
  }
  els.gameOverScreen.classList.add("show");
}

export function success() {
  if (!state.flowActive && !state.flowWordHadTypo) {
    state.flowGauge = flowGaugeFillOnPerfectWord(state.flowGauge);
  }
  state.flowWordHadTypo = false;

  const len = state.currentWord.length;
  let bonus = 15 + len * 7;
  if (len >= 10) bonus += 28;
  if (len >= 13) bonus += 22;
  if (state.flowActive) bonus = Math.floor(bonus * FLOW_HEALTH_MULT_WHILE_ACTIVE);

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

export async function leaveRoomAndReload(removeAllDevBots: (opts: { leaveServer: boolean }) => Promise<void>) {
  try {
    await removeAllDevBots({ leaveServer: true });
    if (state.roomCode && state.myPlayerId) await leaveRoom(state.roomCode, state.myPlayerId);
  } catch {
    // no-op
  } finally {
    if (state.eventSource) state.eventSource.close();
    location.reload();
  }
}
