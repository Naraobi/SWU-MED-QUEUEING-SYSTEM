const db = require("../config/firebase");
const pool = require("../config/mysql");

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
            throw new Error(
              `Department ${record.record_id} no longer exists in MySQL.`
            );
          }

          const department = rows[0];

          await db
            .collection("departments")
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
            throw new Error(
              `Department ${record.record_id} no longer exists in MySQL.`
            );
          }

          const department = rows[0];

          await db
            .collection("departments")
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
            .collection("departments")
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
            throw new Error(
              `Kiosk ${record.record_id} no longer exists in MySQL.`
            );
          }

          const kiosk = rows[0];

          await db
            .collection("kiosks")
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
            throw new Error(
              `Kiosk ${record.record_id} no longer exists in MySQL.`
            );
          }

          const kiosk = rows[0];

          await db
            .collection("kiosks")
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
            .collection("kiosks")
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
    console.error(
      "SYNC SERVICE ERROR:",
      error.message
    );

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
};