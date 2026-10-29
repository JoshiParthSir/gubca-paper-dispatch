import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Difference between the server's clock and this device's clock, in ms.
// Shared by every component and refreshed every few minutes.
let offsetMs = 0;
let lastSync = 0;
let syncing: Promise<void> | null = null;
const RESYNC_MS = 5 * 60 * 1000;

async function syncClock() {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const sentAt = Date.now();
      const { data, error } = await supabase.rpc('server_now');
      const receivedAt = Date.now();
      if (!error && data) {
        // Assume the server read its clock halfway through the round trip
        offsetMs = new Date(data).getTime() - (sentAt + receivedAt) / 2;
        lastSync = receivedAt;
      }
    } catch {
      // keep the previous offset (device time if never synced)
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export function serverNow() {
  return Date.now() + offsetMs;
}

/**
 * Current server-aligned time (ms since epoch), re-rendering every
 * `tickMs`. Use for countdowns and for enabling/disabling time-based actions.
 */
export function useServerNow(tickMs = 1000) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (Date.now() - lastSync > RESYNC_MS) {
      syncClock().then(() => setNow(serverNow()));
    }
    const id = window.setInterval(() => {
      if (Date.now() - lastSync > RESYNC_MS) void syncClock();
      setNow(serverNow());
    }, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return now;
}
