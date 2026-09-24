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

    const codeHash = await bcrypt.hash(code, 10);

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

    if (
      !/^\d{6}$/.test(
        String(pin || "")
      )
    ) {
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
   * Patient View does NOT require a Firebase login.
   *
   * Superadmin:
   *   - Can activate any active kiosk.
   *
   * Admin:
   *   - Can activate only kiosks belonging to
   *     the admin's department.
   *
   * Database relationship:
   *
   *   user.role_id
   *        ↓
   *   role.role_id
   *        ↓
   *   role.role
   */
 /**
 * Validate a Security PIN for kiosk activation.
 *
 * Patient View does NOT require a Firebase login.
 *
 * Superadmin:
 *   - Can activate any active kiosk.
 *
 * Admin:
 *   - Can activate only kiosks belonging to
 *     the admin's department.
 *
 * Database relationship:
 *
 *   user.role_id
 *        ↓
 *   role.role_id
 *        ↓
 *   role.role
 */
async function validateKioskSecurityPin(
  kioskId,
  pin
) {
  // =========================================================
  // 1. BASIC INPUT VALIDATION
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
  // 2. CHECK THAT THE KIOSK EXISTS AND IS ACTIVE
  //
  // CAST(... AS BINARY) prevents MySQL collation conflicts
  // when comparing string IDs.
  // =========================================================

  const [kioskRows] = await db.execute(
    `
      SELECT
        kiosk_id,
        status
      FROM kiosk
      WHERE CAST(kiosk_id AS BINARY) =
            CAST(? AS BINARY)
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
  // 3. GET DEPARTMENTS ASSIGNED TO THIS KIOSK
  //
  // Again, compare the kiosk ID as binary.
  // =========================================================

  const [departmentRows] = await db.execute(
    `
      SELECT
        department_id
      FROM department
      WHERE CAST(kiosk_id AS BINARY) =
            CAST(? AS BINARY)
    `,
    [kioskId]
  );

  const kioskDepartmentIds =
    departmentRows
      .map((row) =>
        String(row.department_id || "")
      )
      .filter(Boolean);

  // =========================================================
  // 4. GET ACTIVE ADMIN / SUPERADMIN USERS
  //
  // user.role_id -> role.role_id
  // role.role     -> actual role name
  //
  // `user` is the actual table name.
  // =========================================================

  const [users] = await db.execute(
    `
      SELECT
        u.user_id,
        u.role_id,
        u.department_id,
        u.status AS user_status,

        r.role AS role_name,
        r.status AS role_status,

        sp.pin_hash

      FROM \`user\` u

      INNER JOIN \`role\` r
        ON CAST(u.role_id AS BINARY) =
           CAST(r.role_id AS BINARY)

      INNER JOIN security_pin sp
        ON CAST(u.user_id AS BINARY) =
           CAST(sp.user_id AS BINARY)
    `
  );

  // =========================================================
  // 5. CHECK USERS
  // =========================================================

  let adminMatch = null;

  for (const user of users) {
    // -------------------------------------------------------
    // Make sure the Security PIN exists.
    // -------------------------------------------------------

    if (!user.pin_hash) {
      continue;
    }

    // -------------------------------------------------------
    // User account must be active.
    // -------------------------------------------------------

    const userStatus = String(
      user.user_status || ""
    )
      .trim()
      .toLowerCase();

    if (userStatus !== "active") {
      continue;
    }

    // -------------------------------------------------------
    // Role must be active.
    // -------------------------------------------------------

    const roleStatus = String(
      user.role_status || ""
    )
      .trim()
      .toLowerCase();

    if (roleStatus !== "active") {
      continue;
    }

    // -------------------------------------------------------
    // Get actual role from role.role
    // -------------------------------------------------------

    const role = String(
      user.role_name || ""
    )
      .trim()
      .toLowerCase();

    // Only admin and superadmin can activate kiosks.
    if (
      role !== "admin" &&
      role !== "superadmin"
    ) {
      continue;
    }

    // -------------------------------------------------------
    // Compare entered PIN with bcrypt hash.
    // -------------------------------------------------------

    const pinMatches =
      await bcrypt.compare(
        String(pin),
        user.pin_hash
      );

    if (!pinMatches) {
      continue;
    }

    // =======================================================
    // 6. SUPERADMIN = MASTER PIN
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
    // 7. ADMIN = THEIR DEPARTMENT ONLY
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
  // 8. VALID ADMIN MATCH
  // =========================================================

  if (adminMatch) {
    return adminMatch;
  }

  // =========================================================
  // 9. INVALID / UNAUTHORIZED PIN
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