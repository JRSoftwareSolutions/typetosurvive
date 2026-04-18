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

  it("keeps participants for players who leave", async () => {
    const app = createApp();
    const createRes = await request(app).post("/api/rooms").send({ username: "A" });
    expect(createRes.status).toBe(201);
    const { roomCode, playerId: aId } = createRes.body;

    const joinRes = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "B" });
    expect(joinRes.status).toBe(200);
    const bId = joinRes.body.playerId;

    const leaveRes = await request(app).post(`/api/rooms/${roomCode}/leave`).send({ playerId: bId });
    expect(leaveRes.status).toBe(200);

    const roomRes = await request(app).get(`/api/rooms/${roomCode}`);
    expect(roomRes.status).toBe(200);

    const participants = roomRes.body.room.participants;
    expect(participants).toBeTruthy();
    expect(participants[aId]?.username).toBe("A");
    expect(participants[bId]?.username).toBe("B");
    expect(typeof participants[bId]?.leftAt).toBe("number");
    expect(roomRes.body.room.players[bId]).toBeUndefined();
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

  it("blocks creator from starting until all players are ready", async () => {
    const app = createApp();
    const created = await request(app).post("/api/rooms").send({ username: "Creator" });
    const roomCode = created.body.roomCode;
    const creatorId = created.body.playerId;

    const joined = await request(app).post(`/api/rooms/${roomCode}/join`).send({ username: "Bob" });
    const bobId = joined.body.playerId;

    const blocked = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/ready/i);

    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: creatorId, ready: true });
    const stillBlocked = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    expect(stillBlocked.status).toBe(403);

    await request(app).post(`/api/rooms/${roomCode}/ready`).send({ playerId: bobId, ready: true });
    const ok = await request(app).post(`/api/rooms/${roomCode}/start`).send({ playerId: creatorId });
    expect(ok.status).toBe(200);
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

