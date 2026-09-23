const express = require("express");

const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  getSecurityPin,
  createVerificationChallenge,
  verifyVerificationCode,
  saveSecurityPin,
  validateSecurityPin,
  validateKioskSecurityPin,
} = require("../services/securityPinService");

const {
  sendPinVerificationEmail,
} = require("../utils/emailService");

const router = express.Router();

const securityPinManager = [
  authenticateRequest,
  authorizeRoles("superadmin", "admin"),
];

router.get("/status", ...securityPinManager, async (req, res) => {
  try {
    const pin = await getSecurityPin(req.user.user_id);

    return res.json({
      success: true,
      configured: Boolean(pin),
    });
  } catch (error) {
    console.error(
      "SECURITY PIN STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Security PIN status.",
    });
  }
});

router.post("/setup", ...securityPinManager, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { pin } = req.body;

    if (!/^\d{6}$/.test(String(pin || ""))) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 6 digits.",
      });
    }

    // This endpoint only exists for a user's very first PIN — it skips
    // the email verification challenge because there is no existing PIN
    // yet to protect. Once a PIN exists, changing it must go through
    // /request + /verify instead, so this route refuses to touch an
    // already-configured PIN.
    const existingPin = await getSecurityPin(userId);

    if (existingPin) {
      return res.status(409).json({
        success: false,
        message:
          "A Security PIN is already configured. Use Change PIN in Settings instead.",
      });
    }

    await saveSecurityPin(userId, pin);

    return res.json({
      success: true,
      message: "Security PIN has been created successfully.",
    });
  } catch (error) {
    console.error(
      "SECURITY PIN SETUP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create the Security PIN.",
    });
  }
});

router.post("/request", ...securityPinManager, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const recipientEmail = req.user.email;
    const firstName = req.user.first_name || "User";

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message:
          "No registered email address is available for this account.",
      });
    }

    const {
      code,
      expiresAt,
    } = await createVerificationChallenge(userId);

    await sendPinVerificationEmail(
      recipientEmail,
      firstName,
      code
    );

    return res.json({
      success: true,
      message:
        "A verification code has been sent to your registered email address.",
      expiresAt,
    });
  } catch (error) {
    console.error(
      "SECURITY PIN VERIFICATION REQUEST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send the Security PIN verification code.",
    });
  }
});

router.post("/verify", ...securityPinManager, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const {
      code,
      pin,
    } = req.body;

    if (!/^\d{6}$/.test(String(pin || ""))) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 6 digits.",
      });
    }

    if (!/^\d{6}$/.test(String(code || ""))) {
      return res.status(400).json({
        success: false,
        message:
          "Verification code must be exactly 6 digits.",
      });
    }

    const verificationResult =
      await verifyVerificationCode(
        userId,
        code
      );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
        attemptsRemaining:
          verificationResult.attemptsRemaining,
      });
    }

    await saveSecurityPin(
      userId,
      pin
    );

    return res.json({
      success: true,
      message:
        "Security PIN has been created successfully.",
    });
  } catch (error) {
    console.error(
      "SECURITY PIN VERIFICATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create the Security PIN.",
    });
  }
});

router.post("/validate", ...securityPinManager, async (req, res) => {
  try {
    const {
      pin,
    } = req.body;

    if (!/^\d{6}$/.test(String(pin || ""))) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 6 digits.",
      });
    }

    const isValid =
      await validateSecurityPin(
        req.user.user_id,
        pin
      );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid Security PIN.",
      });
    }

    return res.json({
      success: true,
      message: "Security PIN validated successfully.",
    });
  } catch (error) {
    console.error(
      "SECURITY PIN VALIDATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to validate the Security PIN.",
    });
  }
});

// =========================================================
// KIOSK SECURITY PIN VALIDATION
// =========================================================
//
// Patient View uses this endpoint.
//
// IMPORTANT:
// No authenticateRequest here.
// Patient View does not require a Firebase login.
//
// Superadmin PIN:
//   Can activate any kiosk.
//
// Admin PIN:
//   Can activate only a kiosk assigned
//   to their department.
// =========================================================

router.post("/kiosk-validate", async (req, res) => {
  try {
    const {
      kiosk_id,
      pin,
    } = req.body;

    if (!/^\d{6}$/.test(String(pin || ""))) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 6 digits.",
      });
    }

    if (!kiosk_id) {
      return res.status(400).json({
        success: false,
        message: "Kiosk ID is required.",
      });
    }

    const result =
      await validateKioskSecurityPin(
        kiosk_id,
        pin
      );

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error(
      "KIOSK SECURITY PIN VALIDATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to validate the kiosk Security PIN.",
    });
  }
});

module.exports = router;