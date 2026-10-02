const admin = require("firebase-admin");

const {
  cert,
  initializeApp,
  getApps,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

const path = require("path");
const fs = require("fs");

let serviceAccount;

const serviceAccountPath = path.join(
  __dirname,
  "../serviceAccountKey.json"
);

// Load credentials from a local file or environment variables.
if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
} else {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

// Validate credentials.
if (
  !serviceAccount.project_id ||
  !serviceAccount.client_email ||
  !serviceAccount.private_key
) {
  throw new Error(
    "Firebase Admin credentials are missing. Check your service account file or environment variables."
  );
}

// Resolve project ID and database URL.
const projectId =
  serviceAccount.project_id || serviceAccount.projectId;

const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  `https://${projectId}-default-rtdb.firebaseio.com`;

// Initialize Firebase Admin only once.
const firebaseApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        databaseURL,
      })
    : getApps()[0];

// Initialize Firebase services.
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const realtimeDb = getDatabase(firebaseApp);

// Export services.
module.exports = {
  admin,
  auth,
  db,
  realtimeDb,
};
