import { describe, expect, it } from "vitest";
import {
  deriveActiveEffects,
  flowDurationMsAtActivation,
  flowGaugeElasticStep,
  flowGaugeFillOnPerfectWord,
} from "../src/gameLogic.ts";
import {
  FLOW_DURATION_MAX_MS,
  FLOW_DURATION_MIN_MS,
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_MAX,
} from "../src/constants.ts";

describe("gameLogic", () => {
  it("flowGaugeFillOnPerfectWord increases gauge and diminishes at high gauge", () => {
    const low = flowGaugeFillOnPerfectWord(0, { maxGauge: 100, baseFill: 24, diminishPow: 1.7 });
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThanOrEqual(100);
    const high = flowGaugeFillOnPerfectWord(90, { maxGauge: 100, baseFill: 24, diminishPow: 1.7 });
    const mid = flowGaugeFillOnPerfectWord(45, { maxGauge: 100, baseFill: 24, diminishPow: 1.7 });
    expect(high - 90).toBeLessThan(mid - 45);
  });

  it("flowGaugeFillOnPerfectWord scales fill by word length", () => {
    const baseOpts = {
      maxGauge: 100,
      baseFill: 20,
      diminishPow: 1.7,
      lengthRefChars: 10,
      lengthMultMin: 0.5,
      lengthMultMax: 2,
    };
    const atRef = flowGaugeFillOnPerfectWord(0, { ...baseOpts, wordLength: 10 });
    const doubleLen = flowGaugeFillOnPerfectWord(0, { ...baseOpts, wordLength: 20 });
    expect(doubleLen).toBeGreaterThan(atRef);
    expect(doubleLen - 0).toBeCloseTo((atRef - 0) * 2, 5);
  });

  it("flowGaugeElasticStep pulls down more at higher gauge and scales with dt", () => {
    const g50 = flowGaugeElasticStep(50, 85, {});
    const g50half = flowGaugeElasticStep(50, 42.5, {});
    expect(g50).toBeLessThan(50);
    expect(g50half).toBeLessThan(50);
    expect(50 - g50half).toBeLessThan(50 - g50);
    const from100 = flowGaugeElasticStep(100, 85, {});
    const from30 = flowGaugeElasticStep(30, 85, {});
    expect(100 - from100).toBeGreaterThan(30 - from30);
  });

  it("flowDurationMsAtActivation maps threshold to min and full gauge to max", () => {
    const atHalf = flowDurationMsAtActivation(FLOW_GAUGE_MAX * FLOW_GAUGE_ACTIVATE_AT, {
      maxGauge: FLOW_GAUGE_MAX,
      minMs: FLOW_DURATION_MIN_MS,
      maxMs: FLOW_DURATION_MAX_MS,
      activateAt: FLOW_GAUGE_ACTIVATE_AT,
    });
    expect(atHalf).toBe(FLOW_DURATION_MIN_MS);
    const atFull = flowDurationMsAtActivation(FLOW_GAUGE_MAX, {
      maxGauge: FLOW_GAUGE_MAX,
      minMs: FLOW_DURATION_MIN_MS,
      maxMs: FLOW_DURATION_MAX_MS,
      activateAt: FLOW_GAUGE_ACTIVATE_AT,
    });
    expect(atFull).toBe(FLOW_DURATION_MAX_MS);
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

    const forB = deriveActiveEffects({ effects, myPlayerId: "B", now })
      .map((e) => e.id)
      .sort();
    expect(forB).toEqual(["e1", "e2"]);

    const forC = deriveActiveEffects({ effects, myPlayerId: "C", now })
      .map((e) => e.id)
      .sort();
    expect(forC).toEqual(["e1", "e3"]);
  });
});
