import { useMemo } from 'react';
import type { SessionData } from '@/lib/duty/store';

export interface TabProps {
  sessionId: string;
  data: SessionData;
  reload: () => Promise<void>;
  onError: (e: unknown) => void;
}

/** Lookups every tab needs. */
export function useLookups(data: SessionData) {
  return useMemo(() => {
    const college = new Map(data.colleges.map((c) => [c.id, c]));
    const faculty = new Map(data.faculty.map((f) => [f.id, f]));
    const subject = new Map(data.subjects.map((s) => [s.code, s]));
    const practicalCodes = [...new Set(data.timetable.map((t) => t.subject_code))].sort();
    return { college, faculty, subject, practicalCodes };
  }, [data]);
}

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

export const shortCode = (code: string) => code.replace(/^.*-/, '');
