import { els } from "../dom/els";
import { state } from "../state";

/** Panel ids: `index` plus card ids used in navigation stack and data-rules-* */
export const RULES_PANEL_INDEX = "index";

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
    subtitle: "Time pressure — faster drain as it rises",
    implemented: true,
  },
  {
    id: "score",
    title: "SCORE",
    subtitle: "Points for finished words",
    implemented: true,
  },
  {
    id: "flowState",
    title: "FLOW STATE",
    subtitle: "Elastic gauge, Foresight, and interference",
    implemented: true,
  },
];

const EFFECT_CARDS: RuleCard[] = [
  {
    id: "secondWind",
    title: "SECOND WIND",
    subtitle: "One threat reset per match",
    implemented: true,
  },
  {
    id: "jammed",
    title: "JAMMED",
    subtitle: "Fake word from an opponent streak",
    implemented: true,
  },
  { id: "comingSoonBuff1", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "comingSoonDebuff1", title: "COMING SOON", subtitle: "New debuff", implemented: false },
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
        Finish words by typing them correctly. Each finished word heals you and adds to your ${rulesLink("score", "score")}.
      </div>
      <div class="rules-p">
        Your health also drains slowly over time. The ${rulesLink("threatLevel", "threat level")} makes that drain faster as the match goes on—see ${rulesLink("threatLevel", "Threat level")} for details and ${rulesLink("secondWind", "Second Wind")}.
      </div>
      <div class="rules-p">
        Build ${rulesLink("flowState", "Flow")} for a timed bonus; a strong finish can ${rulesLink("flowState", "mess with a rival’s screen")}.
      </div>
      <div class="rules-p">
        <span class="rules-k">Win:</span> be the last player standing. <span class="rules-k">Lose:</span> your health reaches zero. Watch out for ${rulesLink("jammed", "Jammed")} after an opponent goes on a tear.
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
            Threat is the number shown in your HUD. It climbs as match time passes—about every 22 seconds it can step up, up to a maximum. Higher threat means your passive health drain gets faster.
          </div>
          <div class="rules-p">
            ${rulesLink("secondWind", "Second Wind")} (once per match) resets your threat timing so you effectively start climbing from the bottom again.
          </div>
          <div class="rules-p">
            Getting ${rulesLink("jammed", "Jammed")} does not change threat; it changes the word you must type for a short time.
          </div>
        </div>
      `;
    case "score":
      return `
        <div class="rules-section">
          <div class="rules-h">SCORE</div>
          <div class="rules-p">
            You earn score every time you complete a word. Longer words give more points than short ones.
          </div>
          <div class="rules-p">
            Score is mostly for bragging rights and tie-break feel—but when ${rulesLink("flowState", "Flow")} ends, interference usually goes to whoever is closest to you on the scoreboard.
          </div>
        </div>
      `;
    case "flowState":
      return `
        <div class="rules-section">
          <div class="rules-h">FLOW STATE</div>
          <div class="rules-p">
            When you <em>complete</em> a word with <em>no typos on that word</em>, your Flow gauge gains a chunk of fill. The higher the gauge already is, the less each clean word adds (diminishing returns). The gauge also slowly drifts back toward empty over time—stronger pull the fuller it is (elastic decay). Decay pauses while Flow is active.
          </div>
          <div class="rules-p">
            A typo <em>outside</em> Flow drops your gauge by about <span class="rules-k">35%</span> (it hurts, but it is not a full wipe).
          </div>
          <div class="rules-p">
            When the gauge is at least half full, press <span class="rules-k">Enter</span> to enter Flow. How long Flow lasts scales smoothly with how full the gauge was at activation: about <span class="rules-k">6.5–7 seconds</span> at half, up to about <span class="rules-k">14 seconds</span> at full. Activating spends the charge (the gauge resets for the next build-up).
          </div>
          <div class="rules-p">
            <span class="rules-k">Foresight:</span> during Flow you see a soft preview of the <em>next</em> word above your current target, and you are fully immune to ${rulesLink("jammed", "Jammed")} for what you must type (you still type the real word). Healing from each word you finish during Flow is reduced by about <span class="rules-k">18%</span>.
          </div>
          <div class="rules-p">
            Only correct keystrokes toward the current word add to the Flow bonus counter (used when Flow ends). A wrong keystroke during Flow ends Flow immediately and sends interference based on that counter—lost time is the main punishment (no extra gauge penalty on top).
          </div>
        </div>
        <div class="rules-section rules-subsection" id="rules-flow-interference">
          <div class="rules-h">Interference</div>
          <div class="rules-p">
            When Flow ends, that bonus is sent to the server. Another player—usually whoever has the score closest to yours—gets brief screen interference (glitch-style visuals). How intense it is depends on how strong your Flow finish was.
          </div>
          <div class="rules-p">
            <button type="button" class="rules-preview-fx-btn" data-rules-preview-flow-interference="1" data-testid="rules-preview-flow-interference">
              Flash sample interference
            </button>
          </div>
          <div class="rules-p">
            Related: ${rulesLink("threatLevel", "Threat level")}, ${rulesLink("score", "Score")}, ${rulesLink("jammed", "Jammed")}.
          </div>
        </div>
      `;
    case "secondWind":
      return `
        <div class="rules-section">
          <div class="rules-h">SECOND WIND</div>
          <div class="rules-p">
            Once per match. If your health drops <em>below 20%</em>, then within about <span class="rules-k">2 seconds</span> you heal back up to <span class="rules-k">80% health or higher</span>, your threat clock resets—you effectively start climbing threat from the beginning again.
          </div>
          <div class="rules-p">
            See also: ${rulesLink("threatLevel", "Threat level")}.
          </div>
        </div>
      `;
    case "jammed":
      return `
        <div class="rules-section">
          <div class="rules-h">JAMMED</div>
          <div class="rules-p">
            If an opponent finishes <span class="rules-k">three words within about five seconds</span>, other players can get Jammed (there is a cooldown so it cannot spam constantly). The effect lasts a bit over ten seconds.
          </div>
          <div class="rules-p">
            While Jammed, after you finish the word you were already on, your <em>next</em> typing target becomes a fake word until you complete it. You will see the on-screen <span class="rules-k">JAMMED!</span> banner when it applies to you. While ${rulesLink("flowState", "Flow")} is active, Foresight blocks Jammed from changing your typing target (and the banner hides for clarity).
          </div>
          <div class="rules-p">
            See also: ${rulesLink("threatLevel", "Threat level")}, ${rulesLink("flowState", "Flow")}.
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
