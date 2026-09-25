const express = require("express");
const { randomUUID } = require("crypto");

const pool = require("../config/mysql");
const { db } = require("../config/firebase");

const router = express.Router();

async function triggerQueuePrediction(queueId) {
  try {
    const response = await fetch(
      "https://swu-med-n8n.onrender.com/webhook/queue-prediction",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
         event: eventType,
          queue_id: queueId,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "n8n queue prediction webhook failed:",
        response.status,
        await response.text()
      );

      return false;
    }

    console.log(
      `n8n queue prediction triggered for queue: ${queueId}`
    );

    return true;
  } catch (error) {
    console.error(
      "Failed to trigger n8n queue prediction:",
      error.message
    );

    return false;
  }
}

router.get("/departments/:kioskId", async (req, res) => {
  const { kioskId } = req.params;

  if (!kioskId) {
    return res.status(400).json({
      success: false,
      message: "Kiosk ID is required.",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        department_id,
        name,
        classification,
        location,
        prefix,
        status,
        est_time,
        kiosk_id
      FROM department
      WHERE kiosk_id = ?
        AND status = 'active'
      ORDER BY name ASC
      `,
      [kioskId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error(
      "Error loading departments by kiosk:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load departments.",
      error: error.message,
    });
  }
});


router.post("/queue", async (req, res) => {
  const {
    kiosk_id,
    kiosk_name,
    department_id,
    department_name,
    queue_type,
  } = req.body;

  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

  if (!kiosk_id) {
    return res.status(400).json({
      success: false,
      message: "Kiosk ID is required.",
    });
  }

  if (!department_id) {
    return res.status(400).json({
      success: false,
      message: "Department ID is required.",
    });
  }

  if (!department_name) {
    return res.status(400).json({
      success: false,
      message: "Department name is required.",
    });
  }

  if (!queue_type) {
    return res.status(400).json({
      success: false,
      message: "Queue type is required.",
    });
  }

  const isPriority =
    String(queue_type).toLowerCase() === "priority";


  /*
  |--------------------------------------------------------------------------
  | GET MYSQL CONNECTION
  |--------------------------------------------------------------------------
  */

  const connection = await pool.getConnection();


  /*
  |--------------------------------------------------------------------------
  | VARIABLES
  |--------------------------------------------------------------------------
  |
  | These are declared outside the try block because they are also needed
  | after the MySQL transaction commits when synchronizing Firebase.
  |--------------------------------------------------------------------------
  */

  let transactionId = null;
  let queueId = null;
  let queueData = null;


  try {
    /*
    |--------------------------------------------------------------------------
    | START MYSQL TRANSACTION
    |--------------------------------------------------------------------------
    */

    await connection.beginTransaction();


    /*
    |--------------------------------------------------------------------------
    | VERIFY DEPARTMENT
    |--------------------------------------------------------------------------
    |
    | The selected department must:
    |
    | - exist
    | - be active
    | - belong to the selected kiosk
    |
    | Actual MySQL table:
    | department
    |--------------------------------------------------------------------------
    */

    const [departments] = await connection.query(
      `
      SELECT
        department_id,
        name,
        prefix,
        est_time,
        kiosk_id,
        status
      FROM department
      WHERE department_id = ?
        AND kiosk_id = ?
        AND status = 'active'
      LIMIT 1
      `,
      [department_id, kiosk_id]
    );


    /*
    |--------------------------------------------------------------------------
    | DEPARTMENT NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (departments.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "The selected department is not available at this kiosk.",
      });
    }


    const department = departments[0];


    /*
    |--------------------------------------------------------------------------
    | USE DATABASE VALUES
    |--------------------------------------------------------------------------
    |
    | The MySQL department table is authoritative for:
    |
    | - department name
    | - prefix
    | - estimated time
    | - kiosk ID
    |--------------------------------------------------------------------------
    */

    const finalDepartmentName =
      department.name;

    const prefix =
      department.prefix;


    /*
    |--------------------------------------------------------------------------
    | GET TODAY'S LAST QUEUE SEQUENCE
    |--------------------------------------------------------------------------
    |
    | Queue sequence starts from 001 each day.
    |
    | Example:
    |
    | Regular:
    | IN-001
    | IN-002
    |
    | Priority:
    | P-IN-001
    | P-IN-002
    |--------------------------------------------------------------------------
    */

    const [sequenceRows] =
      await connection.query(
        `
        SELECT
          COALESCE(
            MAX(queue_sequence),
            0
          ) AS last_sequence
        FROM queue_ticket
        WHERE department_id = ?
          AND is_priority = ?
          AND issued_at >= CURDATE()
          AND issued_at < DATE_ADD(
            CURDATE(),
            INTERVAL 1 DAY
          )
        `,
        [department_id, isPriority ? 1 : 0]
      );


    const lastSequence =
      Number(
        sequenceRows[0]?.last_sequence
      ) || 0;

    const nextSequence =
      lastSequence + 1;


    /*
    |--------------------------------------------------------------------------
    | GENERATE QUEUE NUMBER
    |--------------------------------------------------------------------------
    */

    const paddedSequence =
      String(nextSequence).padStart(
        3,
        "0"
      );

    const regularQueueNumber =
      `${prefix}-${paddedSequence}`;

    const queueNumber =
      isPriority
        ? `P-${regularQueueNumber}`
        : regularQueueNumber;


    /*
    |--------------------------------------------------------------------------
    | GENERATE UUIDS
    |--------------------------------------------------------------------------
    |
    | patient.transaction_id
    | queue_ticket.queue_id
    |
    | These same IDs will be used as Firebase document IDs.
    |--------------------------------------------------------------------------
    */

    transactionId =
      randomUUID();

    queueId =
      randomUUID();


    /*
    |--------------------------------------------------------------------------
    | INSERT PATIENT INTO MYSQL
    |--------------------------------------------------------------------------
    |
    | Actual MySQL patient table:
    |
    | transaction_id
    | department
    | location
    | patient_number
    |--------------------------------------------------------------------------
    */

    await connection.query(
      `
      INSERT INTO patient (
        transaction_id,
        department,
        location,
        patient_number
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        transactionId,
        finalDepartmentName,
        kiosk_name || "",
        queueNumber,
      ]
    );


    /*
    |--------------------------------------------------------------------------
    | INSERT QUEUE TICKET INTO MYSQL
    |--------------------------------------------------------------------------
    |
    | Actual queue_ticket fields:
    |
    | queue_id
    | department_id
    | transaction_id
    | queue_number
    | queue_sequence
    | issued_at
    | called_at
    | service_began_at
    | completed_at
    | status
    | is_priority
    |
    | We DO NOT insert:
    |
    | - counter_id
    | - skip_reason
    |--------------------------------------------------------------------------
    */

    await connection.query(
      `
      INSERT INTO queue_ticket (
        queue_id,
        department_id,
        transaction_id,
        queue_number,
        queue_sequence,
        called_at,
        service_began_at,
        completed_at,
        status,
        is_priority
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        queueId,
        department.department_id,
        transactionId,
        queueNumber,
        nextSequence,
        null,
        null,
        null,
        "waiting",
        isPriority ? 1 : 0,
      ]
    );

    await connection.commit();

await triggerQueuePrediction(queue_created);
    /*
    |--------------------------------------------------------------------------
    | PREPARE RESPONSE / FIREBASE DATA
    |--------------------------------------------------------------------------
    */

    queueData = {
      transaction_id:
        transactionId,

      queue_id:
        queueId,

      queue_number:
        queueNumber,

      queue_sequence:
        nextSequence,

      patient_number:
        queueNumber,

      department_id:
        department.department_id,

      department:
        finalDepartmentName,

      kiosk_id:
        department.kiosk_id,

      kiosk:
        kiosk_name || "",

      queue_type:
        isPriority
          ? "Priority"
          : "Regular",

      is_priority:
        isPriority,

      status:
        "waiting",

      called_at:
        null,

      service_began_at:
        null,

      completed_at:
        null,

      est_time:
        department.est_time,
    };


    /*
    |--------------------------------------------------------------------------
    | SYNCHRONIZE PATIENT TO FIREBASE
    |--------------------------------------------------------------------------
    |
    | Firebase collection:
    |
    | patients
    |
    | Document ID:
    |
    | transaction_id
    |
    |--------------------------------------------------------------------------
    */

    let firebaseSynced = true;
    let firebaseError = null;

    try {
      await db
        .collection("patients")
        .doc(transactionId)
        .set({
          transaction_id:
            transactionId,

          department:
            finalDepartmentName,

          location:
            kiosk_name || "",

          patient_number:
            queueNumber,

          kiosk_id:
            department.kiosk_id,

          kiosk:
            kiosk_name || "",

          department_id:
            department.department_id,

          created_at:
            new Date(),
        });


      /*
      |--------------------------------------------------------------------------
      | SYNCHRONIZE QUEUE TICKET TO FIREBASE
      |--------------------------------------------------------------------------
      |
      | Firebase collection:
      |
      | queue_tickets
      |
      | Document ID:
      |
      | queue_id
      |--------------------------------------------------------------------------
      */

      await db
        .collection("queue_tickets")
        .doc(queueId)
        .set({
          queue_id:
            queueId,

          department_id:
            department.department_id,

          transaction_id:
            transactionId,

          queue_number:
            queueNumber,

          queue_sequence:
            nextSequence,

          kiosk_id:
            department.kiosk_id,

          kiosk:
            kiosk_name || "",

          department:
            finalDepartmentName,

          queue_type:
            isPriority
              ? "Priority"
              : "Regular",

          is_priority:
            isPriority,

          status:
            "waiting",

          issued_at:
            new Date(),

          called_at:
            null,

          service_began_at:
            null,

          completed_at:
            null,

          est_time:
            department.est_time,
        });


      console.log(
        `Firebase sync successful: ${queueNumber}`
      );

    } catch (firebaseSyncError) {
      firebaseSynced = false;

      firebaseError =
        firebaseSyncError.message;

      console.error(
        "Firebase synchronization failed:",
        firebaseSyncError
      );
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN CREATED QUEUE
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      success: true,

      message:
        "Queue ticket created successfully.",

      firebase_synced:
        firebaseSynced,

      ...(firebaseError && {
        firebase_error:
          firebaseError,
      }),

      data:
        queueData,
    });

  } catch (error) {

    /*
    |--------------------------------------------------------------------------
    | MYSQL ROLLBACK
    |--------------------------------------------------------------------------
    |
    | This only happens when the MySQL transaction itself fails.
    |
    | Firebase errors after commit do NOT reach this rollback.
    |--------------------------------------------------------------------------
    */

    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError
      );
    }


    /*
    |--------------------------------------------------------------------------
    | LOG ERROR
    |--------------------------------------------------------------------------
    */

    console.error(
      "Error creating patient queue:",
      error
    );


    /*
    |--------------------------------------------------------------------------
    | RETURN ERROR
    |--------------------------------------------------------------------------
    */

    return res.status(500).json({
      success: false,

      message:
        "Failed to create queue ticket.",

      error:
        error.message,
    });

  } finally {

    /*
    |--------------------------------------------------------------------------
    | RELEASE MYSQL CONNECTION
    |--------------------------------------------------------------------------
    */

    connection.release();
  }
});


/*
|--------------------------------------------------------------------------
| GET QUEUE TICKET
|--------------------------------------------------------------------------
|
| GET /api/patients/queue/:queueId
|
| Used by:
|
| - QR tracker
| - Patient ticket retrieval
| - Queue monitoring
|
| Currently reads from MySQL because MySQL is the local queue source.
|
| Uses transaction_id instead of patient_id.
|--------------------------------------------------------------------------
*/

router.get(
  "/queue/:queueId",
  async (req, res) => {

    const { queueId } = req.params;

    if (!queueId) {
      return res.status(400).json({
        success: false,
        message: "Queue ID is required.",
      });
    }

    try {

      /*
      |--------------------------------------------------------------------------
      | GET QUEUE TICKET
      |--------------------------------------------------------------------------
      */

      const [rows] = await pool.query(
        `
        SELECT
          qt.queue_id,
          qt.issued_at,
          qt.department_id,
          qt.transaction_id,
          qt.queue_number,
          qt.queue_sequence,
          qt.called_at,
          qt.service_began_at,
          qt.completed_at,
          qt.status,
          qt.is_priority,

          p.transaction_id AS patient_transaction_id,
          p.department,
          p.location,
          p.patient_number

        FROM queue_ticket qt

        INNER JOIN patient p
          ON qt.transaction_id = p.transaction_id

        WHERE qt.queue_id = ?

        LIMIT 1
        `,
        [queueId]
      );


      /*
      |--------------------------------------------------------------------------
      | QUEUE NOT FOUND
      |--------------------------------------------------------------------------
      */

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Queue ticket not found.",
        });
      }


      const ticket = rows[0];


      /*
      |--------------------------------------------------------------------------
      | GET TODAY'S AI PREDICTION
      |--------------------------------------------------------------------------
      */

      const [predictionRows] = await pool.query(
        `
        SELECT
          prediction_id,
          department_id,
          prediction_date,
          queue_length,
          priority_count,
          active_staff_count,
          avg_service_minutes,
          avg_waiting_minutes,
          predicted_waiting_time,
          generated_at,
          updated_at

        FROM ai_queue_prediction

        WHERE department_id = ?
          AND prediction_date = CURDATE()

        LIMIT 1
        `,
        [ticket.department_id]
      );


      /*
      |--------------------------------------------------------------------------
      | AI PREDICTION
      |--------------------------------------------------------------------------
      */

      const prediction =
        predictionRows.length > 0
          ? predictionRows[0]
          : null;


      /*
      |--------------------------------------------------------------------------
      | RETURN QUEUE + AI PREDICTION
      |--------------------------------------------------------------------------
      */

      return res.json({
        success: true,

        data: {
          ...ticket,

          // AI estimated waiting time
          estimated_waiting_minutes:
            prediction
              ? Number(
                  prediction.predicted_waiting_time
                )
              : 0,

          // AI prediction information
          ai_prediction: prediction
            ? {
                prediction_id:
                  prediction.prediction_id,

                prediction_date:
                  prediction.prediction_date,

                queue_length:
                  Number(
                    prediction.queue_length
                  ) || 0,

                priority_count:
                  Number(
                    prediction.priority_count
                  ) || 0,

                active_staff_count:
                  Number(
                    prediction.active_staff_count
                  ) || 0,

                avg_service_minutes:
                  Number(
                    prediction.avg_service_minutes
                  ) || 0,

                avg_waiting_minutes:
                  Number(
                    prediction.avg_waiting_minutes
                  ) || 0,

                predicted_waiting_time:
                  Number(
                    prediction.predicted_waiting_time
                  ) || 0,

                generated_at:
                  prediction.generated_at,

                updated_at:
                  prediction.updated_at,
              }
            : null,
        },
      });

    } catch (error) {

      console.error(
        "Error retrieving queue ticket:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve queue ticket.",
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET WAITING COUNT FOR DEPARTMENT
|--------------------------------------------------------------------------
|
| GET /api/patients/waiting-count/:departmentId
|
| Returns the number of patients currently waiting.
|--------------------------------------------------------------------------
*/

router.get(
  "/waiting-count/:departmentId",
  async (req, res) => {

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

    try {

      const [rows] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS waiting_count
          FROM queue_ticket
          WHERE department_id = ?
            AND status = 'waiting'
            AND issued_at >= CURDATE()
            AND issued_at < DATE_ADD(
              CURDATE(),
              INTERVAL 1 DAY
            )
          `,
          [departmentId]
        );

      /*
        How long this department actually takes to serve one
        patient, measured over the last two weeks rather than
        today alone — first thing in the morning there are no
        completed tickets yet, and a single outlier would swing
        a same-day average wildly.
      */
      const [serviceRows] =
        await pool.query(
          `
          SELECT
            AVG(
              TIMESTAMPDIFF(
                SECOND,
                service_began_at,
                completed_at
              ) / 60
            ) AS average_service_minutes
          FROM queue_ticket
          WHERE department_id = ?
            AND status = 'completed'
            AND service_began_at IS NOT NULL
            AND completed_at IS NOT NULL
            AND completed_at >= DATE_SUB(
              CURDATE(),
              INTERVAL 14 DAY
            )
          `,
          [departmentId]
        );

      /*
        Counters serve in parallel, so a queue of 20 in front of
        4 open counters is not 20 service slots of waiting.
      */
      const [counterRows] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS active_counters
          FROM counter
          WHERE department_id = ?
            AND status = 'active'
          `,
          [departmentId]
        );

      const averageServiceMinutes =
        Number(
          serviceRows[0]?.average_service_minutes
        ) || 0;

      return res.json({
        success: true,

        data: {
          waiting_count:
            Number(
              rows[0]?.waiting_count
            ) || 0,

          average_service_minutes:
            averageServiceMinutes > 0
              ? Number(
                  averageServiceMinutes.toFixed(2)
                )
              : null,

          active_counters:
            Number(
              counterRows[0]?.active_counters
            ) || 0,
        },
      });

    } catch (error) {

      console.error(
        "Error getting waiting count:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get waiting count.",
        error:
          error.message,
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;