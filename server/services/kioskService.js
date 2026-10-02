const { randomUUID } = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("../config/mysql");
const { db } = require("../config/firebase");

const {
  getDatabaseMode,
} = require("./databaseService");

/*
|--------------------------------------------------------------------------
| DATABASE / COLLECTION NAMES
|--------------------------------------------------------------------------
*/

const KIOSK_COLLECTION = "kiosk";

/*
|--------------------------------------------------------------------------
| STATUS HELPER
|--------------------------------------------------------------------------
*/

function normalizeStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  return normalized === "active"
    ? "active"
    : "inactive";
}

/*
|--------------------------------------------------------------------------
| FORMAT KIOSK
|--------------------------------------------------------------------------
|
| IMPORTANT:
| kiosk_pin is NEVER returned here.
|
| Only the backend works with the PIN hash.
|
|--------------------------------------------------------------------------
*/

function formatKiosk(
  data,
  documentId = null
) {
  return {
    kiosk_id:
      data.kiosk_id ||
      documentId ||
      null,

    name:
      data.name || "",

    status:
      normalizeStatus(
        data.status
      ),

    created_at:
      data.created_at || null,

    updated_at:
      data.updated_at || null,
  };
}

/*
|--------------------------------------------------------------------------
| VALIDATE KIOSK PIN
|--------------------------------------------------------------------------
|
| This is kept for EXISTING kiosk PIN verification
| and optional PIN updates.
|
| NEW kiosks no longer require a kiosk PIN.
|
|--------------------------------------------------------------------------
*/

function validateKioskPin(pin) {
  const normalizedPin =
    String(pin || "").trim();

  if (!/^\d{4}$/.test(normalizedPin)) {
    throw new Error(
      "Kiosk PIN must be exactly 4 digits."
    );
  }

  return normalizedPin;
}

/*
|--------------------------------------------------------------------------
| GET ALL KIOSKS
|--------------------------------------------------------------------------
*/

