import {
  FLOW_DURATION_MAX_MS,
  FLOW_DURATION_MIN_MS,
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_MAX,
  FLOW_HEALTH_MULT_WHILE_ACTIVE,
  FLOW_TYPO_GAUGE_MULT,
} from "../constants";
import { els } from "../dom/els";
import { state } from "../state";

/** Panel ids: `index` plus card ids used in navigation stack and data-rules-* */
export const RULES_PANEL_INDEX = "index";

/**
 * Jammed / decoy numbers — keep in sync with `backend/src/constants.js` (`DECOY_WORD`).
 * Flow timings and gauge knobs come from `../constants` imports above.
 */
const RULES_DECOY = {
  burstWindowMs: 5000,
  burstCount: 3,
  durationMs: 11000,
  cooldownMs: 55000,
  decoyLen: 5,
} as const;

const flowDurMinS = FLOW_DURATION_MIN_MS / 1000;
const flowDurMaxS = FLOW_DURATION_MAX_MS / 1000;
const flowActivatePct = Math.round(FLOW_GAUGE_ACTIVATE_AT * 100);
const typoGaugeKeepPct = Math.round(FLOW_TYPO_GAUGE_MULT * 100);
const flowHealLessPct = Math.round((1 - FLOW_HEALTH_MULT_WHILE_ACTIVE) * 100);

type RuleCard = {
  id: string;
  title: string;
  subtitle: string;
  implemented: boolean;
};

const MECHANIC_CARDS: RuleCard[] = [
  {
    id: "threatLevel",
    title: "THREAT LEVEL",
    subtitle: "HUD 1–16 · faster drain as it rises",
    implemented: true,
  },
  {
    id: "score",
    title: "SCORE",
    subtitle: "Per word: length × 18 + 50",
    implemented: true,
  },
  {
    id: "flowState",
    title: "FLOW STATE",
    subtitle: "Gauge · Enter · screen interference",
    implemented: true,
  },
];

const EFFECT_CARDS: RuleCard[] = [
  {
    id: "secondWind",
    title: "SECOND WIND",
    subtitle: "Threat reset if you spike HP in time",
    implemented: true,
  },
  {
    id: "foresight",
    title: "FORESIGHT",
    subtitle: "During Flow — next word + Jammed block",
    implemented: true,
  },
  {
    id: "jammed",
    title: "JAMMED",
    subtitle: "5-letter decoy after an enemy streak",
    implemented: true,
  },
  {
    id: "flowInterference",
    title: "INTERFERENCE",
    subtitle: "Glitch FX when someone’s Flow ends",
    implemented: true,
  },
];

function rulesCurrentId(): string {
  const s = state.rulesNavStack;
  return s.length ? s[s.length - 1]! : RULES_PANEL_INDEX;
}

function updateRulesBackButton() {
  const btn = els.rulesBackBtn;
  if (!btn) return;
  const show = state.rulesNavStack.length > 1;
  btn.style.visibility = show ? "visible" : "hidden";
  btn.setAttribute("aria-hidden", show ? "false" : "true");
  btn.tabIndex = show ? 0 : -1;
}

/** Inline “link” that opens another rules card (pushes onto nav stack). */
export function rulesLink(panelId: string, label: string): string {
  return `<button type="button" class="rules-link" data-rules-link="${panelId}">${label}</button>`;
}

function cardButton(c: RuleCard): string {
  return `
    <button class="rules-card" type="button" data-rules-id="${c.id}">
      <div class="rules-card-title">${c.title}</div>
      <div class="rules-card-sub">${c.subtitle}</div>
      ${c.implemented ? "" : `<div class="rules-card-tag">COMING SOON</div>`}
    </button>
  `;
}

