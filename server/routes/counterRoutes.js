
const express = require("express");

const router = express.Router();

const {
  getCounters,
  getCounterById,
  createCounter,
  updateCounter,
  deleteCounter,
  assignCounter,
  releaseCounter,
  getStaffCounter,
} = require("../services/counterService");

// =====================================================
// GET ALL COUNTERS
// GET /api/counters
// =====================================================

router.get("/", async (req, res) => {
  try {
    const counters = await getCounters();

    return res.status(200).json({
      success: true,
      data: counters,
    });
  } catch (error) {
    console.error(
      "GET /api/counters error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve counters",
    });
  }
});

// =====================================================
// GET STAFF'S CURRENT COUNTER
// GET /api/counters/staff/:staffId
//
// IMPORTANT:
// This route MUST come before GET /:id.
// Otherwise Express may interpret "staff" as an ID.
// =====================================================

router.get(
  "/staff/:staffId",
  async (req, res) => {
    try {
      const { staffId } = req.params;

      if (!staffId) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      const counter =
        await getStaffCounter(staffId);

      return res.status(200).json({
        success: true,
        data: counter,
      });
    } catch (error) {
      console.error(
        "GET /api/counters/staff/:staffId error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to retrieve staff counter",
      });
    }
  }
);

// =====================================================
// ASSIGN COUNTER / TERMINAL TO STAFF
// POST /api/counters/:id/assign
//
// Body:
// {
//   "staff_id": "STAFF-ID"
// }
//
// Rules are enforced inside counterService.js:
// - Staff must exist.
// - Terminal must exist.
// - Staff and terminal must belong to same department.
// - Terminal must be active.
// - Terminal cannot belong to another staff member.
// - Staff cannot have another terminal assigned.
// - Assignment is performed atomically in MySQL.
// =====================================================

router.post(
  "/:id/assign",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { staff_id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Counter ID is required",
        });
      }

      if (!staff_id) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      const counter =
        await assignCounter(
          id,
          staff_id
        );

      return res.status(200).json({
        success: true,
        message:
          "Counter assigned successfully",
        data: counter,
      });
    } catch (error) {
      console.error(
        "POST /api/counters/:id/assign error:",
        error
      );

      const message =
        error.message ||
        "Failed to assign counter";

      let statusCode = 400;

      if (
        message ===
          "Counter not found" ||
        message ===
          "Staff user not found"
      ) {
        statusCode = 404;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
);

// =====================================================
// RELEASE COUNTER / TERMINAL FROM STAFF
// POST /api/counters/:id/release
//
// Body:
// {
//   "staff_id": "STAFF-ID"
// }
//
// IMPORTANT:
// The staff ID is required.
// The service verifies that this staff member actually
// owns the terminal before releasing it.
// =====================================================

router.post(
  "/:id/release",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { staff_id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Counter ID is required",
        });
      }

      if (!staff_id) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      const result =
        await releaseCounter(
          id,
          staff_id
        );

      return res.status(200).json({
        success: true,
        message:
          "Counter released successfully",
        data: result,
      });
    } catch (error) {
      console.error(
        "POST /api/counters/:id/release error:",
        error
      );

      const message =
        error.message ||
        "Failed to release counter";

      let statusCode = 400;

      if (
        message ===
        "Counter not found"
      ) {
        statusCode = 404;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
);

// =====================================================
// GET COUNTER BY ID
// GET /api/counters/:id
//
// IMPORTANT:
// This must remain AFTER /staff/:staffId.
// =====================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Counter ID is required",
        });
      }

      const counter =
        await getCounterById(id);

      return res.status(200).json({
        success: true,
        data: counter,
      });
    } catch (error) {
      console.error(
        "GET /api/counters/:id error:",
        error
      );

      const statusCode =
        error.message ===
        "Counter not found"
          ? 404
          : 500;

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to retrieve counter",
      });
    }
  }
);

// =====================================================
// CREATE COUNTER
// POST /api/counters
//
// Expected body:
// {
//   department_id,
//   counter_number,
//   prefix,
//   assigned_staff_id,
//   status
// }
// =====================================================

router.post(
  "/",
  async (req, res) => {
    try {
      const counter =
        await createCounter(
          req.body
        );

      return res.status(201).json({
        success: true,
        message:
          "Counter created successfully",
        data: counter,
      });
    } catch (error) {
      console.error(
        "POST /api/counters error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to create counter",
      });
    }
  }
);

// =====================================================
// UPDATE COUNTER
// PUT /api/counters/:id
// =====================================================

router.put(
  "/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Counter ID is required",
        });
      }

      const counter =
        await updateCounter(
          id,
          req.body
        );

      return res.status(200).json({
        success: true,
        message:
          "Counter updated successfully",
        data: counter,
      });
    } catch (error) {
      console.error(
        "PUT /api/counters/:id error:",
        error
      );

      const statusCode =
        error.message ===
        "Counter not found"
          ? 404
          : 400;

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to update counter",
      });
    }
  }
);

// =====================================================
// DELETE COUNTER
// DELETE /api/counters/:id
// =====================================================

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Counter ID is required",
        });
      }

      const result =
        await deleteCounter(id);

      return res.status(200).json({
        success: true,
        message:
          "Counter deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error(
        "DELETE /api/counters/:id error:",
        error
      );

      const statusCode =
        error.message ===
        "Counter not found"
          ? 404
          : 400;

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to delete counter",
      });
    }
  }
);

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;