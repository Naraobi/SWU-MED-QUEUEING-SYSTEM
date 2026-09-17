const express = require("express");
const { getAuth } = require("firebase-admin/auth");
const pool = require("../config/mysql");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET DASHBOARD ANALYTICS
|--------------------------------------------------------------------------
| GET /api/dashboard/analytics
|
| Query parameters:
|   startDate=YYYY-MM-DD
|   endDate=YYYY-MM-DD
|
| Returns:
|   - department totals
|   - waiting count
|   - average wait
|   - cancelled/skipped count
|   - completed count
|   - terminal totals
|   - department volume
|   - queue status distribution
|   - data-driven insights
|--------------------------------------------------------------------------
*/

router.get("/analytics", async (req, res) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | 1. VERIFY FIREBASE AUTHENTICATION
    |--------------------------------------------------------------------------
    */

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid authorization token.",
      });
    }

    const idToken = authorization.substring(7);

    let decodedToken;

    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Dashboard Firebase token verification failed:", error);

      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 2. VERIFY APPLICATION USER
    |--------------------------------------------------------------------------
    |
    | We use the Firebase email to locate the corresponding MySQL user.
    | The dashboard is restricted to Superadmin users.
    |
    */

    const firebaseEmail = decodedToken.email || null;
    const firebaseUid = decodedToken.uid;

    if (!firebaseEmail && !firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user information is missing.",
      });
    }

    let [users] = await pool.query(
  `
    SELECT
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.status,
      u.role_id,
      u.department,
      r.role AS role_name
    FROM user u
    LEFT JOIN role r
      ON r.role_id = u.role_id
    WHERE u.email = ?
    LIMIT 1
  `,
  [firebaseEmail]
);

    if (!users.length) {
      return res.status(403).json({
        success: false,
        message: "No application user profile was found.",
      });
    }

    const currentUser = users[0];

    if (
      ["inactive", "deactivated", "disabled"].includes(
        String(currentUser.status || "").toLowerCase()
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    const currentRole = String(
  currentUser.role_name || ""
)
  .trim()
  .toLowerCase();

if (
  currentRole !== "superadmin" &&
  currentRole !== "admin"
) {
  return res.status(403).json({
    success: false,
    message: "Dashboard access is restricted to administrators.",
  });
}

let departmentId = null;
let departmentName = null;

if (currentRole === "admin") {
  departmentName = String(
    currentUser.department || ""
  ).trim();

  if (!departmentName) {
    return res.status(403).json({
      success: false,
      message: "Your account is not assigned to a department.",
    });
  }

  const [departmentRows] = await pool.query(
    `
      SELECT
        department_id,
        name
      FROM department
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      LIMIT 1
    `,
    [departmentName]
  );

  if (!departmentRows.length) {
    return res.status(403).json({
      success: false,
      message: "Your assigned department could not be found.",
    });
  }

  departmentId = departmentRows[0].department_id;
  departmentName = departmentRows[0].name;
}
    /*
    |--------------------------------------------------------------------------
    | 3. NORMALIZE DATE RANGE
    |--------------------------------------------------------------------------
    */

    const today = new Date().toISOString().slice(0, 10);

    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || startDate;

    /*
    |--------------------------------------------------------------------------
    | 4. DEPARTMENT COUNTS
    |--------------------------------------------------------------------------
    */

    const [departmentRows] = await pool.query(
  `
    SELECT
      COUNT(*) AS total_departments,
      SUM(
        CASE
          WHEN LOWER(status) = 'active' THEN 1
          ELSE 0
        END
      ) AS active_departments
    FROM department
    WHERE (? IS NULL OR department_id = ?)
  `,
  [departmentId, departmentId]
);

    const departmentStats = departmentRows[0] || {};

    /*
    |--------------------------------------------------------------------------
    | 5. CURRENT WAITING COUNT
    |--------------------------------------------------------------------------
    |
    | "Total Waiting" represents the current queue state.
    | It is intentionally not restricted to the historical date filter.
    |
    */

    const [waitingRows] = await pool.query(
  `
    SELECT COUNT(*) AS total_waiting
    FROM queue_ticket
    WHERE status = 'waiting'
      AND (? IS NULL OR department_id = ?)
  `,
  [departmentId, departmentId]
);

    /*
    |--------------------------------------------------------------------------
    | 6. DATE-BASED QUEUE STATISTICS
    |--------------------------------------------------------------------------
    |
    | issued_at determines which reporting period a ticket belongs to.
    |
    */

    const [queueStatsRows] = await pool.query(
      `
        SELECT
          COUNT(*) AS total_tickets,

          SUM(
            CASE
              WHEN status = 'completed' THEN 1
              ELSE 0
            END
          ) AS completed,

          SUM(
            CASE
              WHEN status = 'cancelled' THEN 1
              ELSE 0
            END
          ) AS skipped,

          SUM(
            CASE
              WHEN status = 'waiting' THEN 1
              ELSE 0
            END
          ) AS waiting,

          SUM(
            CASE
              WHEN status IN ('called', 'serving') THEN 1
              ELSE 0
            END
          ) AS serving,

          AVG(
            CASE
              WHEN called_at IS NOT NULL
                AND issued_at IS NOT NULL
              THEN TIMESTAMPDIFF(
                SECOND,
                issued_at,
                called_at
              )
              ELSE NULL
            END
          ) AS average_wait_seconds

            FROM queue_ticket
            WHERE DATE(issued_at) BETWEEN ? AND ?
                AND (? IS NULL OR department_id = ?)
      `,
      [
  startDate,
  endDate,
  departmentId,
  departmentId,
]
    );

    const queueStats = queueStatsRows[0] || {};

    /*
    |--------------------------------------------------------------------------
    | 7. TERMINAL COUNTS
    |--------------------------------------------------------------------------
    */

    const [terminalRows] = await pool.query(
  `
    SELECT
      COUNT(*) AS total_terminals,
      SUM(
        CASE
          WHEN LOWER(status) = 'active' THEN 1
          ELSE 0
        END
      ) AS active_terminals
    FROM counter
    WHERE (? IS NULL OR department_id = ?)
  `,
  [departmentId, departmentId]
);

    const terminalStats = terminalRows[0] || {};

    /*
    |--------------------------------------------------------------------------
    | 8. DEPARTMENT VOLUME
    |--------------------------------------------------------------------------
    */

    const [departmentVolumeRows] = await pool.query(
  `
    SELECT
      d.department_id,
      d.name,
      COUNT(qt.queue_id) AS volume
    FROM department d
    LEFT JOIN queue_ticket qt
      ON qt.department_id = d.department_id
      AND DATE(qt.issued_at) BETWEEN ? AND ?
    WHERE (? IS NULL OR d.department_id = ?)
    GROUP BY
      d.department_id,
      d.name
    ORDER BY volume DESC, d.name ASC
  `,
  [
    startDate,
    endDate,
    departmentId,
    departmentId,
  ]
);

    /*
    |--------------------------------------------------------------------------
    | 9. QUEUE STATUS DISTRIBUTION
    |--------------------------------------------------------------------------
    */

    const [distributionRows] = await pool.query(
  `
    SELECT
      status,
      COUNT(*) AS total
    FROM queue_ticket
    WHERE DATE(issued_at) BETWEEN ? AND ?
      AND (? IS NULL OR department_id = ?)
    GROUP BY status
  `,
  [
    startDate,
    endDate,
    departmentId,
    departmentId,
  ]
);

       /*
    |--------------------------------------------------------------------------
    | 10. PATIENT VOLUME BY HOUR
    |--------------------------------------------------------------------------
    */

    const [hourlyVolumeRows] = await pool.query(
      `
        SELECT
          HOUR(issued_at) AS hour,
          COUNT(*) AS volume
        FROM queue_ticket
        WHERE DATE(issued_at) BETWEEN ? AND ?
          AND (? IS NULL OR department_id = ?)
        GROUP BY HOUR(issued_at)
        ORDER BY hour ASC
      `,
      [
        startDate,
        endDate,
        departmentId,
        departmentId,
      ]
    );


        /*
    |--------------------------------------------------------------------------
    | 11. AVERAGE WAIT BY DEPARTMENT
    |--------------------------------------------------------------------------
    */

    const [departmentWaitRows] = await pool.query(
      `
        SELECT
          d.department_id,
          d.name,

          AVG(
            CASE
              WHEN qt.called_at IS NOT NULL
                AND qt.issued_at IS NOT NULL
              THEN TIMESTAMPDIFF(
                SECOND,
                qt.issued_at,
                qt.called_at
              )
              ELSE NULL
            END
          ) AS average_wait_seconds

        FROM department d

        LEFT JOIN queue_ticket qt
          ON qt.department_id = d.department_id
          AND DATE(qt.issued_at) BETWEEN ? AND ?

        WHERE (? IS NULL OR d.department_id = ?)

        GROUP BY
          d.department_id,
          d.name

        ORDER BY
          average_wait_seconds DESC,
          d.name ASC
      `,
      [
        startDate,
        endDate,
        departmentId,
        departmentId,
      ]
    );


        /*
    |--------------------------------------------------------------------------
    | 12. DEPARTMENT PERFORMANCE
    |--------------------------------------------------------------------------
    */

    const [departmentPerformanceRows] = await pool.query(
      `
        SELECT
          d.department_id,
          d.name,

          SUM(
            CASE
              WHEN qt.status = 'completed' THEN 1
              ELSE 0
            END
          ) AS served,

          AVG(
            CASE
              WHEN qt.called_at IS NOT NULL
                AND qt.issued_at IS NOT NULL
              THEN TIMESTAMPDIFF(
                SECOND,
                qt.issued_at,
                qt.called_at
              )
              ELSE NULL
            END
          ) AS average_wait_seconds,

          SUM(
            CASE
              WHEN qt.status = 'cancelled' THEN 1
              ELSE 0
            END
          ) AS skipped

        FROM department d

        LEFT JOIN queue_ticket qt
          ON qt.department_id = d.department_id
          AND DATE(qt.issued_at) BETWEEN ? AND ?

        WHERE (? IS NULL OR d.department_id = ?)

        GROUP BY
          d.department_id,
          d.name

        ORDER BY
          d.name ASC
      `,
      [
        startDate,
        endDate,
        departmentId,
        departmentId,
      ]
    );

/*
|--------------------------------------------------------------------------
| 13. DEPARTMENT WAITING / WAIT-TIME DATA FOR INSIGHTS
|--------------------------------------------------------------------------
*/

const [departmentInsightRows] = await pool.query(
  `
    SELECT
      d.department_id,
      d.name,

      SUM(
        CASE
          WHEN qt.status = 'waiting' THEN 1
          ELSE 0
        END
      ) AS current_waiting,

      COUNT(qt.queue_id) AS total_volume,

      AVG(
        CASE
          WHEN qt.called_at IS NOT NULL
            AND qt.issued_at IS NOT NULL
          THEN TIMESTAMPDIFF(
            SECOND,
            qt.issued_at,
            qt.called_at
          )
          ELSE NULL
        END
      ) AS average_wait_seconds,

      SUM(
        CASE
          WHEN qt.status = 'cancelled' THEN 1
          ELSE 0
        END
      ) AS skipped

    FROM department d

    LEFT JOIN queue_ticket qt
      ON qt.department_id = d.department_id
      AND DATE(qt.issued_at) BETWEEN ? AND ?

    WHERE (? IS NULL OR d.department_id = ?)

    GROUP BY
      d.department_id,
      d.name
  `,
  [
    startDate,
    endDate,
    departmentId,
    departmentId,
  ]
);

    /*
    |--------------------------------------------------------------------------
    | 11. FORMAT NUMBERS
    |--------------------------------------------------------------------------
    */

    const totalTickets = Number(queueStats.total_tickets || 0);
    const completed = Number(queueStats.completed || 0);
    const skipped = Number(queueStats.skipped || 0);
    const waiting = Number(waitingRows[0]?.total_waiting || 0);
    const serving = Number(queueStats.serving || 0);

    const averageWaitSeconds = Number(
      queueStats.average_wait_seconds || 0
    );

    const averageWaitMinutes = Math.round(
      averageWaitSeconds / 60
    );

    /*
    |--------------------------------------------------------------------------
    | 12. BUILD QUEUE DISTRIBUTION
    |--------------------------------------------------------------------------
    */

    const distributionTotal =
      completed + waiting + serving;

    const getPercentage = (value) => {
      if (!distributionTotal) return 0;

      return Math.round(
        (Number(value || 0) / distributionTotal) * 100
      );
    };

    const queueDistribution = [
      {
        label: "Serving",
        value: serving,
        pct: getPercentage(serving),
        color: "#0B1524",
      },
      {
        label: "Waiting",
        value: waiting,
        pct: getPercentage(waiting),
        color: "#94A3B8",
      },
      {
        label: "Completed",
        value: completed,
        pct: getPercentage(completed),
        color: "#2563EB",
      },
    ];

    /*
    |--------------------------------------------------------------------------
    | 13. BUILD DATA-DRIVEN INSIGHTS
    |--------------------------------------------------------------------------
    */

    const insightSource = departmentInsightRows
      .map((row) => ({
        name: row.name,
        currentWaiting: Number(row.current_waiting || 0),
        volume: Number(row.total_volume || 0),
        averageWaitMinutes: Math.round(
          Number(row.average_wait_seconds || 0) / 60
        ),
        skipped: Number(row.skipped || 0),
      }))
      .filter((row) => row.volume > 0);

    const insights = [];

    const highestWaitingDepartment = [...insightSource].sort(
      (a, b) => b.currentWaiting - a.currentWaiting
    )[0];

    if (
      highestWaitingDepartment &&
      highestWaitingDepartment.currentWaiting > 0
    ) {
      insights.push({
        type: "waiting",
        icon: "info",
        text: `${highestWaitingDepartment.name} currently has the highest number of waiting patients (${highestWaitingDepartment.currentWaiting}).`,
      });
    }

    const highestVolumeDepartment = [...insightSource].sort(
      (a, b) => b.volume - a.volume
    )[0];

    if (highestVolumeDepartment) {
      insights.push({
        type: "volume",
        icon: "trending",
        text: `${highestVolumeDepartment.name} recorded the highest queue volume during the selected period (${highestVolumeDepartment.volume} tickets).`,
      });
    }

    const highestWaitDepartment = [...insightSource]
      .filter((row) => row.averageWaitMinutes > 0)
      .sort(
        (a, b) =>
          b.averageWaitMinutes - a.averageWaitMinutes
      )[0];

    if (highestWaitDepartment) {
      insights.push({
        type: "wait",
        icon: "alert",
        text: `${highestWaitDepartment.name} had the highest average waiting time during the selected period (${highestWaitDepartment.averageWaitMinutes} min).`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 14. RETURN DASHBOARD DATA
    |--------------------------------------------------------------------------
    */

    return res.json({
      success: true,

      data: {
  dateRange: {
    startDate,
    endDate,
  },

  department: {
    id: departmentId,
    name: departmentName,
  },

  departments: {
          total: Number(
            departmentStats.total_departments || 0
          ),
          active: Number(
            departmentStats.active_departments || 0
          ),
        },

        queue: {
          totalTickets,
          waiting,
          averageWaitMinutes,
          skipped,
          completed,
          serving,
        },

        terminals: {
          total: Number(
            terminalStats.total_terminals || 0
          ),
          active: Number(
            terminalStats.active_terminals || 0
          ),
        },

               departmentVolume: departmentVolumeRows.map(
          (row) => ({
            department_id: row.department_id,
            name: row.name,
            value: Number(row.volume || 0),
          })
        ),

        queueDistribution,

        hourlyVolume: hourlyVolumeRows.map(
          (row) => ({
            hour: Number(row.hour),
            volume: Number(row.volume || 0),
          })
        ),

        departmentWait: departmentWaitRows.map(
          (row) => ({
            department_id: row.department_id,
            name: row.name,
            averageWaitMinutes: Math.round(
              Number(row.average_wait_seconds || 0) / 60
            ),
          })
        ),

        departmentPerformance: departmentPerformanceRows.map(
          (row) => ({
            department_id: row.department_id,
            name: row.name,
            served: Number(row.served || 0),
            averageWaitMinutes: Math.round(
              Number(row.average_wait_seconds || 0) / 60
            ),
            skipped: Number(row.skipped || 0),
          })
        ),

        insights,
      },
    });
  } catch (error) {
    console.error(
      "Dashboard analytics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard analytics.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});

module.exports = router;