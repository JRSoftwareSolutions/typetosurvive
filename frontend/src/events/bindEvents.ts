import { updatePlayer } from "../api";
import {
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_MAX,
  FLOW_MAX_MS,
  FLOW_MIN_MS,
} from "../constants";
import { els } from "../dom/els";
import { isDecoyTypingActive, typingTargetWord } from "../effects/decoy";
import { applyFlowInputDelta } from "../flow/flow";
import { endGame, success } from "../game/game";
import { state } from "../state";
import { updateUI } from "../ui/render";
import { updateLeaveRoomVisibility } from "../ui/visibility";
import { lerp } from "../utils/math";

export type BindEventsOpts = {
  createRoomHandler: () => void;
  joinRoomHandler: () => void;
  startGameHandler: () => void;
  leaveRoomHandler: () => void;
  openRules: () => void;
  closeRules: (opts?: { restoreFocus?: boolean }) => void;
  renderRules: () => void;
  onDecoySuccess: () => void | Promise<void>;
  updateLetterColors: (typed: string) => void;
  flowGaugeAddForStreak: (streak: number) => number;

  // Dev-bot wiring (optional; only used when enabled)
  isDevBotsEnabled: () => boolean;
  updateDevBotPanel: () => void;
  ensureDevBotPanel: () => HTMLElement;
  addDevBot: () => void | Promise<void>;
  removeAllDevBots: (opts: { leaveServer: boolean }) => void | Promise<void>;
  stopDevBot: (id: string) => void;
};

export function bindEvents(opts: BindEventsOpts) {
  state.devBotsEnabled = opts.isDevBotsEnabled();
  if (state.devBotsEnabled) {
    opts.updateDevBotPanel();
    const panel = opts.ensureDevBotPanel();
    const addBtn = panel.querySelector("#dev-add-bot-btn");
    const removeBtn = panel.querySelector("#dev-remove-bots-btn");
    addBtn?.addEventListener("click", () => void opts.addDevBot());
    removeBtn?.addEventListener("click", () => void opts.removeAllDevBots({ leaveServer: true }));
    window.addEventListener("beforeunload", () => {
      // Best effort: stop timers so we don't keep patching during reload.
      (Array.isArray(state.devBotIds) ? state.devBotIds : []).forEach((id) => opts.stopDevBot(id));
    });
  }

  els.usernameInput.addEventListener("input", () => {
    const original = els.usernameInput.value;
    const sanitized = original.replace(/[^a-z0-9]/gi, "");
    if (sanitized !== original) els.usernameInput.value = sanitized;
  });

  els.createBtn.addEventListener("click", opts.createRoomHandler);
  els.joinBtn.addEventListener("click", opts.joinRoomHandler);
  els.startBtn.addEventListener("click", opts.startGameHandler);
  els.leaveBtn.addEventListener("click", opts.leaveRoomHandler);
  els.leaveAfterGameBtn.addEventListener("click", opts.leaveRoomHandler);
  els.leaveInGameBtn.addEventListener("click", opts.leaveRoomHandler);
  els.rulesBtn?.addEventListener("click", opts.openRules);
  els.rulesCloseBtn?.addEventListener("click", () => opts.closeRules());
  els.rulesScreen?.addEventListener("click", (e) => {
    if (e.target === els.rulesScreen) opts.closeRules();
  });
  els.rulesContent?.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const back = target.closest("[data-rules-action='back']");
    if (back) {
      state.rulesView = "index";
      state.rulesSelectedId = null;
      opts.renderRules();
      return;
    }
    const card = target.closest("[data-rules-id]");
    if (card) {
      const id = card.getAttribute("data-rules-id");
      if (!id) return;
      state.rulesIndexScrollTop = els.rulesContent?.scrollTop ?? 0;
      state.rulesView = "detail";
      state.rulesSelectedId = id;
      opts.renderRules();
    }
  });

  els.input.addEventListener("input", (e) => {
    if (!state.gameRunning) return;
    const typed = (e.target as HTMLInputElement).value.trim();
    opts.updateLetterColors(typed);
    const target = typingTargetWord();
    applyFlowInputDelta(updateUI, typed, target);
    if (typed.toLowerCase() === target.toLowerCase()) {
      if (isDecoyTypingActive()) void opts.onDecoySuccess();
      else success(opts.flowGaugeAddForStreak);
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
      opts.closeRules();
      return;
    }
    if (state.gameRunning) endGame();
  });

  updateLeaveRoomVisibility();
}

