const express = require("express");

const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const { listAuditLogs } = require("../services/auditLogService");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| AUDIT LOG ACCESS CONTROL
|--------------------------------------------------------------------------
|
| Audit logs are for SuperAdmin/Admin users only, and an Admin only ever
| sees the changes tied to their own department.
|
*/

const auditAccess = [
  authenticateRequest,
  authorizeRoles("superadmin", "admin"),
];

/*
|--------------------------------------------------------------------------
| GET AUDIT LOGS
| GET /api/audit-logs
|--------------------------------------------------------------------------
|
| Query parameters:
|
| startDate   YYYY-MM-DD
| endDate     YYYY-MM-DD
| search      free text
| action      created | updated | deleted | assigned | released
| entityType  user | department | counter | role | position | kiosk
| limit       max 1000
| offset
|
*/

router.get("/", ...auditAccess, async (req, res) => {
  try {
    const role = String(req.user?.role || "").trim().toLowerCase();

    const departmentId =
      role === "admin"
        ? req.user?.department_id || "__none__"
        : req.query.departmentId || null;

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      1000
    );

    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await listAuditLogs({
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      search: req.query.search || null,
      action: req.query.action || null,
      entityType: req.query.entityType || null,
      departmentId,
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load audit logs.",
    });
  }
});

module.exports = router;
