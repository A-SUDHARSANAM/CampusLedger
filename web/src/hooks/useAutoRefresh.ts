import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL = 10_000; // 10 seconds

/**
 * Silently re-invokes `fetchFn` every `intervalMs` milliseconds.
 * - Skips if the tab is hidden (avoids unnecessary requests in background tabs)
 * - fetchFn should update component state internally; no page reload occurs
 * - The interval is cleared on unmount automatically
 */
export function useAutoRefresh(fetchFn: () => void, intervalMs = DEFAULT_INTERVAL) {
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn; // always call the latest version without re-subscribing

  useEffect(() => {
    const id = setInterval(() => {
      // Skip polling when the tab is hidden to avoid wasted requests
      if (document.visibilityState === 'hidden') return;
      fetchRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
