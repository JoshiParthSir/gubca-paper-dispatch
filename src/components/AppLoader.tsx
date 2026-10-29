import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const SEEN_KEY = 'pd-splash-seen';
const FIRST_VISIT_MS = 2400; // lets the full intro play once per session
const REPEAT_VISIT_MS = 700;
const EXIT_MS = 1250; // must cover the exit animations in index.html

/**
 * Controls the boot splash defined in index.html. The splash paints before
 * any JavaScript runs; once the session check finishes (and the intro has
 * had time to play) this lifts it away and removes it from the page.
 */
export function AppLoader() {
  const { loading } = useAuth();
  const startedAt = useRef(performance.now());
  const done = useRef(false);

  useEffect(() => {
    if (loading || done.current) return;
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage unavailable (private mode): just play the full intro
    }

    const minimum = seen ? REPEAT_VISIT_MS : FIRST_VISIT_MS;
    const wait = Math.max(0, minimum - (performance.now() - startedAt.current));
    done.current = true;

    // One-shot and idempotent, so it is deliberately not cancelled on cleanup
    // (React StrictMode re-runs effects in development).
    window.setTimeout(() => {
      splash.classList.add('is-exiting');
      window.setTimeout(() => splash.remove(), EXIT_MS);
    }, wait);
  }, [loading]);

  return null;
}
