const { getAuth } = require("firebase-admin/auth");

const {
  getUserByFirebaseUid,
} = require("../services/userService");

/**
 * Authenticate a request using the Firebase ID token.
 *
 * Flow:
 * Authorization: Bearer <Firebase ID token>
 *        ↓
 * Firebase verifyIdToken()
 *        ↓
 * Firebase UID
 *        ↓
 * MySQL application user
 */
async function authenticateRequest(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const decodedToken =
      await getAuth().verifyIdToken(idToken);

    const firebaseUid =
      decodedToken.uid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Firebase authentication token.",
      });
    }

    const user =
      await getUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No application user profile is linked to this Firebase account.",
      });
    }

    const status =
      String(user.status || "")
        .trim()
        .toLowerCase();

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
     * Attach authenticated information to req.
     *
     * IMPORTANT:
     * The frontend does not control these values.
     * They come from the verified Firebase token
     * and MySQL.
     */
    req.firebaseUser = decodedToken;
    req.user = user;

    return next();
  } catch (error) {
    console.error(
      "AUTHENTICATION MIDDLEWARE ERROR:",
      error
    );

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/id-token-revoked" ||
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your authentication session is invalid or has expired. Please log in again.",
      });
    }

    if (
      error.code === "auth/invalid-argument"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Authentication failed.",
    });
  }
}

/**
 * Restrict an endpoint to specific application roles.
 *
 * Example:
 * authorizeRoles("superadmin", "admin")
 */
function authorizeRoles(...allowedRoles) {
  const normalizedRoles =
    allowedRoles.map((role) =>
      String(role)
        .trim()
        .toLowerCase()
    );

  return (req, res, next) => {
    const userRole =
      String(req.user?.role || "")
        .trim()
        .toLowerCase();

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to perform this action.",
      });
    }

    return next();
  };
}

module.exports = {
  authenticateRequest,
  authorizeRoles,
};