import { RequestHandler } from "express";
import { Decision, NewDecision, AckRequest } from "@shared/api";
import { randomUUID } from "crypto";

import { getDb } from "../firebase";

export const listDecisions: RequestHandler = async (_req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection("decisions").orderBy("createdAt", "desc").get();
    const decisions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Decision[];
    res.status(200).json({ decisions });
  } catch (e: any) {
    res.status(500).json({ error: "listDecisions failed", message: e?.message || String(e) });
  }
};

export const createDecision: RequestHandler = async (req, res) => {
  const body = req.body as NewDecision;

  if (!body || !body.message || !body.category || !body.priority || !body.targets?.length) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const now = new Date().toISOString();
  const base: Omit<Decision, "id"> = {
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

  try {
    const db = getDb();
    const ref = await db.collection("decisions").add(base as any);
    const decision: Decision = { id: ref.id, ...(base as any) } as Decision;
    res.status(201).json({ decision });
  } catch (e: any) {
    res.status(500).json({ error: "createDecision failed", message: e?.message || String(e) });
  }
};

export const acknowledgeDecision: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const body = req.body as AckRequest;
  if (!body || !body.station) return res.status(400).json({ error: "Station is required" });
  try {
    const db = getDb();
    const ref = db.collection("decisions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Decision not found" });
    const data = snap.data() as any;
    if (!data.acknowledgements || !data.acknowledgements[body.station])
      return res.status(400).json({ error: "Station not targeted for this decision" });
    data.acknowledgements[body.station] = { acknowledged: true, at: new Date().toISOString() };
    await ref.update({ acknowledgements: data.acknowledgements });
    res.status(200).json({ decision: { id, ...(data as any), acknowledgements: data.acknowledgements } });
  } catch (e: any) {
    res.status(500).json({ error: "acknowledgeDecision failed", message: e?.message || String(e) });
  }
};

export const deleteDecision: RequestHandler = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const ref = db.collection("decisions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Decision not found" });
    await ref.delete();
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: "deleteDecision failed", message: e?.message || String(e) });
  }
};
