const FALLBACK_WORDS = [
  "cat", "dog", "run", "fly", "sun", "red", "big", "fast", "jump", "blue",
  "fox", "box", "key", "map", "cup", "hat", "pen", "car", "bus", "sky",
  "typing", "health", "survive", "danger", "battle", "power", "storm", "light",
  "river", "ocean", "cloud", "thunder", "magic", "spell", "javascript",
  "adventure", "computer", "keyboard", "lightning", "mountain", "notebook",
  "waterfall", "serendipity", "labyrinth",
];

const DATAMUSE_WORDS_ORIGIN = "https://api.datamuse.com/words";

/** buildBalancedPool tests use five parallel category decks. */
export const BALANCED_POOL_CATEGORY_COUNT = 5;

const FETCH_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10];

/** Datamuse allows large `max`; more words per length → longer room sequences. */
const DATAMUSE_MAX_PER_LENGTH = 1000;

/**
 * Concatenate this many full shuffles of the pool into one room `wordSequence`
 * (each pass uses every pool word once, re-shuffled; words can repeat across passes).
 */
export const DEFAULT_WORD_SEQUENCE_POOL_PASSES = 2;

function datamuseWordsUrl(length, maxWords = DATAMUSE_MAX_PER_LENGTH) {
  const u = new URL(DATAMUSE_WORDS_ORIGIN);
  u.searchParams.set("sp", "?".repeat(length));
  u.searchParams.set("max", String(maxWords));
  return u.toString();
}

const FETCH_TIMEOUT_MS = 4000;

/**
 * Target easy / medium / hard mix (must sum to 1). Medium highest, easy second, hard lowest.
 * Used by buildBalancedPool (pool shaping) and buildSessionWordSequence (per-room order).
 */
export const DEFAULT_SESSION_TIER_RATIOS = [0.28, 0.48, 0.24];

/** @deprecated Prefer DEFAULT_SESSION_TIER_RATIOS; kept for buildBalancedPool default arg. */
export const DEFAULT_LENGTH_RATIOS = DEFAULT_SESSION_TIER_RATIOS;

/** Easy 3–5, medium 6–7, hard 8–10 (exclusive bands). */
export function wordTierIndex(word) {
  const n = word.length;
  if (n >= 3 && n <= 5) return 0;
  if (n >= 6 && n <= 7) return 1;
  if (n >= 8 && n <= 10) return 2;
  return -1;
}

/** If water-fill yields T === 0, keep Stage A (deduped equal-rounds union) instead of forcing ratios. */
// Tie-break: length balance is skipped when no positive T fits the target ratios given bucket inventory.

let cache = uniqueWords(FALLBACK_WORDS);
let lastFetched = 0;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeWord(raw) {
  if (typeof raw === "string") return raw.trim().toLowerCase();
  if (raw && typeof raw.word === "string") return raw.word.trim().toLowerCase();
  return "";
}

function filterWord(word) {
  return word.length >= 3 && word.length <= 10 && /^[a-z]+$/.test(word);
}

function uniqueWords(words) {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function parseApiWords(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const item of data) {
    const w = normalizeWord(item);
    if (filterWord(w)) out.push(w);
  }
  return uniqueWords(out);
}

function sampleWithoutReplacement(words, n) {
  if (n <= 0) return [];
  const copy = [...words];
  shuffleInPlace(copy);
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Greedily grow a global set: each completed round takes one new word
 * from every non-empty category (fair mix). Stops when any category cannot
 * supply a word not already chosen.
 */
function buildStageAEqualRounds(categoryWordArrays) {
  const decks = categoryWordArrays
    .map((arr) => {
      const u = uniqueWords(arr);
      shuffleInPlace(u);
      return u;
    })
    .filter((d) => d.length > 0);
  if (decks.length === 0) return [];

  const idx = decks.map(() => 0);
  const seen = new Set();
  const out = [];

  while (true) {
    const round = [];
    const idxTry = [...idx];
    let failed = false;
    for (let c = 0; c < decks.length; c += 1) {
      let w = null;
      while (idxTry[c] < decks[c].length) {
        const candidate = decks[c][idxTry[c]];
        idxTry[c] += 1;
        if (!seen.has(candidate)) {
          w = candidate;
          break;
        }
      }
      if (w === null) {
        failed = true;
        break;
      }
      round.push(w);
    }
    if (failed) return out;
    for (let c = 0; c < decks.length; c += 1) {
      idx[c] = idxTry[c];
    }
    for (const w of round) {
      seen.add(w);
      out.push(w);
    }
  }
}

function bucketWordsByLength(words) {
  const easy = [];
  const medium = [];
  const hard = [];
  for (const w of words) {
    const t = wordTierIndex(w);
    if (t === 0) easy.push(w);
    else if (t === 1) medium.push(w);
    else if (t === 2) hard.push(w);
  }
  return [easy, medium, hard];
}

/**
 * Largest remainder allocation so bucket counts sum to T and stay near ratios * T.
 */
export function allocateBucketCounts(T, ratios) {
  const raw = ratios.map((r) => r * T);
  const counts = raw.map((x) => Math.floor(x));
  let remainder = T - counts.reduce((a, b) => a + b, 0);
  const order = [...ratios.keys()].sort(
    (a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])),
  );
  for (let k = 0; k < remainder; k += 1) {
    counts[order[k]] += 1;
  }
  return counts;
}

