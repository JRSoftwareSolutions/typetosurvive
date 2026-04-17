import { state } from "../state";

const HUD_DOM_VERSION = "2";

export function ensureFlowHud() {
  const existing = document.getElementById("flow-hud");
  if (existing?.dataset.flowHudVersion === HUD_DOM_VERSION) return existing;
  if (existing) existing.remove();

  const wrap = document.createElement("div");
  wrap.id = "flow-hud";
  wrap.dataset.flowHudVersion = HUD_DOM_VERSION;
  wrap.className = "flow-hud-wrap";
  wrap.style.position = "fixed";
  wrap.style.left = "50%";
  wrap.style.bottom = "22px";
  wrap.style.transform = "translateX(-50%)";
  wrap.style.zIndex = "55";
  wrap.style.pointerEvents = "none";
  wrap.style.display = "none";
  wrap.style.width = "min(640px, calc(100vw - 40px))";

  const row = document.createElement("div");
  row.id = "flow-hud-row";
  row.className = "flow-hud-row";
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.alignItems = "stretch";
  row.style.gap = "8px";
  row.style.padding = "10px 12px";
  row.style.border = "3px solid rgba(0, 247, 255, 0.7)";
  row.style.borderRadius = "12px";
  row.style.background = "rgba(0,0,0,0.78)";
  row.style.boxShadow = "0 0 18px rgba(0,247,255,0.25)";

  const topRow = document.createElement("div");
  topRow.id = "flow-hud-top";
  topRow.style.display = "flex";
  topRow.style.flexDirection = "row";
  topRow.style.alignItems = "flex-start";
  topRow.style.justifyContent = "space-between";
  topRow.style.gap = "12px";
  topRow.style.width = "100%";

  const title = document.createElement("div");
  title.textContent = "FLOW";
  title.style.color = "#00f7ff";
  title.style.letterSpacing = "0.16em";
  title.style.fontSize = "12px";
  title.style.textShadow = "0 0 10px rgba(0,247,255,0.25)";
  title.style.flexShrink = "0";

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.alignItems = "flex-end";
  right.style.gap = "4px";
  right.style.flexShrink = "0";

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

  topRow.appendChild(title);
  topRow.appendChild(right);

  const barOuter = document.createElement("div");
  barOuter.id = "flow-gauge-outer";
  barOuter.style.width = "100%";
  barOuter.style.flex = "0 0 auto";
  barOuter.style.height = "16px";
  barOuter.style.background = "rgba(17,17,17,0.9)";
  barOuter.style.border = "3px solid rgba(255, 0, 170, 0.65)";
  barOuter.style.borderRadius = "10px";
  barOuter.style.overflow = "hidden";
  barOuter.style.boxSizing = "border-box";

  const barInner = document.createElement("div");
  barInner.id = "flow-gauge-bar";
  barInner.style.height = "100%";
  barInner.style.width = "0%";
  barInner.style.background = "linear-gradient(90deg, rgba(255,0,170,0.85), rgba(0,247,255,0.9))";
  barInner.style.boxShadow = "0 0 18px rgba(255,0,170,0.35)";
  barInner.style.transition = "width 0.18s ease";
  barOuter.appendChild(barInner);

  const hint = document.createElement("div");
  hint.id = "flow-hint";
  hint.style.fontSize = "10px";
  hint.style.opacity = "0.85";
  hint.style.letterSpacing = "0.08em";
  hint.style.color = "rgba(255,255,255,0.9)";
  hint.style.textAlign = "center";
  hint.style.width = "100%";
  hint.style.lineHeight = "1.35";
  hint.style.wordBreak = "break-word";

  row.appendChild(topRow);
  row.appendChild(barOuter);
  row.appendChild(hint);
  wrap.appendChild(row);
  document.body.appendChild(wrap);
  return wrap;
}

export function updateFlowHud(opts: { max: number; activateAt: number }) {
  const hud = ensureFlowHud() as HTMLElement;
  const gauge = Math.max(0, Math.min(opts.max, Number(state.flowGauge) || 0));
  const pct = Math.round((gauge / opts.max) * 100);
  hud.style.display = state.gameRunning ? "block" : "none";

  const canActivate = !state.flowActive && gauge >= opts.max * opts.activateAt;
  const high = !state.flowActive && pct >= 70;

  hud.classList.toggle("flow-hud-wrap--active", state.flowActive);
  hud.classList.toggle("flow-hud-wrap--ready", canActivate);
  hud.classList.toggle("flow-hud-wrap--high", high);

  const bar = document.getElementById("flow-gauge-bar");
  if (bar) (bar as HTMLElement).style.width = `${pct}%`;

  const text = document.getElementById("flow-gauge-text");
  if (text) text.textContent = `${String(pct).padStart(3, " ")}%`;

  const hint = document.getElementById("flow-hint");
  if (hint) {
    hint.textContent = state.flowActive
      ? "FORESIGHT · JAMMED IMMUNE"
      : canActivate
        ? "PRESS ENTER"
        : "ELASTIC GAUGE · CLEAN WORDS FILL";
    (hint as HTMLElement).style.color = canActivate ? "#fff" : "rgba(255,255,255,0.9)";
    (hint as HTMLElement).style.textShadow = canActivate ? "0 0 12px rgba(255,255,255,0.35)" : "none";
  }

  const counter = document.getElementById("flow-counter");
  if (counter) {
    if (state.flowActive) {
      (counter as HTMLElement).style.display = "block";
      const v = Math.trunc(Number(state.flowCounter) || 0);
      counter.textContent = v >= 0 ? `+${v}` : `${v}`;
      (counter as HTMLElement).style.color = v >= 0 ? "#00ff88" : "#ff0066";
      (counter as HTMLElement).style.textShadow =
        v >= 0 ? "0 0 14px rgba(0,255,136,0.3)" : "0 0 14px rgba(255,0,102,0.35)";
    } else {
      (counter as HTMLElement).style.display = "none";
    }
  }
}
