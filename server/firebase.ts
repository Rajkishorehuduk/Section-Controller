import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

export function getDb() {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const json = JSON.parse(raw);
  // Ensure private_key has real newlines
  if (json.private_key && typeof json.private_key === "string") {
    json.private_key = json.private_key.replace(/\\n/g, "\n");
  }
  if (!getApps().length) {
    app = initializeApp({ credential: cert(json) });
  }
  db = getFirestore();
  return db;
}
