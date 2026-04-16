import { state } from "../state";

export function ensureFlowHud() {
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

export function updateFlowHud(opts: { max: number; activateAt: number }) {
  const hud = ensureFlowHud();
  const gauge = Math.max(0, Math.min(opts.max, Number(state.flowGauge) || 0));
  const pct = Math.round((gauge / opts.max) * 100);
  hud.style.display = state.gameRunning ? "block" : "none";

  const bar = document.getElementById("flow-gauge-bar");
  if (bar) (bar as HTMLElement).style.width = `${pct}%`;

  const text = document.getElementById("flow-gauge-text");
  if (text) text.textContent = `${String(pct).padStart(3, " ")}%`;

  const hint = document.getElementById("flow-hint");
  if (hint) {
    const canActivate = !state.flowActive && gauge >= opts.max * opts.activateAt;
    hint.textContent = state.flowActive ? "ACTIVE" : canActivate ? "PRESS ENTER" : "BUILD (PERFECT WORDS)";
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

