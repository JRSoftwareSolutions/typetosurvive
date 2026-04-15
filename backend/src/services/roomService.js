const rooms = new Map();
const roomSubscribers = new Map();
const roomTickers = new Map();

function randomId(prefix = "p") {
  return `${prefix}_${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
    if (nextHealth <= 0) p.deadAt = p.deadAt ?? now;
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
    players: {
      [playerId]: {
        username,
        health: 100,
        score: 0,
        currentIndex: 0,
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
  room.players[playerId] = {
    ...room.players[playerId],
    ...patch,
  };
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
