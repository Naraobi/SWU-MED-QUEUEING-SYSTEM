const bcrypt = require("bcrypt");

const pool = require("../config/mysql");

const {
  sendPinVerificationEmail,
} = require("../utils/emailService");

const {
  createChallenge,
  checkChallenge,
} = require("./verificationCodeService");

/*
|--------------------------------------------------------------------------
| SECURITY PIN SERVICE
|--------------------------------------------------------------------------
|
| The 6-digit Security PIN used to authorize protected admin actions
| (record resets, high-level overrides). The PIN itself is only ever
| stored as a bcrypt hash in `security_pin`; setting or changing it
| requires proving ownership of the account's registered email first
| via a one-time code (see verificationCodeService).
|
|--------------------------------------------------------------------------
*/

const PURPOSE = "security_pin";
const BCRYPT_COST = 10;

/*
|--------------------------------------------------------------------------
| ENSURE TABLE EXISTS
|--------------------------------------------------------------------------
|
| This project has no migration tooling - tables are otherwise created
| by hand. `security_pin` is new, so self-provision it the same way
| userService.js already does for `user_deletion_logs`.
|
|--------------------------------------------------------------------------
*/

async function ensureSecurityPinTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_pin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL UNIQUE,
      pin_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

/*
|--------------------------------------------------------------------------
| GET STATUS
|--------------------------------------------------------------------------
*/

async function getSecurityPinStatus(userId) {
  await ensureSecurityPinTable();

  const [rows] = await pool.query(
    `SELECT id FROM security_pin WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  return rows.length > 0;
}

/*
|--------------------------------------------------------------------------
| REQUEST VERIFICATION CODE
|--------------------------------------------------------------------------
*/

async function requestPinVerification(userId, email, firstName) {
  if (!email) {
    throw new Error(
      "No registered email address is on file for this account."
    );
  }

  const { code, expiresAt } = await createChallenge(
    userId,
    PURPOSE
  );

  await sendPinVerificationEmail(
    email,
    firstName || "there",
    code
  );

  return { expiresAt };
}

/*
|--------------------------------------------------------------------------
| VERIFY CODE + SAVE PIN
|--------------------------------------------------------------------------
*/

async function verifyPinCode(userId, code, pin) {
  if (!/^\d{6}$/.test(String(pin || ""))) {
    throw new Error(
      "PIN must be exactly 6 digits."
    );
  }

  await checkChallenge(userId, PURPOSE, code);
  await ensureSecurityPinTable();

  const pinHash = await bcrypt.hash(
    String(pin),
    BCRYPT_COST
  );

  await pool.query(
    `INSERT INTO security_pin (user_id, pin_hash)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       pin_hash = VALUES(pin_hash),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, pinHash]
  );
}

/*
|--------------------------------------------------------------------------
| VALIDATE PIN
|--------------------------------------------------------------------------
|
| Used to gate protected actions elsewhere in the app (e.g. confirming a
| record reset) - just proves the caller knows the current PIN.
|
|--------------------------------------------------------------------------
*/

async function validateSecurityPin(userId, pin) {
  if (!/^\d{6}$/.test(String(pin || ""))) {
    throw new Error(
      "PIN must be exactly 6 digits."
    );
  }

  await ensureSecurityPinTable();

  const [rows] = await pool.query(
    `SELECT pin_hash FROM security_pin WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    throw new Error(
      "No Security PIN has been set up for this account."
    );
  }

  const isMatch = await bcrypt.compare(
    String(pin),
    rows[0].pin_hash
  );

  if (!isMatch) {
    throw new Error(
      "Invalid Security PIN."
    );
  }
}

module.exports = {
  getSecurityPinStatus,
  requestPinVerification,
  verifyPinCode,
  validateSecurityPin,
};
