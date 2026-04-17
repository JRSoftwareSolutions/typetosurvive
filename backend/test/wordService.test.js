import { describe, expect, it, vi } from "vitest";
import {
  allocateBucketCounts,
  allocateFeasibleTierCounts,
  BALANCED_POOL_CATEGORY_COUNT,
  buildBalancedPool,
  buildSessionWordSequence,
  DEFAULT_SESSION_TIER_RATIOS,
  DEFAULT_WORD_SEQUENCE_POOL_PASSES,
  wordTierIndex,
} from "../src/services/wordService.js";

function countTiers(words) {
  const c = [0, 0, 0];
  for (const w of words) {
    const t = wordTierIndex(w);
    if (t >= 0) c[t] += 1;
  }
  return c;
}

describe("buildBalancedPool", () => {
  it("never returns duplicate strings", () => {
    const pool = [
      "cat", "dog", "bat", "rat", "fox", "owl", "ant",
      "happy", "quick", "brown", "jumps", "zebra", "eagle", "tiger",
      "strength", "mountains", "keyboard", "darkness", "sunlight", "whispered",
    ];
    const categories = Array.from({ length: BALANCED_POOL_CATEGORY_COUNT }, () => [...pool, ...pool]);
    const out = buildBalancedPool(categories, DEFAULT_SESSION_TIER_RATIOS);
    expect(new Set(out).size).toBe(out.length);
  });

  it("returns empty array when every category is empty", () => {
    expect(buildBalancedPool([[], [], [], [], []])).toEqual([]);
  });

  it("ignores empty categories when taking equal slice from survivors", () => {
    const a = ["cat", "dog", "run"];
    const b = ["bat", "owl", "ant"];
    const out = buildBalancedPool([[], a, b, [], []]);
    expect(new Set(out).size).toBeLessThanOrEqual(6);
    expect(out.every((w) => /^[a-z]{3,10}$/.test(w))).toBe(true);
  });

  it("uses Stage A only when length ratios cannot be met (all short words)", () => {
    const easyOnly = ["cat", "dog", "bat", "rat", "fox", "owl", "ant"];
    const categories = Array.from({ length: BALANCED_POOL_CATEGORY_COUNT }, () => [...easyOnly]);
    const out = buildBalancedPool(categories);
    expect(out.length).toBe(easyOnly.length);
    for (const w of out) {
      expect(w.length).toBeGreaterThanOrEqual(3);
      expect(w.length).toBeLessThanOrEqual(5);
    }
  });

  it("water-fills to target total T when buckets have enough inventory", () => {
    const pool = [
      "cat", "dog", "bat", "rat", "fox", "owl", "ant",
      "happy", "quick", "brown", "jumps", "zebra", "eagle", "tiger",
      "banana", "silver", "bronze", "copper", "gopher", "public", "random", "object",
      "orchard", "quartz", "masonry", "absolve",
      "strength", "mountains", "keyboard", "darkness", "sunlight", "whispered",
    ];
    const categories = Array.from({ length: BALANCED_POOL_CATEGORY_COUNT }, () => [...pool]);
    const out = buildBalancedPool(categories, DEFAULT_SESSION_TIER_RATIOS);
    const c = countTiers(pool);
    const T = Math.min(
      ...DEFAULT_SESSION_TIER_RATIOS.map((r, i) => (r > 0 ? Math.floor(c[i] / r) : Infinity)),
    );
    expect(out.length).toBe(T);
    const want = allocateBucketCounts(T, DEFAULT_SESSION_TIER_RATIOS);
    const got = countTiers(out);
    expect(got).toEqual(want);
  });

  it("keeps words unique while mixing short and long category lists", () => {
    const long = ["strength", "mountains", "keyboard", "darkness"];
    const short = ["cat", "dog"];
    const out = buildBalancedPool([long, short, long, long, long]);
    expect(new Set(out).size).toBe(out.length);
    expect(out.some((w) => short.includes(w))).toBe(true);
  });

  it("is deterministic in pool size when Math.random is fixed", () => {
    const pool = [
      "cat", "dog", "bat", "rat", "fox", "owl", "ant",
      "happy", "quick", "brown", "jumps", "zebra", "eagle", "tiger",
      "strength", "mountains", "keyboard", "darkness", "sunlight", "whispered",
    ];
    const categories = Array.from({ length: BALANCED_POOL_CATEGORY_COUNT }, () => [...pool]);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const a = buildBalancedPool(categories);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const b = buildBalancedPool(categories);
    expect(a.length).toBe(b.length);
    vi.restoreAllMocks();
  });
});

