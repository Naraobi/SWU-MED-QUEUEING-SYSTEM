require("dotenv").config();
const express = require("express");
const cors = require("cors");

const pool = require("./config/mysql");
const { db } = require("./config/firebase");

const {
  getDatabaseMode,
} = require("./services/databaseService");

const {
  syncPendingRecords,
} = require("./services/syncService");

// =====================================================
// ROUTES
// =====================================================

const departmentRoutes = require("./routes/departmentRoutes");
const userRoutes = require("./routes/userRoutes");
const kioskRoutes = require("./routes/kioskRoutes");
const counterRoutes = require("./routes/counterRoutes");
const roleRoutes = require("./routes/roleRoutes");
const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const staffQueueRoutes = require("./routes/staffQueueRoutes");
const securityPinRoutes = require("./routes/securityPinRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

const SYNC_INTERVAL = 30 * 1000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// API ROUTES
// =====================================================

app.use(
  "/api/departments",
  departmentRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/kiosks",
  kioskRoutes
);

app.use(
  "/api/counters",
  counterRoutes
);

app.use(
  "/api/roles",
  roleRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/patients",
  patientRoutes
);

app.use(
  "/api/staff-queue",
  staffQueueRoutes
);

app.use(
  "/api/security/pin",
  securityPinRoutes
);

// =====================================================
// BASIC BACKEND TEST
// =====================================================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Node.js backend is working!",
  });
});

/*
|--------------------------------------------------------------------------
| MYSQL CONNECTION TEST
|--------------------------------------------------------------------------
*/

app.get("/api/test/mysql", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT 1 AS connected"
    );

    res.json({
      success: true,
      message: "MySQL connection is working!",
      data: rows,
    });
  } catch (error) {
    console.error(
      "MYSQL ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "MySQL connection failed",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| FIREBASE CONNECTION TEST
|--------------------------------------------------------------------------
*/

app.get("/api/test/firebase", async (req, res) => {
  try {
    const snapshot = await db
      .collection("node_test")
      .limit(1)
      .get();

    res.json({
      success: true,
      message: "Firebase connection is working!",
      documentsFound: snapshot.size,
    });
  } catch (error) {
    console.error(
      "FIREBASE ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Firebase connection failed",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| DATABASE STATUS
|--------------------------------------------------------------------------
|
| Returns the database currently being used:
|
| firebase
| mysql
| offline
|
*/

app.get(
  "/api/database/status",
  async (req, res) => {
    try {
      const mode =
        await getDatabaseMode();

      res.json({
        success: true,
        mode,
      });
    } catch (error) {
      console.error(
        "DATABASE STATUS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to determine database status",
        error: error.message,
      });
    }
  }
);

app.get("/api/test/email", async (req, res) => {
  try {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();

    res.json({
      success: true,
      message: "SMTP connection is working.",
    });
  } catch (error) {
    console.error("SMTP TEST ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || null,
      command: error.command || null,
    });
  }
});

/*
|--------------------------------------------------------------------------
| MANUAL DATABASE SYNCHRONIZATION
|--------------------------------------------------------------------------
|
| POST /api/sync/run
|
*/

app.post(
  "/api/sync/run",
  async (req, res) => {
    try {
      await syncPendingRecords();

      res.json({
        success: true,
        message:
          "Synchronization completed",
      });
    } catch (error) {
      console.error(
        "SYNC RUN ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Synchronization failed",
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| AUTOMATIC DATABASE SYNCHRONIZATION
|--------------------------------------------------------------------------
*/

async function runAutomaticSync() {
  try {
    console.log(
      "Checking sync queue..."
    );

    await syncPendingRecords();
  } catch (error) {
    console.error(
      "AUTOMATIC SYNC ERROR:",
      error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| START AUTOMATIC SYNC
|--------------------------------------------------------------------------
*/

setInterval(
  runAutomaticSync,
  SYNC_INTERVAL
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
 console.log(`Node.js server running on port ${PORT}`
  );

  console.log(
    `Automatic synchronization enabled every ${
      SYNC_INTERVAL / 1000
    } seconds.`
  );

  console.log(
    "Department API: /api/departments"
  );

  console.log(
    "User API: /api/users"
  );

  console.log(
    "Kiosk API: /api/kiosks"
  );

  console.log(
    "Counter API: /api/counters"
  );

  console.log(
    "Role API: /api/roles"
  );

  console.log(
    "Auth API: /api/auth"
  );

  console.log(
    "Patient API: /api/patients"
  );

  console.log(
    "Staff Queue API: /api/staff-queue"
  );
});