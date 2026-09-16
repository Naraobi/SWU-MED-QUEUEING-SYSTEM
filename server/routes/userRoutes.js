const express = require("express");

const {
  getUsers,
  getUserById,
  getUserByEmail,
  getStaffByDepartment,
  createUser,
  updateUser,
  deleteUser,
  createUserDeletionLog,
} = require("../services/userService");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET ALL USERS
|--------------------------------------------------------------------------
|
| GET /api/users
|
*/

router.get("/", async (req, res) => {
  try {
    const users = await getUsers();

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET USER BY EMAIL
|--------------------------------------------------------------------------
|
| GET /api/users/by-email/:email
|
| IMPORTANT:
| This route MUST be before /:id.
|
*/

router.get("/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("GET USER BY EMAIL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET STAFF BY DEPARTMENT
|--------------------------------------------------------------------------
|
| GET /api/users/department/:departmentId
|
| Used by Kiosk Management when assigning staff to a terminal.
|
| IMPORTANT:
| This route MUST be before /:id.
|
*/

router.get("/department/:departmentId", async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: "Department ID is required",
      });
    }

    const staff = await getStaffByDepartment(departmentId);

    return res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("GET STAFF BY DEPARTMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve staff for department",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET USER BY ID
|--------------------------------------------------------------------------
|
| GET /api/users/:id
|
*/

router.get("/:id", async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("GET USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE USER
|--------------------------------------------------------------------------
|
| POST /api/users
|
*/

router.post("/", async (req, res) => {
  try {
    const user = await createUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    const message =
      error.message ||
      "Failed to create user";

    if (
      message.toLowerCase().includes("already exists") ||
      message.toLowerCase().includes("duplicate")
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
|
| PUT /api/users/:id
|
*/

router.put("/:id", async (req, res) => {
  try {
    const user = await updateUser(
      req.params.id,
      req.body
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    const message =
      error.message ||
      "Failed to update user";

    if (
      message.toLowerCase().includes("already exists") ||
      message.toLowerCase().includes("duplicate")
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE USER
|--------------------------------------------------------------------------
|
| DELETE /api/users/:id
|
*/

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    /*
    |--------------------------------------------------------------------------
    | GET USER FIRST
    |--------------------------------------------------------------------------
    */

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GET DELETION INFORMATION
    |--------------------------------------------------------------------------
    */

    const reason =
      req.body?.deletion_reason ||
      req.body?.reason ||
      "";

    const deletedBy =
      req.body?.deletedBy ||
      "superadmin";

    /*
    |--------------------------------------------------------------------------
    | SAVE DELETION LOG
    |--------------------------------------------------------------------------
    */

    await createUserDeletionLog({
      userId,
      userData: user,
      reason,
      deletedBy,
    });

    /*
    |--------------------------------------------------------------------------
    | DELETE USER
    |--------------------------------------------------------------------------
    */

    const deleted = await deleteUser(userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "User could not be deleted",
      });
    }

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;