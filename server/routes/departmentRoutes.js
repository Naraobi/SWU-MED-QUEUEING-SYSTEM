const express = require("express");

const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  resetDepartments,
} = require("../services/departmentService");

const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET ALL DEPARTMENTS
|--------------------------------------------------------------------------
| GET /api/departments
*/
router.get("/", async (req, res) => {
  try {
    const departments = await getDepartments();

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("GET DEPARTMENTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve departments",
      error: error.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| GET ONE DEPARTMENT
|--------------------------------------------------------------------------
| GET /api/departments/:id
*/
router.get("/:id", async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error("GET DEPARTMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve department",
      error: error.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| CREATE DEPARTMENT
|--------------------------------------------------------------------------
| POST /api/departments
*/
router.post("/", async (req, res) => {
  try {
    const department = await createDepartment(req.body);

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    console.error("CREATE DEPARTMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create department",
      error: error.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| UPDATE DEPARTMENT
|--------------------------------------------------------------------------
| PUT /api/departments/:id
*/
router.put("/:id", async (req, res) => {
  try {
    const department = await updateDepartment(
      req.params.id,
      req.body
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("UPDATE DEPARTMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update department",
      error: error.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| DELETE DEPARTMENT
|--------------------------------------------------------------------------
| DELETE /api/departments/:id
*/
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteDepartment(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("DELETE DEPARTMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete department",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| RESET SELECTED DEPARTMENTS
|--------------------------------------------------------------------------
| POST /api/departments/reset
*/

router.post(
  "/reset",
  authenticateRequest,
  authorizeRoles("superadmin"),
  async (req, res) => {
  try {
    const { departmentIds } = req.body;

    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No departments selected for reset.",
      });
    }

    const result = await resetDepartments(departmentIds);

    res.json({
      success: true,
      message: "Departments reset successfully.",
      data: result,
    });
  } catch (error) {
    console.error("RESET DEPARTMENTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reset departments.",
      error: error.message,
    });
  }
});

module.exports = router;