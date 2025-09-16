import admin from "firebase-admin";

// This tells the Admin SDK to find and use your service account key.
// Using require() is a simple way to import the JSON credentials in a Node.js environment.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require("./firebase-service-account.json");

// Initialize the Firebase Admin App
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("Firebase Admin SDK initialized successfully.");

// Create and export the Firestore database instance for use in your API routes
export const db = admin.firestore();