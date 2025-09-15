import { RequestHandler } from "express";
import { Decision, NewDecision, AckRequest } from "@shared/api";
import { randomUUID } from "crypto";

// In-memory store for demo purposes
const decisions: Decision[] = [];

export const listDecisions: RequestHandler = (_req, res) => {
  res.status(200).json({ decisions });
};

export const createDecision: RequestHandler = (req, res) => {
  const body = req.body as NewDecision;

  if (!body || !body.message || !body.category || !body.priority || !body.targets?.length) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const now = new Date().toISOString();
  const decision: Decision = {
    id: randomUUID(),
    message: body.message,
    category: body.category,
    priority: body.priority,
    targets: body.targets,
    effectiveAt: body.effectiveAt ?? now,
    expiresAt: body.expiresAt ?? null,
    createdAt: now,
    author: body.author ?? "Section Controller",
    acknowledgements: body.targets.reduce<Record<string, { acknowledged: boolean; at: string | null }>>((acc, station) => {
      acc[station] = { acknowledged: false, at: null };
      return acc;
    }, {}),
    effect: body.effect,
    meta: body.meta,
  };

  decisions.unshift(decision);
  res.status(201).json({ decision });
};

export const acknowledgeDecision: RequestHandler = (req, res) => {
  const { id } = req.params;
  const body = req.body as AckRequest;
  const decision = decisions.find((d) => d.id === id);

  if (!decision) return res.status(404).json({ error: "Decision not found" });
  if (!body || !body.station) return res.status(400).json({ error: "Station is required" });
  if (!decision.acknowledgements[body.station]) return res.status(400).json({ error: "Station not targeted for this decision" });

  decision.acknowledgements[body.station] = { acknowledged: true, at: new Date().toISOString() };
  res.status(200).json({ decision });
};

export const deleteDecision: RequestHandler = (req, res) => {
  const { id } = req.params;
  const idx = decisions.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Decision not found" });
  decisions.splice(idx, 1);
  res.status(204).end();
};