function rulesIndexHtml(): string {
  const mechanics = MECHANIC_CARDS.map(cardButton).join("");
  const effects = EFFECT_CARDS.map(cardButton).join("");
  return `
    <div class="rules-section rules-goal">
      <div class="rules-h">GOAL</div>
      <div class="rules-p">
        Type each word correctly. Finishing a word heals you (more on longer words) and adds ${rulesLink("score", "score")} (<span class="rules-k">length × 18 + 50</span>).
      </div>
      <div class="rules-p">
        Health passively drains; ${rulesLink("threatLevel", "threat")} makes drain faster over time. ${rulesLink("secondWind", "Second Wind")} can reset that climb once.
      </div>
      <div class="rules-p">
        ${rulesLink("flowState", "Flow")}: build gauge, press Enter for a timed boost (${rulesLink("foresight", "Foresight")} while active); a strong exit can apply ${rulesLink("flowInterference", "interference")} to a rival.
      </div>
      <div class="rules-p">
        <span class="rules-k">Win (2+ players):</span> last alive. <span class="rules-k">Lose:</span> HP hits 0. <span class="rules-k">Jammed:</span> ${rulesLink("jammed", "fake word")} if someone streaks.
      </div>
    </div>

    <div class="rules-section">
      <div class="rules-h">CORE SYSTEMS</div>
      <div class="rules-grid rules-grid-mechanics">
        ${mechanics}
      </div>
    </div>

    <div class="rules-section">
      <div class="rules-h">BUFFS &amp; DEBUFFS</div>
      <div class="rules-grid rules-grid-effects">
        ${effects}
      </div>
    </div>
  `;
}

