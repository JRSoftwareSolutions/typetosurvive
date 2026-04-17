const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload: JsonObject = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((payload as any).message || "Request failed");
  return payload as unknown as T;
}

export type RoomDto = unknown;

export type CreateRoomResponse = {
  roomCode: string;
  playerId: string;
  room: RoomDto;
};

export type JoinRoomResponse = {
  roomCode?: string;
  playerId: string;
  room: RoomDto;
};

export function createRoom(username: string) {
  return request<CreateRoomResponse>("/rooms", { method: "POST", body: JSON.stringify({ username }) });
}

export function joinRoom(roomCode: string, username: string, playerId: string | null = null) {
  return request<JoinRoomResponse>(`/rooms/${roomCode}/join`, {
    method: "POST",
    body: JSON.stringify({ username, playerId }),
  });
}

export function startRoom(roomCode: string, playerId: string) {
  return request(`/rooms/${roomCode}/start`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export function updatePlayer(roomCode: string, playerId: string, patch: Record<string, unknown>) {
  return request(`/rooms/${roomCode}/players/${playerId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function leaveRoom(roomCode: string, playerId: string) {
  return request(`/rooms/${roomCode}/leave`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export function subscribeRoomEvents(
  roomCode: string,
  onMessage: (data: unknown) => void,
  playerId?: string,
) {
  const q = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
  const es = new EventSource(`${API_BASE_URL}/rooms/${roomCode}/events${q}`);
  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return es;
}

