const rooms = new Map();
const roomSubscribers = new Map();
const roomTickers = new Map();
/** @type {Map<string, number>} key: `${roomCode}|${playerId}` */
const playerSseRefCounts = new Map();
/** @type {WeakMap<import("http").ServerResponse, { roomCode: string, playerId: string }>} */
const sseRefsByRes = new WeakMap();

import { DECOY_WORD } from "../constants.js";

const FLOW_OBSCURE_TICK_MS = 350;
const FLOW_OBSCURE_MAX_TICKS = 80;

/** Rooms with no SSE listeners and no writes for this long are removed (API-only / crashed clients). */
const STALE_ROOM_MS = 5 * 60 * 1000;
const JANITOR_INTERVAL_MS = 60 * 1000;

function sseKey(roomCode, playerId) {
  return `${roomCode}|${playerId}`;
}

function touchRoomActivity(room) {
  if (room) room.lastActivityAt = Date.now();
}

function purgeRoomMaps(roomCode) {
  roomSubscribers.delete(roomCode);
  for (const key of [...playerSseRefCounts.keys()]) {
    if (key.startsWith(`${roomCode}|`)) playerSseRefCounts.delete(key);
  }
}

function sweepStaleRooms() {
  const now = Date.now();
  for (const [roomCode, room] of [...rooms.entries()]) {
    const listeners = roomSubscribers.get(roomCode);
    if (listeners?.length) continue;
    const last =
      typeof room.lastActivityAt === "number"
        ? room.lastActivityAt
        : typeof room.createdAt === "number"
          ? room.createdAt
          : now;
    if (now - last < STALE_ROOM_MS) continue;
    stopRoomTicker(roomCode);
    rooms.delete(roomCode);
    emitRoomUpdate(roomCode);
    purgeRoomMaps(roomCode);
  }
}

/**
 * Removes abandoned rooms periodically. Call once from the HTTP server process.
 * @param {{ intervalMs?: number }} [options]
 * @returns {() => void} stop function
 */
export function startRoomMaintenanceLoop(options = {}) {
  const intervalMs = typeof options.intervalMs === "number" ? options.intervalMs : JANITOR_INTERVAL_MS;
  const id = setInterval(() => sweepStaleRooms(), intervalMs);
  return () => clearInterval(id);
}

/** @internal Used by tests */
export function sweepStaleRoomsNow() {
  sweepStaleRooms();
}

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

function alivePlayerIds(room) {
  return Object.entries(room.players || {})
    .filter(([, p]) => {
      const hp = typeof p?.health === "number" ? p.health : 100;
      return hp > 0;
    })
    .map(([id]) => id);
}