describe("buildSessionWordSequence", () => {
  it("uses each word once and matches feasible tier allocation", () => {
    const easy = ["ant", "bat", "cat", "dog", "eel", "fox", "hogs", "kits", "lambs", "moose"];
    const medium = ["banana", "silver", "bronze", "copper", "gopher", "public", "random", "object", "orchard", "quartz"];
    const hard = [
      "keyboard",
      "darkness",
      "mountain",
      "strength",
      "sunlight",
      "whispered",
      "adventure",
      "executable",
      "programmer",
      "typescript",
    ];
    const pool = [...easy, ...medium, ...hard];
    expect(pool.length).toBe(30);
    expect(new Set(pool).size).toBe(30);

    const sizes = [easy.length, medium.length, hard.length];
    const want = allocateFeasibleTierCounts(30, DEFAULT_SESSION_TIER_RATIOS, sizes);
    const seq = buildSessionWordSequence(pool, DEFAULT_SESSION_TIER_RATIOS);
    expect(seq.length).toBe(30);
    expect(new Set(seq).size).toBe(30);
    expect(countTiers(seq)).toEqual(want);
  });

  it("permutes the full pool so tier histogram matches the pool", () => {
    const easy = Array.from({ length: 90 }, (_, i) => {
      const a = String.fromCharCode(97 + (i % 26));
      const b = String.fromCharCode(97 + (((i / 26) | 0) % 26));
      const c = String.fromCharCode(97 + (((i / 676) | 0) % 26));
      return `${a}${b}${c}`;
    });
    const medium = Array.from({ length: 60 }, (_, i) => {
      const a = String.fromCharCode(97 + (i % 26));
      const b = String.fromCharCode(97 + (((i / 26) | 0) % 26));
      const c = String.fromCharCode(97 + (((i / 676) | 0) % 26));
      const d = String.fromCharCode(97 + (((i / 17576) | 0) % 26));
      return `${a}${b}${c}${d}mm`;
    });
    const hard = Array.from({ length: 40 }, (_, i) => {
      const a = String.fromCharCode(97 + (i % 26));
      const b = String.fromCharCode(97 + (((i / 26) | 0) % 26));
      const c = String.fromCharCode(97 + (((i / 676) | 0) % 26));
      const d = String.fromCharCode(97 + (((i / 17576) | 0) % 26));
      const e = String.fromCharCode(97 + (((i / 456976) | 0) % 26));
      return `${a}${b}${c}${d}${e}hard`;
    });
    const pool = [...new Set([...easy, ...medium, ...hard])];

    const seq = buildSessionWordSequence(pool, DEFAULT_SESSION_TIER_RATIOS);
    expect(seq.length).toBe(pool.length);
    expect(new Set(seq).size).toBe(seq.length);
    expect(countTiers(seq)).toEqual(countTiers(pool));
  });

  it("concatenates multiple full pool passes for a longer sequence", () => {
    expect(DEFAULT_WORD_SEQUENCE_POOL_PASSES).toBeGreaterThanOrEqual(2);
    const easy = ["ant", "bat", "cat", "dog", "eel"];
    const medium = ["banana", "silver", "bronze"];
    const hard = ["keyboard", "darkness"];
    const pool = [...easy, ...medium, ...hard];
    const seq = buildSessionWordSequence(pool, DEFAULT_SESSION_TIER_RATIOS, DEFAULT_WORD_SEQUENCE_POOL_PASSES);
    expect(seq.length).toBe(pool.length * DEFAULT_WORD_SEQUENCE_POOL_PASSES);
    const freq = new Map();
    for (const w of seq) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    for (const w of pool) {
      expect(freq.get(w)).toBe(DEFAULT_WORD_SEQUENCE_POOL_PASSES);
    }
  });
});
