import { describe, expect, it, vi } from "vitest";
import {
  createRoom,
  getRoom,
  joinRoom,
  setPlayerReady,
  startRoom,
  subscribeRoom,
  sweepStaleRoomsNow,
  unsubscribeRoom,
} from "../src/services/roomService.js";

function mockRes() {
  return { write: vi.fn() };
}

describe("abandoned room cleanup", () => {
  it("removes the last player when their SSE disconnects (playerId ref-count)", () => {
    const { roomCode, playerId } = createRoom({ username: "solo", wordSequence: ["x"] });
    const res = mockRes();
    subscribeRoom(roomCode, res, playerId);
    expect(getRoom(roomCode)).not.toBeNull();

    unsubscribeRoom(roomCode, res);
    expect(getRoom(roomCode)).toBeNull();
  });

  it("does not remove the player while a second SSE tab is still open", () => {
    const { roomCode, playerId } = createRoom({ username: "solo", wordSequence: ["x"] });
    const r1 = mockRes();
    const r2 = mockRes();
    subscribeRoom(roomCode, r1, playerId);
    subscribeRoom(roomCode, r2, playerId);

    unsubscribeRoom(roomCode, r1);
    expect(getRoom(roomCode)).not.toBeNull();

    unsubscribeRoom(roomCode, r2);
    expect(getRoom(roomCode)).toBeNull();
  });

  it("does not remove the room when SSE has no playerId (backward compatible)", () => {
    const { roomCode, playerId } = createRoom({ username: "solo", wordSequence: ["x"] });
    const res = mockRes();
    subscribeRoom(roomCode, res, null);

    unsubscribeRoom(roomCode, res);
    expect(getRoom(roomCode)?.players[playerId]).toBeTruthy();
  });

  it("sweepStaleRoomsNow deletes rooms with no listeners and stale lastActivityAt", () => {
    const { roomCode } = createRoom({ username: "ghost", wordSequence: ["x"] });
    const room = getRoom(roomCode);
    room.lastActivityAt = Date.now() - 6 * 60 * 1000;

    sweepStaleRoomsNow();
    expect(getRoom(roomCode)).toBeNull();
  });

  it("stops match ticker when solo player is removed via SSE disconnect", () => {
    vi.useFakeTimers();
    try {
      const { roomCode, playerId } = createRoom({ username: "solo", wordSequence: ["x"] });
      setPlayerReady({ roomCode, playerId, ready: true });
      startRoom({ roomCode, playerId });

      const res = mockRes();
      subscribeRoom(roomCode, res, playerId);

      vi.advanceTimersByTimeAsync(500);
      unsubscribeRoom(roomCode, res);

      vi.advanceTimersByTimeAsync(2000);
      expect(getRoom(roomCode)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a room with no listeners when activity is recent (sweep no-op)", () => {
    const { roomCode } = createRoom({ username: "fresh", wordSequence: ["x"] });
    sweepStaleRoomsNow();
    expect(getRoom(roomCode)).not.toBeNull();
  });

  it("removes only the disconnecting player in a two-player room", () => {
    const { roomCode, playerId: aId } = createRoom({ username: "A", wordSequence: ["x"] });
    const { playerId: bId } = joinRoom({ roomCode, username: "B", playerId: null });
    expect(bId).toBeTruthy();

    const resA = mockRes();
    subscribeRoom(roomCode, resA, aId);
    unsubscribeRoom(roomCode, resA);

    const room = getRoom(roomCode);
    expect(room?.players[aId]).toBeUndefined();
    expect(room?.players[bId]).toBeTruthy();
  });
});