function maybeEndMatchLastStanding(roomCode, room) {
  if (!room?.started || room.matchEnded) return;
  const ids = Object.keys(room.players || {});
  if (ids.length < 2) return;

  const alive = alivePlayerIds(room);
  if (alive.length === 1) {
    room.matchEnded = true;
    room.matchWinnerId = alive[0];
    stopRoomTicker(roomCode);
  } else if (alive.length === 0) {
    room.matchEnded = true;
    room.matchWinnerId = null;
    stopRoomTicker(roomCode);
  }
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

  Object.keys(room.players).forEach((playerId) => {
    const p = room.players[playerId];
    if (!p) return;
    const resetAt = typeof p.threatResetElapsedSeconds === "number" ? p.threatResetElapsedSeconds : 0;
    const effectiveElapsed = Math.max(0, room.elapsedSeconds - resetAt);
    const threat = Math.min(15, Math.floor(effectiveElapsed / 22));
    const drainPer85ms = 0.92 + threat * 0.24;
    const drainPerMs = drainPer85ms / 85;
    const drainAmount = drainPerMs * dtMs;
    const currentHealth = typeof p.health === "number" ? p.health : 100;
    const nextHealth = Math.max(0, currentHealth - drainAmount);
    p.health = nextHealth;
    if (!p.secondWindUsed) {
      if (nextHealth < 20 && typeof p.secondWindLowAt !== "number") {
        p.secondWindLowAt = now;
      } else if (typeof p.secondWindLowAt === "number" && now - p.secondWindLowAt > 2000) {
        p.secondWindLowAt = null;
      }
    }
    if (nextHealth <= 0) {
      p.deadAt = p.deadAt ?? now;
    }
  });

  if (Array.isArray(room.effects) && room.effects.length) {
    room.effects.forEach((e) => {
      if (!e || e.type !== "flowObscure") return;
      const payload = e.payload && typeof e.payload === "object" ? e.payload : {};
      const remaining = typeof payload.remainingTicks === "number" ? payload.remainingTicks : 0;
      if (remaining <= 0) {
        e.expiresAt = now - 1;
        return;
      }
      const last = typeof payload.lastTickAt === "number" ? payload.lastTickAt : e.createdAt ?? now;
      const diff = Math.max(0, now - last);
      const steps = Math.floor(diff / FLOW_OBSCURE_TICK_MS);
      if (steps <= 0) return;
      const nextRemaining = Math.max(0, remaining - steps);
      e.payload = {
        ...payload,
        remainingTicks: nextRemaining,
        lastTickAt: last + steps * FLOW_OBSCURE_TICK_MS,
      };
      e.expiresAt = now + nextRemaining * FLOW_OBSCURE_TICK_MS;
    });
  }

  maybeEndMatchLastStanding(roomCode, room);

  emitRoomUpdate(roomCode);
}

/**
 * @param {string} roomCode
 * @param {import("http").ServerResponse} res
 * @param {string | null} [ssePlayerId] when present and matches a player in the room, closing this SSE decrements a ref-count and may remove the player (last tab wins).
 */
export function subscribeRoom(roomCode, res, ssePlayerId = null) {
  if (!roomSubscribers.has(roomCode)) {
    roomSubscribers.set(roomCode, []);
  }
  roomSubscribers.get(roomCode).push(res);

  const room = rooms.get(roomCode);
  if (ssePlayerId && room?.players?.[ssePlayerId]) {
    const k = sseKey(roomCode, ssePlayerId);
    playerSseRefCounts.set(k, (playerSseRefCounts.get(k) ?? 0) + 1);
    sseRefsByRes.set(res, { roomCode, playerId: ssePlayerId });
  }

  emitRoomUpdate(roomCode);
}

export function unsubscribeRoom(roomCode, res) {
  const listeners = roomSubscribers.get(roomCode);
  if (!listeners) return;

  const next = listeners.filter((listener) => listener !== res);
  if (next.length === 0) {
    roomSubscribers.delete(roomCode);
  } else {
    roomSubscribers.set(roomCode, next);
  }

  const tracked = sseRefsByRes.get(res);
  sseRefsByRes.delete(res);

  if (tracked && tracked.roomCode === roomCode) {
    const k = sseKey(roomCode, tracked.playerId);
    const n = (playerSseRefCounts.get(k) ?? 1) - 1;
    if (n <= 0) {
      playerSseRefCounts.delete(k);
      leaveRoom({ roomCode, playerId: tracked.playerId });
    } else {
      playerSseRefCounts.set(k, n);
    }
  }
}

export function getRoom(roomCode) {
  return rooms.get(roomCode) ?? null;
}

