import { useEffect, useState } from 'react';
import {
  checkBackendConnection,
  subscribeToNetworkStatus,
} from '../services/networkStatus';
import { getPendingOperations } from '../services/offlineStorage';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncConflict, setSyncConflict] = useState('');

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      const backendAvailable = await checkBackendConnection();
      const pending = await getPendingOperations().catch(() => []);

      if (mounted) {
        setIsOffline(!backendAvailable);
        setPendingCount(pending.length);
      }
    };

    checkConnection();

    const unsubscribe = subscribeToNetworkStatus(() => {
      checkConnection();
    });

    const interval = setInterval(checkConnection, 10000);
    const handleConflict = (event) => setSyncConflict(event.detail?.message || 'A saved queue action needs review.');
    window.addEventListener('offline-sync-conflict', handleConflict);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('offline-sync-conflict', handleConflict);
    };
  }, []);

  if (!isOffline && pendingCount === 0 && !syncConflict) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black shadow-md">
      {syncConflict
        ? `Queue sync needs review: ${syncConflict}`
        : isOffline
        ? `Offline mode. ${pendingCount ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} saved on this device and waiting to sync.` : 'You are viewing saved data; some actions need a connection.'}`
        : `Syncing ${pendingCount} saved change${pendingCount === 1 ? '' : 's'}…`}
    </div>
  );
}
