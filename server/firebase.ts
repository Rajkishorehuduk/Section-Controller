import fs from "fs";
import path from "path";

// Lightweight Firestore-like in-memory fallback used when Firebase Admin is not configured.
class InMemoryCollection<T extends { id: string }> {
  private store = new Map<string, T>();

  orderBy(field: keyof T & string, direction: "asc" | "desc" = "asc") {
    const docs = Array.from(this.store.values()).sort((a, b) => {
      const va = (a as any)[field];
      const vb = (b as any)[field];
      if (va === vb) return 0;
      const res = va > vb ? 1 : -1;
      return direction === "asc" ? res : -res;
    });
    return {
      async get() {
        const snapshot = docs.map((d) => ({
          data: () => d,
        }));
        return {
          forEach(cb: (doc: { data: () => T }) => void) {
            snapshot.forEach(cb);
          },
        };
      },
    };
  }

  doc(id: string) {
    return {
      set: async (data: T) => {
        this.store.set(id, { ...data, id });
      },
      get: async () => {
        const data = this.store.get(id) || null;
        return {
          exists: !!data,
          data: () => data as T | null,
        };
      },
      update: async (updateObj: Record<string, unknown>) => {
        const existing = this.store.get(id);
        if (!existing) throw new Error("Document not found");
        // Support dot-notation for nested fields (used for acknowledgements.<station>)
        const updated = { ...existing } as any;
        for (const [key, value] of Object.entries(updateObj)) {
          const parts = key.split(".");
          let target: any = updated;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            target[p] = target[p] ?? {};
            target = target[p];
          }
          target[parts[parts.length - 1]] = value;
        }
        this.store.set(id, updated);
      },
      delete: async () => {
        this.store.delete(id);
      },
    };
  }
}

class InMemoryDB {
  private collections = new Map<string, InMemoryCollection<any>>();
  collection<T extends { id: string }>(name: string) {
    if (!this.collections.has(name)) this.collections.set(name, new InMemoryCollection<T>());
    return this.collections.get(name)! as InMemoryCollection<T>;
  }
}

// Try to initialize Firebase Admin if available and configured, otherwise use in-memory fallback.
function initDatabase() {
  // First, try to load firebase-admin without making it a hard dependency during dev.
  let admin: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    admin = require("firebase-admin");
  } catch {
    // Not installed – fallback
  }

  // If admin is available, try to initialize with credentials from env or local file
  if (admin) {
    try {
      const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      let credential: any | null = null;

      if (envJson) {
        const parsed = JSON.parse(envJson);
        credential = admin.credential.cert(parsed);
      } else {
        const jsonPath = path.join(__dirname, "./firebase-service-account.json");
        if (fs.existsSync(jsonPath)) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const serviceAccount = require(jsonPath);
          credential = admin.credential.cert(serviceAccount);
        }
      }

      if (credential) {
        try {
          // If already initialized, skip
          if (!admin.apps?.length) {
            admin.initializeApp({ credential });
          }
          // Return real Firestore DB
          const db = admin.firestore();
          // eslint-disable-next-line no-console
          console.log("Firebase Admin SDK initialized successfully.");
          return db;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("Failed to initialize Firebase Admin, using in-memory DB. Reason:", err);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          "Firebase credentials not found. Provide FIREBASE_SERVICE_ACCOUNT_JSON or firebase-service-account.json. Falling back to in-memory DB."
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Error while parsing Firebase credentials. Falling back to in-memory DB.", err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("firebase-admin not installed. Using in-memory DB.");
  }

  // Fallback
  return new InMemoryDB();
}

export const db = initDatabase() as any;
