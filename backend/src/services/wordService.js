const FALLBACK_WORDS = [
  "cat", "dog", "run", "fly", "sun", "red", "big", "fast", "jump", "blue",
  "fox", "box", "key", "map", "cup", "hat", "pen", "car", "bus", "sky",
  "typing", "health", "survive", "danger", "battle", "power", "storm", "light",
  "river", "ocean", "cloud", "thunder", "magic", "spell", "javascript",
  "adventure", "computer", "keyboard", "lightning", "mountain", "notebook",
  "waterfall", "serendipity", "labyrinth",
];

let cache = [...FALLBACK_WORDS];
let lastFetched = 0;

function createSharedWordSequence(wordPool) {
  const seq = [];
  let virtualTime = 0;

  for (let i = 0; i < wordPool.length - 1; i += 1) {
    virtualTime += 25;
    const minLen = Math.max(3, 4 + Math.floor((virtualTime / 60) * 1.3));
    const maxLen = Math.min(18, minLen + 9 + Math.floor(virtualTime / 120));
    let candidates = wordPool.filter((w) => w.length >= minLen && w.length <= maxLen);
    if (candidates.length < 5) candidates = wordPool;

    let word = candidates[Math.floor(Math.random() * candidates.length)];
    while (seq.length && word === seq[seq.length - 1]) {
      word = candidates[Math.floor(Math.random() * candidates.length)];
    }
    seq.push(word);
  }
  return seq;
}

export async function getWordPool() {
  const now = Date.now();
  if (now - lastFetched < 5 * 60 * 1000) return cache;

  const timeoutMs = 4000;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("word API timeout")), timeoutMs);
  });

  try {
    const fetchPromise = fetch("https://random-words-api.kushcreates.com/api")
      .then((res) => res.json());
    const data = await Promise.race([fetchPromise, timeout]);
    const words = data
      .map((item) => item.word.toLowerCase())
      .filter((word) => word.length >= 3 && word.length <= 10 && /^[a-z]+$/.test(word));

    cache = words.length ? words : [...FALLBACK_WORDS];
    lastFetched = now;
    return cache;
  } catch {
    cache = [...FALLBACK_WORDS];
    lastFetched = now;
    return cache;
  }
}

export async function getGeneratedSequence() {
  const pool = await getWordPool();
  return createSharedWordSequence(pool);
}
