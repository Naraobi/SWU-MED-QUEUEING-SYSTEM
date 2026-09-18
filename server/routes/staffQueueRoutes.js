const express = require("express");
const router = express.Router();

const pool = require("../config/mysql");
const { db } = require("../config/firebase");

// ============================================================
// HELPER: SYNC QUEUE TICKET TO FIREBASE
// ============================================================

async function syncQueueTicketToFirebase(queueId) {
  if (!queueId) {
    throw new Error(
      "Queue ID is required for Firebase synchronization."
    );
  }

  const [rows] = await pool.query(
    `
    SELECT
      qt.queue_id,
      qt.department_id,
      qt.transaction_id,
      qt.queue_number,
      qt.queue_sequence,
      qt.issued_at,
      qt.called_at,
      qt.service_began_at,
      qt.completed_at,
      qt.status,
      qt.is_priority,

      p.patient_number,

      d.name AS department,
      d.prefix,
      d.kiosk_id

    FROM queue_ticket qt

    INNER JOIN patient p
      ON qt.transaction_id = p.transaction_id

    INNER JOIN department d
      ON qt.department_id = d.department_id

    WHERE qt.queue_id = ?

    LIMIT 1
    `,
    [queueId]
  );

  if (rows.length === 0) {
    throw new Error(
      "Queue ticket not found while synchronizing with Firebase."
    );
  }

  const queue = rows[0];

  await db
    .collection("queue_tickets")
    .doc(queue.queue_id)
    .set(
      {
        queue_id: queue.queue_id,
        department_id: queue.department_id,
        transaction_id: queue.transaction_id,
        queue_number: queue.queue_number,
        queue_sequence: Number(queue.queue_sequence),

        issued_at: queue.issued_at || null,
        called_at: queue.called_at || null,
        service_began_at:
          queue.service_began_at || null,
        completed_at:
          queue.completed_at || null,

        status: queue.status,

        is_priority: Boolean(
          queue.is_priority
        ),

        patient_number:
          queue.patient_number,

        department:
          queue.department,

        prefix:
          queue.prefix,

        kiosk_id:
          queue.kiosk_id,

        firebase_synced_at:
          new Date(),
      },
      {
        merge: true,
      }
    );

  console.log(
    `Firebase queue sync successful: ${queue.queue_number}`
  );

  return queue;
}

// ============================================================
// HELPER: GET TODAY'S QUEUE STATE
// ============================================================

