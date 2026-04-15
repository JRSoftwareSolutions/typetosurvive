import express from "express";
import cors from "cors";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  startRoom,
  subscribeRoom,
  unsubscribeRoom,
  updatePlayer,
} from "./services/roomService.js";
import { getGeneratedSequence, getWordPool } from "./services/wordService.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json());

  app.get("/api/health", (_, res) => {
    res.json({ ok: true, service: "typeforyourlife-backend" });
  });

  app.get("/api/words", async (_, res) => {
    const words = await getWordPool();
    res.json({ words });
  });

  app.post("/api/rooms", async (req, res) => {
    const username = (req.body?.username || "").trim() || `Player${Math.floor(Math.random() * 999)}`;
    const sequence = await getGeneratedSequence();
    const { roomCode, playerId } = createRoom({ username, wordSequence: sequence });
    const room = getRoom(roomCode);
    res.status(201).json({ roomCode, playerId, room });
  });

  app.post("/api/rooms/:roomCode/join", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const username = (req.body?.username || "").trim() || `Player${Math.floor(Math.random() * 999)}`;
    const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : null;
    const result = joinRoom({ roomCode, username, playerId });
    if (!result) return res.status(404).json({ message: "Room not found" });
    return res.json({ playerId: result.playerId, room: result.room });
  });

  app.get("/api/rooms/:roomCode", (req, res) => {
    const room = getRoom(req.params.roomCode.toUpperCase());
    if (!room) return res.status(404).json({ message: "Room not found" });
    return res.json({ room });
  });

  app.post("/api/rooms/:roomCode/start", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const { playerId } = req.body ?? {};
    const ok = startRoom({ roomCode, playerId });
    if (!ok) return res.status(403).json({ message: "Only room creator can start game" });
    return res.json({ ok: true });
  });

  app.patch("/api/rooms/:roomCode/players/:playerId", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const playerId = req.params.playerId;
    const player = updatePlayer({ roomCode, playerId, patch: req.body ?? {} });
    if (!player) return res.status(404).json({ message: "Player or room not found" });
    return res.json({ player });
  });

  app.post("/api/rooms/:roomCode/leave", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const { playerId } = req.body ?? {};
    const ok = leaveRoom({ roomCode, playerId });
    if (!ok) return res.status(404).json({ message: "Player or room not found" });
    return res.json({ ok: true });
  });

  app.get("/api/rooms/:roomCode/events", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    subscribeRoom(roomCode, res);

    req.on("close", () => {
      unsubscribeRoom(roomCode, res);
    });
  });

  return app;
}

