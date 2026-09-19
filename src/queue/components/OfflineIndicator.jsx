import { useEffect, useState } from 'react';
import {
  checkBackendConnection,
  subscribeToNetworkStatus,
} from '../services/networkStatus';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      const backendAvailable = await checkBackendConnection();

      if (mounted) {
        setIsOffline(!backendAvailable);
      }
    };

    checkConnection();

    const unsubscribe = subscribeToNetworkStatus(() => {
      checkConnection();
    });

    const interval = setInterval(checkConnection, 10000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black shadow-md">
      You are offline. Some actions may be unavailable until the connection is restored.
    </div>
  );
}