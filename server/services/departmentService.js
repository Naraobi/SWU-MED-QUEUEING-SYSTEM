  const { randomUUID } = require("crypto");

  const { db } = require("../config/firebase");
  const pool = require("../config/mysql");

  const {
    checkFirebaseConnection,
  } = require("./databaseService");

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY FIREBASE OFFLINE TEST SWITCH
  |--------------------------------------------------------------------------
  */

  const FORCE_FIREBASE_OFFLINE = false;

  /*
  |--------------------------------------------------------------------------
  | GET ALL DEPARTMENTS
  |--------------------------------------------------------------------------
  */
/*
|--------------------------------------------------------------------------
| GET ALL DEPARTMENTS
|--------------------------------------------------------------------------
*/

async function getDepartments() {
  const firebaseAvailable = FORCE_FIREBASE_OFFLINE
    ? false
    : await checkFirebaseConnection();

  let departments = [];

  /*
  |--------------------------------------------------------------------------
  | GET DEPARTMENT INFORMATION
  |--------------------------------------------------------------------------
  */

  if (firebaseAvailable) {
    try {
      const snapshot = await db
        .collection("department")
        .get();

      departments = snapshot.docs.map((doc) => doc.data());

      if (departments.length > 0) {
        console.log(
          `GET departments: ${departments.length} records loaded from Firebase.`
        );
      } else {
        console.log(
          "Firebase department collection is empty. Loading departments from MySQL..."
        );
      }
    } catch (error) {
      console.error(
        "Firebase GET departments failed:",
        error.message
      );

      console.log(
        "Falling back to MySQL..."
      );
    }
  } else {
    console.log(
      "Firebase unavailable. Loading departments from MySQL..."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL DEPARTMENT FALLBACK
  |--------------------------------------------------------------------------
  */

  if (departments.length === 0) {
    const [rows] = await pool.query(
      `
      SELECT
        department_id,
        name,
        classification,
        location,
        prefix,
        est_time,
        kiosk_id,
        status
      FROM department
      ORDER BY name ASC
      `
    );

    departments = rows;

    console.log(
      `GET departments: ${departments.length} records loaded from MySQL.`
    );
  }

  /*
  |--------------------------------------------------------------------------
  | GET LIVE QUEUE + TERMINAL INFORMATION
  |--------------------------------------------------------------------------
  */

const [liveData] = await pool.query(
  `
  SELECT
    d.department_id,

    /* =====================================================
       WAITING PATIENTS
       ===================================================== */
    (
      SELECT COUNT(*)
      FROM queue_ticket qt_waiting
      WHERE qt_waiting.department_id = d.department_id
        AND qt_waiting.status = 'waiting'
        AND DATE(qt_waiting.issued_at) = CURDATE()
    ) AS waiting_count,

    /* =====================================================
       CURRENT QUEUE
       Latest queue ticket issued today
       ===================================================== */
    (
      SELECT qt_current.queue_number
      FROM queue_ticket qt_current
      WHERE qt_current.department_id = d.department_id
        AND DATE(qt_current.issued_at) = CURDATE()
        AND qt_current.status IN ('waiting', 'serving')
      ORDER BY
        qt_current.queue_sequence DESC,
        qt_current.issued_at DESC
      LIMIT 1
    ) AS current_queue,

    /* =====================================================
       ACTIVE TERMINALS
       ===================================================== */
    (
      SELECT COUNT(*)
      FROM counter c
      WHERE c.department_id = d.department_id
        AND LOWER(c.status) = 'active'
    ) AS active_terminals

  FROM department d
  `
);
  /*
  |--------------------------------------------------------------------------
  | MERGE LIVE DATA INTO DEPARTMENTS
  |--------------------------------------------------------------------------
  */
const liveDataMap = new Map(
  liveData.map((row) => [
    String(row.department_id),

    {
      waiting_count:
        Number(row.waiting_count) || 0,

      current_queue:
        row.current_queue || null,

      active_terminals:
        Number(row.active_terminals) || 0,
    },
  ])
);

const enrichedDepartments =
  departments.map((department) => {

    const departmentKey =
      String(
        department.department_id ||
        department.id ||
        ''
      );

    const live =
      liveDataMap.get(
        departmentKey
      );

    return {
      ...department,

      waiting_count:
        live?.waiting_count || 0,

      current_queue:
        live?.current_queue || null,

      active_terminals:
        live?.active_terminals || 0,
    };
  });

  /*
  |--------------------------------------------------------------------------
  | RETURN
  |--------------------------------------------------------------------------
  */

  return enrichedDepartments;
}

  /*
  |--------------------------------------------------------------------------
  | CREATE DEPARTMENT
  |--------------------------------------------------------------------------
  */

  async function createDepartment(department) {
    const departmentId =
      department.department_id || randomUUID();

    const {
      name,
      classification,
      location,
      prefix,
      est_time,
      kiosk_id,
      status,
    } = department;

    /*
    |--------------------------------------------------------------------------
    | SAVE TO MYSQL FIRST
    |--------------------------------------------------------------------------
    */

    await pool.query(
      `
      INSERT INTO department
      (
        department_id,
        name,
        classification,
        location,
        prefix,
        est_time,
        kiosk_id,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        departmentId,
        name,
        classification,
        location,
        prefix,
        est_time,
        kiosk_id,
        status,
      ]
    );

    /*
    |--------------------------------------------------------------------------
    | CHECK FIREBASE
    |--------------------------------------------------------------------------
    */

    const firebaseAvailable = FORCE_FIREBASE_OFFLINE
      ? false
      : await checkFirebaseConnection();

    /*
    |--------------------------------------------------------------------------
    | SAVE TO FIREBASE
    |--------------------------------------------------------------------------
    */

    if (firebaseAvailable) {
      try {
        await db
          .collection("department")
          .doc(departmentId)
          .set({
            department_id: departmentId,
            name,
            classification,
            location,
            prefix,
            est_time,
            kiosk_id,
            status,
          });

        console.log(
          `Department ${departmentId} saved to MySQL and Firebase.`
        );
      } catch (error) {
        console.error(
          "Firebase CREATE failed:",
          error.message
        );

        await pool.query(
          `
          INSERT INTO sync_queue
          (
            table_name,
            record_id,
            operation,
            status,
            error_message
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            "department",
            departmentId,
            "create",
            "pending",
            error.message,
          ]
        );

        console.log(
          `Department ${departmentId} saved to MySQL and added to sync queue.`
        );
      }
    } else {
      await pool.query(
        `
        INSERT INTO sync_queue
        (
          table_name,
          record_id,
          operation,
          status
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          "department",
          departmentId,
          "create",
          "pending",
        ]
      );

      console.log(
        `Department ${departmentId} saved to MySQL and added to sync queue.`
      );
    }

    return {
      department_id: departmentId,
      name,
      classification,
      location,
      prefix,
      est_time,
      kiosk_id,
      status,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE DEPARTMENT
  |--------------------------------------------------------------------------
  */

  async function updateDepartment(
    departmentId,
    department
  ) {
    const {
      name,
      classification,
      location,
      prefix,
      est_time,
      kiosk_id,
      status,
    } = department;

    /*
    |--------------------------------------------------------------------------
    | UPDATE MYSQL FIRST
    |--------------------------------------------------------------------------
    */

    const [result] = await pool.query(
      `
      UPDATE department
      SET
        name = ?,
        classification = ?,
        location = ?,
        prefix = ?,
        est_time = ?,
        kiosk_id = ?,
        status = ?
      WHERE department_id = ?
      `,
      [
        name,
        classification,
        location,
        prefix,
        est_time,
        kiosk_id,
        status,
        departmentId,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const updatedDepartment = {
      department_id: departmentId,
      name,
      classification,
      location,
      prefix,
      est_time,
      kiosk_id,
      status,
    };

    /*
    |--------------------------------------------------------------------------
    | CHECK FIREBASE
    |--------------------------------------------------------------------------
    */

    const firebaseAvailable = FORCE_FIREBASE_OFFLINE
      ? false
      : await checkFirebaseConnection();

    /*
    |--------------------------------------------------------------------------
    | UPDATE FIREBASE
    |--------------------------------------------------------------------------
    */

    if (firebaseAvailable) {
      try {
        await db
          .collection("department")
          .doc(departmentId)
          .set(updatedDepartment);

        console.log(
          `Department ${departmentId} updated in MySQL and Firebase.`
        );
      } catch (error) {
        console.error(
          "Firebase UPDATE failed:",
          error.message
        );

        await pool.query(
          `
          INSERT INTO sync_queue
          (
            table_name,
            record_id,
            operation,
            status,
            error_message
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            "department",
            departmentId,
            "update",
            "pending",
            error.message,
          ]
        );

        console.log(
          `Department ${departmentId} updated in MySQL and added to sync queue.`
        );
      }
    } else {
      await pool.query(
        `
        INSERT INTO sync_queue
        (
          table_name,
          record_id,
          operation,
          status
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          "department",
          departmentId,
          "update",
          "pending",
        ]
      );

      console.log(
        `Department ${departmentId} updated in MySQL and added to sync queue.`
      );
    }

    return updatedDepartment;
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE DEPARTMENT
  |--------------------------------------------------------------------------
  */

  async function deleteDepartment(departmentId) {
    /*
    |--------------------------------------------------------------------------
    | DELETE FROM MYSQL FIRST
    |--------------------------------------------------------------------------
    */

    const [result] = await pool.query(
      `
      DELETE FROM department
      WHERE department_id = ?
      `,
      [departmentId]
    );

    if (result.affectedRows === 0) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK FIREBASE
    |--------------------------------------------------------------------------
    */

    const firebaseAvailable = FORCE_FIREBASE_OFFLINE
      ? false
      : await checkFirebaseConnection();

    /*
    |--------------------------------------------------------------------------
    | DELETE FROM FIREBASE
    |--------------------------------------------------------------------------
    */

    if (firebaseAvailable) {
      try {
        await db
          .collection("department")
          .doc(departmentId)
          .delete();

        console.log(
          `Department ${departmentId} deleted from MySQL and Firebase.`
        );
      } catch (error) {
        console.error(
          "Firebase DELETE failed:",
          error.message
        );

        await pool.query(
          `
          INSERT INTO sync_queue
          (
            table_name,
            record_id,
            operation,
            status,
            error_message
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            "department",
            departmentId,
            "delete",
            "pending",
            error.message,
          ]
        );

        console.log(
          `Department ${departmentId} deleted from MySQL and added to sync queue.`
        );
      }
    } else {
      await pool.query(
        `
        INSERT INTO sync_queue
        (
          table_name,
          record_id,
          operation,
          status
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          "department",
          departmentId,
          "delete",
          "pending",
        ]
      );

      console.log(
        `Department ${departmentId} deleted from MySQL and added to sync queue.`
      );
    }

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | EXPORT SERVICES
  |--------------------------------------------------------------------------
  */

  module.exports = {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };