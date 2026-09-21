const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/mysql");

/**
 * Email verification-code plumbing for the Change Password wizard.
 *
 * Kept in its own table (password_reset_verification) rather than
 * reusing security_pin's pin_verification table, so a pending Security
 * PIN setup and a pending password change never invalidate each other
 * for the same user.
 */

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * This project has no migration tooling - tables are created by hand.
 * password_reset_verification is new, so self-provision it the same way
 * userService.js already does for user_deletion_logs.
 */
async function ensurePasswordResetTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_verification (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_lookup (user_id, verified)
    )
  `);
}

/**
 * Create a new email verification challenge for a password change.
 *
 * Returns the plaintext verification code so the email service can
 * send it to the user's registered email.
 */
async function createPasswordResetChallenge(userId) {
  await ensurePasswordResetTable();

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);

  const expiresAt = new Date(
    Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000
  );

  // Invalidate previous unverified challenges for this user.
  await db.execute(
    `
      UPDATE password_reset_verification
      SET verified = 1
      WHERE user_id = ?
        AND verified = 0
    `,
    [userId]
  );

  await db.execute(
    `
      INSERT INTO password_reset_verification
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
 * Verify the email verification code for a password change.
 */
async function verifyPasswordResetCode(userId, code) {
  await ensurePasswordResetTable();

  const [rows] = await db.execute(
    `
      SELECT
        id,
        code_hash,
        expires_at,
        attempts,
        verified
      FROM password_reset_verification
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
        UPDATE password_reset_verification
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
        UPDATE password_reset_verification
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
        UPDATE password_reset_verification
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
      UPDATE password_reset_verification
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

module.exports = {
  createPasswordResetChallenge,
  verifyPasswordResetCode,
};
