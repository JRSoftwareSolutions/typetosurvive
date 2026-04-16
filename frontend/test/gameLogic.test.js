import { describe, expect, it } from "vitest";
import { deriveActiveEffects, flowGaugeAddForStreak } from "../src/gameLogic.ts";

describe("gameLogic", () => {
  it("flowGaugeAddForStreak uses base + streak*mult with soft cap", () => {
    const baseAdd = 6;
    const multAdd = 6;
    const softCap = 12;

    expect(flowGaugeAddForStreak({ streak: 1, softCap, baseAdd, multAdd })).toBe(12);
    expect(flowGaugeAddForStreak({ streak: 5, softCap, baseAdd, multAdd })).toBe(36);
    expect(flowGaugeAddForStreak({ streak: 999, softCap, baseAdd, multAdd })).toBe(6 + 12 * 6);
  });

  it("deriveActiveEffects supports targets:[id] and targets:'others'", () => {
    const now = 1_000_000;
    const effects = [
      { id: "e1", type: "x", sourcePlayerId: "A", targets: "others", expiresAt: now + 100 },
      { id: "e2", type: "x", sourcePlayerId: "A", targets: ["B"], expiresAt: now + 100 },
      { id: "e3", type: "x", sourcePlayerId: "A", targets: ["C"], expiresAt: now + 100 },
      { id: "e4", type: "x", sourcePlayerId: "A", targets: "others", expiresAt: now - 1 },
    ];

    const forA = deriveActiveEffects({ effects, myPlayerId: "A", now }).map((e) => e.id);
    expect(forA).toEqual([]);

    const forB = deriveActiveEffects({ effects, myPlayerId: "B", now }).map((e) => e.id).sort();
    expect(forB).toEqual(["e1", "e2"]);

    const forC = deriveActiveEffects({ effects, myPlayerId: "C", now }).map((e) => e.id).sort();
    expect(forC).toEqual(["e1", "e3"]);
  });
});