/**
 * Stage A: equal rounds across categories, each word globally unique (max union under fair mix).
 * Stage B: length water-fill + sampling; if T === 0, return Stage A union only.
 * Final pool is always strictly unique (no repeats).
 */
export function buildBalancedPool(categoryWordArrays, ratios = DEFAULT_LENGTH_RATIOS) {
  const stageA = uniqueWords(buildStageAEqualRounds(categoryWordArrays));
  if (stageA.length === 0) return [];

  const buckets = bucketWordsByLength(stageA);
  const counts = buckets.map((b) => b.length);
  const T = Math.min(...ratios.map((r, i) => (r > 0 ? Math.floor(counts[i] / r) : Infinity)));
  if (!Number.isFinite(T) || T <= 0) {
    shuffleInPlace(stageA);
    return stageA;
  }

  const want = allocateBucketCounts(T, ratios);
  const picked = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const need = want[i];
    if (need > counts[i]) {
      shuffleInPlace(stageA);
      return stageA;
    }
    picked.push(...sampleWithoutReplacement(buckets[i], need));
  }
  shuffleInPlace(picked);
  return uniqueWords(picked);
}

async function fetchCategoryWords(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    return parseApiWords(data);
  } catch {
    return [];
  }
}

/**
 * After clipping ideal tier targets to inventory, distribute remaining slots so the
 * sequence uses every word in the pool exactly once when inventory matches pool size.
 */
export function allocateFeasibleTierCounts(n, ratios, bucketSizes) {
  let want = allocateBucketCounts(n, ratios);
  for (let i = 0; i < 3; i += 1) {
    want[i] = Math.min(want[i], bucketSizes[i]);
  }
  let sum = want.reduce((a, b) => a + b, 0);
  let deficit = n - sum;
  while (deficit > 0) {
    let best = -1;
    let bestSlack = -Infinity;
    for (let i = 0; i < 3; i += 1) {
      if (want[i] >= bucketSizes[i]) continue;
      const slack = ratios[i] - want[i] / Math.max(n, 1);
      if (slack > bestSlack) {
        bestSlack = slack;
        best = i;
      }
    }
    if (best < 0) break;
    want[best] += 1;
    deficit -= 1;
  }
  return want;
}

/**
 * Room `wordSequence`: `poolPasses` concatenated permutations of the full pool,
 * each permutation tier-balanced then globally shuffled.
 */
export function buildSessionWordSequence(
  pool,
  ratios = DEFAULT_SESSION_TIER_RATIOS,
  poolPasses = 1,
) {
  const words = uniqueWords(pool.filter((w) => wordTierIndex(w) >= 0));
  if (words.length === 0) return [];

  const passes = Math.max(1, Math.floor(poolPasses));
  const out = [];
  for (let p = 0; p < passes; p += 1) {
    const buckets = bucketWordsByLength(words);
    const sizes = buckets.map((b) => b.length);
    const want = allocateFeasibleTierCounts(words.length, ratios, sizes);

    const picked = [];
    for (let i = 0; i < 3; i += 1) {
      picked.push(...sampleWithoutReplacement(buckets[i], want[i]));
    }
    shuffleInPlace(picked);
    out.push(...picked);
  }
  return out;
}

export async function getWordPool() {
  const now = Date.now();
  if (now - lastFetched < 5 * 60 * 1000) return cache;

  try {
    const perLength = await Promise.all(
      FETCH_LENGTHS.map((len) => fetchCategoryWords(datamuseWordsUrl(len))),
    );
    const merged = uniqueWords(perLength.flat());
    cache = merged.length ? merged : uniqueWords(FALLBACK_WORDS);
    lastFetched = now;
    return cache;
  } catch {
    cache = uniqueWords(FALLBACK_WORDS);
    lastFetched = now;
    return cache;
  }
}

export async function getGeneratedSequence() {
  const pool = await getWordPool();
  return buildSessionWordSequence(pool, DEFAULT_SESSION_TIER_RATIOS, DEFAULT_WORD_SEQUENCE_POOL_PASSES);
}
