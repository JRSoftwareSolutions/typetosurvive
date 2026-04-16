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

  it("second wind (once) resets per-player threat baseline", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;
    const creatorId = created.body.playerId;

    const startRes = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    expect(startRes.status).toBe(200);

    // Arm: drop below 20% while tick loop is active.
    const lowRes = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${creatorId}`)
      .send({ health: 10 });
    expect(lowRes.status).toBe(200);

    await vi.advanceTimersByTimeAsync(500);

    // Trigger: heal to >= 80 within 2 seconds.
    const healRes = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${creatorId}`)
      .send({ health: 85 });
    expect(healRes.status).toBe(200);

    const roomAfter = (await request(app).get(`/api/rooms/${roomCode}`)).body.room;
    const p = roomAfter.players[creatorId];
    expect(p.secondWindUsed).toBe(true);
    expect(p.secondWindLowAt).toBe(null);
    expect(p.threatResetElapsedSeconds).toBe(roomAfter.elapsedSeconds);

    // Doesn't re-trigger after being used.
    await vi.advanceTimersByTimeAsync(250);
    await request(app)
      .patch(`/api/rooms/${roomCode}/players/${creatorId}`)
      .send({ health: 90 });
    const roomFinal = (await request(app).get(`/api/rooms/${roomCode}`)).body.room;
    expect(roomFinal.players[creatorId].secondWindUsed).toBe(true);
    expect(roomFinal.players[creatorId].threatResetElapsedSeconds).toBe(roomAfter.elapsedSeconds);
  });
});

