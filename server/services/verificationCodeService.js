const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("../config/mysql");

/*
|--------------------------------------------------------------------------
| VERIFICATION CODE SERVICE
|--------------------------------------------------------------------------
|
| Shared 6-digit email verification-code plumbing, used by both the
| Security PIN feature and the Change Password wizard. Challenges are
| scoped by `purpose` so a pending PIN code and a pending password-change
| code never collide for the same user.
|
| Table: pin_verification (user_id, purpose, code_hash, expires_at,
|        attempts, verified, created_at)
|
|--------------------------------------------------------------------------
*/

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const BCRYPT_COST = 10;

/*
|--------------------------------------------------------------------------
| ENSURE TABLE EXISTS
|--------------------------------------------------------------------------
|
| This project has no migration tooling - tables are otherwise created
| by hand. `pin_verification` is new, so self-provision it the same way
| userService.js already does for `user_deletion_logs`.
|
|--------------------------------------------------------------------------
*/

async function ensurePinVerificationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pin_verification (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pin_verification_lookup (user_id, purpose, verified)
    )
  `);
}

function generateCode() {
  return String(
    crypto.randomInt(0, 1000000)
  ).padStart(CODE_LENGTH, "0");
}

/*
|--------------------------------------------------------------------------
| CREATE CHALLENGE
|--------------------------------------------------------------------------
|
| Invalidates any previous unverified challenge for this user/purpose,
| creates a new one, and returns the plaintext code so the caller can
| email it (it is never returned to the client, only hashed and stored).
|
|--------------------------------------------------------------------------
*/

async function createChallenge(userId, purpose) {
  await ensurePinVerificationTable();

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(
    Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000
  );

  await pool.query(
    `UPDATE pin_verification
     SET verified = 1
     WHERE user_id = ? AND purpose = ? AND verified = 0`,
    [userId, purpose]
  );

  await pool.query(
    `INSERT INTO pin_verification
      (user_id, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, purpose, codeHash, expiresAt]
  );

  return {
    code,
    expiresAt,
  };
}

/*
|--------------------------------------------------------------------------
| CHECK CHALLENGE
|--------------------------------------------------------------------------
|
| Verifies `code` against the most recent unverified challenge for this
| user/purpose. Throws a descriptive Error on any failure; on success,
| marks the challenge as consumed so it cannot be reused.
|
|--------------------------------------------------------------------------
*/

async function checkChallenge(userId, purpose, code) {
  if (!/^\d{6}$/.test(String(code || ""))) {
    throw new Error(
      "Verification code must be exactly 6 digits."
    );
  }

  await ensurePinVerificationTable();

  const [rows] = await pool.query(
    `SELECT *
     FROM pin_verification
     WHERE user_id = ? AND purpose = ? AND verified = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose]
  );

  const challenge = rows[0];

  if (!challenge) {
    throw new Error(
      "No verification code was requested. Please request a new code."
    );
  }

  if (new Date(challenge.expires_at) < new Date()) {
    await pool.query(
      `UPDATE pin_verification SET verified = 1 WHERE id = ?`,
      [challenge.id]
    );

    throw new Error(
      "This verification code has expired. Please request a new one."
    );
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await pool.query(
      `UPDATE pin_verification SET verified = 1 WHERE id = ?`,
      [challenge.id]
    );

    throw new Error(
      "Too many incorrect attempts. Please request a new code."
    );
  }

  const isMatch = await bcrypt.compare(
    String(code),
    challenge.code_hash
  );

  if (!isMatch) {
    await pool.query(
      `UPDATE pin_verification SET attempts = attempts + 1 WHERE id = ?`,
      [challenge.id]
    );

    const attemptsRemaining =
      MAX_ATTEMPTS - (challenge.attempts + 1);

    const error = new Error(
      "The verification code you entered is incorrect."
    );

    error.attemptsRemaining = Math.max(
      0,
      attemptsRemaining
    );

    throw error;
  }

  await pool.query(
    `UPDATE pin_verification SET verified = 1 WHERE id = ?`,
    [challenge.id]
  );
}

/*
|--------------------------------------------------------------------------
| CONFIRM VERIFIED CHALLENGE
|--------------------------------------------------------------------------
|
| For flows that need proof of the *already-verified* challenge from a
| later step (e.g. Change Password verifies the code first, then collects
| the new password as a separate request). checkChallenge() only matches
| `verified = 0` rows, since it consumes the challenge - this looks for
| the matching row after it's been consumed instead, still bounded by the
| code's original expiry so a finalize step can't be replayed indefinitely.
|
|--------------------------------------------------------------------------
*/

async function confirmVerifiedChallenge(userId, purpose, code) {
  if (!/^\d{6}$/.test(String(code || ""))) {
    throw new Error(
      "Verification code must be exactly 6 digits."
    );
  }

  await ensurePinVerificationTable();

  const [rows] = await pool.query(
    `SELECT *
     FROM pin_verification
     WHERE user_id = ? AND purpose = ? AND verified = 1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose]
  );

  const challenge = rows[0];

  if (!challenge || new Date(challenge.expires_at) < new Date()) {
    throw new Error(
      "Your verification has expired. Please start over."
    );
  }

  const isMatch = await bcrypt.compare(
    String(code),
    challenge.code_hash
  );

  if (!isMatch) {
    throw new Error(
      "Your verification has expired. Please start over."
    );
  }
}

module.exports = {
  createChallenge,
  checkChallenge,
  confirmVerifiedChallenge,
};
