export const FLOW_GAUGE_MAX = 100;
export const FLOW_GAUGE_ACTIVATE_AT = 0.5;

/** Per clean word: base fill before diminishing curve (tuned so ~4+ clean words reach 50%). */
export const FLOW_GAUGE_FILL_BASE = 15;
/** Exponent on (gauge/max) for diminishing returns on fill. */
export const FLOW_GAUGE_FILL_DIMINISH_POW = 1.78;

/** Elastic pullback: subtract `mult * (gauge/max)^pow * (dtMs / elasticDtReferenceMs)` per drain tick. */
export const FLOW_ELASTIC_PULL_MULT = 0.6;
export const FLOW_ELASTIC_PULL_POW = 2.2;
/** Normalize elastic step so values match the design when drain runs at ~85ms. */
export const FLOW_ELASTIC_DT_REFERENCE_MS = 85;

export const FLOW_TYPO_GAUGE_MULT = 0.65;
export const FLOW_HEALTH_MULT_WHILE_ACTIVE = 0.82;

/** Flow duration at 50% gauge (ms). */
export const FLOW_DURATION_MIN_MS = 6800;
/** Flow duration at 100% gauge (ms). */
export const FLOW_DURATION_MAX_MS = 14_000;

export const DEV_BOT_CHAR_MS = 500;
export const DEV_BOT_WORD_PAUSE_MS = 500;
export const DEV_BOT_JITTER_MS = 85;
