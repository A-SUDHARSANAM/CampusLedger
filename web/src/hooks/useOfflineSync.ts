import { useEffect, useState } from 'react';

const QUEUE_KEY = 'campusledger_offline_queue';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  queuedAt: number;
}

function getQueue(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedRequest[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Enqueue a failed mutation for replay on reconnect.  Can be called from api.ts (non-hook context). */
export function enqueueOfflineRequest(
  req: Omit<QueuedRequest, 'id' | 'queuedAt'>,
): void {
  const queue = getQueue();
  // Avoid duplicates: same method + url + body = same request
  const dup = queue.some(
    (q) => q.url === req.url && q.method === req.method && q.body === req.body,
  );
  if (dup) return;
  queue.push({ ...req, id: crypto.randomUUID(), queuedAt: Date.now() });
  saveQueue(queue);
}

async function processQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedRequest[] = [];
  let succeeded = 0;

  for (const item of queue) {
    // Drop items older than 24 hours
    if (Date.now() - item.queuedAt > 24 * 60 * 60_000) continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (res.ok) {
        succeeded += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return succeeded;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [queueSize, setQueueSize] = useState(() => getQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (getQueue().length > 0) {
        setSyncing(true);
        const done = await processQueue();
        setSyncing(false);
        setQueueSize(getQueue().length);
        if (done > 0) setLastSyncedAt(Date.now());
      }
    };

    const handleOffline = () => setIsOnline(false);

    // Sync queue size if another tab enqueues a request
    const handleStorage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) setQueueSize(getQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { isOnline, queueSize, syncing, lastSyncedAt };
}
