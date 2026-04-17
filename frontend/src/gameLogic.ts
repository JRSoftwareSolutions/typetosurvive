import {
  FLOW_DURATION_MAX_MS,
  FLOW_DURATION_MIN_MS,
  FLOW_ELASTIC_DT_REFERENCE_MS,
  FLOW_ELASTIC_PULL_MULT,
  FLOW_ELASTIC_PULL_POW,
  FLOW_GAUGE_ACTIVATE_AT,
  FLOW_GAUGE_FILL_BASE,
  FLOW_GAUGE_FILL_DIMINISH_POW,
  FLOW_GAUGE_LENGTH_MULT_MAX,
  FLOW_GAUGE_LENGTH_MULT_MIN,
  FLOW_GAUGE_LENGTH_REF_CHARS,
  FLOW_GAUGE_MAX,
} from "./constants";
import { lerp } from "./utils/math";

export type FlowGaugeFillOpts = {
  maxGauge?: number;
  baseFill?: number;
  diminishPow?: number;
  /** Completed word length; longer words add more gauge. Defaults to ref length (multiplier 1). */
  wordLength?: number;
  lengthRefChars?: number;
  lengthMultMin?: number;
  lengthMultMax?: number;
};

/** Add gauge after a word completed with no typos on that word (diminishing as gauge rises). */
export function flowGaugeFillOnPerfectWord(
  currentGauge: number,
  opts: FlowGaugeFillOpts = {},
): number {
  const max = opts.maxGauge ?? FLOW_GAUGE_MAX;
  const baseFill = opts.baseFill ?? FLOW_GAUGE_FILL_BASE;
  const diminishPow = opts.diminishPow ?? FLOW_GAUGE_FILL_DIMINISH_POW;
  const refChars = opts.lengthRefChars ?? FLOW_GAUGE_LENGTH_REF_CHARS;
  const multMin = opts.lengthMultMin ?? FLOW_GAUGE_LENGTH_MULT_MIN;
  const multMax = opts.lengthMultMax ?? FLOW_GAUGE_LENGTH_MULT_MAX;
  const g = Math.max(0, Math.min(max, Number(currentGauge) || 0));
  const diminishing = Math.pow(g / max, diminishPow);
  const wlRaw =
    opts.wordLength != null && Number.isFinite(Number(opts.wordLength))
      ? Number(opts.wordLength)
      : refChars;
  const safeLen = Math.max(1, wlRaw);
  const lengthMult = Math.min(multMax, Math.max(multMin, safeLen / refChars));
  return Math.min(max, g + baseFill * (1 - diminishing) * lengthMult);
}

export type FlowGaugeElasticOpts = {
  maxGauge?: number;
  mult?: number;
  pow?: number;
  dtReferenceMs?: number;
};

/** Elastic drift toward zero over time (stronger pull at higher gauge). */
export function flowGaugeElasticStep(
  currentGauge: number,
  dtMs: number,
  opts: FlowGaugeElasticOpts = {},
): number {
  const max = opts.maxGauge ?? FLOW_GAUGE_MAX;
  const mult = opts.mult ?? FLOW_ELASTIC_PULL_MULT;
  const pow = opts.pow ?? FLOW_ELASTIC_PULL_POW;
  const ref = opts.dtReferenceMs ?? FLOW_ELASTIC_DT_REFERENCE_MS;
  const g = Math.max(0, Math.min(max, Number(currentGauge) || 0));
  if (g <= 0) return 0;
  const scale = Math.max(0, Number(dtMs) || 0) / ref;
  const pullBack = mult * Math.pow(g / max, pow) * scale;
  return Math.max(0, g - pullBack);
}

/** Duration (ms) when activating Flow from `gauge` (0..max), only meaningful from activate threshold upward. */
export function flowDurationMsAtActivation(
  gaugeAtActivation: number,
  opts: { maxGauge?: number; minMs?: number; maxMs?: number; activateAt?: number } = {},
): number {
  const max = opts.maxGauge ?? FLOW_GAUGE_MAX;
  const minMs = opts.minMs ?? FLOW_DURATION_MIN_MS;
  const maxMs = opts.maxMs ?? FLOW_DURATION_MAX_MS;
  const activateAt = opts.activateAt ?? FLOW_GAUGE_ACTIVATE_AT;
  const g = Math.max(0, Math.min(max, Number(gaugeAtActivation) || 0));
  const low = max * activateAt;
  if (g < low) return minMs;
  const t = Math.min(1, Math.max(0, (g - low) / (max - low)));
  return Math.floor(lerp(minMs, maxMs, t));
}

export type EffectDto = {
  expiresAt?: number;
  targets?: "others" | string[] | unknown;
  sourcePlayerId?: string;
};

export type DeriveActiveEffectsArgs = {
  effects: unknown;
  myPlayerId: string | null;
  now: number;
};

export function deriveActiveEffects({ effects, myPlayerId, now }: DeriveActiveEffectsArgs) {
  const list = Array.isArray(effects) ? (effects as EffectDto[]) : [];
  const myId = myPlayerId;
  const t = typeof now === "number" ? now : Date.now();

  return list.filter((e) => {
    if (!e || typeof e.expiresAt !== "number" || e.expiresAt <= t) return false;
    if (e.targets === "others") return e.sourcePlayerId !== myId;
    if (Array.isArray(e.targets)) return myId != null && (e.targets as string[]).includes(myId);
    return false;
  });
}
