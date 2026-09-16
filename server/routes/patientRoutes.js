const express = require("express");
const { randomUUID } = require("crypto");

const pool = require("../config/mysql");
const { db } = require("../config/firebase");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET DEPARTMENTS BY KIOSK
|--------------------------------------------------------------------------
|
| GET /api/patients/departments/:kioskId
|
| MySQL table:
| department
|
| Returns only active departments assigned to the selected kiosk.
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| CREATE PATIENT QUEUE TICKET
|--------------------------------------------------------------------------
|
| POST /api/patients/queue
|
| Creates:
|
| 1. patient record in MySQL
| 2. queue_ticket record in MySQL
| 3. patient document in Firebase
| 4. queue_tickets document in Firebase
|
| DATABASE STRATEGY:
|
| MySQL is written first because it is the local/primary queue database.
|
| After MySQL successfully commits, Firebase is synchronized.
|
| IMPORTANT:
| If Firebase fails:
|
| - MySQL data remains valid.
| - Queue creation is still successful.
| - firebase_synced is returned as false.
|
| Firebase document IDs:
|
| patients/{transaction_id}
| queue_tickets/{queue_id}
|
| IMPORTANT:
| queue_ticket uses transaction_id to reference:
| patient.transaction_id
|
| No counter_id.
| No skip_reason.
|--------------------------------------------------------------------------
*/

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
          AND issued_at >= CURDATE()
          AND issued_at < DATE_ADD(
            CURDATE(),
            INTERVAL 1 DAY
          )
        `,
        [department_id]
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


    /*
    |--------------------------------------------------------------------------
    | COMMIT MYSQL TRANSACTION
    |--------------------------------------------------------------------------
    |
    | At this point the local MySQL database contains both:
    |
    | patient
    | queue_ticket
    |
    | If Firebase later fails, these records remain valid.
    |--------------------------------------------------------------------------
    */

    await connection.commit();


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

      /*
      |--------------------------------------------------------------------------
      | FIREBASE SYNC FAILED
      |--------------------------------------------------------------------------
      |
      | DO NOT ROLLBACK MYSQL.
      |
      | The MySQL transaction has already been committed.
      |
      | This allows the hospital queue to continue operating even if
      | Firebase is temporarily unavailable.
      |--------------------------------------------------------------------------
      */

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

    const { queueId } =
      req.params;

    if (!queueId) {
      return res.status(400).json({
        success: false,
        message:
          "Queue ID is required.",
      });
    }

    try {

      const [rows] =
        await pool.query(
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
            ON qt.transaction_id =
               p.transaction_id

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
          message:
            "Queue ticket not found.",
        });
      }


      /*
      |--------------------------------------------------------------------------
      | RETURN QUEUE
      |--------------------------------------------------------------------------
      */

      return res.json({
        success: true,
        data: rows[0],
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
        error:
          error.message,
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
          `,
          [departmentId]
        );


      return res.json({
        success: true,

        data: {
          waiting_count:
            Number(
              rows[0]?.waiting_count
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