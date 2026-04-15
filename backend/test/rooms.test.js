import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("rooms API (regression)", () => {
  it("creates a room and returns creator playerId", async () => {
    const app = createApp();
    const res = await request(app).post("/api/rooms").send({ username: "Alice" });
    expect(res.status).toBe(201);
    expect(res.body.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.playerId).toMatch(/^p_/);
    expect(res.body.room.creatorId).toBe(res.body.playerId);
    expect(res.body.room.players[res.body.playerId].username).toBe("Alice");
  });

  it("blocks non-creator from starting", async () => {
    const app = createApp();
    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;

    const joined = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "Bob" });
    const bobId = joined.body.playerId;

    const startRes = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: bobId });
    expect(startRes.status).toBe(403);
  });

  it("allows rename-in-place when rejoining with playerId", async () => {
    const app = createApp();
    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;

    const joinA = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "a" });
    const playerId = joinA.body.playerId;
    const playersCountA = Object.keys(joinA.body.room.players).length;

    const joinB = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ username: "b", playerId });

    expect(joinB.status).toBe(200);
    expect(joinB.body.playerId).toBe(playerId);
    expect(Object.keys(joinB.body.room.players).length).toBe(playersCountA);
    expect(joinB.body.room.players[playerId].username).toBe("b");
  });
});

