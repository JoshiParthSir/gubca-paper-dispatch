// Appointment letters. A letter is built once from the template (rule 3),
// then stored as `duty_letters.content` and only ever changed by hand.
// Nothing here mentions what changed (rule 5).

import {
  fmtLongDate,
  readPerson,
  yearOfSemester,
  type Contacts,
  type LetterSettings,
  type PersonDetails,
} from './letterSettings';

export interface LetterDutyRow {
  /** ISO date. */
  date: string;
  centreCode: string;
  centreName: string;
  subjectCode: string;
  subject: string;
  students: number;
  batches: number;
  /** The duty was cancelled: the row stays, with "Cancelled" in place of the centre. */
  cancelled?: boolean;
}

/** Centre shown in the letter's tables: "Cancelled" for a cancelled duty. */
export const rowCentre = (d: Pick<LetterDutyRow, 'centreCode' | 'cancelled'>) => (d.cancelled ? 'Cancelled' : d.centreCode);

export interface LetterContent {
  refNo: string;
  /** ISO date. */
  issueDate: string;
  showRefAndDate: boolean;
  letterhead: string[];
  confidential: string;
  refLine: string;
  /** The examiner; used for the address and the file name. */
  to: { title: string; name: string; college: string; collegeCode: string };
  toLines: string[];
  subjectLine: string;
  salutation: string;
  opening: string;
  duties: LetterDutyRow[];
  /** Printed under each subject in the table, e.g. "11:00 to 1:00 pm". */
  examTime: string;
  afterTable: string;
  /** Chairperson first, then the coordinators. */
  contacts: PersonDetails[];
  contactEmail: string;
  closing: string;
  signOff: string[];
  guidelinesHeading: string[];
  guidelines: string[];
  billNote: string;
}

export interface LetterInput {
  faculty: { title: string; name: string };
  college: { code: string; fullName: string };
  duties: readonly LetterDutyRow[];
  settings: LetterSettings;
  contacts: Contacts;
  refNo: string;
  /** Every practical of the exam (code and name), for {{allSubjects}} / {{allCodes}}. */
  examSubjects?: readonly { code: string; name: string }[];
}

/** Replace {{placeholders}}; unknown ones are left as typed so they show up. */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

/** "Practical Solutions Using Python" -> "... Python Practical", as GU prints it. */
export const tableSubject = (subject: string) => (/practical\s*$/i.test(subject) ? subject : `${subject} Practical`);

/** "DSC-C-BCA-353P" -> "DSC-C-BCA-353 P", as printed by GU. */
export const printCode = (code: string) => code.replace(/(\d)([A-Z])$/, '$1 $2');

