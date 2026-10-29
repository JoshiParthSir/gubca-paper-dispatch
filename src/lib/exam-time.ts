// Exam dates and times are stored as plain local values and enforced by the
// server in India Standard Time. Interpreting them with an explicit +05:30
// offset keeps the browser in agreement with the server, whatever time zone
// the device is set to.
const IST_OFFSET = '+05:30';

const withSeconds = (time: string) => (time.length === 5 ? `${time}:00` : time.slice(0, 8));

export function examInstant(date: string, time: string): number {
  return new Date(`${date}T${withSeconds(time)}${IST_OFFSET}`).getTime();
}

export type ExamPhase = 'upcoming' | 'open' | 'closed';

export interface ExamWindow {
  start: number;
  end: number;
}

export function examWindow(date: string, startTime: string, endTime: string): ExamWindow {
  return { start: examInstant(date, startTime), end: examInstant(date, endTime) };
}

/** Matches the server rule: open from start to end inclusive. */
export function examPhase(w: ExamWindow, now: number): ExamPhase {
  if (now < w.start) return 'upcoming';
  if (now <= w.end) return 'open';
  return 'closed';
}

/** "2d 4h", "3h 05m", "12:04" for countdowns */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatExamDate(date: string) {
  return new Date(`${date}T00:00:00${IST_OFFSET}`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export const formatTime = (time: string) => time.slice(0, 5);
