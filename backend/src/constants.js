/**
 * Shared gameplay constants (single source of truth for tuning knobs).
 *
 * DECOY_WORD (typing burst → "jammed" / decoy on next word):
 * Typing benchmarks: many sources cite ~40 WPM as a typical adult average
 * (e.g. Wikipedia "Words per minute", common industry roundups). At ~40 WPM,
 * finishing 3 short words in a row is often on the order of a few seconds when
 * focused, but real play includes pauses — so the burst window is set a bit
 * wider than a "perfect" 40 WPM chain to stay achievable occasionally, while
 * the long cooldown keeps the effect rare (roughly once or twice per typical
 * match length, not spammy).
 */
export const DECOY_WORD = {
  burstWindowMs: 5000,
  burstCount: 3,
  durationMs: 11000,
  cooldownMs: 55000,
  length: 5,
};
