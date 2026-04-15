import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("multiplayer effects (regression)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers decoyWord on a success burst with per-victim words and prunes after expiry", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "A" });
    const roomCode = created.body.roomCode;
    const aId = created.body.playerId;

    const joined = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    const bId = joined.body.playerId;
    expect(bId).not.toBe(aId);

    for (let i = 0; i < 3; i += 1) {
      const t = Date.now();
      const res = await request(app)
        .patch(`/api/rooms/${roomCode}/players/${aId}`)
        .send({ lastSuccess: t });
      expect(res.status).toBe(200);
      await vi.advanceTimersByTimeAsync(600);
    }

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(200);
    const room = roomRes.body.room;
    expect(Array.isArray(room.effects)).toBe(true);
    expect(room.effects.length).toBeGreaterThanOrEqual(1);

    const fx = room.effects.find((e) => e.type === "decoyWord");
    expect(fx).toBeTruthy();
    expect(fx.sourcePlayerId).toBe(aId);
    expect(fx.targets).toBe("others");
    expect(typeof fx.expiresAt).toBe("number");
    const wordB = fx.payload?.wordsByPlayerId?.[bId];
    expect(typeof wordB).toBe("string");
    expect(wordB.length).toBe(7);
    expect(/^[a-z]+$/.test(wordB)).toBe(true);

    await vi.advanceTimersByTimeAsync(12_000);
    const bump = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${bId}`)
      .send({ health: 99 });
    expect(bump.status).toBe(200);

    const afterRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.room.effects.length).toBe(0);
  });

  it("removes decoyWord when victim PATCHes decoyTypedEffectId", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "A" });
    const roomCode = created.body.roomCode;
    const aId = created.body.playerId;

    const joined = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    const bId = joined.body.playerId;

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .patch(`/api/rooms/${roomCode}/players/${aId}`)
        .send({ lastSuccess: Date.now() });
      await vi.advanceTimersByTimeAsync(600);
    }

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    const fx = roomRes.body.room.effects.find((e) => e.type === "decoyWord");
    expect(fx).toBeTruthy();

    const clearRes = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${bId}`)
      .send({ decoyTypedEffectId: fx.id });
    expect(clearRes.status).toBe(200);

    const after = await request(app).get(`/api/rooms/${roomCode}`);
    expect(after.body.room.effects.length).toBe(0);
  });
});
