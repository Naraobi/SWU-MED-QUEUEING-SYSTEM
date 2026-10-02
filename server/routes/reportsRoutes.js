const express = require("express");

const {
  authenticateRequest,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const pool = require("../config/mysql");

const router = express.Router();


// =====================================================
// REPORT ACCESS CONTROL
// =====================================================
//
// Reports are intended for SuperAdmin/Admin users.
// The frontend must not be the only protection.
// =====================================================

const reportAccess = [
  authenticateRequest,
  authorizeRoles("superadmin", "admin"),
];


// =====================================================
// GET REPORT DEPARTMENTS
// GET /api/reports/departments
// =====================================================

router.get(
  "/departments",
  ...reportAccess,
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          department_id,
          name,
          kiosk_id,
          status
        FROM department
        ORDER BY name ASC
      `);

      return res.json({
        success: true,
        data: rows.map((row) => ({
          departmentId:
            row.department_id,

          name:
            row.name,

          kioskId:
            row.kiosk_id,

          status:
            row.status,
        })),
      });
    } catch (error) {
      console.error(
        "GET /api/reports/departments error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load report departments.",
      });
    }
  }
);


// =====================================================
// GET REPORT KIOSKS
// GET /api/reports/kiosks
// =====================================================

router.get(
  "/kiosks",
  ...reportAccess,
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          kiosk_id,
          name,
          status
        FROM kiosk
        ORDER BY name ASC
      `);

      return res.json({
        success: true,
        data: rows.map((row) => ({
          kioskId:
            row.kiosk_id,

          name:
            row.name,

          status:
            row.status,
        })),
      });
    } catch (error) {
      console.error(
        "GET /api/reports/kiosks error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load report kiosks.",
      });
    }
  }
);


// =====================================================
// GET REPORT DATA
// GET /api/reports/data
// =====================================================
//
// Query parameters:
//
// reportType
// startDate
// endDate
// departmentId
// kioskId
//
// Example:
//
// /api/reports/data
// ?reportType=department
// &startDate=2026-10-02
// &endDate=2026-10-02
// &departmentId=all
// &kioskId=all
// =====================================================

router.get(
  "/data",
  ...reportAccess,
  async (req, res) => {
    const {
      reportType,
      startDate,
      endDate,
      departmentId,
      kioskId,
    } = req.query;

    // -------------------------------------------------
    // VALIDATE REPORT TYPE
    // -------------------------------------------------

    const validReportTypes = [
      "department",
      "staff",
      "served",
    ];

    if (
      !reportType ||
      !validReportTypes.includes(
        reportType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid report type is required.",
      });
    }

    // -------------------------------------------------
    // VALIDATE DATES
    // -------------------------------------------------

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Start date and end date are required.",
      });
    }

    // Basic YYYY-MM-DD validation.
    const datePattern =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !datePattern.test(startDate) ||
      !datePattern.test(endDate)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Dates must use YYYY-MM-DD format.",
      });
    }

    // -------------------------------------------------
    // DEPARTMENT PERFORMANCE
    // -------------------------------------------------

    if (
      reportType ===
      "department"
    ) {
      return getDepartmentReport(
        req,
        res
      );
    }

    // -------------------------------------------------
    // SERVED QUEUES
    // -------------------------------------------------

    if (
      reportType ===
      "served"
    ) {
      return getServedReport(
        req,
        res
      );
    }

    // -------------------------------------------------
    // STAFF PERFORMANCE
    // -------------------------------------------------
    //
    // IMPORTANT:
    //
    // We are intentionally NOT returning
    // historical staff/session data yet.
    //
    // counter.assigned_staff_id represents the
    // current assignment, not the historical staff
    // who operated a counter at the time a queue
    // was served.
    //
    // Login/logout timestamps also require persistent
    // staff terminal session history.
    // -------------------------------------------------

    if (
  reportType ===
  "staff"
) {
  return getStaffReport(
    req,
    res
  );
}

    return res.status(400).json({
      success: false,
      message:
        "Unsupported report type.",
    });
  }
);


// =====================================================
// DEPARTMENT PERFORMANCE REPORT
// =====================================================
//
// Columns:
//
// Department
// Total Queues
// Served
// Skipped
// Terminals
// Service Rate
//
// =====================================================

