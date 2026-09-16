const express = require("express");

const {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require("../services/roleService");

const router = express.Router();

// GET /api/roles
router.get("/", async (req, res) => {
  try {
    const roles = await getAllRoles();

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("GET /api/roles ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch roles.",
    });
  }
});

// GET /api/roles/:id
router.get("/:id", async (req, res) => {
  try {
    const role = await getRoleById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("GET /api/roles/:id ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch role.",
    });
  }
});

// POST /api/roles
router.post("/", async (req, res) => {
  try {
    const {
      role_id,
      role,
      description,
      status,
      permissions,
    } = req.body;

    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required.",
      });
    }

    if (!role || !role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required.",
      });
    }

    const createdRole = await createRole({
      role_id,
      role: role.trim(),
      description,
      status,
      permissions,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully.",
      data: createdRole,
    });
  } catch (error) {
    console.error("POST /api/roles ERROR:", error);

    const statusCode = error.message?.includes("already exists")
      ? 409
      : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create role.",
    });
  }
});

// PUT /api/roles/:id
router.put("/:id", async (req, res) => {
  try {
    const {
      role,
      description,
      status,
      permissions,
    } = req.body;

    if (!role || !role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role name is required.",
      });
    }

    const updatedRole = await updateRole(req.params.id, {
      role: role.trim(),
      description,
      status,
      permissions,
    });

    res.status(200).json({
      success: true,
      message: "Role updated successfully.",
      data: updatedRole,
    });
  } catch (error) {
    console.error("PUT /api/roles/:id ERROR:", error);

    const statusCode =
      error.message?.includes("already exists")
        ? 409
        : error.message?.includes("not found")
        ? 404
        : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update role.",
    });
  }
});

// DELETE /api/roles/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteRole(req.params.id);

    res.status(200).json(result);
  } catch (error) {
    console.error("DELETE /api/roles/:id ERROR:", error);

    const statusCode =
      error.message?.includes("cannot be deleted")
        ? 409
        : error.message?.includes("not found")
        ? 404
        : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete role.",
    });
  }
});

module.exports = router;