/** "Practical Solutions Using Python (DSC-C-BCA-353 P)", joined with "and". */
export function subjectList(duties: readonly LetterDutyRow[]): string {
  const seen = new Map<string, string>();
  for (const d of duties) {
    if (!seen.has(d.subjectCode)) {
      seen.set(d.subjectCode, d.subject && d.subject !== d.subjectCode ? `${d.subject} (${printCode(d.subjectCode)})` : printCode(d.subjectCode));
    }
  }
  const items = [...seen.values()];
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function buildLetter({ faculty, college, duties, settings, contacts, refNo, examSubjects }: LetterInput): LetterContent {
  const rows = [...duties].sort((a, b) => a.date.localeCompare(b.date) || a.centreCode.localeCompare(b.centreCode));
  const all = examSubjects?.length
    ? [...examSubjects].sort((a, b) => a.code.localeCompare(b.code))
    : [...new Map(rows.map((d) => [d.subjectCode, { code: d.subjectCode, name: d.subject }])).values()];
  const activeRows = rows.some((d) => !d.cancelled) ? rows.filter((d) => !d.cancelled) : rows;
  const values: Record<string, string> = {
    title: faculty.title,
    name: faculty.name,
    college: college.fullName,
    examName: settings.examName,
    semester: settings.semesterLabel,
    year: yearOfSemester(settings.semesterLabel),
    examMonth: settings.examMonth,
    subjects: subjectList(activeRows),
    allSubjects: joinAnd(all.map((x) => (x.name && x.name !== x.code ? `${tableSubject(x.name)} (${printCode(x.code)})` : printCode(x.code)))),
    allCodes: joinAnd(all.map((x) => printCode(x.code))),
    semesterShort: settings.semesterLabel.replace(/\s+(\d)/, '-$1'),
    rate: settings.ratePerStudent ? String(settings.ratePerStudent) : '',
    billLastDate: settings.billLastDate ? fmtLongDate(settings.billLastDate) : '',
    reportingTime: settings.reportingTime,
    'chairperson.name': contacts.chairperson.name,
  };
  const fill = (t: string) => fillPlaceholders(t, values);
  const t = settings.template;
  return {
    refNo,
    issueDate: settings.issueDate,
    showRefAndDate: t.showRefAndDate,
    letterhead: t.letterhead.filter((l) => l.trim()),
    confidential: t.confidential,
    refLine: fill(t.refLine),
    to: { title: faculty.title, name: faculty.name, college: college.fullName, collegeCode: college.code },
    toLines: t.toLines.map(fill).filter((l) => l.trim()),
    subjectLine: fill(t.subjectLine),
    salutation: fill(t.salutation),
    opening: fill(t.opening),
    duties: rows,
    examTime: settings.examTime,
    afterTable: fill(t.afterTable),
    contacts: [contacts.chairperson, ...contacts.coordinators].filter((c) => c.name.trim()).map((c) => ({ ...c })),
    contactEmail: contacts.email,
    closing: fill(t.closing),
    signOff: t.signOff.map(fill).filter((l) => l.trim()),
    guidelinesHeading: t.guidelinesHeading.map(fill).filter((l) => l.trim()),
    guidelines: t.guidelines.map(fill).filter((g) => g.trim()),
    billNote: fill(t.billNote),
  };
}

/** Read stored JSON back as a letter, tolerating missing fields and the old letter format. */
export function readLetterContent(raw: unknown): LetterContent {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<LetterContent> & { signatory?: unknown; coordinator?: unknown };
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const to = { title: '', name: '', college: '', collegeCode: '', ...o.to };
  const contacts = Array.isArray(o.contacts)
    ? o.contacts.map((c) => readPerson(c))
    : [readPerson(o.signatory), readPerson(o.coordinator)].filter((c) => c.name.trim());
  return {
    refNo: text(o.refNo),
    issueDate: text(o.issueDate),
    showRefAndDate: typeof o.showRefAndDate === 'boolean' ? o.showRefAndDate : !Array.isArray(o.toLines),
    letterhead: list(o.letterhead),
    confidential: text(o.confidential),
    refLine: text(o.refLine),
    to,
    toLines: Array.isArray(o.toLines) ? list(o.toLines) : ['To,', `${to.title} ${to.name}`.trim(), to.college].filter(Boolean),
    subjectLine: text(o.subjectLine),
    salutation: text(o.salutation),
    opening: text(o.opening),
    duties: Array.isArray(o.duties) ? o.duties : [],
    examTime: text(o.examTime),
    afterTable: text(o.afterTable),
    contacts,
    contactEmail: text(o.contactEmail),
    closing: text(o.closing),
    signOff: list(o.signOff),
    guidelinesHeading: list(o.guidelinesHeading),
    guidelines: list(o.guidelines),
    billNote: text(o.billNote),
  };
}

/** All the text of a letter, for the change-word check. */
export function letterText(c: LetterContent): string {
  return [
    c.refLine,
    ...c.toLines,
    c.subjectLine,
    c.salutation,
    c.opening,
    c.afterTable,
    c.closing,
    ...c.signOff,
    ...c.guidelinesHeading,
    ...c.guidelines,
    c.billNote,
    ...c.duties.flatMap((d) => [d.centreName, d.subject]),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Duty rows from the session data

export interface DutySource {
  assignments: readonly { faculty_id: string; exam_date: string; centre_id: string; subject_code: string; status: string }[];
  timetable: readonly { exam_date: string; centre_id: string; subject_code: string; students: number | null }[];
  colleges: readonly { id: string; code: string; full_name: string | null; raw_name: string }[];
  subjects: readonly { code: string; name: string }[];
}

export const collegeName = (c: { code: string; full_name: string | null; raw_name: string } | undefined) =>
  c ? (c.full_name?.trim() || (c.raw_name !== c.code ? c.raw_name : '') || c.code) : '';

/** Active duties per faculty id, as letter rows. */
export function dutyRowsByFaculty(src: DutySource): Map<string, LetterDutyRow[]> {
  const college = new Map(src.colleges.map((c) => [c.id, c]));
  const subject = new Map(src.subjects.map((s) => [s.code, s.name]));
  const slot = new Map<string, { students: number; batches: number }>();
  for (const t of src.timetable) {
    const k = `${t.exam_date}|${t.centre_id}|${t.subject_code}`;
    const s = slot.get(k) ?? { students: 0, batches: 0 };
    s.students += t.students ?? 0;
    s.batches += 1;
    slot.set(k, s);
  }
  const out = new Map<string, LetterDutyRow[]>();
  for (const a of src.assignments) {
    if (a.status !== 'active' && a.status !== 'cancelled') continue;
    const c = college.get(a.centre_id);
    const s = slot.get(`${a.exam_date}|${a.centre_id}|${a.subject_code}`) ?? { students: 0, batches: 0 };
    const row: LetterDutyRow = {
      date: a.exam_date,
      centreCode: c?.code ?? '',
      centreName: collegeName(c),
      subjectCode: a.subject_code,
      subject: subject.get(a.subject_code) ?? a.subject_code,
      students: s.students,
      batches: s.batches,
      ...(a.status === 'cancelled' ? { cancelled: true } : {}),
    };
    if (!out.has(a.faculty_id)) out.set(a.faculty_id, []);
    out.get(a.faculty_id)!.push(row);
  }
  for (const [id, rows] of out) {
    // A cancelled day that was given back to the same examiner shows once, as active.
    const activeKeys = new Set(rows.filter((r) => !r.cancelled).map(dutyKey));
    const seen = new Set<string>();
    const kept = rows.filter((r) => {
      if (!r.cancelled) return true;
      const k = dutyKey(r);
      if (activeKeys.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    kept.sort((a, b) => a.date.localeCompare(b.date) || a.centreCode.localeCompare(b.centreCode));
    out.set(id, kept);
  }
  return out;
}

/** Whether any of these rows is a duty still to be done. */
export const hasActiveDuty = (rows: readonly LetterDutyRow[]) => rows.some((r) => !r.cancelled);

function dutyKey(d: { date: string; centreCode: string; subjectCode: string }) {
  return `${d.date}|${d.centreCode}|${d.subjectCode}`;
}
const matchKey = (d: LetterDutyRow) => `${dutyKey(d)}|${d.cancelled ? 'cancelled' : ''}`;

/**
 * Whether a letter's duty rows still match the examiner's active duties.
 * Only date, centre and subject are compared; hand-edited names and
 * numbers do not count as a difference.
 */
export function dutiesMatch(letter: readonly LetterDutyRow[], active: readonly LetterDutyRow[]): boolean {
  const a = letter.map(matchKey).sort();
  const b = active.map(matchKey).sort();
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * Letter numbers for new letters: prefix + running number after the
 * highest number already used with that prefix. Existing numbers are never
 * reused or changed.
 */
export function nextRefNumbers(existing: readonly string[], prefix: string, count: number): string[] {
  let max = 0;
  for (const ref of existing) {
    if (!ref.startsWith(prefix)) continue;
    const m = ref.slice(prefix.length).match(/^(\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const width = Math.max(3, String(max + count).length);
  return Array.from({ length: count }, (_, i) => `${prefix}${String(max + i + 1).padStart(width, '0')}`);
}

/**
 * Unique PDF file names, "<COLLEGE>_<Name_Surname>.pdf". When two names
 * clash, "_2", "_3" are added so no file overwrites another in the ZIP.
 */
export function letterFileNames(letters: readonly { to: { name: string; collegeCode: string } }[]): string[] {
  const used = new Map<string, number>();
  return letters.map((l) => {
    const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const base = [clean(l.to.collegeCode) || 'COLLEGE', clean(l.to.name) || 'Examiner'].join('_');
    const n = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), n);
    return `${base}${n > 1 ? `_${n}` : ''}.pdf`;
  });
}
