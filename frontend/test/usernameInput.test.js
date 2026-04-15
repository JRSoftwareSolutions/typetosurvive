import { describe, expect, it, beforeEach } from "vitest";

function setupDom() {
  document.body.innerHTML = `
    <div id="letters"></div>
    <input id="typing-input" />
    <div id="health-bar"></div>
    <div id="health-text"></div>
    <div id="score"></div>
    <div id="time"></div>
    <div id="threat-level"></div>
    <div id="lobby-screen"></div>
    <div id="game-over-screen"><div id="end-screen-title"></div></div>
    <div id="lobby-player-list"></div>
    <div id="lobby-code-display"></div>
    <div id="multiplayer-sidebar"></div>
    <div id="creator-controls"></div>
    <div id="final-stats"></div>
    <button id="create-btn"></button>
    <button id="join-btn"></button>
    <button id="start-btn"></button>
    <button id="leave-btn"></button>
    <button id="leave-after-game-btn"></button>
    <button id="leave-in-game-btn"></button>
    <input id="username-input" />
    <input id="join-code-input" />
    <div id="particles"></div>
  `;
}

describe("username input sanitization", () => {
  beforeEach(async () => {
    setupDom();
    // Import after DOM exists (main.js binds listeners on import)
    await import("../src/main.js");
  });

  it("strips non a-z0-9 characters but preserves casing", () => {
    const input = document.getElementById("username-input");
    input.value = "JoH_123-!!";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe("JoH123");
  });
});