async function getQueueState(
  departmentPrefix,
  { start, end } = {}
) {
  // Live panels (waiting list + currently serving) always
  // reflect today, regardless of the reporting date filter.
  const [waitingQueue] = await pool.query(
    `
    SELECT
      qt.queue_id,
      qt.queue_number,
      qt.queue_sequence,
      qt.status,
      qt.issued_at,
      qt.called_at,
      qt.service_began_at,
      qt.completed_at,
      qt.is_priority,

      p.transaction_id,
      p.patient_number,

      d.department_id,
      d.name AS department,
      d.prefix

    FROM queue_ticket qt

    INNER JOIN patient p
      ON qt.transaction_id = p.transaction_id

    INNER JOIN department d
      ON qt.department_id = d.department_id

    WHERE d.prefix = ?
      AND DATE(qt.issued_at) = CURDATE()
      AND qt.status = 'waiting'

    ORDER BY
      qt.is_priority DESC,
      qt.queue_sequence ASC
    `,
    [departmentPrefix]
  );

  const [currentRows] = await pool.query(
    `
    SELECT
      qt.queue_id,
      qt.queue_number,
      qt.queue_sequence,
      qt.status,
      qt.issued_at,
      qt.called_at,
      qt.service_began_at,
      qt.completed_at,
      qt.is_priority,

      p.transaction_id,
      p.patient_number,

      d.department_id,
      d.name AS department,
      d.prefix

    FROM queue_ticket qt

    INNER JOIN patient p
      ON qt.transaction_id = p.transaction_id

    INNER JOIN department d
      ON qt.department_id = d.department_id

    WHERE d.prefix = ?
      AND DATE(qt.issued_at) = CURDATE()
      AND qt.status IN ('called', 'serving')

    ORDER BY qt.called_at DESC

    LIMIT 1
    `,
    [departmentPrefix]
  );

  const currentlyServing =
    currentRows.length > 0
      ? {
          ...currentRows[0],

          secondsElapsed:
            currentRows[0].service_began_at
              ? Math.max(
                  0,
                  Math.floor(
                    (
                      Date.now() -
                      new Date(
                        currentRows[0]
                          .service_began_at
                      ).getTime()
                    ) / 1000
                  )
                )
              : 0,
        }
      : null;

  // Reporting stats (the stat cards / donut chart) respect the
  // requested date range. Defaults to today when none is given,
  // reusing the same range-condition pattern as /history below.
  let statsDateCondition =
    "DATE(qt.issued_at) = CURDATE()";

  const statsParams = [
    departmentPrefix,
  ];

  if (start && end) {
    statsDateCondition =
      "DATE(qt.issued_at) BETWEEN ? AND ?";

    statsParams.push(
      start,
      end
    );
  }

  const [statsRows] = await pool.query(
    `
    SELECT

      SUM(
        CASE
          WHEN qt.status = 'waiting'
          THEN 1
          ELSE 0
        END
      ) AS waiting,

      SUM(
        CASE
          WHEN qt.status IN ('called', 'serving')
          THEN 1
          ELSE 0
        END
      ) AS currentlyServing,

      SUM(
        CASE
          WHEN qt.status = 'completed'
          THEN 1
          ELSE 0
        END
      ) AS completed,

      SUM(
        CASE
          WHEN qt.status = 'cancelled'
          THEN 1
          ELSE 0
        END
      ) AS skipped

    FROM queue_ticket qt

    INNER JOIN department d
      ON qt.department_id = d.department_id

    WHERE d.prefix = ?
      AND ${statsDateCondition}
    `,
    statsParams
  );

  const stats = {
    waiting: Number(
      statsRows[0]?.waiting || 0
    ),

    currentlyServing: Number(
      statsRows[0]?.currentlyServing || 0
    ),

    completed: Number(
      statsRows[0]?.completed || 0
    ),

    skipped: Number(
      statsRows[0]?.skipped || 0
    ),
  };

  return {
    waitingQueue,
    currentlyServing,
    stats,
  };
}

// ============================================================
// GET QUEUE STATE
// GET /api/staff-queue/state/:departmentPrefix
// ============================================================

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

router.get(
  "/state/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      if (!departmentPrefix) {
        return res.status(400).json({
          success: false,
          message:
            "Department prefix is required.",
        });
      }

      const {
        start,
        end,
      } = req.query;

      const hasValidRange =
        ISO_DATE_PATTERN.test(start || "") &&
        ISO_DATE_PATTERN.test(end || "");

      const state =
        await getQueueState(
          departmentPrefix,
          hasValidRange
            ? { start, end }
            : {}
        );

      res.json({
        success: true,
        ...state,
      });
    } catch (error) {
      console.error(
        "GET queue state error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to retrieve queue state.",
        error: error.message,
      });
    }
  }
);

// ============================================================
// GET NOTIFICATIONS
// GET /api/staff-queue/notifications/:departmentPrefix
// ============================================================
//
// IMPORTANT:
//
// Your React application is currently requesting:
//
// /api/staff-queue/notifications/PD
//
// This endpoint prevents the 404.
//
// Since the current database schema shown does not include a
// notification table, we return an empty notification list.
//
// This can later be connected to a proper notifications table
// or Firebase notification collection without changing the
// frontend API URL.
//
// ============================================================

router.get(
  "/notifications/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      if (!departmentPrefix) {
        return res.status(400).json({
          success: false,
          message:
            "Department prefix is required.",
        });
      }

      /*
       * There is currently no notification table
       * in the database schema provided.
       *
       * Return an empty list so the staff dashboard
       * can load normally.
       */

      return res.json({
        success: true,
        data: [],
      });
    } catch (error) {
      console.error(
        "GET notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve notifications.",
        error: error.message,
      });
    }
  }
);

// ============================================================
// CALL NEXT PATIENT
// POST /api/staff-queue/call-next/:departmentPrefix
// ============================================================

