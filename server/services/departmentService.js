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

async function getDepartments() {
  const firebaseAvailable = FORCE_FIREBASE_OFFLINE
    ? false
    : await checkFirebaseConnection();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE
  |--------------------------------------------------------------------------
  */

  if (firebaseAvailable) {
    try {
      const snapshot = await db
        .collection("department")
        .get();

      const firebaseDepartments = snapshot.docs.map((doc) =>
        doc.data()
      );

      if (firebaseDepartments.length > 0) {
        console.log(
          `GET departments: ${firebaseDepartments.length} records loaded from Firebase.`
        );

        return firebaseDepartments;
      }

      console.log(
        "Firebase department collection is empty. Loading departments from MySQL..."
      );
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
  | MYSQL FALLBACK
  |--------------------------------------------------------------------------
  */

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

  console.log(
    `GET departments: ${rows.length} records loaded from MySQL.`
  );

  return rows;
}

/*
|--------------------------------------------------------------------------
| GET DEPARTMENT BY ID
|--------------------------------------------------------------------------
*/

async function getDepartmentById(departmentId) {
  const firebaseAvailable = FORCE_FIREBASE_OFFLINE
    ? false
    : await checkFirebaseConnection();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE
  |--------------------------------------------------------------------------
  */

  if (firebaseAvailable) {
    try {
      const document = await db
        .collection("department")
        .doc(departmentId)
        .get();

      if (document.exists) {
        console.log(
          `GET department ${departmentId}: loaded from Firebase.`
        );

        return document.data();
      }

      console.log(
        `Department ${departmentId} not found in Firebase. Checking MySQL...`
      );
    } catch (error) {
      console.error(
        "Firebase GET department by ID failed:",
        error.message
      );

      console.log(
        "Falling back to MySQL..."
      );
    }
  } else {
    console.log(
      "Firebase unavailable. Loading department from MySQL..."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL FALLBACK
  |--------------------------------------------------------------------------
  */

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
    WHERE department_id = ?
    LIMIT 1
    `,
    [departmentId]
  );

  if (rows.length === 0) {
    console.log(
      `Department ${departmentId} was not found in MySQL.`
    );

    return null;
  }

  console.log(
    `GET department ${departmentId}: loaded from MySQL.`
  );

  return rows[0];
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
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};