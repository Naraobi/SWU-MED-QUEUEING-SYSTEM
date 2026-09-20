import { createPatientQueue } from './backendApi';
import {
  getPendingOperations,
  removePendingOperation,
} from './offlineStorage';
import { checkBackendConnection } from './networkStatus';

let isSyncing = false;

export async function syncPendingOperations() {
  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    const backendAvailable = await checkBackendConnection();

    if (!backendAvailable) {
      console.log('QUEUE SYNC: backend unavailable.');
      return;
    }

    const pendingOperations = await getPendingOperations();

    if (!pendingOperations.length) {
      console.log('QUEUE SYNC: no pending operations.');
      return;
    }

    console.log(
      `QUEUE SYNC: found ${pendingOperations.length} pending operation(s).`
    );

    for (const operation of pendingOperations) {
      if (operation.type !== 'CREATE_PATIENT_QUEUE') {
        console.warn(
          'QUEUE SYNC: unknown operation type:',
          operation.type
        );
        continue;
      }

      try {
        console.log(
          'QUEUE SYNC: sending pending queue:',
          operation
        );

        const result = await createPatientQueue(
          operation.payload
        );

        if (!result?.queue_id) {
          throw new Error(
            'Server did not return a queue ID.'
          );
        }

        if (!result?.queue_number) {
          throw new Error(
            'Server did not return a queue number.'
          );
        }

        console.log(
          'QUEUE SYNC: queue successfully created:',
          result
        );

        await removePendingOperation(operation.id);

        console.log(
          `QUEUE SYNC: removed pending operation ${operation.id}.`
        );

        window.dispatchEvent(
          new CustomEvent('queue-sync-success', {
            detail: {
              local_id: operation.local_id,
              queue_id: result.queue_id,
              queue_number: result.queue_number,
              queue_data: result,
            },
          })
        );
      } catch (error) {
        console.error(
          `QUEUE SYNC: failed to sync operation ${operation.id}:`,
          error
        );

        // Keep the operation in IndexedDB.
        // It will be retried when the backend becomes available.
      }
    }
  } catch (error) {
    console.error(
      'QUEUE SYNC: synchronization failed:',
      error
    );
  } finally {
    isSyncing = false;
  }
}