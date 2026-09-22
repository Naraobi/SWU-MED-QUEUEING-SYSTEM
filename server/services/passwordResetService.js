const crypto = require("crypto");
const { randomUUID } = require("crypto");

const pool = require("../config/mysql");
const { auth } = require("../config/firebase");

const {
  getUserByEmailFromMySQL,
} = require("./userService");

const {
  sendPasswordResetCodeEmail,
} = require("../utils/emailService");


// =====================================================
// HELPERS
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


// =====================================================
// SEND PASSWORD RESET CODE
// =====================================================

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

if (
  String(user.status || "").toLowerCase() !== "active"
) {
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


// =====================================================
// VERIFY PASSWORD RESET CODE
// =====================================================

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


// =====================================================
// RESET PASSWORD
// =====================================================

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
  sendPasswordResetCode,
  verifyPasswordResetCode,
  resetPassword,
};