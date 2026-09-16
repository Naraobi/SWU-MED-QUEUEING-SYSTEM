const express = require("express");

const {
  getKiosks,
  getKioskById,
  createKiosk,
  updateKiosk,
  deleteKiosk,
  verifyKioskPin,
} = require("../services/kioskService");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| VERIFY KIOSK PIN
|--------------------------------------------------------------------------
| POST /api/kiosks/:id/verify-pin
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/verify-pin",
  async (req, res) => {
    try {
      const { pin } = req.body;

      const valid =
        await verifyKioskPin(
          req.params.id,
          pin
        );

      if (!valid) {
        return res.status(401).json({
          success: false,
          valid: false,
          message:
            "Incorrect kiosk PIN.",
        });
      }

      res.json({
        success: true,
        valid: true,
        message:
          "Kiosk PIN verified successfully.",
      });
    } catch (error) {
      console.error(
        "VERIFY KIOSK PIN ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        valid: false,
        message:
          error.message ||
          "Failed to verify kiosk PIN.",
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

router.get(
  "/",
  async (req, res) => {
    try {
      const kiosks =
        await getKiosks();

      res.json({
        success: true,
        data: kiosks,
      });
    } catch (error) {
      console.error(
        "GET KIOSKS ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to retrieve kiosks",
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET ONE KIOSK
|--------------------------------------------------------------------------
| GET /api/kiosks/:id
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  async (req, res) => {
    try {
      const kiosk =
        await getKioskById(
          req.params.id
        );

      if (!kiosk) {
        return res.status(404).json({
          success: false,
          message:
            "Kiosk not found",
        });
      }

      res.json({
        success: true,
        data: kiosk,
      });
    } catch (error) {
      console.error(
        "GET KIOSK ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to retrieve kiosk",
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CREATE KIOSK
|--------------------------------------------------------------------------
| POST /api/kiosks
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  async (req, res) => {
    try {
      const kiosk =
        await createKiosk(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Kiosk created successfully",
        data: kiosk,
      });
    } catch (error) {
      console.error(
        "CREATE KIOSK ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create kiosk",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE KIOSK
|--------------------------------------------------------------------------
| PUT /api/kiosks/:id
|--------------------------------------------------------------------------
*/

router.put(
  "/:id",
  async (req, res) => {
    try {
      const kiosk =
        await updateKiosk(
          req.params.id,
          req.body
        );

      if (!kiosk) {
        return res.status(404).json({
          success: false,
          message:
            "Kiosk not found",
        });
      }

      res.json({
        success: true,
        message:
          "Kiosk updated successfully",
        data: kiosk,
      });
    } catch (error) {
      console.error(
        "UPDATE KIOSK ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update kiosk",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE KIOSK
|--------------------------------------------------------------------------
| DELETE /api/kiosks/:id
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const deleted =
        await deleteKiosk(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message:
            "Kiosk not found",
        });
      }

      res.json({
        success: true,
        message:
          "Kiosk deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE KIOSK ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete kiosk",
      });
    }
  }
);

module.exports = router;

