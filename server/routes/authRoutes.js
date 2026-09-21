const express = require("express");

const {
  getUserByFirebaseUid,
  authenticateUser,
  markPasswordChanged,
} = require("../services/userService");

const {
  sendPasswordChangedEmail,
  sendPasswordResetCodeEmail,
} = require("../utils/emailService");

const {
  getAuth,
} = require("firebase-admin/auth");

const {
  authenticateRequest,
} = require("../middleware/authMiddleware");

const {
  createPasswordResetChallenge,
  verifyPasswordResetCode,
} = require("../services/passwordResetService");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/auth/profile
|--------------------------------------------------------------------------
|
| Firebase Authentication
|        ↓
| Firebase ID Token
|        ↓
| Node.js verifies token
|        ↓
| Firebase UID
|        ↓
| MySQL user.firebase_uid
|        ↓
| Application profile
|
|--------------------------------------------------------------------------
*/

router.get("/profile", async (req, res) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | GET AUTHORIZATION HEADER
    |--------------------------------------------------------------------------
    */

    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | EXTRACT FIREBASE ID TOKEN
    |--------------------------------------------------------------------------
    */

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VERIFY FIREBASE ID TOKEN
    |--------------------------------------------------------------------------
    */

    const decodedToken =
      await getAuth().verifyIdToken(
        idToken
      );

    const firebaseUid =
      decodedToken.uid;

    const firebaseEmail =
      decodedToken.email || null;

    /*
    |--------------------------------------------------------------------------
    | FIND APPLICATION USER
    |--------------------------------------------------------------------------
    |
    | First:
    |   Find by Firebase UID.
    |
    | Temporary migration fallback:
    |   If UID is not linked yet, userService may search
    |   by Firebase email and link the Firebase UID.
    |
    |--------------------------------------------------------------------------
    */

    const user =
      await getUserByFirebaseUid(
        firebaseUid,
        firebaseEmail
      );

    /*
    |--------------------------------------------------------------------------
    | USER PROFILE NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No application user profile is linked to this Firebase account.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */
const status =
  String(
    user.status || ""
  ).toLowerCase();

if (
  status === "inactive" ||
  status === "deactivated" ||
  status === "disabled"
) {
  return res.status(403).json({
    success: false,
    message:
      "Your account is inactive. Please contact the administrator.",
  });
}

/*
|--------------------------------------------------------------------------
| CHECK TEMPORARY PASSWORD EXPIRATION
|--------------------------------------------------------------------------
*/

if (
  user.must_change_password === true &&
  user.temporary_password_expires_at &&
  new Date(user.temporary_password_expires_at) <= new Date()
) {
  return res.status(403).json({
    success: false,
    message:
      "Your temporary password has expired. Please contact the administrator.",
    code: "TEMPORARY_PASSWORD_EXPIRED",
  });
}

    /*
    |--------------------------------------------------------------------------
    | RETURN APPLICATION PROFILE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message:
        "User profile retrieved successfully.",

      data: {
        ...user,

        /*
        |--------------------------------------------------------------------------
        | Firebase identity
        |--------------------------------------------------------------------------
        */

        firebase_uid:
          firebaseUid,

        firebaseUid:
          firebaseUid,

        uid:
          firebaseUid,

        emailVerified:
          decodedToken.email_verified === true,
      },
    });
  } catch (error) {
    console.error(
      "AUTH PROFILE ERROR:",
      error
    );

    /*
    |--------------------------------------------------------------------------
    | INVALID FIREBASE TOKEN
    |--------------------------------------------------------------------------
    */

    if (
      error.code ===
        "auth/id-token-expired" ||
      error.code ===
        "auth/id-token-revoked" ||
      error.code ===
        "auth/argument-error" ||
      error.code ===
        "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your authentication session is invalid or has expired. Please log in again.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIREBASE AUTHENTICATION ERROR
    |--------------------------------------------------------------------------
    */

    if (
      error.code ===
        "auth/invalid-argument"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GENERAL SERVER ERROR
    |--------------------------------------------------------------------------
    */

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve user profile.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/auth/password-changed
|--------------------------------------------------------------------------
|
| PURPOSE:
|
| Called after the user successfully changes their temporary
| Firebase password to their own permanent password.
|
| React
|   ↓
| Firebase updatePassword()
|   ↓
| Firebase ID Token
|   ↓
| POST /api/auth/password-changed
|   ↓
| Node.js verifies Firebase ID Token
|   ↓
| Firebase UID
|   ↓
| MySQL user.firebase_uid
|   ↓
| must_change_password = 0
|   ↓
| password_changed_at = current timestamp
|
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| The frontend does NOT send a user ID.
|
| The user is identified securely through the Firebase ID token.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/password-changed",
  async (req, res) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | GET AUTHORIZATION HEADER
      |--------------------------------------------------------------------------
      */

      const authHeader =
        req.headers.authorization || "";

      if (
        !authHeader.startsWith(
          "Bearer "
        )
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication token is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | EXTRACT FIREBASE ID TOKEN
      |--------------------------------------------------------------------------
      */

      const idToken =
        authHeader
          .substring(7)
          .trim();

      if (!idToken) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication token is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | VERIFY FIREBASE ID TOKEN
      |--------------------------------------------------------------------------
      */

      const decodedToken =
        await getAuth().verifyIdToken(
          idToken
        );

      const firebaseUid =
        decodedToken.uid;

      if (!firebaseUid) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Firebase authentication token.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE PASSWORD STATUS
      |--------------------------------------------------------------------------
      |
      | Firebase already changed the actual password.
      |
      | This function updates the application database so the
      | temporary-password requirement is removed.
      |
      |--------------------------------------------------------------------------
      */

    const result = await markPasswordChanged(firebaseUid);

    // Send password-change confirmation email
    try {
      const user = await getUserByFirebaseUid(firebaseUid);

      if (user?.email) {
        await sendPasswordChangedEmail(
          user.email,
          user.first_name || "User"
        );
      }
    } catch (emailError) {
      console.error(
        "PASSWORD CHANGE CONFIRMATION EMAIL ERROR:",
        emailError
      );
}

      /*
      |--------------------------------------------------------------------------
      | SUCCESS
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,
        message:
          "Password status updated successfully.",
        data: result,
      });
    } catch (error) {
      console.error(
        "PASSWORD CHANGED ERROR:",
        error
      );

      /*
      |--------------------------------------------------------------------------
      | INVALID / EXPIRED FIREBASE TOKEN
      |--------------------------------------------------------------------------
      */

      if (
        error.code ===
          "auth/id-token-expired" ||
        error.code ===
          "auth/id-token-revoked" ||
        error.code ===
          "auth/argument-error" ||
        error.code ===
          "auth/invalid-id-token"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Your authentication session is invalid or has expired. Please log in again.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | FIREBASE AUTHENTICATION ERROR
      |--------------------------------------------------------------------------
      */

      if (
        error.code ===
          "auth/invalid-argument"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid authentication token.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | USER PROFILE NOT FOUND
      |--------------------------------------------------------------------------
      */

      if (
        error.message ===
        "User profile could not be found."
      ) {
        return res.status(404).json({
          success: false,
          message:
            "User profile could not be found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GENERAL SERVER ERROR
      |--------------------------------------------------------------------------
      */

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update password status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/auth/login
|--------------------------------------------------------------------------
|
| LEGACY LOGIN
|
| IMPORTANT:
|
| The new login flow uses:
|
| React
|   ↓
| Firebase Authentication
|   ↓
| Firebase ID Token
|   ↓
| GET /api/auth/profile
|
| This route is kept temporarily for older parts of the application.
|
| It still uses the old MySQL password_hash authentication.
|
| Do not use this route for the new Login.jsx.
|
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE REQUEST
    |--------------------------------------------------------------------------
    */

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | LEGACY MYSQL AUTHENTICATION
    |--------------------------------------------------------------------------
    */

    const user =
      await authenticateUser(
        email,
        password
      );

    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      data: user,
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error.message
    );

    /*
    |--------------------------------------------------------------------------
    | INVALID LOGIN
    |--------------------------------------------------------------------------
    */

    return res.status(401).json({
      success: false,
      message:
        error.message ||
        "Login failed.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| VALIDATE NEW PASSWORD STRENGTH
|--------------------------------------------------------------------------
|
| Mirrors the requirements shown to the user in the Change Password
| wizard's UI - enforced here too since the client-side checklist is
| only a UX aid, not a security boundary.
|
|--------------------------------------------------------------------------
*/

function validateNewPasswordStrength(password) {
  const value = String(password || "");

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/\d/.test(value)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include at least one special character.";
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| POST /api/auth/change-password/request
|--------------------------------------------------------------------------
|
| Step 1 of the Change Password wizard. Sends a 6-digit verification
| code to the logged-in user's registered email address.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/change-password/request",
  authenticateRequest,
  async (req, res) => {
    try {
      if (!req.user.email) {
        return res.status(400).json({
          success: false,
          message:
            "No registered email address is on file for this account.",
        });
      }

      const { code, expiresAt } =
        await createPasswordResetChallenge(
          req.user.user_id
        );

      await sendPasswordResetCodeEmail(
        req.user.email,
        req.user.first_name || "there",
        code
      );

      return res.status(200).json({
        success: true,
        message:
          "A verification code has been sent to your registered email address.",
        expiresAt,
      });
    } catch (error) {
      console.error(
        "CHANGE PASSWORD REQUEST ERROR:",
        error
      );

      return res.status(400).json({
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
| POST /api/auth/change-password/verify
|--------------------------------------------------------------------------
|
| Step 2 of the Change Password wizard. Body: { code, newPassword }
|
| Confirms the emailed code, then sets the new Firebase Authentication
| password through the Admin SDK rather than the client-side
| updatePassword(), which requires a "recent" sign-in and would fail
| with auth/requires-recent-login for anyone using this wizard later in
| a session rather than right after logging in - the normal case for a
| voluntary password change from Settings.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/change-password/verify",
  authenticateRequest,
  async (req, res) => {
    try {
      const { code, newPassword } =
        req.body || {};

      const passwordError =
        validateNewPasswordStrength(
          newPassword
        );

      if (passwordError) {
        return res.status(400).json({
          success: false,
          message: passwordError,
        });
      }

      if (!req.user.firebase_uid) {
        return res.status(400).json({
          success: false,
          message:
            "This account is not linked to Firebase Authentication.",
        });
      }

      const verificationResult =
        await verifyPasswordResetCode(
          req.user.user_id,
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

      await getAuth().updateUser(
        req.user.firebase_uid,
        { password: newPassword }
      );

      await markPasswordChanged(
        req.user.firebase_uid
      );

      try {
        await sendPasswordChangedEmail(
          req.user.email,
          req.user.first_name || "there"
        );
      } catch (emailError) {
        console.error(
          "PASSWORD CHANGED EMAIL ERROR:",
          emailError
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Your password has been changed successfully.",
      });
    } catch (error) {
      console.error(
        "CHANGE PASSWORD VERIFY ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to change your password.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;
