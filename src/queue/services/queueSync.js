import { API_URL } from './apiBase';
import {
  getPendingOperations,
  removePendingOperation,
} from './offlineStorage';
import { checkBackendConnection } from './networkStatus';
import { getOfflineData, saveOfflineData } from './offlineStorage';

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
      if (['REST_REQUEST', 'STAFF_QUEUE_ACTION'].includes(operation.type) && operation.request?.url) {
        try {
          const idMap = await getOfflineData('offline:id-map').catch(() => ({})) || {};
          let requestUrl = operation.request.url;
          for (const [localId, remoteId] of Object.entries(idMap)) {
            requestUrl = requestUrl.replace(encodeURIComponent(localId), encodeURIComponent(remoteId));
          }
          const response = await fetch(requestUrl, {
            method: operation.request.method,
            headers: operation.request.headers,
            body: operation.request.body || undefined,
          });
          if (operation.type === 'STAFF_QUEUE_ACTION' && response.status >= 400 && response.status < 500 && ![401, 429].includes(response.status)) {
            const conflict = await response.json().catch(() => ({}));
            await removePendingOperation(operation.id);
            window.dispatchEvent(new CustomEvent('offline-sync-conflict', {
              detail: { operation, message: conflict?.message || `Queue action could not be applied (${response.status}).` },
            }));
            continue;
          }
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result?.success === false) {
            throw new Error(result?.message || `Request failed (${response.status})`);
          }
          if (operation.syncMeta?.cacheKey && operation.syncMeta?.localId && result?.data) {
            const envelope = await getOfflineData(operation.syncMeta.cacheKey).catch(() => null);
            const rows = Array.isArray(envelope?.data) ? envelope.data : [];
            const nextRows = rows.map((row) => String(row._offline_id || row.user_id || row.department_id) === String(operation.syncMeta.localId)
              ? { ...result.data, _offline_id: operation.syncMeta.localId, _offline_pending: false }
              : row);
            await saveOfflineData(operation.syncMeta.cacheKey, { ...(envelope || { success: true }), data: nextRows });
            const remoteId = result.data.user_id || result.data.uid || result.data.firebase_uid;
            if (remoteId) await saveOfflineData('offline:id-map', { ...idMap, [operation.syncMeta.localId]: String(remoteId) });
          }
          await removePendingOperation(operation.id);
          window.dispatchEvent(new CustomEvent('offline-sync-success', {
            detail: { operation, result },
          }));
        } catch (error) {
          console.error(`OFFLINE SYNC: failed operation ${operation.id}:`, error);
          // Leave it in IndexedDB for the next retry.
        }
        continue;
      }

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

        const response = await fetch(`${API_URL}/patients/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.payload),
        });
        const envelope = await response.json();
        if (!response.ok || !envelope?.success) {
          throw new Error(envelope?.message || 'Failed to synchronize queue ticket.');
        }
        const result = envelope.data;

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
