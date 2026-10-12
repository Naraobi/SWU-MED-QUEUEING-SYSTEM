import {
  addPendingOperation,
  getOfflineData,
  saveOfflineData,
} from './offlineStorage';

const jsonResponse = (value, status = 200, offline = false) => new Response(
  JSON.stringify(value),
  { status, headers: { 'Content-Type': 'application/json', ...(offline ? { 'X-Offline-Cache': '1' } : {}) } }
);

/** Network-first requests for the small set of screens that support offline use. */
export async function offlineFetch(url, options = {}, {
  cacheKey,
  queueOnFailure = false,
  optimisticData,
  operationType = 'REST_REQUEST',
  localId,
  operationPayload,
  syncMeta,
} = {}) {
  const method = String(options.method || 'GET').toUpperCase();

  try {
    const response = await fetch(url, options);
    if (response.ok && method === 'GET' && cacheKey) {
      try {
        await saveOfflineData(cacheKey, await response.clone().json());
      } catch (error) {
        console.warn('Could not cache offline response:', error);
      }
    }
    return response;
  } catch (error) {
    if (method === 'GET' && cacheKey) {
      const cached = await getOfflineData(cacheKey).catch(() => null);
      if (cached !== null) return jsonResponse(cached, 200, true);
    }

    // Only queue transport failures. Server validation/authentication errors
    // arrive as HTTP responses and must remain visible to the user.
    if (method !== 'GET' && queueOnFailure && error instanceof TypeError) {
      const body = typeof options.body === 'string' ? options.body : null;
      await addPendingOperation({
        type: operationType,
        local_id: localId || null,
        payload: operationPayload,
        syncMeta,
        request: {
          url,
          method,
          headers: Object.fromEntries(new Headers(options.headers || {}).entries()),
          body,
        },
      });
      return jsonResponse({ success: true, data: optimisticData, pending_sync: true });
    }

    throw error;
  }
}
