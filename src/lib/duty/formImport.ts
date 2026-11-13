// Reads the Google Form responses sheet (colleges, students, PCs and the
// faculty handling each subject) into a clean structure.
//
// Every faculty member is kept, whatever subject they teach: the ones who
// teach the practical subject are allocated; everyone else can be picked by hand.

import { cleanCollegeCode, collegeKey, editDistance, parseNameCell, personKey, type CleanName } from './names';

export interface ParsedSubject {
  code: string;
  name: string;
  isPractical: boolean;
}

export interface ParsedFaculty extends CleanName {
  /** Every subject this person handles at their college. */
  subjectCodes: string[];
}

export interface ParsedCollege {
  code: string;
  key: string;
  rawName: string;
  students: number | null;
  pcs: number | null;
  email: string | null;
  submittedAt: Date | null;
  /** Elective name typed for SEC subjects, e.g. "Information Security". */
  electiveName: string | null;
  faculty: ParsedFaculty[];
  /** How many responses this college sent (only the latest is used). */
  responses: number;
}

export interface ImportWarning {
  college?: string;
  message: string;
}

export interface ParsedForm {
  subjects: ParsedSubject[];
  colleges: ParsedCollege[];
  warnings: ImportWarning[];
}

/** "DSC-C-BCA-353 P" -> "DSC-C-BCA-353P". */
export function normalizeSubjectCode(raw: unknown): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-');
}

export const isPracticalCode = (code: string) => /\dP$/.test(code);

/** First whole number in a cell ("210", 210.0, "about 120"). */
export function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const m = String(v ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30).
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

type ColumnRole =
  | { kind: 'timestamp' }
  | { kind: 'college' }
  | { kind: 'students' }
  | { kind: 'pcs' }
  | { kind: 'email' }
  | { kind: 'elective' }
  | { kind: 'faculty'; code: string; name: string };

/** Work out what each column holds from its header text. */
export function classifyHeader(header: unknown): ColumnRole | null {
  const h = String(header ?? '').replace(/\s+/g, ' ').trim();
  if (!h) return null;
  if (/^timestamp$/i.test(h)) return { kind: 'timestamp' };
  if (/name of (your )?college/i.test(h)) return { kind: 'college' };
  if (/number of students/i.test(h)) return { kind: 'students' };
  if (/number of computers|\bpcs?\b/i.test(h)) return { kind: 'pcs' };
  if (/mail/i.test(h)) return { kind: 'email' };
  if (/name[s]? of (the )?subject[s]? offered/i.test(h)) return { kind: 'elective' };

  const f = h.match(/facult(?:y|ies)\W*.*?subject of\s*(.+)$/i);
  if (f) {
    const [codePart, ...nameParts] = f[1].split(':');
    const code = normalizeSubjectCode(codePart);
    const name = nameParts.join(':').trim();
    return { kind: 'faculty', code, name: name || code };
  }
  return null;
}