async function getDepartmentReport(
  req,
  res
) {
  const {
    startDate,
    endDate,
    departmentId,
    kioskId,
  } = req.query;

  const conditions = [];

  const params = [];

  // -------------------------------------------------
  // DATE FILTER
  // -------------------------------------------------

  conditions.push(
    `DATE(qt.issued_at) BETWEEN ? AND ?`
  );

  params.push(
    startDate,
    endDate
  );

  // -------------------------------------------------
  // DEPARTMENT FILTER
  // -------------------------------------------------

  if (
    departmentId &&
    departmentId !== "all"
  ) {
    conditions.push(
      `d.department_id = ?`
    );

    params.push(
      departmentId
    );
  }

  // -------------------------------------------------
  // KIOSK FILTER
  // -------------------------------------------------

  if (
    kioskId &&
    kioskId !== "all"
  ) {
    conditions.push(
      `d.kiosk_id = ?`
    );

    params.push(
      kioskId
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  try {
    const [rows] =
      await pool.query(
        `
        SELECT

          d.department_id,

          d.name
            AS department,

          COUNT(
            DISTINCT qt.queue_id
          )
            AS total_queues,

          COUNT(
            DISTINCT CASE
              WHEN qt.status =
                'completed'
              THEN qt.queue_id
            END
          )
            AS served,

          COUNT(
            DISTINCT CASE
              WHEN qt.status =
                'cancelled'
              THEN qt.queue_id
            END
          )
            AS skipped,

          COUNT(
            DISTINCT c.counter_id
          )
            AS terminals

        FROM department d

        LEFT JOIN queue_ticket qt
          ON qt.department_id =
            d.department_id

        LEFT JOIN counter c
          ON c.department_id =
            d.department_id

        ${whereClause}

        GROUP BY
          d.department_id,
          d.name

        ORDER BY
          d.name ASC
        `,
        params
      );

    const reportRows =
      rows.map((row) => {
        const totalQueues =
          Number(
            row.total_queues
          ) || 0;

        const served =
          Number(
            row.served
          ) || 0;

        const skipped =
          Number(
            row.skipped
          ) || 0;

        const terminals =
          Number(
            row.terminals
          ) || 0;

        const serviceRate =
          totalQueues > 0
            ? (served /
                totalQueues) *
              100
            : 0;

        return {
          departmentId:
            row.department_id,

          department:
            row.department,

          totalQueues,

          served,

          skipped,

          terminals,

          serviceRate,
        };
      });

    return res.json({
      success: true,

      data: {
        reportType:
          "department",

        startDate,

        endDate,

        departmentId:
          departmentId ||
          "all",

        kioskId:
          kioskId ||
          "all",

        rows:
          reportRows,
      },
    });
  } catch (error) {
    console.error(
      "Department report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate Department Performance report.",
    });
  }
}


// =====================================================
// SERVED QUEUES REPORT
// =====================================================
//
// For one day:
//
// Department | Served Queues | Share of Total
//
// For multiple days:
//
// Date | Department | Served Queues | Share of Total
//
// =====================================================

async function getServedReport(
  req,
  res
) {
  const {
    startDate,
    endDate,
    departmentId,
    kioskId,
  } = req.query;

  const conditions = [];

  const params = [];

  // -------------------------------------------------
  // DATE FILTER
  // -------------------------------------------------

  conditions.push(
    `DATE(qt.issued_at) BETWEEN ? AND ?`
  );

  params.push(
    startDate,
    endDate
  );

  // -------------------------------------------------
  // COMPLETED ONLY
  // -------------------------------------------------

  conditions.push(
    `qt.status = 'completed'`
  );

  // -------------------------------------------------
  // DEPARTMENT FILTER
  // -------------------------------------------------

  if (
    departmentId &&
    departmentId !== "all"
  ) {
    conditions.push(
      `d.department_id = ?`
    );

    params.push(
      departmentId
    );
  }

  // -------------------------------------------------
  // KIOSK FILTER
  // -------------------------------------------------

  if (
    kioskId &&
    kioskId !== "all"
  ) {
    conditions.push(
      `d.kiosk_id = ?`
    );

    params.push(
      kioskId
    );
  }

  const whereClause =
    conditions.join(
      " AND "
    );

  try {
    const [rows] =
      await pool.query(
        `
        SELECT

            DATE_FORMAT(qt.issued_at, '%Y-%m-%d') AS report_date,

            d.department_id,

            d.name
                AS department,

          COUNT(DISTINCT qt.queue_id) AS served_queues

        FROM queue_ticket qt

        INNER JOIN department d
          ON d.department_id =
            qt.department_id

        WHERE ${whereClause}

        GROUP BY

          DATE(qt.issued_at),

          d.department_id,

          d.name

        ORDER BY

          report_date ASC,

          d.name ASC
        `,
        params
      );

    const rawRows =
      rows.map((row) => ({
        date:
          row.report_date,

        departmentId:
          row.department_id,

        department:
          row.department,

        servedQueues:
          Number(
            row.served_queues
          ) || 0,
      }));

    // -------------------------------------------------
    // TOTAL SERVED ACROSS SELECTED PERIOD
    // -------------------------------------------------

    const totalServed =
      rawRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.servedQueues
          ),
        0
      );

    const reportRows =
      rawRows.map((row) => ({
        ...row,

        shareOfTotal:
          totalServed > 0
            ? (
                (Number(
                  row.servedQueues
                ) /
                  totalServed) *
                100
              )
            : 0,
      }));

    return res.json({
      success: true,

      data: {
        reportType:
          "served",

        startDate,

        endDate,

        departmentId:
          departmentId ||
          "all",

        kioskId:
          kioskId ||
          "all",

        totalServed,

        rows:
          reportRows,
      },
    });
  } catch (error) {
    console.error(
      "Served report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate Served Queues report.",
    });
  }
}

