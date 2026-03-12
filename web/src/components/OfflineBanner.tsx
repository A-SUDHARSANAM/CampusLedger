import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function OfflineBanner() {
  const { isOnline, queueSize, syncing } = useOfflineSync();
  const [dismissed, setDismissed] = useState(false);

  // Re-show banner if connection drops again after being dismissed
  useEffect(() => {
    if (!isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <WifiOff size={14} />
      <span>
        You are offline. Some features may be unavailable.
        {queueSize > 0 && ` (${queueSize} request${queueSize > 1 ? 's' : ''} queued)`}
      </span>
      {syncing && (
        <span className="offline-syncing">
          <RefreshCw size={12} className="spin" /> Syncing…
        </span>
      )}
      <button
        type="button"
        className="offline-dismiss"
        aria-label="Dismiss offline notice"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}
