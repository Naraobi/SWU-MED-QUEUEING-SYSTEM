const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/mysql");

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;
const SECURITY_PIN_LENGTH = 6;

/**
 * Get the current Security PIN record for a user.
 */
async function getSecurityPin(userId) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        user_id,
        created_at,
        updated_at
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
  const code = String(
    crypto.randomInt(100000, 1000000)
  );

  const codeHash = await bcrypt.hash(
    code,
    10
  );

  const expiresAt = new Date(
    Date.now() +
      VERIFICATION_EXPIRY_MINUTES * 60 * 1000
  );

  // Invalidate previous unverified challenges
  // for this user.
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
        (
          user_id,
          code_hash,
          expires_at,
          attempts,
          verified
        )
      VALUES
        (?, ?, ?, 0, 0)
    `,
    [
      userId,
      codeHash,
      expiresAt,
    ]
  );

  return {
    code,
    expiresAt,
  };
}

/**
 * Verify the email verification code.
 */
async function verifyVerificationCode(
  userId,
  code
) {
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
      message:
        "No active verification request found.",
    };
  }

  // Check expiration.
  if (
    new Date(
      verification.expires_at
    ).getTime() < Date.now()
  ) {
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
      message:
        "Verification code has expired.",
    };
  }

  // Check maximum attempts.
  if (
    verification.attempts >=
    MAX_VERIFICATION_ATTEMPTS
  ) {
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
      message:
        "Maximum verification attempts exceeded.",
    };
  }

  const isValid = await bcrypt.compare(
    String(code),
    verification.code_hash
  );

  if (!isValid) {
    const newAttempts =
      verification.attempts + 1;

    await db.execute(
      `
        UPDATE pin_verification
        SET attempts = ?
        WHERE id = ?
      `,
      [
        newAttempts,
        verification.id,
      ]
    );

    return {
      success: false,
      message:
        "Invalid verification code.",
      attemptsRemaining: Math.max(
        0,
        MAX_VERIFICATION_ATTEMPTS -
          newAttempts
      ),
    };
  }

  // Verification successful.
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
    message:
      "Email verification successful.",
  };
}

/**
 * Save or replace the user's Security PIN.
 */
async function saveSecurityPin(
  userId,
  pin
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!/^\d{6}$/.test(String(pin || ""))) {
    throw new Error(
      "Security PIN must be exactly 6 digits."
    );
  }

  const pinHash = await bcrypt.hash(
    String(pin),
    12
  );

  await db.execute(
    `
      INSERT INTO security_pin
        (
          user_id,
          pin_hash
        )
      VALUES
        (?, ?)
      ON DUPLICATE KEY UPDATE
        pin_hash = VALUES(pin_hash),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      pinHash,
    ]
  );

  return {
    success: true,
  };
}

/**
 * Validate a user's Security PIN.
 *
 * Used for authenticated Security PIN operations.
 */
async function validateSecurityPin(
  userId,
  pin
) {
  if (!userId || !pin) {
    return false;
  }

  const [rows] = await db.execute(
    `
      SELECT
        pin_hash
      FROM security_pin
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  const record = rows[0];

  if (
    !record ||
    !record.pin_hash
  ) {
    return false;
  }

  return bcrypt.compare(
    String(pin),
    record.pin_hash
  );
}

/**
 * Validate a Security PIN for kiosk activation.
 *
 * IMPORTANT:
 *
 * Patient View does NOT require a Firebase login.
 * This function therefore validates the PIN directly
 * against the Security PIN records in MySQL.
 *
 * Superadmin:
 *   - Their Security PIN is treated as a master PIN.
 *   - Can activate any active kiosk.
 *
 * Admin:
 *   - Can activate only kiosks belonging to
 *     their department.
 *
 * The actual MySQL user table is `user`, NOT `users`.
 */
async function validateKioskSecurityPin(
  kioskId,
  pin
) {
  // =========================================================
  // BASIC INPUT VALIDATION
  // =========================================================

  if (!kioskId) {
    return {
      success: false,
      authorized: false,
      message: "Kiosk ID is required.",
    };
  }

  if (!/^\d{6}$/.test(String(pin || ""))) {
    return {
      success: false,
      authorized: false,
      message:
        "Security PIN must be exactly 6 digits.",
    };
  }

  // =========================================================
  // 1. CHECK THAT THE KIOSK EXISTS AND IS ACTIVE
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
      authorized: false,
      message: "Kiosk not found.",
    };
  }

  const kioskStatus = String(
    kiosk.status || ""
  )
    .trim()
    .toLowerCase();

  if (kioskStatus !== "active") {
    return {
      success: false,
      authorized: false,
      message:
        "This kiosk is inactive.",
    };
  }

  // =========================================================
  // 2. GET THE DEPARTMENTS ASSIGNED TO THIS KIOSK
  // =========================================================

  const [
    departmentRows,
  ] = await db.execute(
    `
      SELECT
        department_id
      FROM department
      WHERE kiosk_id = ?
    `,
    [kioskId]
  );

  const kioskDepartmentIds =
    departmentRows
      .map((row) =>
        String(
          row.department_id || ""
        )
      )
      .filter(Boolean);

  // =========================================================
  // 3. GET ACTIVE ADMIN / SUPERADMIN USERS
  //    THAT HAVE A SECURITY PIN
  //
  // IMPORTANT:
  // The correct table is `user`, not `users`.
  // =========================================================

  const [users] = await db.execute(
    `
      SELECT
        u.user_id,
        u.role,
        u.department_id,
        sp.pin_hash
      FROM \`user\` u
      INNER JOIN security_pin sp
        ON sp.user_id = u.user_id
      WHERE LOWER(TRIM(u.status)) = 'active'
        AND LOWER(TRIM(u.role)) IN (
          'admin',
          'superadmin'
        )
    `
  );

  // =========================================================
  // 4. COMPARE THE ENTERED PIN AGAINST THE STORED
  //    SECURITY PIN HASHES
  // =========================================================

  let adminMatch = null;

  for (const user of users) {
    // Ignore malformed Security PIN records.
    if (!user.pin_hash) {
      continue;
    }

    const pinMatches =
      await bcrypt.compare(
        String(pin),
        user.pin_hash
      );

    // PIN does not belong to this user.
    if (!pinMatches) {
      continue;
    }

    const role = String(
      user.role || ""
    )
      .trim()
      .toLowerCase();

    // =======================================================
    // 5. SUPERADMIN = MASTER PIN
    //
    // A valid active superadmin PIN can activate
    // ANY active kiosk.
    // =======================================================

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

    // =======================================================
    // 6. ADMIN = DEPARTMENT ONLY
    //
    // The admin's department_id must match one of the
    // departments assigned to this kiosk.
    // =======================================================

    if (role === "admin") {
      const adminDepartmentId =
        String(
          user.department_id || ""
        );

      const canAccessKiosk =
        adminDepartmentId &&
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

  // =========================================================
  // 7. RETURN A VALID ADMIN RESULT
  // =========================================================

  if (adminMatch) {
    return adminMatch;
  }

  // =========================================================
  // 8. PIN DOES NOT HAVE AUTHORIZATION FOR THIS KIOSK
  // =========================================================

  return {
    success: false,
    authorized: false,
    message:
      "This Security PIN is not authorized for this kiosk.",
  };
}

/**
 * Export all Security PIN functions.
 */
module.exports = {
  getSecurityPin,
  createVerificationChallenge,
  verifyVerificationCode,
  saveSecurityPin,
  validateSecurityPin,
  validateKioskSecurityPin,
};