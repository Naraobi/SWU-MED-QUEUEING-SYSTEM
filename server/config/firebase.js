const admin = require("firebase-admin");

const {
  cert,
  initializeApp,
  getApps,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

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

// Export both services.
module.exports = {
  admin,
  auth,
};
