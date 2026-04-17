import { els } from "../dom/els";
import { getWords } from "../game/selectors";
import { state } from "../state";

/** One-shot motion: former Foresight “next” word settles into the active typing row (Flow only). */
export function triggerFlowWordSlotAnimation() {
  const el = els.letters;
  if (!el) return;

  el.classList.remove("letters--flow-enter");
  void el.offsetWidth;

  const done = () => {
    el.classList.remove("letters--flow-enter");
    el.removeEventListener("animationend", onEnd);
  };

  const onEnd = (ev: Event) => {
    if (ev.target !== el) return;
    const ae = ev as AnimationEvent;
    if (ae.animationName !== "flow-word-slot-enter") return;
    done();
  };

  el.addEventListener("animationend", onEnd);
  el.classList.add("letters--flow-enter");
  window.setTimeout(done, 420);
}

export function updateForesightPreview() {
  const el = els.foresightWord;
  if (!el) return;

  if (!state.gameRunning || !state.flowActive) {
    if (el.classList.contains("foresight-fade-out")) return;
    if (!state.flowActive) {
      el.textContent = "";
      el.classList.remove("foresight-visible", "foresight-fade-out");
    }
    return;
  }

  const words = getWords();
  const next = words[state.myCurrentIndex + 1];
  if (typeof next !== "string" || !next.length) {
    el.textContent = "";
    el.classList.remove("foresight-visible", "foresight-fade-out");
    return;
  }

  el.textContent = next;
  el.classList.remove("foresight-fade-out");
  el.classList.add("foresight-visible");
}

export function clearForesightPreview({ animate = false }: { animate?: boolean } = {}) {
  const el = els.foresightWord;
  if (!el) return;

  if (!animate) {
    el.textContent = "";
    el.classList.remove("foresight-visible", "foresight-fade-out");
    return;
  }

  el.classList.add("foresight-fade-out");
  el.classList.remove("foresight-visible");
  el.addEventListener(
    "transitionend",
    (ev) => {
      if ((ev as TransitionEvent).propertyName !== "opacity") return;
      el.textContent = "";
      el.classList.remove("foresight-visible", "foresight-fade-out");
    },
    { once: true },
  );
}
