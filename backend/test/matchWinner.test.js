import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("last-player-standing match end", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets matchWinnerId when only one of two players remains alive", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "A" });
    const roomCode = created.body.roomCode;
    const aId = created.body.playerId;

    const joined = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    const bId = joined.body.playerId;

    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: aId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: bId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: aId });

    await request(app).patch(`/api/rooms/${roomCode}/players/${aId}`).send({ health: 0.01 });

    await vi.advanceTimersByTimeAsync(2000);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(200);
    const room = roomRes.body.room;
    expect(room.matchEnded).toBe(true);
    expect(room.matchWinnerId).toBe(bId);
  });
});
