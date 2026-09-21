const {
  getAuth,
} = require("firebase-admin/auth");

const {
  getUserByFirebaseUid,
} = require("../services/userService");

/*
|--------------------------------------------------------------------------
| AUTHENTICATE REQUEST
|--------------------------------------------------------------------------
|
| Verifies the Firebase ID token on the Authorization header, resolves it
| to the linked MySQL user profile, and attaches both to the request:
|
| req.firebaseUser  -> decoded Firebase token
| req.user          -> MySQL `user` row
|
|--------------------------------------------------------------------------
*/

async function authenticateRequest(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    const decodedToken =
      await getAuth().verifyIdToken(idToken);

    const firebaseUid = decodedToken.uid;

    const user =
      await getUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No application user profile is linked to this Firebase account.",
      });
    }

    const status = String(
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

    req.firebaseUser = decodedToken;
    req.user = user;

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/id-token-revoked" ||
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-id-token" ||
      error.code === "auth/invalid-argument"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your authentication session is invalid or has expired. Please log in again.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Authentication failed.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| AUTHORIZE ROLES
|--------------------------------------------------------------------------
|
| Must run after authenticateRequest. Rejects the request unless
| req.user.role matches one of the allowed roles (case-insensitive).
|
|--------------------------------------------------------------------------
*/

function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) =>
    String(role).toLowerCase()
  );

  return function (req, res, next) {
    const role = String(
      req.user?.role || ""
    ).toLowerCase();

    if (!normalizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to perform this action.",
      });
    }

    next();
  };
}

module.exports = {
  authenticateRequest,
  authorizeRoles,
};
