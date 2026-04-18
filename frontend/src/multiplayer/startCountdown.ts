/** Must match `MULTIPLAYER_*` in backend `roomService.js`. */
export const MULTIPLAYER_START_DIGIT_MS = 1000;
export const MULTIPLAYER_START_HOLD_MS = 900;
export const MULTIPLAYER_COUNTDOWN_TOTAL_MS =
  5 * MULTIPLAYER_START_DIGIT_MS + MULTIPLAYER_START_HOLD_MS;

let rafId = 0;
let completeTimeoutId = 0;

function phaseLabel(remainingMs: number): string | null {
  const h = MULTIPLAYER_START_HOLD_MS;
  if (remainingMs > h + 4000) return "5";
  if (remainingMs > h + 3000) return "4";
  if (remainingMs > h + 2000) return "3";
  if (remainingMs > h + 1000) return "2";
  if (remainingMs > h) return "1";
  if (remainingMs > 0) return "START";
  return null;
}

function renderFallingText(container: HTMLElement, text: string) {
  const wrap = document.createElement("div");
  wrap.className = "start-countdown-word";
  wrap.setAttribute("aria-live", "polite");
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    const ch = upper[i];
    if (ch === " ") continue;
    const span = document.createElement("span");
    span.className = "start-countdown-char";
    span.textContent = ch;
    span.style.animationDelay = `${i * 0.06}s`;
    wrap.appendChild(span);
  }
  container.replaceChildren(wrap);
}

function ensureOverlayEl(): HTMLElement {
  let el = document.getElementById("start-countdown-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "start-countdown-overlay";
    el.className = "start-countdown-overlay";
    el.dataset.testid = "start-countdown-overlay";
    document.body.appendChild(el);
  }
  return el;
}

export function cancelMultiplayerStartCountdown() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (completeTimeoutId) clearTimeout(completeTimeoutId);
  completeTimeoutId = 0;
  const el = document.getElementById("start-countdown-overlay");
  if (el) {
    el.replaceChildren();
    el.classList.remove("start-countdown-overlay--visible");
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
  }
}

export function beginMultiplayerStartCountdown(playBeginsAt: number, onComplete: () => void) {
  cancelMultiplayerStartCountdown();
  const el = ensureOverlayEl();
  el.style.display = "flex";
  el.classList.add("start-countdown-overlay--visible");
  el.setAttribute("aria-hidden", "false");

  let lastRendered: string | null = null;

  const tick = () => {
    const remaining = playBeginsAt - Date.now();
    const label = phaseLabel(remaining);
    if (label != null && label !== lastRendered) {
      lastRendered = label;
      renderFallingText(el, label);
    }
    if (remaining > 0) {
      rafId = requestAnimationFrame(tick);
    }
  };

  rafId = requestAnimationFrame(tick);

  const delay = Math.max(0, playBeginsAt - Date.now());
  completeTimeoutId = window.setTimeout(() => {
    completeTimeoutId = 0;
    cancelMultiplayerStartCountdown();
    onComplete();
  }, delay);
}
