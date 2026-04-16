import { els } from "../dom/els";
import { state } from "../state";

type RuleItem = {
  id: string;
  kind: "buff" | "debuff";
  title: string;
  subtitle: string;
  implemented: boolean;
};

const RULE_ITEMS: RuleItem[] = [
  { id: "secondWind", kind: "buff", title: "SECOND WIND", subtitle: "Threat reset", implemented: true },
  { id: "comingSoonBuff1", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "comingSoonBuff2", kind: "buff", title: "COMING SOON", subtitle: "New buff", implemented: false },
  { id: "decoyWord", kind: "debuff", title: "DECOY WORD", subtitle: "Fake next word", implemented: true },
  { id: "comingSoonDebuff1", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
  { id: "comingSoonDebuff2", kind: "debuff", title: "COMING SOON", subtitle: "New debuff", implemented: false },
];

function rulesIndexHtml() {
  const buffs = RULE_ITEMS.filter((i) => i.kind === "buff");
  const debuffs = RULE_ITEMS.filter((i) => i.kind === "debuff");
  const card = (i: RuleItem) => `
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

function rulesDetailHtml(itemId: string) {
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
        <div class="rules-p"><span class="rules-k">Effect</span>: after you finish the word you’re on when it hits, your <span class="rules-k">next</span> target becomes a fake word until you complete it.</div>
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

export function renderRules() {
  if (!els.rulesContent) return;
  if (state.rulesView === "detail" && typeof state.rulesSelectedId === "string") {
    els.rulesContent.innerHTML = rulesDetailHtml(state.rulesSelectedId);
    return;
  }
  els.rulesContent.innerHTML = rulesIndexHtml();
  els.rulesContent.scrollTop = typeof state.rulesIndexScrollTop === "number" ? state.rulesIndexScrollTop : 0;
}

export function openRules() {
  if (!els.rulesScreen) return;
  state.rulesView = "index";
  state.rulesSelectedId = null;
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

