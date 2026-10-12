import { API_BASE_URL } from './apiBase';

export async function checkBackendConnection() {
  if (!navigator.onLine) {
    return false;
  }

  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE_URL}/api/test`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function subscribeToNetworkStatus(callback) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
