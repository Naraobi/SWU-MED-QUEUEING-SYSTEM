const { db } = require("../config/firebase");
const pool = require("../config/mysql");

// MySQL is authoritative. These are application data tables that are safe to
// mirror to Firestore. Authentication secrets, reset tokens, verification
// attempts, sync metadata, audit logs, and short lived sessions are excluded.
const MYSQL_FIRESTORE_TABLES = [
  { table: "department", collection: "department" },
  { table: "kiosk", collection: "kiosk" },
  { table: "counter", collection: "counter" },
  { table: "position", collection: "position" },
  { table: "role", collection: "role" },
  { table: "user", collection: "users" },
  { table: "patient", collection: "patients" },
  { table: "queue_ticket", collection: "queue_tickets" },
  { table: "ai_queue_prediction", collection: "ai_queue_predictions" },
];

const FIRESTORE_BATCH_SIZE = 400;
let fullSyncPromise = null;
const NUMERIC_FIELDS = new Set([
  "est_time",
  "queue_sequence",
  "counter_number",
  "predicted_waiting_time",
  "waiting_count",
  "active_terminals",
  "users",
]);

function normalizeRow(row) {
  const result = {};

  for (const [key, value] of Object.entries(row)) {
    // Never copy credentials or verification material into Firestore.
    if (/(password|pin|token|secret|credential)/i.test(key)) continue;
    if (value === undefined) continue;

    if (
      typeof value === "string" &&
      ["tabs", "permissions"].includes(key) &&
      value.trim()
    ) {
      try {
        result[key] = JSON.parse(value);
        continue;
      } catch {
        // Keep non-JSON legacy values as strings.
      }
    }

    if (NUMERIC_FIELDS.has(key) && value !== null && value !== "") {
      const numericValue = Number(value);
      result[key] = Number.isFinite(numericValue) ? numericValue : value;
    } else if (key === "is_priority" && value !== null) {
      result[key] = Boolean(Number(value));
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function getPrimaryKey(tableName) {
  const [rows] = await pool.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
  const columns = rows
    .sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
    .map((row) => row.Column_name);

  if (columns.length !== 1) {
    throw new Error(
      `Expected one primary key column for ${tableName}; found ${columns.length}.`
    );
  }

  return columns[0];
}

async function mirrorTableToFirestore({ table, collection }) {
  const primaryKey = await getPrimaryKey(table);
  const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
  const collectionRef = db.collection(collection);
  const existingSnapshot = await collectionRef.get();
  const mysqlIds = new Set();
  const writes = [];

  for (const row of rows) {
    const id = row[primaryKey];
    if (id === null || id === undefined || String(id).includes("/")) {
      throw new Error(`Invalid ${table}.${primaryKey} value encountered during sync.`);
    }

    const documentId = String(id);
    mysqlIds.add(documentId);
    writes.push({
      ref: collectionRef.doc(documentId),
      data: normalizeRow(row),
    });
  }

  const staleRefs = existingSnapshot.docs
    .filter((doc) => !mysqlIds.has(doc.id))
    .map((doc) => doc.ref);

  for (let offset = 0; offset < writes.length; offset += FIRESTORE_BATCH_SIZE) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + FIRESTORE_BATCH_SIZE)) {
      batch.set(write.ref, write.data);
    }
    await batch.commit();
  }

  for (let offset = 0; offset < staleRefs.length; offset += FIRESTORE_BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of staleRefs.slice(offset, offset + FIRESTORE_BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
  }

  return {
    table,
    collection,
    mysqlRecords: rows.length,
    firebaseDeleted: staleRefs.length,
  };
}

async function syncAllMySqlToFirebase() {
  if (fullSyncPromise) return fullSyncPromise;

  fullSyncPromise = (async () => {
    const results = [];
    for (const mapping of MYSQL_FIRESTORE_TABLES) {
      results.push(await mirrorTableToFirestore(mapping));
    }
    console.log("Full MySQL to Firebase sync completed.", results);
    return results;
  })();

  try {
    return await fullSyncPromise;
  } finally {
    fullSyncPromise = null;
  }
}

/*
|--------------------------------------------------------------------------
| SYNC PENDING RECORDS
|--------------------------------------------------------------------------
|
| Supported operations:
|
| department/create
| department/update
| department/delete
|
| kiosk/create
| kiosk/update
| kiosk/delete
|
*/

async function syncPendingRecords() {
  let phase = "loading pending sync_queue rows";

  try {
    const [pendingRecords] = await pool.query(
      `
      SELECT
        sync_id,
        table_name,
        record_id,
        operation,
        status
      FROM sync_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      `
    );

    if (pendingRecords.length === 0) {
      console.log("No pending records to synchronize.");
      return;
    }

    console.log(
      `${pendingRecords.length} pending record(s) found.`
    );

    for (const record of pendingRecords) {
      phase = `processing ${record.table_name}/${record.record_id} (${record.operation})`;
      try {
        /*
        |--------------------------------------------------------------------------
        | DEPARTMENT CREATE
        |--------------------------------------------------------------------------
        */

        if (
          record.table_name === "department" &&
          record.operation === "create"
        ) {
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
            [record.record_id]
          );

          if (rows.length === 0) {
            // A queued create is obsolete when the department was deleted
            // before Firebase became available. Retire it so it cannot block
            // later queue records (such as the matching delete) on every run.
            await markAsSynced(record.sync_id);
            console.warn(
              `Skipping obsolete department create ${record.record_id}; it no longer exists in MySQL.`
            );
            continue;
          }

          const department = rows[0];

          await db
            .collection("department")
            .doc(department.department_id)
            .set(department);

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully synchronized department ${record.record_id} to Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | DEPARTMENT UPDATE
        |--------------------------------------------------------------------------
        */

        else if (
          record.table_name === "department" &&
          record.operation === "update"
        ) {
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
            [record.record_id]
          );

          if (rows.length === 0) {
            // Updates for deleted departments have no current state to copy to
            // Firebase, so retire the stale queue item instead of retrying it.
            await markAsSynced(record.sync_id);
            console.warn(
              `Skipping obsolete department update ${record.record_id}; it no longer exists in MySQL.`
            );
            continue;
          }

          const department = rows[0];

          await db
            .collection("department")
            .doc(department.department_id)
            .set(department);

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully synchronized updated department ${record.record_id} to Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | DEPARTMENT DELETE
        |--------------------------------------------------------------------------
        |
        | The department has already been deleted from MySQL.
        | We only need the ID to delete the Firebase document.
        |
        */

        else if (
          record.table_name === "department" &&
          record.operation === "delete"
        ) {
          await db
            .collection("department")
            .doc(record.record_id)
            .delete();

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully deleted department ${record.record_id} from Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | KIOSK CREATE
        |--------------------------------------------------------------------------
        */

        else if (
          record.table_name === "kiosk" &&
          record.operation === "create"
        ) {
          const [rows] = await pool.query(
            `
            SELECT
              kiosk_id,
              name,
              status,
              created_at,
              updated_at
            FROM kiosk
            WHERE kiosk_id = ?
            LIMIT 1
            `,
            [record.record_id]
          );

          if (rows.length === 0) {
            await markAsSynced(record.sync_id);
            console.warn(
              `Skipping obsolete kiosk create ${record.record_id}; it no longer exists in MySQL.`
            );
            continue;
          }

          const kiosk = rows[0];

          await db
            .collection("kiosk")
            .doc(kiosk.kiosk_id)
            .set(kiosk);

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully synchronized kiosk ${record.record_id} to Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | KIOSK UPDATE
        |--------------------------------------------------------------------------
        */

        else if (
          record.table_name === "kiosk" &&
          record.operation === "update"
        ) {
          const [rows] = await pool.query(
            `
            SELECT
              kiosk_id,
              name,
              status,
              created_at,
              updated_at
            FROM kiosk
            WHERE kiosk_id = ?
            LIMIT 1
            `,
            [record.record_id]
          );

          if (rows.length === 0) {
            await markAsSynced(record.sync_id);
            console.warn(
              `Skipping obsolete kiosk update ${record.record_id}; it no longer exists in MySQL.`
            );
            continue;
          }

          const kiosk = rows[0];

          await db
            .collection("kiosk")
            .doc(kiosk.kiosk_id)
            .set(kiosk);

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully synchronized updated kiosk ${record.record_id} to Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | KIOSK DELETE
        |--------------------------------------------------------------------------
        |
        | The kiosk has already been deleted from MySQL.
        | We only need the ID to delete the Firebase document.
        |
        */

        else if (
          record.table_name === "kiosk" &&
          record.operation === "delete"
        ) {
          await db
            .collection("kiosk")
            .doc(record.record_id)
            .delete();

          await markAsSynced(record.sync_id);

          console.log(
            `Successfully deleted kiosk ${record.record_id} from Firebase.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | UNSUPPORTED OPERATION
        |--------------------------------------------------------------------------
        */

        else {
          console.warn(
            `Unsupported sync operation: ${record.table_name}/${record.operation}`
          );
        }
      } catch (syncError) {
        console.error(
          `SYNC FAILED for ${record.table_name}/${record.record_id}:`,
          syncError.message
        );

        phase = `recording sync failure for ${record.table_name}/${record.record_id}`;
        await pool.query(
          `
          UPDATE sync_queue
          SET
            status = 'pending',
            error_message = ?
          WHERE sync_id = ?
          `,
          [
            syncError.message,
            record.sync_id,
          ]
        );
      }
    }
  } catch (error) {
    console.error("SYNC SERVICE ERROR DETAILS:", {
      phase,
      error,
      name: error?.name,
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sql: error?.sql,
      stack: error?.stack,
      cause: error?.cause,
    });

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| MARK RECORD AS SYNCHRONIZED
|--------------------------------------------------------------------------
*/

async function markAsSynced(syncId) {
  await pool.query(
    `
    UPDATE sync_queue
    SET
      status = 'synced',
      synced_at = CURRENT_TIMESTAMP,
      error_message = NULL
    WHERE sync_id = ?
    `,
    [syncId]
  );
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  syncPendingRecords,
  syncAllMySqlToFirebase,
};
