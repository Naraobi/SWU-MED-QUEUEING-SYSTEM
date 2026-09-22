const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { randomUUID } = require("crypto");

const db = require("../config/mysql");
const pool = db;
const { auth } = require("../config/firebase");

const {
  getUserByEmailFromMySQL,
} = require("./userService");

const {
  sendPasswordResetCodeEmail,
} = require("../utils/emailService");

/**
 * Two independent flows live in this file:
 *
 * - createPasswordResetChallenge / verifyChangePasswordCode: the
 *   authenticated "Change Password" wizard in Settings, keyed by
 *   user_id, backed by password_reset_verification. Kept in its own
 *   table rather than reusing security_pin's pin_verification table,
 *   so a pending Security PIN setup and a pending password change
 *   never invalidate each other for the same user.
 *
 * - sendPasswordResetCode / verifyPasswordResetCode / resetPassword:
 *   the public "Forgot Password" flow for a signed-out user, keyed by
 *   email, backed by password_reset_tokens.
 *
 * They used to collide on the name verifyPasswordResetCode (same
 * name, different argument shape - userId vs email) after merging in
 * two branches that each added one of these flows independently. The
 * Change Password side was renamed to verifyChangePasswordCode to
 * resolve that; the Forgot Password side keeps its original name.
 */

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

// =====================================================
// CHANGE PASSWORD WIZARD (authenticated, keyed by user_id)
// =====================================================

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
async function verifyChangePasswordCode(userId, code) {
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

// =====================================================
// FORGOT PASSWORD FLOW (signed-out, keyed by email)
// =====================================================

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function generateVerificationCode() {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendPasswordResetCode(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  // Find the application user in MySQL
  const user = await getUserByEmailFromMySQL(normalizedEmail);

  if (!user) {
    throw new Error("No account was found with that email address.");
  }

  // Only active accounts can reset their password
  if (user.status !== "active") {
    throw new Error(
      "This account is inactive. Please contact your system administrator."
    );
  }

  // Make sure the Firebase account exists
  let firebaseUser;

  try {
    firebaseUser = await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error(
        "The authentication account for this user could not be found."
      );
    }

    throw error;
  }

  // Invalidate previous unused reset requests
  await pool.query(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE email = ?
        AND used_at IS NULL
    `,
    [normalizedEmail]
  );

  // Generate 6-digit OTP
  const verificationCode = generateVerificationCode();

  // Hash OTP before storing it
  const otpHash = hashValue(verificationCode);

  // OTP expires after 10 minutes
  const otpExpiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  const resetId = randomUUID();

  await pool.query(
    `
      INSERT INTO password_reset_tokens (
        reset_id,
        user_id,
        email,
        otp_hash,
        otp_expires_at,
        otp_attempts
      )
      VALUES (?, ?, ?, ?, ?, 0)
    `,
    [
      resetId,
      user.user_id,
      normalizedEmail,
      otpHash,
      otpExpiresAt,
    ]
  );

  try {
    await sendPasswordResetCodeEmail(
      normalizedEmail,
      user.first_name,
      verificationCode
    );
  } catch (emailError) {
    // Don't leave a usable reset code if email delivery fails
    await pool.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE reset_id = ?
      `,
      [resetId]
    );

    console.error(
      "PASSWORD RESET EMAIL ERROR:",
      emailError
    );

    throw new Error(
      "The verification email could not be sent. Please try again."
    );
  }

  return {
    success: true,
    message: "A verification code has been sent to your email.",
  };
}

async function verifyPasswordResetCode(email, verificationCode) {
  const normalizedEmail = normalizeEmail(email);
  const code = String(verificationCode || "").trim();

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Verification code must be 6 digits.");
  }

  const [rows] = await pool.query(
    `
      SELECT *
      FROM password_reset_tokens
      WHERE email = ?
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [normalizedEmail]
  );

  if (!rows.length) {
    throw new Error(
      "No active password reset request was found."
    );
  }

  const resetRequest = rows[0];

  // Check expiration
  if (
    new Date(resetRequest.otp_expires_at).getTime() <=
    Date.now()
  ) {
    throw new Error(
      "This verification code has expired. Please request a new code."
    );
  }

  // Limit incorrect attempts
  if (resetRequest.otp_attempts >= 5) {
    await pool.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE reset_id = ?
      `,
      [resetRequest.reset_id]
    );

    throw new Error(
      "Too many incorrect attempts. Please request a new code."
    );
  }

  const suppliedHash = hashValue(code);

  if (suppliedHash !== resetRequest.otp_hash) {
    await pool.query(
      `
        UPDATE password_reset_tokens
        SET otp_attempts = otp_attempts + 1
        WHERE reset_id = ?
      `,
      [resetRequest.reset_id]
    );

    throw new Error("Incorrect verification code.");
  }

  // OTP is correct.
  // Generate a temporary reset token for the next step.
  const resetToken = generateResetToken();
  const resetTokenHash = hashValue(resetToken);

  const resetTokenExpiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  await pool.query(
    `
      UPDATE password_reset_tokens
      SET
        reset_token_hash = ?,
        reset_token_expires_at = ?,
        otp_expires_at = NOW()
      WHERE reset_id = ?
    `,
    [
      resetTokenHash,
      resetTokenExpiresAt,
      resetRequest.reset_id,
    ]
  );

  return {
    success: true,
    resetToken,
  };
}

async function resetPassword(email, resetToken, newPassword) {
  const normalizedEmail = normalizeEmail(email);
  const token = String(resetToken || "").trim();
  const password = String(newPassword || "");

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  if (!token) {
    throw new Error("Password reset session is invalid.");
  }

  // Server-side password validation
  if (password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters long."
    );
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error(
      "Password must contain at least one uppercase letter."
    );
  }

  if (!/[0-9]/.test(password)) {
    throw new Error(
      "Password must contain at least one number."
    );
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error(
      "Password must contain at least one special character."
    );
  }

  const tokenHash = hashValue(token);

  const [rows] = await pool.query(
    `
      SELECT *
      FROM password_reset_tokens
      WHERE email = ?
        AND reset_token_hash = ?
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [normalizedEmail, tokenHash]
  );

  if (!rows.length) {
    throw new Error(
      "Password reset session is invalid or has already been used."
    );
  }

  const resetRequest = rows[0];

  // Check reset token expiration
  if (
    !resetRequest.reset_token_expires_at ||
    new Date(resetRequest.reset_token_expires_at).getTime() <=
      Date.now()
  ) {
    throw new Error(
      "Password reset session has expired. Please start again."
    );
  }

  // Find Firebase account
  let firebaseUser;

  try {
    firebaseUser = await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error(
        "The authentication account could not be found."
      );
    }

    throw error;
  }

  // Update the actual Firebase password
  await auth.updateUser(firebaseUser.uid, {
    password,
  });

  // Mark the application's password state as changed
  await pool.query(
    `
      UPDATE \`user\`
      SET
        must_change_password = 0,
        password_changed_at = NOW(),
        temporary_password_expires_at = NULL,
        updated_at = NOW()
      WHERE user_id = ?
    `,
    [resetRequest.user_id]
  );

  // Mark reset token as used
  await pool.query(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE reset_id = ?
    `,
    [resetRequest.reset_id]
  );

  return {
    success: true,
    firebaseUid: firebaseUser.uid,
  };
}

module.exports = {
  createPasswordResetChallenge,
  verifyChangePasswordCode,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  resetPassword,
};
