const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/mysql");

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * Get the current Security PIN record for a user.
 */
async function getSecurityPin(userId) {
  const [rows] = await db.execute(
    `
      SELECT id, user_id, created_at, updated_at
      FROM security_pin
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

/**
 * Create a new email verification challenge.
 *
 * Returns the plaintext verification code so the email service
 * can send it to the user's registered email.
 */
async function createVerificationChallenge(userId) {
  const code = String(crypto.randomInt(100000, 1000000));

  const codeHash = await bcrypt.hash(code, 10);

  const expiresAt = new Date(
    Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000
  );

  // Invalidate previous unverified challenges for this user.
  await db.execute(
    `
      UPDATE pin_verification
      SET verified = 1
      WHERE user_id = ?
        AND verified = 0
    `,
    [userId]
  );

  await db.execute(
    `
      INSERT INTO pin_verification
        (user_id, code_hash, expires_at, attempts, verified)
      VALUES
        (?, ?, ?, 0, 0)
    `,
    [userId, codeHash, expiresAt]
  );

  return {
    code,
    expiresAt,
  };
}

/**
 * Verify the email verification code.
 */
async function verifyVerificationCode(userId, code) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        code_hash,
        expires_at,
        attempts,
        verified
      FROM pin_verification
      WHERE user_id = ?
        AND verified = 0
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  const verification = rows[0];

  if (!verification) {
    return {
      success: false,
      message: "No active verification request found.",
    };
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    await db.execute(
      `
        UPDATE pin_verification
        SET verified = 1
        WHERE id = ?
      `,
      [verification.id]
    );

    return {
      success: false,
      message: "Verification code has expired.",
    };
  }

  if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    await db.execute(
      `
        UPDATE pin_verification
        SET verified = 1
        WHERE id = ?
      `,
      [verification.id]
    );

    return {
      success: false,
      message: "Maximum verification attempts exceeded.",
    };
  }

  const isValid = await bcrypt.compare(
    String(code),
    verification.code_hash
  );

  if (!isValid) {
    const newAttempts = verification.attempts + 1;

    await db.execute(
      `
        UPDATE pin_verification
        SET attempts = ?
        WHERE id = ?
      `,
      [newAttempts, verification.id]
    );

    return {
      success: false,
      message: "Invalid verification code.",
      attemptsRemaining: Math.max(
        0,
        MAX_VERIFICATION_ATTEMPTS - newAttempts
      ),
    };
  }

  await db.execute(
    `
      UPDATE pin_verification
      SET verified = 1
      WHERE id = ?
    `,
    [verification.id]
  );

  return {
    success: true,
    message: "Email verification successful.",
  };
}

/**
 * Save or replace the user's Security PIN.
 */
async function saveSecurityPin(userId, pin) {
  const pinHash = await bcrypt.hash(String(pin), 12);

  await db.execute(
    `
      INSERT INTO security_pin
        (user_id, pin_hash)
      VALUES
        (?, ?)
      ON DUPLICATE KEY UPDATE
        pin_hash = VALUES(pin_hash),
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId, pinHash]
  );

  return {
    success: true,
  };
}

/**
 * Validate a user's Security PIN.
 */
async function validateSecurityPin(userId, pin) {
  const [rows] = await db.execute(
    `
      SELECT pin_hash
      FROM security_pin
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  const record = rows[0];

  if (!record) {
    return false;
  }

  return bcrypt.compare(String(pin), record.pin_hash);
}
/**
 * Validate a Security PIN for kiosk activation.
 *
 * Superadmin:
 *   - Master PIN
 *   - Can activate any active kiosk
 *
 * Admin:
 *   - Can activate only a kiosk assigned to
 *     their department
 */
async function validateKioskSecurityPin(kioskId, pin) {
  if (!kioskId || !pin) {
    return {
      success: false,
      message: "Kiosk ID and Security PIN are required.",
    };
  }

  // =========================================================
  // CHECK KIOSK
  // =========================================================

  const [kioskRows] = await db.execute(
    `
      SELECT
        kiosk_id,
        status
      FROM kiosk
      WHERE kiosk_id = ?
      LIMIT 1
    `,
    [kioskId]
  );

  const kiosk = kioskRows[0];

  if (!kiosk) {
    return {
      success: false,
      message: "Kiosk not found.",
    };
  }

  if (
    String(kiosk.status || "").toLowerCase() !==
    "active"
  ) {
    return {
      success: false,
      message: "This kiosk is inactive.",
    };
  }

  // =========================================================
  // GET DEPARTMENTS ASSIGNED TO THIS KIOSK
  // =========================================================

  const [departmentRows] = await db.execute(
    `
      SELECT department_id
      FROM department
      WHERE kiosk_id = ?
    `,
    [kioskId]
  );

  const kioskDepartmentIds =
    departmentRows.map((row) =>
      String(row.department_id)
    );

  // =========================================================
  // GET ACTIVE ADMIN / SUPERADMIN PIN RECORDS
  // =========================================================

  const [users] = await db.execute(
    `
      SELECT
        u.user_id,
        u.role,
        u.department_id,
        sp.pin_hash
      FROM users u
      INNER JOIN security_pin sp
        ON sp.user_id = u.user_id
      WHERE LOWER(TRIM(u.status)) = 'active'
        AND LOWER(TRIM(u.role)) IN (
          'admin',
          'superadmin'
        )
    `
  );

  let adminMatch = null;

  // =========================================================
  // CHECK PIN
  // =========================================================

  for (const user of users) {
    const matches = await bcrypt.compare(
      String(pin),
      user.pin_hash
    );

    if (!matches) {
      continue;
    }

    const role =
      String(user.role || "").toLowerCase();

    // -------------------------------------------------------
    // SUPERADMIN = MASTER PIN
    // -------------------------------------------------------

    if (role === "superadmin") {
      return {
        success: true,
        authorized: true,
        role: "superadmin",
        scope: "all",
        message:
          "Superadmin Security PIN validated successfully.",
      };
    }

    // -------------------------------------------------------
    // ADMIN
    // -------------------------------------------------------

    if (role === "admin") {
      const adminDepartmentId =
        String(user.department_id || "");

      const canAccessKiosk =
        kioskDepartmentIds.includes(
          adminDepartmentId
        );

      if (canAccessKiosk) {
        adminMatch = {
          success: true,
          authorized: true,
          role: "admin",
          scope: "department",
          message:
            "Admin Security PIN validated successfully.",
        };
      }
    }
  }

  if (adminMatch) {
    return adminMatch;
  }

  return {
    success: false,
    authorized: false,
    message:
      "This Security PIN is not authorized for this kiosk.",
  };
}
module.exports = {
  getSecurityPin,
  createVerificationChallenge,
  verifyVerificationCode,
  saveSecurityPin,
  validateSecurityPin,
};