export function createRoom({ username, wordSequence }) {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) roomCode = generateRoomCode();

  const playerId = randomId("p");
  const now = Date.now();
  rooms.set(roomCode, {
    roomCode,
    started: false,
    createdAt: now,
    lastActivityAt: now,
    creatorId: playerId,
    wordSequence,
    startedAt: null,
    lastTickAt: null,
    elapsedSeconds: 0,
    matchEnded: false,
    matchWinnerId: null,
    effects: [],
    participants: {
      [playerId]: {
        username,
        health: 100,
        score: 0,
        deadAt: null,
        leftAt: null,
        joinedAt: now,
        lastSeenAt: now,
      },
    },
    players: {
      [playerId]: {
        username,
        health: 100,
        score: 0,
        currentIndex: 0,
        recentSuccesses: [],
        nextEffectAllowedAt: 0,
        secondWindUsed: false,
        secondWindLowAt: null,
        threatResetElapsedSeconds: 0,
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

  const now = Date.now();
  room.players[resolvedPlayerId] = {
    username,
    health: 100,
    score: 0,
    currentIndex: 0,
    recentSuccesses: [],
    nextEffectAllowedAt: 0,
    secondWindUsed: false,
    secondWindLowAt: null,
    threatResetElapsedSeconds: 0,
  };

  room.participants = room.participants ?? {};
  const prev = room.participants[resolvedPlayerId] ?? {};
  room.participants[resolvedPlayerId] = {
    ...prev,
    username,
    health: 100,
    score: 0,
    deadAt: typeof prev.deadAt === "number" ? prev.deadAt : null,
    leftAt: null,
    joinedAt: typeof prev.joinedAt === "number" ? prev.joinedAt : now,
    lastSeenAt: now,
  };

  touchRoomActivity(room);
  emitRoomUpdate(roomCode);
  return { room, playerId: resolvedPlayerId };
}

export function startRoom({ roomCode, playerId }) {
  const room = rooms.get(roomCode);
  if (!room || room.creatorId !== playerId) return false;
  room.started = true;
  room.startedAt = room.startedAt ?? Date.now();
  room.lastTickAt = Date.now();
  room.matchEnded = false;
  room.matchWinnerId = null;
  touchRoomActivity(room);
  emitRoomUpdate(roomCode);
  ensureRoomTicker(roomCode);
  return true;
}

export function updatePlayer({ roomCode, playerId, patch }) {
  const room = rooms.get(roomCode);
  if (!room?.players?.[playerId]) return null;
  touchRoomActivity(room);
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
  if (typeof playerPatch?.flowPayout === "number" && Number.isFinite(playerPatch.flowPayout)) {
    const payout = Math.max(0, Math.floor(playerPatch.flowPayout));
    const ticks = Math.max(0, Math.min(FLOW_OBSCURE_MAX_TICKS, payout));
    const victimIds = Object.keys(room.players).filter((id) => id !== playerId);
    if (ticks > 0 && victimIds.length > 0) {
      const sourceScore = typeof prev.score === "number" ? prev.score : 0;
      const candidates = victimIds.map((vid) => {
        const v = room.players?.[vid];
        const vScore = typeof v?.score === "number" ? v.score : 0;
        return { id: vid, diff: Math.abs(vScore - sourceScore) };
      });
      const minDiff = candidates.reduce((m, c) => Math.min(m, c.diff), Number.POSITIVE_INFINITY);
      const tied = candidates.filter((c) => c.diff === minDiff);
      const victimId = tied[Math.floor(Math.random() * tied.length)]?.id ?? null;
      if (!victimId) {
        // No eligible victim (shouldn't happen given victimIds.length check).
        // Skip effect creation.
      } else {
      const intensity = Math.max(0, Math.min(1, ticks / FLOW_OBSCURE_MAX_TICKS));
      const effect = {
        id: randomId("fx"),
        type: "flowObscure",
        sourcePlayerId: playerId,
        targets: [victimId],
        createdAt: now,
        expiresAt: now + ticks * FLOW_OBSCURE_TICK_MS,
        payload: {
          remainingTicks: ticks,
          intensity,
          lastTickAt: now,
        },
      };
      room.effects = Array.isArray(room.effects) ? room.effects : [];
      room.effects.push(effect);
      }
    }
  }
  const lowAt = typeof next.secondWindLowAt === "number" ? next.secondWindLowAt : null;
  const canSecondWind = !next.secondWindUsed && lowAt != null && now - lowAt <= 2000;
  const healedHigh = typeof next.health === "number" && next.health >= 80;
  if (canSecondWind && healedHigh) {
    next.secondWindUsed = true;
    next.secondWindLowAt = null;
    next.threatResetElapsedSeconds = room.elapsedSeconds;
  }
  if (typeof playerPatch?.lastSuccess === "number") {
    const prevRecent = Array.isArray(prev.recentSuccesses) ? prev.recentSuccesses : [];
    const recent = [...prevRecent, playerPatch.lastSuccess].filter((t) => now - t <= DECOY_WORD.burstWindowMs);
    next.recentSuccesses = recent;

    const cooldownUntil = typeof prev.nextEffectAllowedAt === "number" ? prev.nextEffectAllowedAt : 0;
    const victimIds = Object.keys(room.players).filter((id) => id !== playerId);
    if (recent.length >= DECOY_WORD.burstCount && now >= cooldownUntil && victimIds.length > 0) {
      const wordsByPlayerId = {};
      victimIds.forEach((vid) => {
        wordsByPlayerId[vid] = generateDecoyWord(DECOY_WORD.length);
      });
      const effect = {
        id: randomId("fx"),
        type: "decoyWord",
        sourcePlayerId: playerId,
        targets: "others",
        createdAt: now,
        expiresAt: now + DECOY_WORD.durationMs,
        payload: {
          wordsByPlayerId,
          completedBy: {},
        },
      };
      room.effects = Array.isArray(room.effects) ? room.effects : [];
      room.effects.push(effect);
      next.nextEffectAllowedAt = now + DECOY_WORD.cooldownMs;
    } else {
      next.nextEffectAllowedAt = cooldownUntil;
    }
  }

  room.players[playerId] = next;

  room.participants = room.participants ?? {};
  const prevParticipant = room.participants[playerId] ?? {};
  room.participants[playerId] = {
    ...prevParticipant,
    username: typeof next.username === "string" ? next.username : prevParticipant.username,
    health: typeof next.health === "number" ? next.health : prevParticipant.health,
    score: typeof next.score === "number" ? next.score : prevParticipant.score,
    deadAt: typeof next.deadAt === "number" ? next.deadAt : prevParticipant.deadAt ?? null,
    leftAt: typeof prevParticipant.leftAt === "number" ? prevParticipant.leftAt : null,
    joinedAt: typeof prevParticipant.joinedAt === "number" ? prevParticipant.joinedAt : Date.now(),
    lastSeenAt: Date.now(),
  };

  maybeEndMatchLastStanding(roomCode, room);
  emitRoomUpdate(roomCode);
  return room.players[playerId];
}

export function leaveRoom({ roomCode, playerId }) {
  const room = rooms.get(roomCode);
  if (!room?.players?.[playerId]) return false;

  const now = Date.now();
  room.participants = room.participants ?? {};
  const prevParticipant = room.participants[playerId] ?? {};
  const prevPlayer = room.players[playerId] ?? {};
  room.participants[playerId] = {
    ...prevParticipant,
    username: typeof prevPlayer.username === "string" ? prevPlayer.username : prevParticipant.username,
    health: typeof prevPlayer.health === "number" ? prevPlayer.health : prevParticipant.health,
    score: typeof prevPlayer.score === "number" ? prevPlayer.score : prevParticipant.score,
    deadAt: typeof prevPlayer.deadAt === "number" ? prevPlayer.deadAt : prevParticipant.deadAt ?? null,
    leftAt: now,
    joinedAt: typeof prevParticipant.joinedAt === "number" ? prevParticipant.joinedAt : now,
    lastSeenAt: now,
  };

  delete room.players[playerId];
  if (Object.keys(room.players).length === 0) {
    stopRoomTicker(roomCode);
    rooms.delete(roomCode);
    emitRoomUpdate(roomCode);
    purgeRoomMaps(roomCode);
    return true;
  }

  if (room.creatorId === playerId) {
    room.creatorId = Object.keys(room.players)[0];
  }

  touchRoomActivity(room);
  emitRoomUpdate(roomCode);
  return true;
}
