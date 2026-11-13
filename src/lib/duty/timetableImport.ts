// Reads the practical timetable: one row per batch with
// Date, Centre, Subject Code, Batch, Seat From, Seat To (and optionally Students).

import { cleanCollegeCode, collegeKey } from './names';
import { normalizeSubjectCode, toInt, type ImportWarning } from './formImport';

export interface TimetableRow {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  centreCode: string;
  centreKey: string;
  subjectCode: string;
  batch: string | null;
  seatFrom: string | null;
  seatTo: string | null;
  students: number | null;
}

export interface ParsedTimetable {
  rows: TimetableRow[];
  /** Practical subject codes that actually appear in the timetable. */
  subjectCodes: string[];
  warnings: ImportWarning[];
}

export const TIMETABLE_HEADERS = ['Date', 'Centre', 'Subject Code', 'Batch', 'Seat From', 'Seat To', 'Students'] as const;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
};
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/**
 * Exam dates as typed in India: day first. Accepts Date objects, Excel
 * serials, "18-11-2026", "18/11/26", "18-Nov-26", "18 November 2026" and
 * ISO "2026-11-18".
 */
export function parseExamDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS gives local midnight for date cells.
    return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return iso(fullYear(+m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[-\s/.]*([a-z]{3})[a-z]*[-\s/.,]*(\d{2,4})$/i);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (mon) return iso(fullYear(+m[3]), mon, +m[1]);
  }
  return null;
}

/** Students in a seat range: "1001".."1060" -> 60, "BCA101".."BCA160" -> 60. */
export function seatCount(from: unknown, to: unknown): number | null {
  const a = String(from ?? '').match(/(\d+)\s*$/);
  const b = String(to ?? '').match(/(\d+)\s*$/);
  if (!a || !b) return null;
  const n = Number(b[1]) - Number(a[1]) + 1;
  return n > 0 ? n : null;
}

function headerIndex(headers: unknown[], ...patterns: RegExp[]) {
  return headers.findIndex((h) => patterns.some((p) => p.test(String(h ?? '').trim())));
}

export function parseTimetable(rows: unknown[][]): ParsedTimetable {
  const warnings: ImportWarning[] = [];
  const out: TimetableRow[] = [];
  if (!rows.length) return { rows: out, subjectCodes: [], warnings: [{ message: 'The timetable file is empty.' }] };

  const h = rows[0];
  const iDate = headerIndex(h, /^date/i);
  const iCentre = headerIndex(h, /^cent(re|er)/i, /^college/i);
  const iSubject = headerIndex(h, /subject\s*code/i, /^subject/i, /^paper/i);
  const iBatch = headerIndex(h, /^batch/i);
  const iFrom = headerIndex(h, /seat\s*from/i, /^from/i);
  const iTo = headerIndex(h, /seat\s*to/i, /^to$/i);
  const iStudents = headerIndex(h, /^students|^no\.? of students|^count/i);

  const missing = [
    iDate < 0 && 'Date',
    iCentre < 0 && 'Centre',
    iSubject < 0 && 'Subject Code',
  ].filter(Boolean);
  if (missing.length) {
    return {
      rows: out,
      subjectCodes: [],
      warnings: [{ message: `Timetable is missing column(s): ${missing.join(', ')}. Use the template headers: ${TIMETABLE_HEADERS.join(', ')}.` }],
    };
  }

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (!row || row.every((c) => c === null || String(c).trim() === '')) return;
    const date = parseExamDate(row[iDate]);
    const centreCode = cleanCollegeCode(row[iCentre]);
    const subjectCode = normalizeSubjectCode(row[iSubject]);
    if (!date) return void warnings.push({ message: `Row ${line}: date "${row[iDate] ?? ''}" not understood, row skipped.` });
    if (!centreCode) return void warnings.push({ message: `Row ${line}: centre is empty, row skipped.` });
    if (!subjectCode) return void warnings.push({ message: `Row ${line}: subject code is empty, row skipped.` });

    const seatFrom = iFrom >= 0 ? String(row[iFrom] ?? '').trim() || null : null;
    const seatTo = iTo >= 0 ? String(row[iTo] ?? '').trim() || null : null;
    const students = (iStudents >= 0 ? toInt(row[iStudents]) : null) ?? seatCount(seatFrom, seatTo);

    out.push({
      date,
      centreCode,
      centreKey: collegeKey(centreCode),
      subjectCode,
      batch: iBatch >= 0 ? String(row[iBatch] ?? '').trim() || null : null,
      seatFrom,
      seatTo,
      students,
    });
  });

  const subjectCodes = [...new Set(out.map((r) => r.subjectCode))].sort();
  return { rows: out, subjectCodes, warnings };
}

/** Optimal string alignment distance (edit distance that counts swaps as 1). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export interface CentreMatch {
  centreCode: string;
  /** Key of the matched college in the form data, or null. */
  collegeKey: string | null;
  /** exact: same code; check: close spelling, the chairperson should confirm; none: no match. */
  confidence: 'exact' | 'check' | 'none';
}

/**
 * Link each timetable centre to a college from the form responses.
 * Anything short of an exact code match is only a suggestion ('check')
 * that the chairperson must confirm. Suggestions come from, in order:
 *   1. the centre code appearing in the college's email
 *      (e.g. centre CCCA, email ccca.bca2009@…)
 *   2. one code being the start of the other (KHYATI / KHYATIBCA)
 *   3. a close spelling, only for codes of 6+ letters, since short codes
 *      like CCCA and LCCA are different colleges one letter apart.
 */
export function matchCentres(
  centreCodes: string[],
  colleges: readonly { key: string; email?: string | null }[],
): CentreMatch[] {
  const keys = colleges.map((c) => c.key);
  const only = (found: string[]) => (found.length === 1 ? found[0] : null);

  return [...new Set(centreCodes)].map((centreCode): CentreMatch => {
    const k = collegeKey(centreCode);
    if (keys.includes(k)) return { centreCode, collegeKey: k, confidence: 'exact' };

    const byEmail = only(colleges.filter((c) => k.length >= 3 && collegeKey(c.email ?? '').includes(k)).map((c) => c.key));
    if (byEmail) return { centreCode, collegeKey: byEmail, confidence: 'check' };

    const byPrefix = only(keys.filter((ck) => Math.min(ck.length, k.length) >= 4 && (ck.startsWith(k) || k.startsWith(ck))));
    if (byPrefix) return { centreCode, collegeKey: byPrefix, confidence: 'check' };

    if (k.length >= 6) {
      const limit = k.length >= 10 ? 2 : 1;
      const close = only(keys.filter((ck) => editDistance(k, ck) <= limit));
      if (close) return { centreCode, collegeKey: close, confidence: 'check' };
    }
    return { centreCode, collegeKey: null, confidence: 'none' };
  });
}
