import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Reproduces (and guards) a race where Jammed defers the decoy until after the current word,
 * Flow hides the decoy while active, then Flow ends: `typingTargetWord()` flips to the decoy
 * (`decoy.ts` uses `!state.flowActive`) but the letter strip was last painted for the real word.
 * @see frontend/src/effects/decoy.ts — useDecoyWord gates on `!state.flowActive`
 * @see frontend/src/flow/flow.ts — `endFlow` must call `renderWord()` after flow drops
 */
function setupLettersDom() {
  document.body.innerHTML = `<div id="letters"></div>`;
}

describe("Jammed (decoy) when Flow ends", () => {
  beforeEach(() => {
    vi.resetModules();
    setupLettersDom();
  });

  it("repaints #letters so the visible word matches typingTargetWord after endFlow", async () => {
    const { state } = await import("../src/state.ts");
    const { typingTargetWord } = await import("../src/effects/decoy.ts");
    const { renderWord } = await import("../src/ui/render.ts");
    const { endFlow } = await import("../src/flow/flow.ts");

    const me = "player-me";
    const attacker = "player-atk";
    const decoyWord = "abcde";

    state.roomCode = "";
    state.myPlayerId = me;
    state.gameRunning = true;
    state.myCurrentIndex = 1;
    state.currentWord = "plane";
    state.flowActive = true;
    state.flowEndsAt = Date.now() + 60_000;
    state.decoyDeferEffectId = "fx-decoy-1";
    state.decoyDeferIndex = 0;
    state.room = {
      wordSequence: ["w0", "plane", "w2"],
      effects: [
        {
          id: "fx-decoy-1",
          type: "decoyWord",
          sourcePlayerId: attacker,
          expiresAt: Date.now() + 60_000,
          payload: {
            wordsByPlayerId: { [me]: decoyWord },
            completedBy: {},
          },
        },
      ],
    };

    // While Flow is active, jammed typing is blocked — UI shows the real word.
    expect(typingTargetWord()).toBe("plane");
    renderWord();
    const lettersEl = document.getElementById("letters");
    expect((lettersEl?.textContent || "").replace(/\s+/g, "")).toBe("plane");

    // Flow ends (no room sync required). Logical target becomes decoy immediately.
    endFlow(() => {});
    expect(state.flowActive).toBe(false);
    expect(typingTargetWord()).toBe(decoyWord);

    // Letters must match what input / success handlers use (`typingTargetWord()`).
    expect((lettersEl?.textContent || "").replace(/\s+/g, "")).toBe(decoyWord);
  });
});
