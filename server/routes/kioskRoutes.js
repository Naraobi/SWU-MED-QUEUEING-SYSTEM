
const express = require("express");

const {
  getKiosks,
  getKioskById,
  createKiosk,
  updateKiosk,
  deleteKiosk,
  verifyKioskPin,
  createOrUpdateKioskPin,
  getKioskPinStatus,
} = require("../services/kioskService");
const {
  getKioskUnlockStatus,
  remoteUnlockKiosk,
} = require("../services/securityPinService");
const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| VERIFY KIOSK PIN
|--------------------------------------------------------------------------
| POST /api/kiosks/:id/verify-pin
|
| Public endpoint for the physical kiosk's PIN screen.
| Apply rate limiting at the router or application level.
|--------------------------------------------------------------------------
*/

router.post("/:id/verify-pin", async (req, res) => {
  try {
    const { pin } = req.body;

    const result = await verifyKioskPin(
      req.params.id,
      pin
    );

    if (!result.valid) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: "Incorrect kiosk PIN.",
      });
    }

    return res.json({
      success: true,
      valid: true,
      message: "Kiosk PIN verified successfully.",
    });
  } catch (error) {
    console.error("VERIFY KIOSK PIN ERROR:", error);

    const statusCode =
      error.message === "Kiosk ID is required." ||
      error.message === "Kiosk PIN must be exactly 4 digits."
        ? 400
        : error.message.includes("inactive") ||
          error.message.includes("does not exist")
          ? 404
          : 500;

    return res.status(statusCode).json({
      success: false,
      valid: false,
      message:
        error.message ||
        "Failed to verify kiosk PIN.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE OR UPDATE KIOSK PIN
|--------------------------------------------------------------------------
| POST /api/kiosks/:id/pins
|
| Initially restricted to superadmin.
| The server does not accept a role supplied by the client.
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/pins",
  authenticateRequest,
  authorizeRoles("superadmin"),
  async (req, res) => {
    try {
      const { role, department_id, pin } = req.body;

      if (!role || !pin) {
        return res.status(400).json({
          success: false,
          message: "Role and PIN are required.",
        });
      }

      const normalizedRole = String(role)
        .trim()
        .toLowerCase();

      if (!["superadmin", "admin"].includes(normalizedRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid PIN role.",
        });
      }

      if (
        normalizedRole === "admin" &&
        !department_id
      ) {
        return res.status(400).json({
          success: false,
          message: "Department ID is required for an admin PIN.",
        });
      }

      if (
        normalizedRole === "superadmin" &&
        req.params.id
      ) {
        // The superadmin PIN is global.
        // The URL kiosk ID is not used for its storage.
      }

      const result = await createOrUpdateKioskPin({
        kioskId:
          normalizedRole === "admin"
            ? req.params.id
            : null,
        departmentId:
          normalizedRole === "admin"
            ? department_id
            : null,
        role: normalizedRole,
        pin,
      });

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("SAVE KIOSK PIN ERROR:", error);

      const statusCode =
        error.message.includes("required") ||
        error.message.includes("exactly 4 digits") ||
        error.message.includes("Invalid")
          ? 400
          : error.message.includes("does not belong") ||
            error.message.includes("not active")
            ? 403
            : 500;

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to save kiosk PIN.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET KIOSK PIN CONFIGURATION STATUS
|--------------------------------------------------------------------------
| GET /api/kiosks/:id/pins
|
| Returns PIN configuration metadata only.
| Never returns PIN hashes.
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/pins",
  authenticateRequest,
  authorizeRoles("superadmin"),
  async (req, res) => {
    try {
      const kiosk = await getKioskById(req.params.id);

      if (!kiosk) {
        return res.status(404).json({
          success: false,
          message: "Kiosk not found.",
        });
      }

      const pins = await getKioskPinStatus(
        req.params.id
      );

      return res.json({
        success: true,
        data: pins,
      });
    } catch (error) {
      console.error("GET KIOSK PIN STATUS ERROR:", error);

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to retrieve kiosk PIN status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET ALL KIOSKS
|--------------------------------------------------------------------------
| GET /api/kiosks
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const kiosks = await getKiosks();

    return res.json({
      success: true,
      data: kiosks,
    });
  } catch (error) {
    console.error("GET KIOSKS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve kiosks.",
      error: error.message,
    });
  }
});


router.get(
  "/kiosk-status/:kiosk_id",
  async (req, res) => {
    try {
      const { kiosk_id } = req.params;

      if (!kiosk_id) {
        return res.status(400).json({
          success: false,
          message: "Kiosk ID is required.",
        });
      }

      const status = await getKioskUnlockStatus(
        kiosk_id
      );

      return res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      console.error(
        "KIOSK STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve kiosk status.",
      });
    }
  }
);

router.get("/:id", async (req, res) => {
  try {
    const kiosk = await getKioskById(req.params.id);

    if (!kiosk) {
      return res.status(404).json({
        success: false,
        message: "Kiosk not found.",
      });
    }

    return res.json({
      success: true,
      data: kiosk,
    });
  } catch (error) {
    console.error("GET KIOSK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve kiosk.",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE KIOSK
|--------------------------------------------------------------------------
| POST /api/kiosks
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const kiosk = await createKiosk(req.body);

    return res.status(201).json({
      success: true,
      message: "Kiosk created successfully.",
      data: kiosk,
    });
  } catch (error) {
    console.error("CREATE KIOSK ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create kiosk.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE KIOSK
|--------------------------------------------------------------------------
| PUT /api/kiosks/:id
|--------------------------------------------------------------------------
*/

router.put("/:id", async (req, res) => {
  try {
    const kiosk = await updateKiosk(
      req.params.id,
      req.body
    );

    if (!kiosk) {
      return res.status(404).json({
        success: false,
        message: "Kiosk not found.",
      });
    }

    return res.json({
      success: true,
      message: "Kiosk updated successfully.",
      data: kiosk,
    });
  } catch (error) {
    console.error("UPDATE KIOSK ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update kiosk.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE KIOSK
|--------------------------------------------------------------------------
| DELETE /api/kiosks/:id
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteKiosk(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Kiosk not found.",
      });
    }

    return res.json({
      success: true,
      message: "Kiosk deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE KIOSK ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete kiosk.",
    });
  }
});

router.post(
  "/:id/remote-unlock",
  authenticateRequest,
  authorizeRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const { pin } = req.body;

      // Use the authenticated user's database ID.
      const userId = req.user.user_id;

      const result = await remoteUnlockKiosk(
        req.params.id,
        userId,
        pin
      );

      if (!result.success) {
        return res.status(403).json(result);
      }

      return res.json(result);
    } catch (error) {
      console.error("Remote kiosk unlock error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to remotely unlock kiosk.",
      });
    }
  }
);
module.exports = router;