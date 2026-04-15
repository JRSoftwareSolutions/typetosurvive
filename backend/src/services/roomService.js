const rooms = new Map();
const roomSubscribers = new Map();
const roomTickers = new Map();

const EFFECT_BURST_WINDOW_MS = 5000;
const EFFECT_BURST_COUNT = 3;
const EFFECT_DURATION_MS = 11000;
const EFFECT_COOLDOWN_MS = 9000;
const DECOY_LENGTH = 7;

function randomId(prefix = "p") {
  return `${prefix}_${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateDecoyWord(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < length; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function completeDecoyTyped(room, playerId, effectId) {
  if (!room?.effects?.length) return;
  const idx = room.effects.findIndex((e) => e?.id === effectId && e.type === "decoyWord");
  if (idx === -1) return;
  const e = room.effects[idx];
  const words = e.payload?.wordsByPlayerId || {};
  const completed = e.payload?.completedBy || {};
  if (!words[playerId] || completed[playerId]) return;
  e.payload = {
    ...e.payload,
    completedBy: { ...completed, [playerId]: true },
  };
  const victimIds = Object.keys(words);
  const allDone = victimIds.length > 0 && victimIds.every((id) => e.payload.completedBy[id]);
  if (allDone) {
    room.effects = room.effects.filter((_, i) => i !== idx);
  }
}

function pruneExpiredEffects(room, now = Date.now()) {
  if (!room?.effects?.length) return;
  room.effects = room.effects.filter((e) => typeof e?.expiresAt === "number" && e.expiresAt > now);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function emitRoomUpdate(roomCode) {
  const listeners = roomSubscribers.get(roomCode) ?? [];
  const room = rooms.get(roomCode);
  pruneExpiredEffects(room);
  const payload = JSON.stringify(room ?? null);
  listeners.forEach((res) => {
    res.write(`data: ${payload}\n\n`);
  });
}

function stopRoomTicker(roomCode) {
  const ticker = roomTickers.get(roomCode);
  if (!ticker) return;
  clearInterval(ticker.intervalId);
  roomTickers.delete(roomCode);
}

function ensureRoomTicker(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.started) return;
  if (roomTickers.has(roomCode)) return;

  const tickMs = 250;
  roomTickers.set(roomCode, {
    intervalId: setInterval(() => tickRoom(roomCode), tickMs),
  });
}

function tickRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.started) return;

  const now = Date.now();
  const startedAt = room.startedAt ?? now;
  const lastTickAt = room.lastTickAt ?? now;
  const dtMs = Math.max(0, now - lastTickAt);

  room.startedAt = startedAt;
  room.lastTickAt = now;
  room.elapsedSeconds = Math.floor((now - startedAt) / 1000);

  const threat = Math.min(15, Math.floor(room.elapsedSeconds / 22));
  const drainPer85ms = 0.92 + threat * 0.24;
  const drainPerMs = drainPer85ms / 85;
  const drainAmount = drainPerMs * dtMs;

  Object.keys(room.players).forEach((playerId) => {
    const p = room.players[playerId];
    if (!p) return;
    const currentHealth = typeof p.health === "number" ? p.health : 100;
    const nextHealth = Math.max(0, currentHealth - drainAmount);
    p.health = nextHealth;
    if (nextHealth <= 0) {
      p.deadAt = p.deadAt ?? now;
    }
  });

  emitRoomUpdate(roomCode);
}

export function subscribeRoom(roomCode, res) {
  if (!roomSubscribers.has(roomCode)) {
    roomSubscribers.set(roomCode, []);
  }
  roomSubscribers.get(roomCode).push(res);
  emitRoomUpdate(roomCode);
}

export function unsubscribeRoom(roomCode, res) {
  const listeners = roomSubscribers.get(roomCode);
  if (!listeners) return;
  roomSubscribers.set(
    roomCode,
    listeners.filter((listener) => listener !== res),
  );
}

export function getRoom(roomCode) {
  return rooms.get(roomCode) ?? null;
}

export function createRoom({ username, wordSequence }) {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) roomCode = generateRoomCode();

  const playerId = randomId("p");
  rooms.set(roomCode, {
    roomCode,
    started: false,
    createdAt: Date.now(),
    creatorId: playerId,
    wordSequence,
    startedAt: null,
    lastTickAt: null,
    elapsedSeconds: 0,
    effects: [],
    players: {
      [playerId]: {
        username,
        health: 100,
        score: 0,
        currentIndex: 0,
        recentSuccesses: [],
        nextEffectAllowedAt: 0,
      },
    },
  });

  emitRoomUpdate(roomCode);
  return { roomCode, playerId };
}

export function joinRoom({ roomCode, username, playerId }) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const existingPlayerIdById = playerId && room.players[playerId] ? playerId : null;
  const existingPlayerIdByName = Object.keys(room.players).find(
    (id) => room.players[id].username.toLowerCase() === username.toLowerCase(),
  );
  const resolvedPlayerId = existingPlayerIdById ?? existingPlayerIdByName ?? randomId("p");

  room.players[resolvedPlayerId] = {
    username,
    health: 100,
    score: 0,
    currentIndex: 0,
    recentSuccesses: [],
    nextEffectAllowedAt: 0,
  };

  emitRoomUpdate(roomCode);
  return { room, playerId: resolvedPlayerId };
}

export function startRoom({ roomCode, playerId }) {
  const room = rooms.get(roomCode);
  if (!room || room.creatorId !== playerId) return false;
  room.started = true;
  room.startedAt = room.startedAt ?? Date.now();
  room.lastTickAt = Date.now();
  emitRoomUpdate(roomCode);
  ensureRoomTicker(roomCode);
  return true;
}

export function updatePlayer({ roomCode, playerId, patch }) {
  const room = rooms.get(roomCode);
  if (!room?.players?.[playerId]) return null;
  const prev = room.players[playerId];

  if (typeof patch?.decoyTypedEffectId === "string") {
    completeDecoyTyped(room, playerId, patch.decoyTypedEffectId);
  }

  const { decoyTypedEffectId: _decoyTyped, ...playerPatch } = patch || {};
  const next = {
    ...prev,
    ...playerPatch,
  };

  const now = Date.now();
  if (typeof playerPatch?.lastSuccess === "number") {
    const prevRecent = Array.isArray(prev.recentSuccesses) ? prev.recentSuccesses : [];
    const recent = [...prevRecent, playerPatch.lastSuccess].filter((t) => now - t <= EFFECT_BURST_WINDOW_MS);
    next.recentSuccesses = recent;

    const cooldownUntil = typeof prev.nextEffectAllowedAt === "number" ? prev.nextEffectAllowedAt : 0;
    const victimIds = Object.keys(room.players).filter((id) => id !== playerId);
    if (recent.length >= EFFECT_BURST_COUNT && now >= cooldownUntil && victimIds.length > 0) {
      const wordsByPlayerId = {};
      victimIds.forEach((vid) => {
        wordsByPlayerId[vid] = generateDecoyWord(DECOY_LENGTH);
      });
      const effect = {
        id: randomId("fx"),
        type: "decoyWord",
        sourcePlayerId: playerId,
        targets: "others",
        createdAt: now,
        expiresAt: now + EFFECT_DURATION_MS,
        payload: {
          wordsByPlayerId,
          completedBy: {},
        },
      };
      room.effects = Array.isArray(room.effects) ? room.effects : [];
      room.effects.push(effect);
      next.nextEffectAllowedAt = now + EFFECT_COOLDOWN_MS;
    } else {
      next.nextEffectAllowedAt = cooldownUntil;
    }
  }

  room.players[playerId] = next;
  emitRoomUpdate(roomCode);
  return room.players[playerId];
}

export function leaveRoom({ roomCode, playerId }) {
  const room = rooms.get(roomCode);
  if (!room?.players?.[playerId]) return false;

  delete room.players[playerId];
  if (Object.keys(room.players).length === 0) {
    stopRoomTicker(roomCode);
    rooms.delete(roomCode);
    emitRoomUpdate(roomCode);
    return true;
  }

  if (room.creatorId === playerId) {
    room.creatorId = Object.keys(room.players)[0];
  }

  emitRoomUpdate(roomCode);
  return true;
}
