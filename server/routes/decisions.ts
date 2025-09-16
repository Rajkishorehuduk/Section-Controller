import { RequestHandler } from "express";
import { Decision, NewDecision, AckRequest } from "@shared/api";
import { randomUUID } from "crypto";
import { db } from "../firebase"; // Import our initialized Firestore DB instance

// This is our permanent reference to the "decisions" collection in Firestore
const decisionsRef = db.collection("decisions");

/**
 * READ: Get all decisions from Firestore
 */
export const listDecisions: RequestHandler = async (_req, res) => {
  try {
    // Get all documents, order by creation time (descending) 
    // This maintains the same behavior as your original in-memory array (newest first).
    const snapshot = await decisionsRef.orderBy("createdAt", "desc").get();
    
    const decisions: Decision[] = [];
    snapshot.forEach((doc) => {
      decisions.push(doc.data() as Decision);
    });
    
    res.status(200).json({ decisions });
  } catch (error) {
    console.error("Error listing decisions:", error);
    res.status(500).json({ error: "Failed to list decisions from database" });
  }
};

/**
 * CREATE: Create a new decision document in Firestore
 */
export const createDecision: RequestHandler = async (req, res) => {
  const body = req.body as NewDecision;

  if (!body || !body.message || !body.category || !body.priority || !body.targets?.length) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const now = new Date().toISOString();
  const decision: Decision = {
    id: randomUUID(), // Generate a UUID for the decision
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
    // Save the new decision in Firestore using its own UUID as the document ID
    await decisionsRef.doc(decision.id).set(decision);
    res.status(201).json({ decision });
  } catch (error) {
    console.error("Error creating decision:", error);
    res.status(500).json({ error: "Failed to create decision in database" });
  }
};

/**
 * UPDATE: Acknowledge a specific decision in Firestore
 */
export const acknowledgeDecision: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const body = req.body as AckRequest;

  if (!body || !body.station) {
    return res.status(400).json({ error: "Station is required" });
  }

  const docRef = decisionsRef.doc(id);
  
  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Decision not found" });
    }

    const decision = doc.data() as Decision;
    if (!decision.acknowledgements[body.station]) {
      return res.status(400).json({ error: "Station not targeted for this decision" });
    }

    // Use dot notation to update a specific nested field in the map.
    // This is efficient and prevents race conditions.
    const ackFieldPath = `acknowledgements.${body.station}`;
    await docRef.update({
      [ackFieldPath]: { acknowledged: true, at: new Date().toISOString() }
    });

    // Get the updated decision and send it back
    const updatedDoc = await docRef.get();
    res.status(200).json({ decision: updatedDoc.data() });

  } catch (error) {
    console.error("Error acknowledging decision:", error);
    res.status(500).json({ error: "Failed to acknowledge decision" });
  }
};

/**
 * DELETE: Delete a decision document from Firestore
 */
export const deleteDecision: RequestHandler = async (req, res) => {
  const { id } = req.params;
  
  try {
    const docRef = decisionsRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Decision not found" });
    }

    // Delete the document from the database
    await docRef.delete();
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting decision:", error);
    res.status(500).json({ error: "Failed to delete decision" });
  }
};