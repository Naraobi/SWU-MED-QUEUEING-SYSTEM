const express = require("express");

const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  getSecurityPinStatus,
  requestPinVerification,
  verifyPinCode,
  validateSecurityPin,
} = require("../services/securityPinService");

const router = express.Router();

const securityPinManager = [
  authenticateRequest,
  authorizeRoles("admin", "superadmin"),
];

/*
|--------------------------------------------------------------------------
| GET /api/security/pin/status
|--------------------------------------------------------------------------
*/

router.get(
  "/status",
  ...securityPinManager,
  async (req, res) => {
    try {
      const configured = await getSecurityPinStatus(
        req.user.user_id
      );

      res.json({
        success: true,
        configured,
      });
    } catch (error) {
      console.error(
        "SECURITY PIN STATUS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to retrieve Security PIN status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/security/pin/request
|--------------------------------------------------------------------------
|
| Sends a 6-digit verification code to the caller's registered email.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/request",
  ...securityPinManager,
  async (req, res) => {
    try {
      const { expiresAt } = await requestPinVerification(
        req.user.user_id,
        req.user.email,
        req.user.first_name
      );

      res.json({
        success: true,
        message:
          "A verification code has been sent to your registered email address.",
        expiresAt,
      });
    } catch (error) {
      console.error(
        "SECURITY PIN REQUEST ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to send verification code.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/security/pin/verify
|--------------------------------------------------------------------------
|
| Body: { code, pin }
|
| Confirms the emailed code, then saves the PIN (create or overwrite).
|
|--------------------------------------------------------------------------
*/

router.post(
  "/verify",
  ...securityPinManager,
  async (req, res) => {
    try {
      const { code, pin } = req.body || {};

      await verifyPinCode(
        req.user.user_id,
        code,
        pin
      );

      res.json({
        success: true,
        message:
          "Security PIN has been saved successfully.",
      });
    } catch (error) {
      console.error(
        "SECURITY PIN VERIFY ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to verify the code.",
        attemptsRemaining:
          error.attemptsRemaining,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/security/pin/validate
|--------------------------------------------------------------------------
|
| Body: { pin }
|
| Used to gate protected actions - just proves the caller knows the
| current PIN, without changing anything.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/validate",
  ...securityPinManager,
  async (req, res) => {
    try {
      const { pin } = req.body || {};

      await validateSecurityPin(
        req.user.user_id,
        pin
      );

      res.json({
        success: true,
        message:
          "Security PIN validated successfully.",
      });
    } catch (error) {
      console.error(
        "SECURITY PIN VALIDATE ERROR:",
        error
      );

      const status =
        error.message === "Invalid Security PIN."
          ? 401
          : 400;

      res.status(status).json({
        success: false,
        message:
          error.message ||
          "Failed to validate PIN.",
      });
    }
  }
);

module.exports = router;
