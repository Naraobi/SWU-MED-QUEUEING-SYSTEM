const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function checkBackendConnection() {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE_URL}/api/test`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return response.ok;
  } catch {
    return false;
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