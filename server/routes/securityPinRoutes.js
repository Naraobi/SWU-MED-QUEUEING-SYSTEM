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

module.exports = router;