async function getKiosks() {
  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    try {
      const snapshot =
        await db
          .collection(
            KIOSK_COLLECTION
          )
          .get();

      const kiosks =
        snapshot.docs.map(
          (kioskDoc) =>
            formatKiosk(
              kioskDoc.data(),
              kioskDoc.id
            )
        );

      if (kiosks.length > 0) {
        kiosks.sort(
          (a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
        );

        console.log(
          `GET kiosks: ${kiosks.length} records loaded from Firebase.`
        );

        return kiosks;
      }

      console.log(
        "Firebase kiosk collection is empty. Loading kiosks from MySQL..."
      );

      return getKiosksFromMySQL();
    } catch (error) {
      console.error(
        "FIREBASE GET KIOSKS ERROR:",
        error.message
      );

      console.log(
        "Falling back to MySQL for kiosks..."
      );

      return getKiosksFromMySQL();
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    return getKiosksFromMySQL();
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| GET ALL KIOSKS FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getKiosksFromMySQL() {
  const [rows] =
    await pool.query(`
      SELECT
        kiosk_id,
        name,
        status,
        created_at,
        updated_at
      FROM \`kiosk\`
      ORDER BY name ASC
    `);

  return rows.map(
    (kiosk) => ({
      kiosk_id:
        kiosk.kiosk_id,

      name:
        kiosk.name || "",

      status:
        normalizeStatus(
          kiosk.status
        ),

      created_at:
        kiosk.created_at ||
        null,

      updated_at:
        kiosk.updated_at ||
        null,
    })
  );
}

/*
|--------------------------------------------------------------------------
| GET ONE KIOSK
|--------------------------------------------------------------------------
*/

async function getKioskById(
  kioskId
) {
  if (!kioskId) {
    return null;
  }

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    try {
      const kioskDoc =
        await db
          .collection(
            KIOSK_COLLECTION
          )
          .doc(kioskId)
          .get();

      if (kioskDoc.exists) {
        return formatKiosk(
          kioskDoc.data(),
          kioskDoc.id
        );
      }

      return getKioskFromMySQL(
        kioskId
      );
    } catch (error) {
      console.error(
        "FIREBASE GET KIOSK ERROR:",
        error.message
      );

      return getKioskFromMySQL(
        kioskId
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    return getKioskFromMySQL(
      kioskId
    );
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| GET ONE KIOSK FROM MYSQL
|--------------------------------------------------------------------------
*/

async function getKioskFromMySQL(
  kioskId
) {
  const [rows] =
    await pool.query(
      `
      SELECT
        kiosk_id,
        name,
        status,
        created_at,
        updated_at
      FROM \`kiosk\`
      WHERE kiosk_id = ?
      LIMIT 1
      `,
      [kioskId]
    );

  if (rows.length === 0) {
    return null;
  }

  return {
    kiosk_id:
      rows[0].kiosk_id,

    name:
      rows[0].name || "",

    status:
      normalizeStatus(
        rows[0].status
      ),

    created_at:
      rows[0].created_at ||
      null,

    updated_at:
      rows[0].updated_at ||
      null,
  };
}

/*
|--------------------------------------------------------------------------
| GET KIOSK INCLUDING PIN HASH FROM MYSQL
|--------------------------------------------------------------------------
|
| INTERNAL USE ONLY.
|
| The PIN hash is NEVER returned to the frontend.
|
|--------------------------------------------------------------------------
*/

async function getKioskWithPinFromMySQL(
  kioskId
) {
  const [rows] =
    await pool.query(
      `
      SELECT
        kiosk_id,
        name,
        status,
        kiosk_pin,
        created_at,
        updated_at
      FROM \`kiosk\`
      WHERE kiosk_id = ?
      LIMIT 1
      `,
      [kioskId]
    );

  if (rows.length === 0) {
    return null;
  }

  return {
    kiosk_id:
      rows[0].kiosk_id,

    name:
      rows[0].name || "",

    status:
      normalizeStatus(
        rows[0].status
      ),

    kiosk_pin:
      rows[0].kiosk_pin ||
      null,

    created_at:
      rows[0].created_at ||
      null,

    updated_at:
      rows[0].updated_at ||
      null,
  };
}

/*
|--------------------------------------------------------------------------
| CHECK DUPLICATE KIOSK NAME
|--------------------------------------------------------------------------
*/

async function kioskNameExists(
  name,
  excludeKioskId = null
) {
  const normalizedName =
    String(name || "")
      .trim()
      .toLowerCase();

  if (!normalizedName) {
    return false;
  }

  let sql = `
    SELECT kiosk_id
    FROM \`kiosk\`
    WHERE LOWER(TRIM(name)) = ?
  `;

  const params = [
    normalizedName,
  ];

  if (excludeKioskId) {
    sql += `
      AND kiosk_id <> ?
    `;

    params.push(
      excludeKioskId
    );
  }

  sql += `
    LIMIT 1
  `;

  const [rows] =
    await pool.query(
      sql,
      params
    );

  return rows.length > 0;
}

/*
|--------------------------------------------------------------------------
| CREATE KIOSK
|--------------------------------------------------------------------------
|
| NEW KIOSKS DO NOT REQUIRE A KIOSK PIN.
|
| The kiosk PIN has been moved to the centralized
| Admin Security PIN / reset logic.
|
| Existing kiosk PINs are still supported separately
| for backwards compatibility.
|
|--------------------------------------------------------------------------
*/

async function createKiosk(
  kioskData = {}
) {
  const kioskId =
    kioskData.kiosk_id ||
    randomUUID();

  const name =
    String(
      kioskData.name || ""
    ).trim();

  const status =
    normalizeStatus(
      kioskData.status
    );

  /*
  |--------------------------------------------------------------------------
  | VALIDATE NAME
  |--------------------------------------------------------------------------
  */

  if (!name) {
    throw new Error(
      "Kiosk name is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CHECK DUPLICATE NAME
  |--------------------------------------------------------------------------
  */

  const duplicate =
    await kioskNameExists(
      name
    );

  if (duplicate) {
    throw new Error(
      "A kiosk with this name already exists."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE KIOSK DATA
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  | No kiosk_pin is created here.
  |
  |--------------------------------------------------------------------------
  */

  const now =
    new Date().toISOString();

  const kiosk = {
    kiosk_id:
      kioskId,

    name,

    status,

    created_at:
      now,

    updated_at:
      now,
  };

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE ONLINE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    try {
      await db
        .collection(
          KIOSK_COLLECTION
        )
        .doc(kioskId)
        .set({
          kiosk_id:
            kioskId,

          name,

          status,

          created_at:
            now,

          updated_at:
            now,
        });

      await insertKioskIntoMySQL(
        kiosk
      );

      console.log(
        `CREATE kiosk: ${kioskId} saved to Firebase and MySQL.`
      );

      return formatKiosk(
        kiosk
      );
    } catch (error) {
      console.error(
        "FIREBASE CREATE KIOSK ERROR:",
        error.message
      );

      await insertKioskIntoMySQL(
        kiosk
      );

      console.log(
        `CREATE kiosk: ${kioskId} saved to MySQL after Firebase failure.`
      );

      return formatKiosk(
        kiosk
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    await insertKioskIntoMySQL(
      kiosk
    );

    console.log(
      `CREATE kiosk: ${kioskId} saved to MySQL.`
    );

    return formatKiosk(
      kiosk
    );
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| INSERT KIOSK INTO MYSQL
|--------------------------------------------------------------------------
|
| NEW KIOSKS ARE INSERTED WITHOUT kiosk_pin.
|
| This requires kiosk.kiosk_pin to allow NULL
| or have a default value in MySQL.
|
|--------------------------------------------------------------------------
*/

async function insertKioskIntoMySQL(
  kiosk
) {
  await pool.query(
    `
    INSERT INTO \`kiosk\` (
      kiosk_id,
      name,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      kiosk.kiosk_id,
      kiosk.name,
      kiosk.status,
      kiosk.created_at ||
        null,
      kiosk.updated_at ||
        null,
    ]
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE KIOSK
|--------------------------------------------------------------------------
|
| Existing kiosk PINs are preserved.
|
| If a new PIN is supplied:
|   validate → hash → replace old hash
|
| If no PIN is supplied:
|   keep the existing hash
|
|--------------------------------------------------------------------------
*/
async function updateKiosk(kioskId, kioskData = {}) {
  if (!kioskId) {
    throw new Error("Kiosk ID is required.");
  }

  const existingKiosk = await getKioskById(kioskId);

  if (!existingKiosk) {
    return null;
  }

  const name =
    kioskData.name !== undefined
      ? String(kioskData.name || "").trim()
      : existingKiosk.name;

  const status =
    kioskData.status !== undefined
      ? normalizeStatus(kioskData.status)
      : normalizeStatus(existingKiosk.status);

  if (!name) {
    throw new Error("Kiosk name is required.");
  }

  const duplicate = await kioskNameExists(name, kioskId);

  if (duplicate) {
    throw new Error(
      "A kiosk with this name already exists."
    );
  }

  const updatedAt = new Date().toISOString();

  const updatedKiosk = {
    kiosk_id: kioskId,
    name,
    status,
    created_at: existingKiosk.created_at,
    updated_at: updatedAt,
  };

  const mode = await getDatabaseMode();

  if (mode === "firebase") {
    try {
      await db
        .collection(KIOSK_COLLECTION)
        .doc(kioskId)
        .set(
          {
            kiosk_id: kioskId,
            name,
            status,
            updated_at: updatedAt,
          },
          { merge: true }
        );

      await updateKioskInMySQL(kioskId, updatedKiosk);

      return formatKiosk(updatedKiosk);
    } catch (error) {
      console.error(
        "FIREBASE UPDATE KIOSK ERROR:",
        error.message
      );

      await updateKioskInMySQL(kioskId, updatedKiosk);

      return formatKiosk(updatedKiosk);
    }
  }

  if (mode === "mysql") {
    await updateKioskInMySQL(kioskId, updatedKiosk);

    return formatKiosk(updatedKiosk);
  }

  throw new Error("No database is currently available.");
}
/*
|--------------------------------------------------------------------------
| UPDATE KIOSK IN MYSQL
|--------------------------------------------------------------------------
*/

async function updateKioskInMySQL(kioskId, kiosk) {
  const [result] = await pool.query(
    `
    UPDATE \`kiosk\`
    SET
      name = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE kiosk_id = ?
    `,
    [
      kiosk.name,
      kiosk.status,
      kioskId,
    ]
  );

  if (result.affectedRows === 0) {
    const existing = await getKioskFromMySQL(kioskId);

    if (!existing) {
      await insertKioskIntoMySQL(kiosk);
    }
  }

  return true;
}
/*
|--------------------------------------------------------------------------
| VERIFY KIOSK PIN
|--------------------------------------------------------------------------
|
| POST /api/kiosks/:id/verify-pin
|
| Existing kiosks that still have a kiosk PIN
| can continue to use this function.
|
|--------------------------------------------------------------------------
*/

async function verifyKioskPin(
  kioskId,
  pin
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE ENTERED PIN
  |--------------------------------------------------------------------------
  */

  const kioskPin =
    validateKioskPin(pin);

  const mode =
    await getDatabaseMode();

  let storedHash = null;

  /*
  |--------------------------------------------------------------------------
  | FIREBASE ONLINE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    try {
      const kioskDoc =
        await db
          .collection(
            KIOSK_COLLECTION
          )
          .doc(kioskId)
          .get();

      if (
        kioskDoc.exists
      ) {
        const kioskData =
          kioskDoc.data();

        storedHash =
          kioskData.kiosk_pin ||
          null;
      }

      /*
      |--------------------------------------------------------------------------
      | IF FIREBASE HAS NO PIN, CHECK MYSQL
      |--------------------------------------------------------------------------
      */

      if (!storedHash) {
        const mysqlKiosk =
          await getKioskWithPinFromMySQL(
            kioskId
          );

        storedHash =
          mysqlKiosk?.kiosk_pin ||
          null;
      }
    } catch (error) {
      console.error(
        "FIREBASE VERIFY KIOSK PIN ERROR:",
        error.message
      );

      /*
      |--------------------------------------------------------------------------
      | FIREBASE FAILED → MYSQL FALLBACK
      |--------------------------------------------------------------------------
      */

      const mysqlKiosk =
        await getKioskWithPinFromMySQL(
          kioskId
        );

      storedHash =
        mysqlKiosk?.kiosk_pin ||
        null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    const mysqlKiosk =
      await getKioskWithPinFromMySQL(
        kioskId
      );

    storedHash =
      mysqlKiosk?.kiosk_pin ||
      null;
  }

  /*
  |--------------------------------------------------------------------------
  | NO PIN FOUND
  |--------------------------------------------------------------------------
  */

  if (!storedHash) {
    throw new Error(
      "This kiosk does not have a PIN configured."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | COMPARE ENTERED PIN WITH BCRYPT HASH
  |--------------------------------------------------------------------------
  */

  const isValid =
    await bcrypt.compare(
      kioskPin,
      storedHash
    );

  return isValid;
}
/*
|--------------------------------------------------------------------------
| VALIDATE PIN FORMAT
|--------------------------------------------------------------------------
*/

function validateKioskPin(pin) {
  const normalizedPin = String(pin || "").trim();

  if (!/^\d{4}$/.test(normalizedPin)) {
    throw new Error(
      "Kiosk PIN must be exactly 4 digits."
    );
  }

  return normalizedPin;
}

/*
|--------------------------------------------------------------------------
| CREATE OR UPDATE KIOSK PIN
|--------------------------------------------------------------------------
|
| Superadmin:
|   kiosk_id = NULL
|   department_id = NULL
|
| Admin:
|   kiosk_id = selected kiosk
|   department_id = assigned department
|
|--------------------------------------------------------------------------
*/

async function createOrUpdateKioskPin({
  kioskId = null,
  departmentId = null,
  role,
  pin,
}) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();

  if (!["superadmin", "admin"].includes(normalizedRole)) {
    throw new Error("Invalid PIN role.");
  }

  const normalizedPin = validateKioskPin(pin);

  if (normalizedRole === "superadmin") {
    kioskId = null;
    departmentId = null;
  }

  if (normalizedRole === "admin") {
    if (!kioskId || !departmentId) {
      throw new Error(
        "Kiosk ID and department ID are required for admin PINs."
      );
    }

    const [departments] = await pool.query(
      `
      SELECT department_id
      FROM department
      WHERE department_id = ?
        AND kiosk_id = ?
      LIMIT 1
      `,
      [departmentId, kioskId]
    );

    if (departments.length === 0) {
      throw new Error(
        "This department does not belong to the selected kiosk."
      );
    }

    const kiosk = await getKioskFromMySQL(kioskId);

    if (!kiosk || kiosk.status !== "active") {
      throw new Error(
        "The selected kiosk is not active or does not exist."
      );
    }
  }

  const pinHash = await bcrypt.hash(normalizedPin, 10);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let existingRows;

    if (normalizedRole === "superadmin") {
      [existingRows] = await connection.query(
        `
        SELECT pin_id
        FROM kiosk_pin
        WHERE role = 'superadmin'
          AND kiosk_id IS NULL
          AND department_id IS NULL
        LIMIT 1
        FOR UPDATE
        `
      );
    } else {
      [existingRows] = await connection.query(
        `
        SELECT pin_id
        FROM kiosk_pin
        WHERE role = 'admin'
          AND kiosk_id = ?
          AND department_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [kioskId, departmentId]
      );
    }

    if (existingRows.length > 0) {
      await connection.query(
        `
        UPDATE kiosk_pin
        SET
          pin_hash = ?,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        WHERE pin_id = ?
        `,
        [
          pinHash,
          existingRows[0].pin_id,
        ]
      );
    } else {
      await connection.query(
        `
        INSERT INTO kiosk_pin (
          kiosk_id,
          department_id,
          role,
          pin_hash,
          status
        )
        VALUES (?, ?, ?, ?, 'active')
        `,
        [
          kioskId,
          departmentId,
          normalizedRole,
          pinHash,
        ]
      );
    }

    await connection.commit();

    return {
      success: true,
      message: "Kiosk PIN saved successfully.",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/*
|--------------------------------------------------------------------------
| VERIFY KIOSK PIN
|--------------------------------------------------------------------------
|
| Checks a PIN against:
|   - The global superadmin PIN
|   - Admin PINs belonging to the selected kiosk
|
| Returns the matched role and department.
|
|--------------------------------------------------------------------------
*/

async function verifyKioskPin(kioskId, pin) {
  if (!kioskId) {
    throw new Error("Kiosk ID is required.");
  }

  const normalizedPin = validateKioskPin(pin);

  const kiosk = await getKioskFromMySQL(kioskId);

  if (!kiosk || kiosk.status !== "active") {
    throw new Error(
      "The kiosk is inactive or does not exist."
    );
  }

  const [pinRows] = await pool.query(
    `
    SELECT
      pin_id,
      kiosk_id,
      department_id,
      role,
      pin_hash
    FROM kiosk_pin
    WHERE status = 'active'
      AND (
        (
          role = 'superadmin'
          AND kiosk_id IS NULL
          AND department_id IS NULL
        )
        OR
        (
          role = 'admin'
          AND kiosk_id = ?
        )
      )
    `,
    [kioskId]
  );

  for (const pinRecord of pinRows) {
    const isMatch = await bcrypt.compare(
      normalizedPin,
      pinRecord.pin_hash
    );

    if (!isMatch) {
      continue;
    }

    if (pinRecord.role === "superadmin") {
      return {
        valid: true,
        role: "superadmin",
        department_id: null,
        kiosk_id: kioskId,
      };
    }

    const [departments] = await pool.query(
      `
      SELECT department_id
      FROM department
      WHERE department_id = ?
        AND kiosk_id = ?
      LIMIT 1
      `,
      [
        pinRecord.department_id,
        kioskId,
      ]
    );

    if (departments.length > 0) {
      return {
        valid: true,
        role: "admin",
        department_id: pinRecord.department_id,
        kiosk_id: kioskId,
      };
    }
  }

  return {
    valid: false,
    role: null,
    department_id: null,
    kiosk_id: kioskId,
  };
}

/*
|--------------------------------------------------------------------------
| GET KIOSK PIN CONFIGURATION STATUS
|--------------------------------------------------------------------------
|
| Returns configuration metadata only.
| Never returns PIN hashes.
|
|--------------------------------------------------------------------------
*/

async function getKioskPinStatus(kioskId) {
  if (!kioskId) {
    throw new Error("Kiosk ID is required.");
  }

  const [rows] = await pool.query(
    `
    SELECT
      pin_id,
      department_id,
      role,
      status,
      created_at,
      updated_at
    FROM kiosk_pin
    WHERE kiosk_id = ?
       OR (
         role = 'superadmin'
         AND kiosk_id IS NULL
       )
    ORDER BY role, department_id
    `,
    [kioskId]
  );

  return rows.map((row) => ({
    pin_id: row.pin_id,
    department_id: row.department_id,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/*
|--------------------------------------------------------------------------
| DELETE KIOSK
|--------------------------------------------------------------------------
*/

async function deleteKiosk(
  kioskId
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required."
    );
  }

  const existingKiosk =
    await getKioskById(
      kioskId
    );

  if (!existingKiosk) {
    return false;
  }

  const mode =
    await getDatabaseMode();

  /*
  |--------------------------------------------------------------------------
  | FIREBASE ONLINE
  |--------------------------------------------------------------------------
  */

  if (mode === "firebase") {
    try {
      await db
        .collection(
          KIOSK_COLLECTION
        )
        .doc(kioskId)
        .delete();

      await deleteKioskFromMySQL(
        kioskId
      );

      console.log(
        `DELETE kiosk: ${kioskId} deleted from Firebase and MySQL.`
      );

      return true;
    } catch (error) {
      console.error(
        "FIREBASE DELETE KIOSK ERROR:",
        error.message
      );

      await deleteKioskFromMySQL(
        kioskId
      );

      return true;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    await deleteKioskFromMySQL(
      kioskId
    );

    return true;
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| DELETE KIOSK FROM MYSQL
|--------------------------------------------------------------------------
*/

async function deleteKioskFromMySQL(
  kioskId
) {
  const [result] =
    await pool.query(
      `
      DELETE FROM \`kiosk\`
      WHERE kiosk_id = ?
      `,
      [kioskId]
    );

  return (
    result.affectedRows > 0
  );
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getKiosks,
  getKiosksFromMySQL,

  getKioskById,
  getKioskFromMySQL,

  createKiosk,
  updateKiosk,
  deleteKiosk,

  kioskNameExists,

  createOrUpdateKioskPin,
  verifyKioskPin,
  getKioskPinStatus,
};