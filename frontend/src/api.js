const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || "Request failed");
  return payload;
}

export function createRoom(username) {
  return request("/rooms", { method: "POST", body: JSON.stringify({ username }) });
}

export function joinRoom(roomCode, username, playerId = null) {
  return request(`/rooms/${roomCode}/join`, {
    method: "POST",
    body: JSON.stringify({ username, playerId }),
  });
}

export function startRoom(roomCode, playerId) {
  return request(`/rooms/${roomCode}/start`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export function updatePlayer(roomCode, playerId, patch) {
  return request(`/rooms/${roomCode}/players/${playerId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function leaveRoom(roomCode, playerId) {
  return request(`/rooms/${roomCode}/leave`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export function subscribeRoomEvents(roomCode, onMessage) {
  const es = new EventSource(`${API_BASE_URL}/rooms/${roomCode}/events`);
  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return es;
}
