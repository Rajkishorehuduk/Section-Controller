import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  listDecisions,
  createDecision,
  acknowledgeDecision,
  deleteDecision,
} from "./routes/decisions";
import { handleAIPlan } from "./routes/ai";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Decisions API
  app.get("/api/decisions", listDecisions);
  app.post("/api/decisions", createDecision);
  app.post("/api/decisions/:id/ack", acknowledgeDecision);
  app.delete("/api/decisions/:id", deleteDecision);

  // AI
  app.post("/api/ai/plan", handleAIPlan);

  return app;
}
