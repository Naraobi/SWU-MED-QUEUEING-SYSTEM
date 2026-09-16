const { randomUUID } = require("crypto");

const pool = require("../config/mysql");
const { db, auth } = require("../config/firebase");

const {
  getDatabaseMode,
} = require("../services/databaseService");

const COUNTER_COLLECTION = "counter";

// =====================================================
// HELPER
// =====================================================

function normalizeCounter(counter) {
  if (!counter) {
    return null;
  }

  return {
    counter_id:
      counter.counter_id ||
      counter.id ||
      null,

    department_id:
      counter.department_id ||
      null,

    counter_number:
      counter.counter_number !== undefined &&
      counter.counter_number !== null
        ? Number(counter.counter_number)
        : null,

    prefix:
      counter.prefix ||
      null,

    assigned_staff_id:
      counter.assigned_staff_id ||
      null,

    status:
      counter.status ||
      "active",

    created_at:
      counter.created_at ||
      null,

    updated_at:
      counter.updated_at ||
      null,
  };
}

// =====================================================
// GET STAFF'S CURRENT COUNTER
// =====================================================

async function getStaffCounter(staffId) {
  if (!staffId) {
    throw new Error("Staff ID is required");
  }

  try {
    const mode = await getDatabaseMode();

    // =================================================
    // FIREBASE
    // =================================================

    if (mode === "firebase") {
      try {
        const snapshot = await db
          .collection(COUNTER_COLLECTION)
          .where("assigned_staff_id", "==", staffId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const document = snapshot.docs[0];
          const data = document.data();

          return normalizeCounter({
            ...data,
            counter_id:
              data.counter_id ||
              document.id,
          });
        }

        console.log(
          `No Firebase counter assigned to staff ${staffId}. Checking MySQL...`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase staff counter lookup failed:",
          firebaseError.message
        );

        console.log(
          "Falling back to MySQL for staff counter lookup..."
        );
      }
    }

    // =================================================
    // MYSQL
    // =================================================

    const [rows] = await pool.query(
      `
      SELECT
        counter_id,
        created_at,
        department_id,
        counter_number,
        prefix,
        assigned_staff_id,
        status,
        updated_at
      FROM counter
      WHERE assigned_staff_id = ?
      LIMIT 1
      `,
      [staffId]
    );

    if (rows.length === 0) {
      return null;
    }

    return normalizeCounter(rows[0]);
  } catch (error) {
    console.error(
      "GET staff counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to retrieve staff counter"
    );
  }
}

// =====================================================
// GET STAFF COUNTER FROM MYSQL
// =====================================================

async function getStaffCounterFromMySQL(staffId) {
  if (!staffId) {
    throw new Error("Staff ID is required");
  }

  const [rows] = await pool.query(
    `
    SELECT
      counter_id,
      created_at,
      department_id,
      counter_number,
      prefix,
      assigned_staff_id,
      status,
      updated_at
    FROM counter
    WHERE assigned_staff_id = ?
    LIMIT 1
    `,
    [staffId]
  );

  if (rows.length === 0) {
    return null;
  }

  return normalizeCounter(rows[0]);
}

// =====================================================
// GET ALL COUNTERS
// =====================================================

async function getCounters() {
  try {
    const mode = await getDatabaseMode();

    // =================================================
    // ONLINE
    // FIREBASE FIRST
    // =================================================

    if (mode === "firebase") {
      try {
        const snapshot = await db
          .collection(COUNTER_COLLECTION)
          .get();

        if (!snapshot.empty) {
          const firebaseCounters =
            snapshot.docs.map((item) => {
              const data = item.data();

              return normalizeCounter({
                ...data,
                counter_id:
                  data.counter_id ||
                  item.id,
              });
            });

          firebaseCounters.sort((a, b) => {
            const departmentCompare =
              String(
                a.department_id || ""
              ).localeCompare(
                String(
                  b.department_id || ""
                )
              );

            if (departmentCompare !== 0) {
              return departmentCompare;
            }

            return (
              Number(
                a.counter_number || 0
              ) -
              Number(
                b.counter_number || 0
              )
            );
          });

          console.log(
            `GET counters: ${firebaseCounters.length} records loaded from Firebase.`
          );

          return firebaseCounters;
        }

        console.log(
          "Firebase counter collection is empty. Loading counters from MySQL..."
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter read failed:",
          firebaseError.message
        );

        console.log(
          "Falling back to MySQL for counters..."
        );
      }
    }

    // =================================================
    // MYSQL
    // =================================================

    const [rows] = await pool.query(`
      SELECT
        counter_id,
        created_at,
        department_id,
        counter_number,
        prefix,
        assigned_staff_id,
        status,
        updated_at
      FROM counter
      ORDER BY
        department_id ASC,
        counter_number ASC
    `);

    console.log(
      `GET counters: ${rows.length} records loaded from MySQL.`
    );

    return rows.map(normalizeCounter);
  } catch (error) {
    console.error(
      "GET counters error:",
      error
    );

    throw new Error(
      "Failed to retrieve counters"
    );
  }
}

