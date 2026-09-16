const express = require("express");

const {
  getUserByFirebaseUid,
  authenticateUser,
  markPasswordChanged,
} = require("../services/userService");

const {
  getAuth,
} = require("firebase-admin/auth");

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

      const result =
        await markPasswordChanged(
          firebaseUid
        );

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
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;