export function parseFormResponses(rows: unknown[][]): ParsedForm {
  const warnings: ImportWarning[] = [];
  if (!rows.length) return { subjects: [], colleges: [], warnings: [{ message: 'The file is empty.' }] };

  const roles = rows[0].map(classifyHeader);
  const col = (kind: ColumnRole['kind']) => roles.findIndex((r) => r?.kind === kind);
  const iCollege = col('college');
  if (iCollege < 0) {
    return {
      subjects: [],
      colleges: [],
      warnings: [{ message: 'Could not find the "Name of your College" column. Is this the form responses file?' }],
    };
  }
  const iTime = col('timestamp');
  const iStudents = col('students');
  const iPcs = col('pcs');
  const iEmail = col('email');
  const iElective = col('elective');

  const subjects: ParsedSubject[] = [];
  const facultyCols: { index: number; code: string }[] = [];
  roles.forEach((r, index) => {
    if (r?.kind !== 'faculty') return;
    facultyCols.push({ index, code: r.code });
    if (!subjects.some((s) => s.code === r.code)) {
      subjects.push({ code: r.code, name: r.name, isPractical: isPracticalCode(r.code) });
    }
  });
  if (!facultyCols.length) warnings.push({ message: 'No "Names of Faculty(ies) handling the subject of …" columns found.' });

  // Keep only the latest response per college.
  const latest = new Map<string, { row: unknown[]; at: Date | null; order: number; count: number }>();
  rows.slice(1).forEach((row, order) => {
    const rawName = String(row[iCollege] ?? '').trim();
    if (!rawName) return;
    const key = collegeKey(cleanCollegeCode(rawName));
    const at = iTime >= 0 ? toDate(row[iTime]) : null;
    const prev = latest.get(key);
    const newer = !prev || (at && prev.at ? at >= prev.at : order > prev.order);
    if (newer) latest.set(key, { row, at, order, count: (prev?.count ?? 0) + 1 });
    else prev.count += 1;
  });

  const colleges: ParsedCollege[] = [];
  for (const [key, { row, at, count }] of latest) {
    const rawName = String(row[iCollege]).trim();
    const code = cleanCollegeCode(rawName);
    if (count > 1) warnings.push({ college: code, message: `${count} responses found; the latest one is used.` });

    // One person teaching several subjects is one faculty record with all
    // their subjects, so they can never get two duties on the same day.
    // Names match ignoring word order and initials ("Asha R. Mehta" =
    // "Mehta Asha"); one-word names only match exactly.
    const byKey = new Map<string, ParsedFaculty>();
    const matchKey = (n: CleanName) => {
      const p = personKey(n.name);
      return p.includes(' ') ? `p:${p}` : `n:${n.key}`;
    };
    for (const { index, code: subject } of facultyCols) {
      const { names, warnings: w } = parseNameCell(row[index]);
      w.forEach((message) => warnings.push({ college: code, message: `${subject}: ${message}` }));
      for (const n of names) {
        const mk = matchKey(n);
        const existing = byKey.get(mk);
        if (existing) {
          if (!existing.subjectCodes.includes(subject)) existing.subjectCodes.push(subject);
          existing.isVisiting ||= n.isVisiting;
          if (n.title === 'Dr.') existing.title = 'Dr.';
          if (existing.key !== n.key) {
            warnings.push({ college: code, message: `"${existing.name}" and "${n.name}" are taken as the same person.` });
            // Keep the fuller spelling.
            if (n.name.length > existing.name.length) Object.assign(existing, { name: n.name, key: n.key });
          }
        } else {
          byKey.set(mk, { ...n, subjectCodes: [subject] });
        }
      }
    }
    // Close spellings ("Asha Mehta" / "Asha Metha") are not merged, only flagged.
    const people = [...byKey.values()];
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const a = personKey(people[i].name);
        const b = personKey(people[j].name);
        if (Math.min(a.length, b.length) >= 8 && editDistance(a, b) <= 2) {
          warnings.push({
            college: code,
            message: `"${people[i].name}" and "${people[j].name}" look like the same person. If so, mark one unavailable in the Faculty tab, or they could get two duties on one day.`,
          });
        }
      }
    }

    const students = iStudents >= 0 ? toInt(row[iStudents]) : null;
    const pcs = iPcs >= 0 ? toInt(row[iPcs]) : null;
    if (!pcs) warnings.push({ college: code, message: 'Number of computers is missing.' });

    colleges.push({
      code,
      key,
      rawName,
      students,
      pcs,
      email: iEmail >= 0 ? String(row[iEmail] ?? '').trim() || null : null,
      submittedAt: at,
      electiveName: iElective >= 0 ? String(row[iElective] ?? '').trim() || null : null,
      faculty: [...byKey.values()],
      responses: count,
    });
  }

  colleges.sort((a, b) => a.code.localeCompare(b.code));
  return { subjects, colleges, warnings };
}
