const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

let serviceAccount;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  // Render / cloud environment
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
} else {
  // Local development
  serviceAccount = require("../serviceAccountKey.json");
}

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = getFirestore(firebaseApp);
const realtimeDb = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

module.exports = {
  db,
  realtimeDb,
  auth,
};