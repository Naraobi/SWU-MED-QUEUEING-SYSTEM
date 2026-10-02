<<<<<<< HEAD
const admin = require("firebase-admin");

const {
  cert,
  initializeApp,
  getApps,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");
=======
const { initializeApp, cert } = require("firebase-admin/app");
>>>>>>> JP-SUPER-ADMIN
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

<<<<<<< HEAD
const path = require("path");
const fs = require("fs");

let serviceAccount;

const serviceAccountPath = path.join(
  __dirname,
  "../serviceAccountKey.json"
);

// Load local credentials or Hostinger environment variables.
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

// Initialize Firebase Admin only once.
const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      })
    : getApps()[0];

// Initialize Firebase Authentication.
const auth = getAuth(app);
const db = getFirestore(app);
// Export both services.
module.exports = {
  admin,
  auth,
  db,
};
=======
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
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    `https://${serviceAccount.projectId || serviceAccount.project_id}-default-rtdb.firebaseio.com`,
});

const db = getFirestore(firebaseApp);
const realtimeDb = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);
console.log(
  "🔥 BACKEND FIREBASE PROJECT:",
  firebaseApp.options.projectId
);
module.exports = {
  db,
  realtimeDb,
  auth,
};
>>>>>>> JP-SUPER-ADMIN
