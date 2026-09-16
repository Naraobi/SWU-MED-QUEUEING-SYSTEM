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
  | VALIDATE PIN
  |--------------------------------------------------------------------------
  */

  const kioskPin =
    validateKioskPin(
      kioskData.kiosk_pin
    );

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
  | HASH PIN
  |--------------------------------------------------------------------------
  */

  const kioskPinHash =
    await bcrypt.hash(
      kioskPin,
      10
    );

  const now =
    new Date().toISOString();

  const kiosk = {
    kiosk_id:
      kioskId,

    name,

    status,

    kiosk_pin:
      kioskPinHash,

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

          kiosk_pin:
            kioskPinHash,

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
  | MYSQL OFFLINE
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
      kiosk_pin,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      kiosk.kiosk_id,
      kiosk.name,
      kiosk.status,
      kiosk.kiosk_pin,
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
*/

async function updateKiosk(
  kioskId,
  kioskData = {}
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | GET EXISTING KIOSK INCLUDING PIN HASH
  |--------------------------------------------------------------------------
  */

  let existingKiosk =
    await getKioskWithPinFromMySQL(
      kioskId
    );

  /*
  |--------------------------------------------------------------------------
  | IF NOT IN MYSQL, CHECK FIREBASE
  |--------------------------------------------------------------------------
  */

  if (!existingKiosk) {
    try {
      const kioskDoc =
        await db
          .collection(
            KIOSK_COLLECTION
          )
          .doc(kioskId)
          .get();

      if (kioskDoc.exists) {
        const firebaseData =
          kioskDoc.data();

        existingKiosk = {
          ...formatKiosk(
            firebaseData,
            kioskDoc.id
          ),

          kiosk_pin:
            firebaseData.kiosk_pin ||
            null,
        };
      }
    } catch (error) {
      console.error(
        "FIREBASE CHECK KIOSK ERROR:",
        error.message
      );
    }
  }

  if (!existingKiosk) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | NAME
  |--------------------------------------------------------------------------
  */

  const name =
    kioskData.name !==
    undefined
      ? String(
          kioskData.name ||
            ""
        ).trim()
      : existingKiosk.name;

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  const status =
    kioskData.status !==
    undefined
      ? normalizeStatus(
          kioskData.status
        )
      : normalizeStatus(
          existingKiosk.status
        );

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
      name,
      kioskId
    );

  if (duplicate) {
    throw new Error(
      "A kiosk with this name already exists."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PIN
  |--------------------------------------------------------------------------
  |
  | If a new PIN is supplied:
  |   validate → hash → replace old hash
  |
  | If no PIN is supplied:
  |   keep the existing hash
  |
  |--------------------------------------------------------------------------
  */

  let kioskPinHash =
    existingKiosk.kiosk_pin ||
    null;

  const hasNewPin =
    kioskData.kiosk_pin !==
      undefined &&
    kioskData.kiosk_pin !==
      null &&
    String(
      kioskData.kiosk_pin
    ).trim() !== "";

  if (hasNewPin) {
    const newKioskPin =
      validateKioskPin(
        kioskData.kiosk_pin
      );

    kioskPinHash =
      await bcrypt.hash(
        newKioskPin,
        10
      );
  }

  const updatedAt =
    new Date().toISOString();

  const updatedKiosk = {
    kiosk_id:
      kioskId,

    name,

    status,

    kiosk_pin:
      kioskPinHash,

    created_at:
      existingKiosk.created_at ||
      null,

    updated_at:
      updatedAt,
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
      const firebaseUpdate = {
        kiosk_id:
          kioskId,

        name,

        status,

        updated_at:
          updatedAt,
      };

      /*
      |----------------------------------------------------------------------
      | Only update PIN when a new PIN was provided.
      |----------------------------------------------------------------------
      */

      if (hasNewPin) {
        firebaseUpdate.kiosk_pin =
          kioskPinHash;
      }

      await db
        .collection(
          KIOSK_COLLECTION
        )
        .doc(kioskId)
        .set(
          firebaseUpdate,
          {
            merge: true,
          }
        );

      await updateKioskInMySQL(
        kioskId,
        updatedKiosk,
        hasNewPin
      );

      console.log(
        `UPDATE kiosk: ${kioskId} updated in Firebase and MySQL.`
      );

      return formatKiosk(
        updatedKiosk
      );
    } catch (error) {
      console.error(
        "FIREBASE UPDATE KIOSK ERROR:",
        error.message
      );

      await updateKioskInMySQL(
        kioskId,
        updatedKiosk,
        hasNewPin
      );

      return formatKiosk(
        updatedKiosk
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MYSQL OFFLINE
  |--------------------------------------------------------------------------
  */

  if (mode === "mysql") {
    await updateKioskInMySQL(
      kioskId,
      updatedKiosk,
      hasNewPin
    );

    console.log(
      `UPDATE kiosk: ${kioskId} updated in MySQL.`
    );

    return formatKiosk(
      updatedKiosk
    );
  }

  throw new Error(
    "No database is currently available."
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE KIOSK IN MYSQL
|--------------------------------------------------------------------------
*/

async function updateKioskInMySQL(
  kioskId,
  kiosk,
  updatePin = false
) {
  let sql = `
    UPDATE \`kiosk\`
    SET
      name = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
  `;

  const params = [
    kiosk.name,
    kiosk.status,
  ];

  if (updatePin) {
    sql += `,
      kiosk_pin = ?
    `;

    params.push(
      kiosk.kiosk_pin
    );
  }

  sql += `
    WHERE kiosk_id = ?
  `;

  params.push(
    kioskId
  );

  const [result] =
    await pool.query(
      sql,
      params
    );

  /*
  |--------------------------------------------------------------------------
  | If MySQL row does not exist, insert it.
  |--------------------------------------------------------------------------
  */

  if (
    result.affectedRows === 0
  ) {
    await insertKioskIntoMySQL(
      kiosk
    );
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
| The frontend sends:
|
| {
|   pin: "1234"
| }
|
| The backend:
|
| 1. Gets the stored bcrypt hash.
| 2. Compares the entered PIN.
| 3. Returns true/false.
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
  | Validate entered PIN
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
      | If Firebase has no PIN, check MySQL.
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
      | Firebase failed → MySQL fallback
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
  | MYSQL OFFLINE
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
  | No PIN found
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
  | MYSQL OFFLINE
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

  verifyKioskPin,
};