function rulesDetailHtml(panelId: string): string {
  switch (panelId) {
    case "threatLevel":
      return `
        <div class="rules-section">
          <div class="rules-h">THREAT LEVEL</div>
          <div class="rules-p">
            HUD shows <span class="rules-k">1–16</span>. It steps up about every <span class="rules-k">22s</span> of <em>effective</em> match time (time since your last ${rulesLink("secondWind", "Second Wind")} threat reset). Higher value → faster passive drain.
          </div>
          <div class="rules-p">
            ${rulesLink("secondWind", "Second Wind")} resets your effective threat clock once it procs.
          </div>
          <div class="rules-p">
            ${rulesLink("jammed", "Jammed")} does not change threat—only which word you type for a while.
          </div>
          <div class="rules-threat-locate-demo" aria-hidden="true" data-testid="rules-threat-ui-example">
            <div class="rules-threat-locate-demo-label">WHERE TO FIND IT</div>
            <p class="rules-threat-locate-demo-intro">During a match, threat is the <span class="rules-k">pink number</span> in the <span class="rules-k">top header</span>—between Score and Health.</p>
            <div class="rules-threat-locate-demo-bar" role="presentation">
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">SCORE</span>
                <span class="rules-threat-locate-score">001240</span>
              </div>
              <div class="rules-threat-locate-stat rules-threat-locate-stat--highlight">
                <span class="rules-threat-locate-label">THREAT LEVEL</span>
                <span class="rules-threat-locate-threat">07</span>
              </div>
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">HEALTH</span>
                <span class="rules-threat-locate-healthfake">82%</span>
              </div>
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">SURVIVED</span>
                <span class="rules-threat-locate-time">03:42</span>
              </div>
            </div>
            <div class="rules-threat-locate-demo-caption">Same layout as the live HUD; values here are examples only.</div>
          </div>
        </div>
      `;
    case "score":
      return `
        <div class="rules-section">
          <div class="rules-h">SCORE</div>
          <div class="rules-p">
            Each completed word: <span class="rules-k">word length × 18 + 50</span> (longer words score more).
          </div>
          <div class="rules-p">
            When someone’s ${rulesLink("flowState", "Flow")} ends, ${rulesLink("flowInterference", "interference")} usually hits the rival whose score is <em>closest</em> to theirs (ties pick randomly).
          </div>
          <div class="rules-score-locate-demo" aria-hidden="true" data-testid="rules-score-ui-example">
            <div class="rules-threat-locate-demo-label">WHERE TO FIND IT</div>
            <p class="rules-threat-locate-demo-intro">
              During a match, your score is the <span class="rules-k">bright number</span> on the <span class="rules-k">far left</span> of the top header (six digits, often zero-padded). ${rulesLink("threatLevel", "Threat")} sits in the next column to the right.
            </p>
            <div class="rules-threat-locate-demo-bar" role="presentation">
              <div class="rules-threat-locate-stat rules-threat-locate-stat--scorePrimary">
                <span class="rules-threat-locate-label">SCORE</span>
                <span class="rules-threat-locate-score">001240</span>
              </div>
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">THREAT LEVEL</span>
                <span class="rules-threat-locate-threat">07</span>
              </div>
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">HEALTH</span>
                <span class="rules-threat-locate-healthfake">82%</span>
              </div>
              <div class="rules-threat-locate-stat">
                <span class="rules-threat-locate-label">SURVIVED</span>
                <span class="rules-threat-locate-time">03:42</span>
              </div>
            </div>
            <div class="rules-threat-locate-demo-caption">Same layout as the live HUD; values here are examples only.</div>
          </div>
        </div>
      `;
    case "flowState":
      return `
        <div class="rules-section">
          <div class="rules-h">FLOW STATE</div>
          <div class="rules-p">
            Finish a word with <em>no typos on that word</em> to fill the gauge (longer words help more; fill slows as the bar gets high). The bar eases down over time when not in Flow; decay pauses during Flow.
          </div>
          <div class="rules-p">
            A typo while <em>not</em> in Flow multiplies the gauge by <span class="rules-k">${typoGaugeKeepPct}%</span> (lose roughly <span class="rules-k">${100 - typoGaugeKeepPct}%</span> of the current fill).
          </div>
          <div class="rules-p">
            At <span class="rules-k">${flowActivatePct}%</span> of max (<span class="rules-k">${FLOW_GAUGE_MAX}</span>) or more, press <span class="rules-k">Enter</span> to start Flow. Duration scales with fill at activation: about <span class="rules-k">${flowDurMinS}s–${flowDurMaxS}s</span>. Activation clears the gauge.
          </div>
          <div class="rules-p">
            ${rulesLink("foresight", "Foresight")} is active for the whole Flow window. Word heal per completion is <span class="rules-k">×${FLOW_HEALTH_MULT_WHILE_ACTIVE}</span> (~<span class="rules-k">${flowHealLessPct}%</span> less than normal).
          </div>
          <div class="rules-p">
            During Flow, only correct new keystrokes add to the exit counter. One wrong new character ends Flow early and sends that counter as a payout (same as timing out).
          </div>
          <div class="rules-p">
            That payout can inflict ${rulesLink("flowInterference", "interference")} on another player—see that debuff for victim rules and visuals.
          </div>
          <div class="rules-flow-gauge-demos" aria-hidden="true" data-testid="rules-flow-gauge-examples">
            <div class="rules-flow-gauge-demo-label">EXAMPLE · FLOW BAR</div>
            <div class="rules-flow-gauge-demo-row">
              <div class="rules-flow-gauge-demo-caption">Building (under ${flowActivatePct}%)</div>
              <div class="rules-flow-demo-wrap rules-flow-demo-wrap--building">
                <div class="rules-flow-hud-row">
                  <div class="rules-flow-hud-top">
                    <span class="rules-flow-hud-title">FLOW</span>
                    <span class="rules-flow-hud-pct"> 35%</span>
                  </div>
                  <div class="rules-flow-gauge-outer">
                    <div class="rules-flow-gauge-bar" style="width:35%"></div>
                  </div>
                  <div class="rules-flow-hint rules-flow-hint--building">ELASTIC GAUGE · CLEAN WORDS FILL</div>
                </div>
              </div>
            </div>
            <div class="rules-flow-gauge-demo-row">
              <div class="rules-flow-gauge-demo-caption">Ready (≥${flowActivatePct}% — press Enter)</div>
              <div class="rules-flow-demo-wrap rules-flow-demo-wrap--ready rules-flow-demo-wrap--high">
                <div class="rules-flow-hud-row">
                  <div class="rules-flow-hud-top">
                    <span class="rules-flow-hud-title">FLOW</span>
                    <span class="rules-flow-hud-pct"> 72%</span>
                  </div>
                  <div class="rules-flow-gauge-outer">
                    <div class="rules-flow-gauge-bar" style="width:72%"></div>
                  </div>
                  <div class="rules-flow-hint rules-flow-hint--ready">PRESS ENTER</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    case "foresight":
      return `
        <div class="rules-section">
          <div class="rules-h">FORESIGHT</div>
          <div class="rules-p">
            A buff tied to ${rulesLink("flowState", "Flow")}: only while Flow is running after you press Enter.
          </div>
          <div class="rules-p">
            You see the <em>next</em> word above your current line (soft preview). You still type the real current word—preview is informational.
          </div>
          <div class="rules-p">
            ${rulesLink("jammed", "Jammed")} cannot swap the word you must type; the <span class="rules-k">JAMMED!</span> banner stays hidden during Flow so the UI stays clear.
          </div>
          <div class="rules-foresight-demo" aria-hidden="true" data-testid="rules-foresight-example">
            <div class="rules-foresight-demo-label">EXAMPLE LAYOUT</div>
            <div class="foresight-word foresight-visible rules-foresight-demo-next">nebula</div>
            <div class="rules-foresight-demo-wordbox">
              <span class="rules-foresight-demo-note">You type (current word)</span>
              <div class="rules-foresight-demo-current">starship</div>
            </div>
            <div class="rules-foresight-demo-caption">Soft dim line above = next word; bright box = what you type.</div>
          </div>
        </div>
      `;
    case "secondWind":
      return `
        <div class="rules-section">
          <div class="rules-h">SECOND WIND</div>
          <div class="rules-p">
            Once per match. When server health first drops <span class="rules-k">below 20%</span>, a <span class="rules-k">2s</span> window opens. If you reach <span class="rules-k">80%+ HP</span> before that window closes—by finishing words, same as normal healing—your <em>threat baseline resets</em> (you climb threat from the bottom again). The game does not auto-heal you.
          </div>
          <div class="rules-p">
            Miss 80% in that window and nothing triggers; you can arm again on later dips below 20% until Second Wind actually fires once this match.
          </div>
          <div class="rules-second-wind-demo" aria-hidden="true" data-testid="rules-second-wind-example">
            <div class="rules-second-wind-demo-label">EXAMPLE WHEN IT TRIGGERS</div>
            <div class="rules-second-wind-demo-banner">SECOND WIND!</div>
            <div class="rules-second-wind-demo-caption">
              In a match this banner flashes for about <span class="rules-k">1.4s</span> when Second Wind procs—same moment your ${rulesLink("threatLevel", "threat")} climb restarts from the bottom.
            </div>
          </div>
        </div>
      `;
    case "jammed":
      return `
        <div class="rules-section">
          <div class="rules-h">JAMMED</div>
          <div class="rules-p">
            If an opponent completes <span class="rules-k">${RULES_DECOY.burstCount}</span> words within <span class="rules-k">${RULES_DECOY.burstWindowMs / 1000}s</span>, others can get Jammed. That source cannot trigger again for <span class="rules-k">${RULES_DECOY.cooldownMs / 1000}s</span>. The debuff runs <span class="rules-k">${RULES_DECOY.durationMs / 1000}s</span>.
          </div>
          <div class="rules-p">
            After your current word, your next target is a fake <span class="rules-k">${RULES_DECOY.decoyLen}</span>-letter word until you clear it. Banner: <span class="rules-k">JAMMED!</span> ${rulesLink("flowState", "Flow")} / ${rulesLink("foresight", "Foresight")} blocks the swap for what you type.
          </div>
          <div class="rules-jammed-demo" aria-hidden="true" data-testid="rules-jammed-example">
            <div class="rules-jammed-demo-label">EXAMPLE WHEN ACTIVE</div>
            <div class="rules-jammed-demo-banner">JAMMED!</div>
            <div class="rules-jammed-demo-note">Decoy target in the word box (sample letters):</div>
            <div class="rules-jammed-demo-wordbox">
              <div class="rules-jammed-demo-letters">
                ${"qzxwm"
                  .split("")
                  .map((c) => `<span class="letter pending">${c}</span>`)
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    case "flowInterference":
      return `
        <div class="rules-section rules-subsection" id="rules-flow-interference">
          <div class="rules-h">INTERFERENCE</div>
          <div class="rules-p">
            A debuff applied to <em>you</em> when someone else’s ${rulesLink("flowState", "Flow")} ends (timer or typo). The server picks one victim: usually whoever is <em>closest</em> on the ${rulesLink("score", "scoreboard")} to the Flow player (ties random). Glitch-style visuals; how harsh and how long it lasts scale with their Flow exit counter (strong finish → worse for you).
          </div>
          <div class="rules-p">
            <button type="button" class="rules-preview-fx-btn" data-rules-preview-flow-interference="1" data-testid="rules-preview-flow-interference">
              Flash sample interference
            </button>
          </div>
        </div>
      `;
    default: {
      const all = [...MECHANIC_CARDS, ...EFFECT_CARDS];
      const c = all.find((x) => x.id === panelId);
      if (!c) {
        return `
          <div class="rules-section">
            <div class="rules-h">NOT FOUND</div>
            <div class="rules-p">This topic is missing.</div>
          </div>
        `;
      }
      if (!c.implemented) {
        return `
          <div class="rules-section">
            <div class="rules-h">${c.title}</div>
            <div class="rules-p">Coming soon.</div>
          </div>
        `;
      }
      return `
        <div class="rules-section">
          <div class="rules-h">${c.title}</div>
          <div class="rules-p">Details unavailable.</div>
        </div>
      `;
    }
  }
}

export function renderRules() {
  if (!els.rulesContent) return;
  const id = rulesCurrentId();
  if (id === RULES_PANEL_INDEX) {
    els.rulesContent.innerHTML = rulesIndexHtml();
    els.rulesContent.scrollTop =
      typeof state.rulesIndexScrollTop === "number" ? state.rulesIndexScrollTop : 0;
  } else {
    els.rulesContent.innerHTML = rulesDetailHtml(id);
    els.rulesContent.scrollTop = 0;
  }
  updateRulesBackButton();
}

/** Save index scroll position, push panel id, re-render. Call from event handler. */
export function rulesNavigatePush(panelId: string) {
  if (rulesCurrentId() === RULES_PANEL_INDEX && els.rulesContent) {
    state.rulesIndexScrollTop = els.rulesContent.scrollTop;
  }
  state.rulesNavStack.push(panelId);
  renderRules();
}

export function rulesNavigatePop(): boolean {
  if (state.rulesNavStack.length <= 1) return false;
  state.rulesNavStack.pop();
  renderRules();
  return true;
}

/** Jump to the rules index and clear navigation history (stack is only `index`). */
export function rulesNavigateHome() {
  state.rulesNavStack = [RULES_PANEL_INDEX];
  state.rulesIndexScrollTop = 0;
  renderRules();
}

export function openRules() {
  if (!els.rulesScreen) return;
  state.rulesNavStack = [RULES_PANEL_INDEX];
  state.rulesIndexScrollTop = 0;
  renderRules();
  els.rulesScreen.classList.add("show");
}

export function closeRules({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
  if (!els.rulesScreen) return;
  els.rulesScreen.classList.remove("show");
  if (restoreFocus && els.lobbyScreen?.classList.contains("show")) {
    els.usernameInput?.focus?.();
  }
}