// =====================================================
// GET COUNTER BY ID
// =====================================================

async function getCounterById(counterId) {
  if (!counterId) {
    throw new Error(
      "Counter ID is required"
    );
  }

  try {
    const mode =
      await getDatabaseMode();

    // =================================================
    // FIREBASE
    // =================================================

    if (mode === "firebase") {
      try {
        const counterRef = db
          .collection(
            COUNTER_COLLECTION
          )
          .doc(counterId);

        const snapshot =
          await counterRef.get();

        if (snapshot.exists) {
          const data =
            snapshot.data();

          return normalizeCounter({
            ...data,
            counter_id:
              data.counter_id ||
              snapshot.id,
          });
        }

        console.log(
          `Counter ${counterId} not found in Firebase. Checking MySQL...`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter lookup failed:",
          firebaseError.message
        );

        console.log(
          "Falling back to MySQL for counter lookup..."
        );
      }
    }

    // =================================================
    // MYSQL
    // =================================================

    const [rows] =
      await pool.query(
        `
        SELECT
          counter_id,
          created_at,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status,
          updated_at
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    if (rows.length === 0) {
      throw new Error(
        "Counter not found"
      );
    }

    return normalizeCounter(rows[0]);
  } catch (error) {
    console.error(
      "GET counter by ID error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to retrieve counter"
    );
  }
}

// =====================================================
// CHECK DUPLICATE COUNTER NUMBER
// =====================================================

async function counterNumberExists(
  departmentId,
  counterNumber,
  excludeCounterId = null
) {
  let sql = `
    SELECT counter_id
    FROM counter
    WHERE department_id = ?
      AND counter_number = ?
  `;

  const params = [
    departmentId,
    counterNumber,
  ];

  if (excludeCounterId) {
    sql += `
      AND counter_id != ?
    `;

    params.push(
      excludeCounterId
    );
  }

  sql += " LIMIT 1";

  const [rows] =
    await pool.query(
      sql,
      params
    );

  return rows.length > 0;
}

// =====================================================
// CREATE COUNTER
// =====================================================

async function createCounter(
  counter
) {
  if (!counter) {
    throw new Error(
      "Counter data is required"
    );
  }

  const {
    department_id,
    counter_number,
    prefix,
    assigned_staff_id,
    status = "active",
  } = counter;

  // =================================================
  // VALIDATION
  // =================================================

  if (!department_id) {
    throw new Error(
      "Department ID is required"
    );
  }

  if (
    counter_number === undefined ||
    counter_number === null ||
    counter_number === ""
  ) {
    throw new Error(
      "Counter number is required"
    );
  }

  const parsedCounterNumber =
    Number(counter_number);

  if (
    !Number.isInteger(
      parsedCounterNumber
    ) ||
    parsedCounterNumber <= 0
  ) {
    throw new Error(
      "Counter number must be a positive integer"
    );
  }

  // =================================================
  // CHECK DEPARTMENT
  // =================================================

  const [departmentRows] =
    await pool.query(
      `
      SELECT department_id
      FROM department
      WHERE department_id = ?
      LIMIT 1
      `,
      [department_id]
    );

  if (departmentRows.length === 0) {
    throw new Error(
      "Department not found"
    );
  }

  // =================================================
  // CHECK DUPLICATE COUNTER
  // =================================================

  const exists =
    await counterNumberExists(
      department_id,
      parsedCounterNumber
    );

  if (exists) {
    throw new Error(
      `Counter ${parsedCounterNumber} already exists in this department`
    );
  }

  // =================================================
  // GENERATE UUID
  // =================================================

  const counterId =
    randomUUID();

  try {
    const mode =
      await getDatabaseMode();

    // =================================================
    // MYSQL DATA
    // =================================================

    const mysqlCounter = {
      counter_id:
        counterId,

      department_id:
        department_id,

      counter_number:
        parsedCounterNumber,

      prefix:
        prefix || null,

      assigned_staff_id:
        assigned_staff_id || null,

      status:
        status || "active",
    };

    // =================================================
    // ONLINE
    // FIREBASE + MYSQL
    // =================================================

    if (mode === "firebase") {
      try {
        const now =
          new Date();

        await db
          .collection(
            COUNTER_COLLECTION
          )
          .doc(counterId)
          .set({
            counter_id:
              counterId,

            department_id:
              department_id,

            counter_number:
              parsedCounterNumber,

            prefix:
              prefix || null,

            assigned_staff_id:
              assigned_staff_id ||
              null,

            status:
              status || "active",

            created_at:
              now,

            updated_at:
              now,
          });

        console.log(
          `Counter ${counterId} created in Firebase.`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter creation failed:",
          firebaseError.message
        );

        throw new Error(
          "Failed to create counter in Firebase"
        );
      }

      // =================================================
      // MYSQL
      // =================================================

      await pool.query(
        `
        INSERT INTO counter (
          counter_id,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          mysqlCounter.counter_id,
          mysqlCounter.department_id,
          mysqlCounter.counter_number,
          mysqlCounter.prefix,
          mysqlCounter.assigned_staff_id,
          mysqlCounter.status,
        ]
      );

      console.log(
        `Counter ${counterId} created in MySQL.`
      );
    }

    // =================================================
    // OFFLINE
    // MYSQL ONLY
    // =================================================

    else {
      await pool.query(
        `
        INSERT INTO counter (
          counter_id,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          mysqlCounter.counter_id,
          mysqlCounter.department_id,
          mysqlCounter.counter_number,
          mysqlCounter.prefix,
          mysqlCounter.assigned_staff_id,
          mysqlCounter.status,
        ]
      );

      console.log(
        `Counter ${counterId} created in MySQL (offline mode).`
      );
    }

    // =================================================
    // RETURN CREATED RECORD
    // =================================================

    return await getCounterById(
      counterId
    );
  } catch (error) {
    console.error(
      "CREATE counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to create counter"
    );
  }
}

// =====================================================
// UPDATE COUNTER
// =====================================================

async function updateCounter(
  counterId,
  counter
) {
  if (!counterId) {
    throw new Error(
      "Counter ID is required"
    );
  }

  if (!counter) {
    throw new Error(
      "Counter data is required"
    );
  }

  const {
    department_id,
    counter_number,
    prefix,
    assigned_staff_id,
    status,
  } = counter;

  try {
    // =================================================
    // GET EXISTING COUNTER
    // =================================================

    const [existingRows] =
      await pool.query(
        `
        SELECT *
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    if (
      existingRows.length === 0
    ) {
      throw new Error(
        "Counter not found"
      );
    }

    const existing =
      existingRows[0];

    const finalDepartmentId =
      department_id ||
      existing.department_id;

    const finalCounterNumber =
      counter_number !==
        undefined &&
      counter_number !==
        null
        ? Number(counter_number)
        : existing.counter_number;

    const finalPrefix =
      prefix !== undefined
        ? prefix
        : existing.prefix;

    const finalStaffId =
      assigned_staff_id !==
      undefined
        ? assigned_staff_id
        : existing.assigned_staff_id;

    const finalStatus =
      status ||
      existing.status;

    // =================================================
    // VALIDATE COUNTER NUMBER
    // =================================================

    if (
      !Number.isInteger(
        finalCounterNumber
      ) ||
      finalCounterNumber <= 0
    ) {
      throw new Error(
        "Counter number must be a positive integer"
      );
    }

    // =================================================
    // CHECK DUPLICATE
    // =================================================

    const duplicate =
      await counterNumberExists(
        finalDepartmentId,
        finalCounterNumber,
        counterId
      );

    if (duplicate) {
      throw new Error(
        `Counter ${finalCounterNumber} already exists in this department`
      );
    }

    // =================================================
    // GET DATABASE MODE
    // =================================================

    const mode =
      await getDatabaseMode();

    // =================================================
    // FIREBASE
    // =================================================

    if (mode === "firebase") {
      try {
        const counterRef =
          db
            .collection(
              COUNTER_COLLECTION
            )
            .doc(counterId);

        await counterRef.set(
          {
            counter_id:
              counterId,

            department_id:
              finalDepartmentId,

            counter_number:
              finalCounterNumber,

            prefix:
              finalPrefix || null,

            assigned_staff_id:
              finalStaffId || null,

            status:
              finalStatus,

            updated_at:
              new Date(),
          },
          {
            merge: true,
          }
        );

        console.log(
          `Counter ${counterId} updated in Firebase.`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter update failed:",
          firebaseError.message
        );

        throw new Error(
          "Failed to update counter in Firebase"
        );
      }
    }

    // =================================================
    // MYSQL
    // =================================================

    await pool.query(
      `
      UPDATE counter
      SET
        department_id = ?,
        counter_number = ?,
        prefix = ?,
        assigned_staff_id = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE counter_id = ?
      `,
      [
        finalDepartmentId,
        finalCounterNumber,
        finalPrefix || null,
        finalStaffId || null,
        finalStatus,
        counterId,
      ]
    );

    console.log(
      `Counter ${counterId} updated in MySQL.`
    );

    // =================================================
    // RETURN UPDATED RECORD
    // =================================================

    const [rows] =
      await pool.query(
        `
        SELECT
          counter_id,
          created_at,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status,
          updated_at
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    return normalizeCounter(rows[0]);
  } catch (error) {
    console.error(
      "UPDATE counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to update counter"
    );
  }
}

// =====================================================
// DELETE COUNTER
// =====================================================

async function deleteCounter(
  counterId
) {
  if (!counterId) {
    throw new Error(
      "Counter ID is required"
    );
  }

  try {
    // =================================================
    // CHECK COUNTER EXISTS
    // =================================================

    const [rows] =
      await pool.query(
        `
        SELECT counter_id
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    if (rows.length === 0) {
      throw new Error(
        "Counter not found"
      );
    }

    const mode =
      await getDatabaseMode();

    // =================================================
    // FIREBASE
    // =================================================

    if (mode === "firebase") {
      try {
        await db
          .collection(
            COUNTER_COLLECTION
          )
          .doc(counterId)
          .delete();

        console.log(
          `Counter ${counterId} deleted from Firebase.`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter deletion failed:",
          firebaseError.message
        );

        throw new Error(
          "Failed to delete counter from Firebase"
        );
      }
    }

    // =================================================
    // MYSQL
    // =================================================

    await pool.query(
      `
      DELETE FROM counter
      WHERE counter_id = ?
      `,
      [counterId]
    );

    console.log(
      `Counter ${counterId} deleted from MySQL.`
    );

    return {
      counter_id:
        counterId,

      deleted:
        true,
    };
  } catch (error) {
    console.error(
      "DELETE counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to delete counter"
    );
  }
}

// =====================================================
// ASSIGN COUNTER / TERMINAL TO STAFF
// =====================================================

async function assignCounter(
  counterId,
  staffId
) {
  if (!counterId) {
    throw new Error(
      "Counter ID is required"
    );
  }

  if (!staffId) {
    throw new Error(
      "Staff ID is required"
    );
  }

  try {
    // =================================================
    // GET STAFF DEPARTMENT
    // =================================================

    const [staffRows] =
      await pool.query(
        `
        SELECT
          user_id,
          department_id
        FROM user
        WHERE user_id = ?
        LIMIT 1
        `,
        [staffId]
      );

    if (
      staffRows.length === 0
    ) {
      throw new Error(
        "Staff user not found"
      );
    }

    const staff =
      staffRows[0];

    // =================================================
    // GET COUNTER
    // =================================================

    const [counterRows] =
      await pool.query(
        `
        SELECT
          counter_id,
          created_at,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status,
          updated_at
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    if (
      counterRows.length === 0
    ) {
      throw new Error(
        "Counter not found"
      );
    }

    const counter =
      counterRows[0];

    // =================================================
    // CHECK DEPARTMENT
    // =================================================

    if (
      String(
        counter.department_id
      ) !==
      String(
        staff.department_id
      )
    ) {
      throw new Error(
        "This terminal does not belong to your department"
      );
    }

    // =================================================
    // CHECK STATUS
    // =================================================

    if (
      String(
        counter.status
      ).toLowerCase() !==
      "active"
    ) {
      throw new Error(
        "This terminal is not available"
      );
    }

    // =================================================
    // ALREADY ASSIGNED TO THIS STAFF
    // =================================================

    if (
      counter.assigned_staff_id &&
      String(
        counter.assigned_staff_id
      ) ===
      String(staffId)
    ) {
      return normalizeCounter(
        counter
      );
    }

    // =================================================
    // CHECK IF ASSIGNED TO ANOTHER STAFF
    // =================================================

    if (
      counter.assigned_staff_id
    ) {
      throw new Error(
        "This terminal is already assigned to another staff member"
      );
    }

    // =================================================
    // CHECK IF STAFF ALREADY HAS
    // ANOTHER TERMINAL
    // =================================================

    const [
      existingAssignment,
    ] = await pool.query(
      `
      SELECT
        counter_id,
        counter_number,
        prefix,
        department_id,
        assigned_staff_id,
        status
      FROM counter
      WHERE assigned_staff_id = ?
      LIMIT 1
      `,
      [staffId]
    );

    if (
      existingAssignment.length >
      0
    ) {
      throw new Error(
        "You already have a terminal assigned"
      );
    }

    // =================================================
    // ATOMIC ASSIGNMENT
    // =================================================

    const [
      updateResult,
    ] = await pool.query(
      `
      UPDATE counter
      SET
        assigned_staff_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE counter_id = ?
        AND department_id = ?
        AND status = 'active'
        AND assigned_staff_id IS NULL
      `,
      [
        staffId,
        counterId,
        staff.department_id,
      ]
    );

    if (
      updateResult.affectedRows ===
      0
    ) {
      throw new Error(
        "Terminal is no longer available. Please select another terminal."
      );
    }

    // =================================================
    // FIREBASE SYNC
    // =================================================

    const mode =
      await getDatabaseMode();

    if (mode === "firebase") {
      try {
        await db
          .collection(
            COUNTER_COLLECTION
          )
          .doc(counterId)
          .set(
            {
              assigned_staff_id:
                staffId,

              updated_at:
                new Date(),
            },
            {
              merge: true,
            }
          );

        console.log(
          `Counter ${counterId} assigned to staff ${staffId} in Firebase.`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter assignment failed:",
          firebaseError.message
        );

        // MySQL remains the successful local assignment.
      }
    }

    // =================================================
    // RETURN UPDATED COUNTER
    // =================================================

    const [rows] =
      await pool.query(
        `
        SELECT
          counter_id,
          created_at,
          department_id,
          counter_number,
          prefix,
          assigned_staff_id,
          status,
          updated_at
        FROM counter
        WHERE counter_id = ?
        LIMIT 1
        `,
        [counterId]
      );

    return normalizeCounter(rows[0]);
  } catch (error) {
    console.error(
      "ASSIGN counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to assign counter"
    );
  }
}

// =====================================================
// RELEASE COUNTER / TERMINAL
// =====================================================

async function releaseCounter(
  counterId,
  staffId
) {
  if (!counterId) {
    throw new Error(
      "Counter ID is required"
    );
  }

  if (!staffId) {
    throw new Error(
      "Staff ID is required"
    );
  }

  try {
    // =================================================
    // RELEASE ONLY IF OWNED BY THIS STAFF
    // =================================================

    const [
      result,
    ] = await pool.query(
      `
      UPDATE counter
      SET
        assigned_staff_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE counter_id = ?
        AND assigned_staff_id = ?
      `,
      [
        counterId,
        staffId,
      ]
    );

    // =================================================
    // FIREBASE SYNC
    // =================================================

    const mode =
      await getDatabaseMode();

    if (mode === "firebase") {
      try {
        await db
          .collection(
            COUNTER_COLLECTION
          )
          .doc(counterId)
          .set(
            {
              assigned_staff_id:
                null,

              updated_at:
                new Date(),
            },
            {
              merge: true,
            }
          );

        console.log(
          `Counter ${counterId} released in Firebase.`
        );
      } catch (firebaseError) {
        console.error(
          "Firebase counter release failed:",
          firebaseError.message
        );

        // MySQL remains the local assignment state.
      }
    }

    return {
      counter_id:
        counterId,

      released:
        result.affectedRows > 0,
    };
  } catch (error) {
    console.error(
      "RELEASE counter error:",
      error
    );

    throw new Error(
      error.message ||
        "Failed to release counter"
    );
  }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // CRUD
  getCounters,
  getCounterById,
  createCounter,
  updateCounter,
  deleteCounter,

  // Terminal session management
  assignCounter,
  releaseCounter,
  getStaffCounter,

  // Aliases used by backend/frontend naming
  assignTerminal:
    assignCounter,

  releaseTerminal:
    releaseCounter,

  getStaffTerminal:
    getStaffCounter,
};