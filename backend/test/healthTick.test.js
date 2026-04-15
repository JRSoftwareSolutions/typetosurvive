import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("server-authoritative health ticking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drains health over time after room start", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;
    const creatorId = created.body.playerId;

    const startRes = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    expect(startRes.status).toBe(200);

    // Advance 1 second; ticker runs every 250ms using Date.now().
    await vi.advanceTimersByTimeAsync(1000);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(200);

    const room = roomRes.body.room;
    const health = room.players[creatorId].health;
    expect(typeof health).toBe("number");
    expect(health).toBeLessThan(100);
    // Rough bounds for 1s of drain at threat=0.
    expect(health).toBeLessThan(95);
    expect(health).toBeGreaterThan(80);
    expect(room.elapsedSeconds).toBeGreaterThanOrEqual(1);
  });

  it("stops ticking when last player leaves (room deleted)", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;
    const creatorId = created.body.playerId;

    await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    await vi.advanceTimersByTimeAsync(500);

    const leaveRes = await request(app).post(`/api/rooms/${roomCode}/leave`).send({ playerId: creatorId });
    expect(leaveRes.status).toBe(200);

    // If a ticker leaked, this would keep running; we at least ensure the room is gone.
    await vi.advanceTimersByTimeAsync(2000);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(404);
  });
});