router.post(
  "/call-next/:departmentPrefix",
  async (req, res) => {
    const connection =
      await pool.getConnection();

    try {
      const {
        departmentPrefix,
      } = req.params;

      await connection.beginTransaction();

      const [activeRows] =
        await connection.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.status

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status IN ('called', 'serving')

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (activeRows.length > 0) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            "There is already an active patient.",
          currentlyServing:
            activeRows[0],
        });
      }

      const [nextRows] =
        await connection.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.queue_sequence,
            qt.status,
            qt.issued_at,
            qt.called_at,
            qt.service_began_at,
            qt.completed_at,
            qt.is_priority,

            p.transaction_id,
            p.patient_number,

            d.department_id,
            d.name AS department,
            d.prefix

          FROM queue_ticket qt

          INNER JOIN patient p
            ON qt.transaction_id = p.transaction_id

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status = 'waiting'

          ORDER BY
            qt.is_priority DESC,
            qt.queue_sequence ASC

          LIMIT 1

          FOR UPDATE
          `,
          [departmentPrefix]
        );

      if (nextRows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message:
            "No waiting patients.",
        });
      }

      const nextPatient =
        nextRows[0];

      await connection.query(
        `
        UPDATE queue_ticket

        SET
          status = 'called',
          called_at = NOW()

        WHERE queue_id = ?
        `,
        [nextPatient.queue_id]
      );

      await connection.commit();

      let firebaseSynced = true;
      let firebaseError = null;

      try {
        await syncQueueTicketToFirebase(
          nextPatient.queue_id
        );
      } catch (syncError) {
        firebaseSynced = false;
        firebaseError =
          syncError.message;

        console.error(
          "Firebase call-next sync failed:",
          syncError
        );
      }

      return res.json({
        success: true,

        message:
          "Next patient called successfully.",

        firebase_synced:
          firebaseSynced,

        ...(firebaseError && {
          firebase_error:
            firebaseError,
        }),

        currentlyServing: {
          ...nextPatient,

          status: "called",

          called_at:
            new Date(),

          service_began_at:
            null,

          secondsElapsed: 0,
        },
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }

      console.error(
        "Call next patient error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to call next patient.",
        error:
          error.message,
      });
    } finally {
      connection.release();
    }
  }
);

// ============================================================
// START SERVICE
// POST /api/staff-queue/start-service/:departmentPrefix
// ============================================================

router.post(
  "/start-service/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      const [rows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.queue_sequence,
            qt.status,
            qt.issued_at,
            qt.called_at,
            qt.service_began_at,
            qt.completed_at,
            qt.is_priority,

            p.transaction_id,
            p.patient_number,

            d.department_id,
            d.name AS department,
            d.prefix

          FROM queue_ticket qt

          INNER JOIN patient p
            ON qt.transaction_id = p.transaction_id

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status = 'called'

          ORDER BY qt.called_at DESC

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No called patient found.",
        });
      }

      const patient =
        rows[0];

      await pool.query(
        `
        UPDATE queue_ticket

        SET
          status = 'serving',
          service_began_at = NOW()

        WHERE queue_id = ?
        `,
        [patient.queue_id]
      );

      const [updatedRows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.queue_sequence,
            qt.status,
            qt.issued_at,
            qt.called_at,
            qt.service_began_at,
            qt.completed_at,
            qt.is_priority,

            p.transaction_id,
            p.patient_number,

            d.department_id,
            d.name AS department,
            d.prefix

          FROM queue_ticket qt

          INNER JOIN patient p
            ON qt.transaction_id = p.transaction_id

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE qt.queue_id = ?

          LIMIT 1
          `,
          [patient.queue_id]
        );

      const updatedPatient =
        updatedRows[0];

      let firebaseSynced = true;
      let firebaseError = null;

      try {
        await syncQueueTicketToFirebase(
          patient.queue_id
        );
      } catch (syncError) {
        firebaseSynced = false;
        firebaseError =
          syncError.message;

        console.error(
          "Firebase start-service sync failed:",
          syncError
        );
      }

      return res.json({
        success: true,

        message:
          "Service started successfully.",

        firebase_synced:
          firebaseSynced,

        ...(firebaseError && {
          firebase_error:
            firebaseError,
        }),

        currentlyServing: {
          ...updatedPatient,
          secondsElapsed: 0,
        },
      });
    } catch (error) {
      console.error(
        "Start service error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to start service.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// MARK PATIENT ARRIVED
// POST /api/staff-queue/arrived/:departmentPrefix
// ============================================================

router.post(
  "/arrived/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      const [rows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.status

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status = 'called'

          ORDER BY qt.called_at DESC

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No called patient found.",
        });
      }

      return res.json({
        success: true,

        message:
          "Patient arrival confirmed.",

        currentlyServing:
          rows[0],
      });
    } catch (error) {
      console.error(
        "Mark arrived error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to confirm patient arrival.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// RECALL CURRENT PATIENT
// POST /api/staff-queue/recall/:departmentPrefix
// ============================================================

router.post(
  "/recall/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      const [rows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.queue_sequence,
            qt.status,
            qt.issued_at,
            qt.called_at,
            qt.service_began_at,
            qt.completed_at,
            qt.is_priority,

            p.transaction_id,
            p.patient_number,

            d.department_id,
            d.name AS department,
            d.prefix

          FROM queue_ticket qt

          INNER JOIN patient p
            ON qt.transaction_id = p.transaction_id

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status IN ('called', 'serving')

          ORDER BY qt.called_at DESC

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No active patient to recall.",
        });
      }

      const current =
        rows[0];

      const secondsElapsed =
        current.service_began_at
          ? Math.max(
              0,
              Math.floor(
                (
                  Date.now() -
                  new Date(
                    current.service_began_at
                  ).getTime()
                ) / 1000
              )
            )
          : 0;

      return res.json({
        success: true,

        message:
          "Patient recalled successfully.",

        currentlyServing: {
          ...current,
          secondsElapsed,
        },
      });
    } catch (error) {
      console.error(
        "Recall patient error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to recall patient.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// COMPLETE CURRENT PATIENT
// POST /api/staff-queue/complete/:departmentPrefix
// ============================================================

router.post(
  "/complete/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      const [rows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.status,
            qt.service_began_at

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status = 'serving'

          ORDER BY qt.service_began_at DESC

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No serving patient found.",
        });
      }

      const queueId =
        rows[0].queue_id;

      await pool.query(
        `
        UPDATE queue_ticket

        SET
          status = 'completed',
          completed_at = NOW()

        WHERE queue_id = ?
        `,
        [queueId]
      );

      let firebaseSynced = true;
      let firebaseError = null;

      try {
        await syncQueueTicketToFirebase(
          queueId
        );
      } catch (syncError) {
        firebaseSynced = false;
        firebaseError =
          syncError.message;

        console.error(
          "Firebase complete sync failed:",
          syncError
        );
      }

      const [statsRows] =
        await pool.query(
          `
          SELECT

            SUM(
              CASE
                WHEN qt.status = 'waiting'
                THEN 1
                ELSE 0
              END
            ) AS waiting,

            SUM(
              CASE
                WHEN qt.status IN ('called', 'serving')
                THEN 1
                ELSE 0
              END
            ) AS currentlyServing,

            SUM(
              CASE
                WHEN qt.status = 'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed,

            SUM(
              CASE
                WHEN qt.status = 'cancelled'
                THEN 1
                ELSE 0
              END
            ) AS skipped

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
          `,
          [departmentPrefix]
        );

      const stats = {
        waiting:
          Number(
            statsRows[0]?.waiting || 0
          ),

        currentlyServing:
          Number(
            statsRows[0]?.currentlyServing || 0
          ),

        completed:
          Number(
            statsRows[0]?.completed || 0
          ),

        skipped:
          Number(
            statsRows[0]?.skipped || 0
          ),
      };

      return res.json({
        success: true,

        message:
          "Patient completed successfully.",

        firebase_synced:
          firebaseSynced,

        ...(firebaseError && {
          firebase_error:
            firebaseError,
        }),

        currentlyServing:
          null,

        stats,
      });
    } catch (error) {
      console.error(
        "Complete patient error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to complete patient.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// CANCEL / SKIP CURRENT PATIENT
// POST /api/staff-queue/cancel/:departmentPrefix
// ============================================================

router.post(
  "/cancel/:departmentPrefix",
  async (req, res) => {
    try {
      const {
        departmentPrefix,
      } = req.params;

      const [rows] =
        await pool.query(
          `
          SELECT
            qt.queue_id,
            qt.queue_number,
            qt.status

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
            AND qt.status IN ('called', 'serving')

          ORDER BY
            COALESCE(
              qt.service_began_at,
              qt.called_at
            ) DESC

          LIMIT 1
          `,
          [departmentPrefix]
        );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No active patient found.",
        });
      }

      const queueId =
        rows[0].queue_id;

      await pool.query(
        `
        UPDATE queue_ticket

        SET
          status = 'cancelled'

        WHERE queue_id = ?
        `,
        [queueId]
      );

      let firebaseSynced = true;
      let firebaseError = null;

      try {
        await syncQueueTicketToFirebase(
          queueId
        );
      } catch (syncError) {
        firebaseSynced = false;
        firebaseError =
          syncError.message;

        console.error(
          "Firebase cancel sync failed:",
          syncError
        );
      }

      const [statsRows] =
        await pool.query(
          `
          SELECT

            SUM(
              CASE
                WHEN qt.status = 'waiting'
                THEN 1
                ELSE 0
              END
            ) AS waiting,

            SUM(
              CASE
                WHEN qt.status IN ('called', 'serving')
                THEN 1
                ELSE 0
              END
            ) AS currentlyServing,

            SUM(
              CASE
                WHEN qt.status = 'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed,

            SUM(
              CASE
                WHEN qt.status = 'cancelled'
                THEN 1
                ELSE 0
              END
            ) AS skipped

          FROM queue_ticket qt

          INNER JOIN department d
            ON qt.department_id = d.department_id

          WHERE d.prefix = ?
            AND DATE(qt.issued_at) = CURDATE()
          `,
          [departmentPrefix]
        );

      const stats = {
        waiting:
          Number(
            statsRows[0]?.waiting || 0
          ),

        currentlyServing:
          Number(
            statsRows[0]?.currentlyServing || 0
          ),

        completed:
          Number(
            statsRows[0]?.completed || 0
          ),

        skipped:
          Number(
            statsRows[0]?.skipped || 0
          ),
      };

      return res.json({
        success: true,

        message:
          "Patient cancelled successfully.",

        firebase_synced:
          firebaseSynced,

        ...(firebaseError && {
          firebase_error:
            firebaseError,
        }),

        currentlyServing:
          null,

        stats,
      });
    } catch (error) {
      console.error(
        "Cancel patient error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to cancel patient.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// QUEUE HISTORY
// GET /api/staff-queue/history/:departmentId
// ============================================================

router.get(
  "/history/:departmentId",
  async (req, res) => {
    try {
      const {
        departmentId,
      } = req.params;

      if (!departmentId) {
        return res.status(400).json({
          success: false,
          message:
            "Department ID is required.",
        });
      }

      const {
        search = "",
        status = "All Status",
        range = "Today",
      } = req.query;

      let dateCondition =
        "DATE(qt.issued_at) = CURDATE()";

      const dateParams = [];

      if (range === "Yesterday") {
        dateCondition =
          "DATE(qt.issued_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
      } else if (
        range === "Last 7 Days" ||
        range === "This Week" ||
        range === "week"
      ) {
        dateCondition = `
          qt.issued_at >=
          DATE_SUB(
            CURDATE(),
            INTERVAL 7 DAY
          )
        `;
      } else if (
        range === "Last 30 Days" ||
        range === "This Month" ||
        range === "month"
      ) {
        dateCondition = `
          qt.issued_at >=
          DATE_SUB(
            CURDATE(),
            INTERVAL 30 DAY
          )
        `;
      } else if (
        typeof range === "string" &&
        range.startsWith("custom:")
      ) {
        /*
         * Format: custom:<startISO>|<endISO>
         *
         * "|" is used instead of ":" because ISO timestamps
         * themselves contain colons (e.g. 2026-09-18T00:00:00.000Z),
         * which would otherwise make the value impossible to split
         * apart reliably.
         */
        const [startIso, endIso] =
          range.slice("custom:".length).split("|");

        const startDate = startIso
          ? new Date(startIso)
          : null;

        const endDate = endIso
          ? new Date(endIso)
          : null;

        if (
          startDate &&
          !Number.isNaN(startDate.getTime()) &&
          endDate &&
          !Number.isNaN(endDate.getTime())
        ) {
          dateCondition =
            "qt.issued_at BETWEEN ? AND ?";

          dateParams.push(
            startDate,
            endDate
          );
        }
      }

      let statusCondition = "";

      const queryParams = [
        departmentId,
        ...dateParams,
      ];

      if (
        status &&
        status !== "All Status"
      ) {
        let dbStatus =
          String(
            status
          ).toLowerCase();

        if (
          dbStatus === "skipped"
        ) {
          dbStatus =
            "cancelled";
        }

        statusCondition =
          "AND qt.status = ?";

        queryParams.push(
          dbStatus
        );
      }

      let searchCondition = "";

      if (search.trim()) {
        searchCondition = `
          AND (
            qt.queue_number LIKE ?
            OR p.patient_number LIKE ?
            OR d.name LIKE ?
          )
        `;

        const searchValue =
          `%${search.trim()}%`;

        queryParams.push(
          searchValue,
          searchValue,
          searchValue
        );
      }

      const [rows] =
        await pool.query(
          `
          SELECT

            qt.queue_id,
            qt.queue_number,
            qt.queue_sequence,
            qt.status,

            qt.issued_at,
            qt.called_at,
            qt.service_began_at,
            qt.completed_at,

            qt.is_priority,

            p.transaction_id,
            p.patient_number,

            d.department_id,
            d.name AS department,
            d.prefix

          FROM queue_ticket qt

          INNER JOIN patient p
            ON qt.transaction_id =
               p.transaction_id

          INNER JOIN department d
            ON qt.department_id =
               d.department_id

          WHERE
            qt.department_id = ?

            AND ${dateCondition}

            ${statusCondition}

            ${searchCondition}

          ORDER BY
            qt.issued_at DESC
          `,
          queryParams
        );

      const formattedRows =
        rows.map((row) => {
          let duration = null;

          if (
            row.service_began_at &&
            row.completed_at
          ) {
            const start =
              new Date(
                row.service_began_at
              ).getTime();

            const end =
              new Date(
                row.completed_at
              ).getTime();

            const seconds =
              Math.max(
                0,
                Math.floor(
                  (end - start) /
                    1000
                )
              );

            const hours =
              Math.floor(
                seconds / 3600
              );

            const minutes =
              Math.floor(
                (seconds % 3600) /
                  60
              );

            const remainingSeconds =
              seconds % 60;

            if (hours > 0) {
              duration =
                `${hours}:${String(
                  minutes
                ).padStart(
                  2,
                  "0"
                )}:${String(
                  remainingSeconds
                ).padStart(
                  2,
                  "0"
                )}`;
            } else {
              duration =
                `${minutes}:${String(
                  remainingSeconds
                ).padStart(
                  2,
                  "0"
                )}`;
            }
          }

          let waitingTime = null;

          if (
            row.issued_at &&
            row.called_at
          ) {
            const issued =
              new Date(
                row.issued_at
              ).getTime();

            const called =
              new Date(
                row.called_at
              ).getTime();

            const seconds =
              Math.max(
                0,
                Math.floor(
                  (called - issued) /
                    1000
                )
              );

            const minutes =
              Math.floor(
                seconds / 60
              );

            const remainingSeconds =
              seconds % 60;

            waitingTime =
              `${minutes}:${String(
                remainingSeconds
              ).padStart(
                2,
                "0"
              )}`;
          }

          let displayStatus =
            row.status;

          if (
            row.status ===
            "cancelled"
          ) {
            displayStatus =
              "Cancelled";
          }

          if (
            row.status ===
            "completed"
          ) {
            displayStatus =
              "Completed";
          }

          if (
            row.status ===
            "waiting"
          ) {
            displayStatus =
              "Waiting";
          }

          if (
            row.status ===
            "called"
          ) {
            displayStatus =
              "Called";
          }

          if (
            row.status ===
            "serving"
          ) {
            displayStatus =
              "Serving";
          }

          return {
            id:
              row.queue_id,

            queue_id:
              row.queue_id,

            queueNumber:
              row.queue_number,

            queue_number:
              row.queue_number,

            service:
              row.department,

            department:
              row.department,

            status:
              displayStatus,

            calledAt:
              row.called_at,

            called_at:
              row.called_at,

            startedAt:
              row.service_began_at,

            service_began_at:
              row.service_began_at,

            completedAt:
              row.completed_at,

            completed_at:
              row.completed_at,

            duration,

            waitingTime,

            transactionDate:
              row.issued_at,

            patientNumber:
              row.patient_number,

            isPriority:
              Boolean(
                row.is_priority
              ),

            terminal:
              null,

            skipReason:
              null,

            staff:
              null,
          };
        });

      return res.json({
        success: true,
        data:
          formattedRows,
      });
    } catch (error) {
      console.error(
        "GET queue history error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve queue history.",
        error:
          error.message,
      });
    }
  }
);

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;