// =====================================================
// STAFF PERFORMANCE REPORT
// =====================================================
//
// Columns:
//
// Staff
// Department
// Terminal
// Queues Served
// Login Timestamp
// Logout Timestamp
//
// One row represents one staff terminal session.
//
// Queues Served is calculated by matching completed
// queues to the same terminal and the staff member's
// login/logout session.
// =====================================================

async function getStaffReport(
  req,
  res
) {
  const {
    startDate,
    endDate,
    departmentId,
    kioskId,
  } = req.query;

  const conditions = [
    `
    sts.login_at >=
      CONCAT(?, ' 00:00:00')
    `,
    `
    sts.login_at <
      DATE_ADD(
        CONCAT(?, ' 00:00:00'),
        INTERVAL 1 DAY
      )
    `,
    `
    LOWER(
      TRIM(r.role)
    ) = 'staff'
    `,
  ];

  // The first two parameters are for the
  // selected report date range.
  //
  // The next two parameters are used inside
  // the queue join so queues are also limited
  // to the selected report period.

  const params = [
    startDate,
    endDate,
  ];

  // -------------------------------------------------
  // DEPARTMENT FILTER
  // -------------------------------------------------

  if (
    departmentId &&
    departmentId !== "all"
  ) {
    conditions.push(
      `d.department_id = ?`
    );

    params.push(
      departmentId
    );
  }

  // -------------------------------------------------
  // KIOSK FILTER
  // -------------------------------------------------

  if (
    kioskId &&
    kioskId !== "all"
  ) {
    conditions.push(
      `d.kiosk_id = ?`
    );

    params.push(
      kioskId
    );
  }

  const whereClause =
    conditions.join(
      " AND "
    );

  try {
    const [rows] =
      await pool.query(
        `
        SELECT

          sts.session_id,

          sts.staff_id,

          CONCAT_WS(
            ' ',
            NULLIF(
              TRIM(u.first_name),
              ''
            ),
            NULLIF(
              TRIM(u.last_name),
              ''
            )
          )
            AS staff,

          d.name
            AS department,

          CONCAT(
            'Terminal ',
            c.counter_number
          )
            AS terminal,

          COUNT(
            DISTINCT qt.queue_id
          )
            AS queues_served,

          sts.login_at,

          sts.logout_at

        FROM staff_terminal_session sts

        INNER JOIN \`user\` u
          ON u.user_id =
             sts.staff_id

        INNER JOIN \`role\` r
          ON r.role_id =
             u.role_id

        INNER JOIN counter c
          ON c.counter_id =
             sts.counter_id

        INNER JOIN department d
          ON d.department_id =
             c.department_id

        LEFT JOIN queue_ticket qt
          ON qt.counter_id =
             sts.counter_id

          AND qt.status =
              'completed'

          AND qt.completed_at
              IS NOT NULL

          AND qt.completed_at >=
              sts.login_at

          AND qt.completed_at <
              COALESCE(
                sts.logout_at,
                CURRENT_TIMESTAMP
              )

          AND qt.completed_at >=
              CONCAT(
                ?,
                ' 00:00:00'
              )

          AND qt.completed_at <
              DATE_ADD(
                CONCAT(
                  ?,
                  ' 00:00:00'
                ),
                INTERVAL 1 DAY
              )

        WHERE ${whereClause}

        GROUP BY

          sts.session_id,

          sts.staff_id,

          u.first_name,

          u.last_name,

          d.department_id,

          d.name,

          c.counter_id,

          c.counter_number,

          sts.login_at,

          sts.logout_at

        ORDER BY
          sts.login_at DESC
        `,
        [
          startDate,
          endDate,
          ...params,
        ]
      );

    const reportRows =
      rows.map((row) => ({
        sessionId:
          row.session_id,

        staffId:
          row.staff_id,

        staff:
          row.staff ||
          "—",

        department:
          row.department ||
          "—",

        terminal:
          row.terminal ||
          "—",

        queuesServed:
          Number(
            row.queues_served
          ) || 0,

        loginTimestamp:
          row.login_at,

        logoutTimestamp:
          row.logout_at,
      }));

    return res.json({
      success: true,

      data: {
        reportType:
          "staff",

        startDate,

        endDate,

        departmentId:
          departmentId ||
          "all",

        kioskId:
          kioskId ||
          "all",

        rows:
          reportRows,
      },
    });

  } catch (error) {
    console.error(
      "Staff report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate Staff Performance report.",
    });
  }
}

module.exports = router;