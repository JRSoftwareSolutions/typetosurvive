import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { DECOY_WORD } from "../src/constants.js";

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
    expect(wordB.length).toBe(DECOY_WORD.length);
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

  it("creates flowObscure from flowPayout and ticks remainingTicks down over time", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "A" });
    const roomCode = created.body.roomCode;
    const aId = created.body.playerId;

    const joinedB = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    const bId = joinedB.body.playerId;
    const joinedC = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "C" });
    const cId = joinedC.body.playerId;
    expect(bId).not.toBe(aId);
    expect(cId).not.toBe(aId);
    expect(cId).not.toBe(bId);

    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: aId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: bId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: cId, ready: true });
    const startRes = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: aId });
    expect(startRes.status).toBe(200);

    // Set scores so B is closest to A.
    await request(app).patch(`/api/rooms/${roomCode}/players/${aId}`).send({ score: 500 });
    await request(app).patch(`/api/rooms/${roomCode}/players/${bId}`).send({ score: 520 });
    await request(app).patch(`/api/rooms/${roomCode}/players/${cId}`).send({ score: 900 });

    const payoutRes = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${aId}`)
      .send({ flowPayout: 10, flowLastEndedAt: Date.now(), flowActive: false });
    expect(payoutRes.status).toBe(200);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(200);
    const fx = roomRes.body.room.effects.find((e) => e.type === "flowObscure");
    expect(fx).toBeTruthy();
    expect(fx.sourcePlayerId).toBe(aId);
    expect(Array.isArray(fx.targets)).toBe(true);
    expect(fx.targets.length).toBe(1);
    expect(fx.targets[0]).toBe(bId);
    expect(typeof fx.expiresAt).toBe("number");
    expect(typeof fx.payload?.remainingTicks).toBe("number");
    expect(fx.payload.remainingTicks).toBe(10);

    await vi.advanceTimersByTimeAsync(1200);
    const after = (await request(app).get(`/api/rooms/${roomCode}`)).body.room;
    const fxAfter = after.effects.find((e) => e.type === "flowObscure");
    expect(fxAfter).toBeTruthy();
    expect(typeof fxAfter.payload?.remainingTicks).toBe("number");
    expect(fxAfter.payload.remainingTicks).toBeLessThan(10);
    expect(fxAfter.payload.remainingTicks).toBeGreaterThanOrEqual(0);
  });

  it("targets a random tied closest-score opponent for flowObscure", async () => {
    const app = createApp();

    const created = await request(app).post("/api/rooms").send({ username: "A" });
    const roomCode = created.body.roomCode;
    const aId = created.body.playerId;

    const joinedB = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    const bId = joinedB.body.playerId;
    const joinedC = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "C" });
    const cId = joinedC.body.playerId;

    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: aId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: bId, ready: true });
    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: cId, ready: true });
    const startRes = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: aId });
    expect(startRes.status).toBe(200);

    // Tie: B and C are equally close to A's score.
    await request(app).patch(`/api/rooms/${roomCode}/players/${aId}`).send({ score: 500 });
    await request(app).patch(`/api/rooms/${roomCode}/players/${bId}`).send({ score: 550 });
    await request(app).patch(`/api/rooms/${roomCode}/players/${cId}`).send({ score: 450 });

    const payoutRes = await request(app)
      .patch(`/api/rooms/${roomCode}/players/${aId}`)
      .send({ flowPayout: 10, flowLastEndedAt: Date.now(), flowActive: false });
    expect(payoutRes.status).toBe(200);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    const fx = roomRes.body.room.effects.find((e) => e.type === "flowObscure");
    expect(fx).toBeTruthy();
    expect(Array.isArray(fx.targets)).toBe(true);
    expect(fx.targets.length).toBe(1);
    expect([bId, cId]).toContain(fx.targets[0]);
  });
});
