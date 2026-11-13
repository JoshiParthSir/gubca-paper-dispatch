// Letter settings of a duty session (stored in duty_sessions.letter_settings)
// and the chairperson / coordinator contacts used by every exam.
//
// Semester and exam month are filled in from the timetable (rule 6) and
// stay editable. The template, rate and times carry over from the previous
// exam. Everything here is pure so it can be tested.

export interface PersonDetails {
  name: string;
  designation: string;
  college: string;
  phone: string;
  email: string;
}

/**
 * Chairperson and coordinators, printed on every letter. Entered once:
 * the most recently saved list (by savedAt, from any exam) is used for
 * every exam until it is changed.
 */
export interface Contacts {
  chairperson: PersonDetails;
  coordinators: PersonDetails[];
  /** Exam office email printed under the contacts. */
  email: string;
  /** ISO timestamp of the last save; the latest one wins. */
  savedAt: string;
}

export interface LetterTemplate {
  /** Letterhead lines, printed centred and bold at the top. */
  letterhead: string[];
  /** Printed bold under the letterhead, e.g. "Confidential". */
  confidential: string;
  refLine: string;
  /** Address lines ("To,", "{{name}},", "{{college}}."). */
  toLines: string[];
  subjectLine: string;
  salutation: string;
  /** Paragraph(s) before the duty table. Blank lines separate paragraphs. */
  opening: string;
  /** Paragraph after the duty table, before the contacts. */
  afterTable: string;
  /** "Thanking you," / "Yours faithfully," lines. */
  closing: string;
  /** Lines under the signature space ("By Order", "Controller of Examination, …"). */
  signOff: string[];
  /** Heading lines of the guidelines page. */
  guidelinesHeading: string[];
  /** Numbered guidelines on the second page. */
  guidelines: string[];
  /** Line under the remuneration table. */
  billNote: string;
  /** Print the letter number and date under the letterhead. */
  showRefAndDate: boolean;
}

export interface LetterSettings {
  /** e.g. "ATKT Practical Examination" or "Practical Examination". */
  examName: string;
  semesterLabel: string;
  examMonth: string;
  /** Printed in the duty table, e.g. "11:00 to 1:00 pm". */
  examTime: string;
  /** ISO date printed on the letter (when shown). */
  issueDate: string;
  /** Letter number = prefix + running number, e.g. "GU/BCA/PR/2026/" + "001". */
  refPrefix: string;
  /** Remuneration per student (Rs.). */
  ratePerStudent: number;
  /** ISO date. */
  billLastDate: string;
  reportingTime: string;
  template: LetterTemplate;
}

export const EMPTY_PERSON: PersonDetails = { name: '', designation: '', college: '', phone: '', email: '' };

/** Placeholders the template may use, shown in the settings screen. Rule 5: the template never describes what changed. */
export const PLACEHOLDERS = [
  '{{title}}',
  '{{name}}',
  '{{college}}',
  '{{examName}}',
  '{{semester}}',
  '{{year}}',
  '{{examMonth}}',
  '{{subjects}}',
  '{{allSubjects}}',
  '{{allCodes}}',
  '{{semesterShort}}',
  '{{rate}}',
  '{{billLastDate}}',
  '{{reportingTime}}',
  '{{chairperson.name}}',
] as const;

/** The Gujarat University duty letter format. */
export const DEFAULT_TEMPLATE: LetterTemplate = {
  letterhead: ['GUJARAT UNIVERSITY', 'Ahmedabad - 380009'],
  confidential: 'Confidential',
  refLine: 'Ref. Examination BS (B.C.A.) {{semester}} NEP 2020, {{examMonth}}',
  toLines: ['To,', '{{name}},', '{{college}}.'],
  subjectLine: '{{examName}} of BS(B.C.A.) {{semester}} NEP 2020, {{examMonth}} to be conducted by Gujarat University.',
  salutation: 'Dear Sir/ Madam,',
  opening: 'You are requested to conduct the {{examName}} for BS (B.C.A.) {{semester}} NEP 2020 as per the following Schedule.',
  afterTable:
    'You may get the required stationery from the institute where you are conducting the examination. You are '
    + 'requested to see the guidelines given on the next page for practical examination evaluation. It may be noted that '
    + 'for BCA Practical Examinations, the Chairperson and Coordinators are:',
  closing: 'Thanking you,\nYours faithfully,',
  signOff: ['By Order', 'Controller of Examination, Gujarat University, Ahmedabad.'],
  guidelinesHeading: [
    'GUJARAT UNIVERSITY',
    'General guidelines for Computer {{examName}}s of Gujarat University at {{year}} Year',
    '{{semesterShort}} NEP 2020',
  ],
  guidelines: [
    'The University Practical Examinations is de-centralized i.e students will have practical examination center at their respective colleges.',
    'You are requested to see the detailed timetable on Gujarat University Website.',
    'Please note that the subject of {{allSubjects}} has to be evaluated on 50 marks for duration of 2 hours. Distribution of marks for {{allCodes}} is as under: 40 marks for practical and 10 marks for viva-voce on given practical questions only. Note: The Viva should be strictly related to the practical definition assigned to the candidate and should be conducted at the candidate\'s desk.',
    'Candidate is not required to produce the journal at the time of practical.',
    'Students are required to produce their Hall Tickets at the time of Exam.',
    'Candidates\' Hall Ticket must be checked by the College Lab Assistant or Exam Incharge before circulating question papers by Examiners.',
    'The answer sheets of the candidates must have university seat no., signature of examiners, practical definition, and program solution.',
    'The final practical marksheet and attendance report will be provided by the examination centre.',
    'The final practical marks statement and attendance report duly signed by examiners in a sealed envelope, answer books in a separate sealed envelope and extra question papers of practical\'s in a sealed envelope should be handed over to the college authority which they will forward to the Exam department of Gujarat University or to the University observers.',
    'Examiners are required to write clearly the marks in the specific formats of the mark sheets provided for practical examination. If the candidate is absent clearly mark "Absent". Please do not leave the marks column BLANK in any case. Colleges/ Institutes should prepare in advance the copies of mark sheets as per the format.',
    'Examiners are required to report at least 30 minutes before the commencement of the examination at the center. Examiners should strictly adhere to the date, time and the center allotted to them.',
    'The Examiners should submit the TA/DA Bill duly signed by the Principal/Director of the Exam Center, to the Accounts department of Gujarat University.',
    'Examiners are requested to use mobiles sparingly only for urgent communication during exam hours.',
    'The remuneration bills along with the copy of your duty letter and attendance sheet of the college where you conducted the exam should be verified and signed by the chairperson or coordinators and then submitted to Accounts department directly by the examiner by the {{billLastDate}}.',
  ],
  billNote: 'Total Amount = No. of students x {{rate}} Rs.',
  showRefAndDate: false,
};

/**
 * Words a letter must not contain (rule 5). Used by the tests and to warn
 * the chairperson while editing.
 */
export const CHANGE_WORDS = [
  'revised',
  'revision',
  'amended',
  'amendment',
  'in place of',
  'instead of',
  'replacement',
  'replaced',
  'substitute',
  'cancelled',
  'cancellation',
  'modified',
  'updated',
  'changed',
];

/** Change words found in a piece of text, for an inline warning. */
export function findChangeWords(text: string): string[] {
  const t = text.toLowerCase();
  return CHANGE_WORDS.filter((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`).test(t));
}

/**
 * Semester from GU subject codes. The middle digit of the course number is
 * the semester: "DSC-C-BCA-353P" -> 353 -> 5. The most common answer
 * across the codes wins. Only a default; the chairperson can change it.
 */
export function semesterFromCodes(codes: readonly string[]): number | null {
  const votes = new Map<number, number>();
  for (const code of codes) {
    const m = code.match(/(\d{3})[A-Z]?$/i);
    if (!m) continue;
    const sem = Math.floor(Number(m[1]) / 10) % 10;
    if (sem >= 1 && sem <= 10) votes.set(sem, (votes.get(sem) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [sem, n] of votes) if (best === null || n > (votes.get(best) ?? 0)) best = sem;
  return best;
}

export const semesterLabel = (sem: number | null) => (sem ? `Semester ${sem}` : '');

const YEARS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];

/** "ATKT Practical Examination" when the exam's title says ATKT, else "Practical Examination". */
export function examNameFromTitle(title: string): string {
  return /(^|[^a-z])atkt([^a-z]|$)/i.test(title) ? 'ATKT Practical Examination' : 'Practical Examination';
}

/** "Semester 5" -> "Third" (two semesters a year). */
export function yearOfSemester(label: string): string {
  const m = label.match(/(\d+)/);
  return m ? YEARS[Math.ceil(Number(m[1]) / 2)] ?? '' : '';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "November 2026" from the earliest ISO date; "November - December 2026" across months. */
export function examMonthFromDates(dates: readonly string[]): string {
  const sorted = [...dates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!sorted.length) return '';
  const [y1, m1] = sorted[0].split('-').map(Number);
  const [y2, m2] = sorted[sorted.length - 1].split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${MONTHS[m1 - 1]} - ${MONTHS[m2 - 1]} ${y1}`;
  return `${MONTHS[m1 - 1]} ${y1} - ${MONTHS[m2 - 1]} ${y2}`;
}

/** "2026-11-13" -> "13-11-2026". Anything else is returned as it is. */
export function fmtIsoDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** "2026-10-26" -> "26 Oct 2026". */
export function fmtLetterDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : iso;
}

/** "2026-11-05" -> "05th of November, 2026". */
export function fmtLongDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = Number(m[3]);
  const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return `${m[3]}${suffix} of ${MONTHS[Number(m[2]) - 1]}, ${m[1]}`;
}

export interface AutoValues {
  /** Practical subject codes in the timetable. */
  subjectCodes: readonly string[];
  /** Exam dates in the timetable. */
  dates: readonly string[];
  /** Signed-in chairperson's name. */
  chairName?: string | null;
  /** The exam's title as created ("BCA Sem 5 ATKT Oct 2026"), for the exam name. */
  examTitle?: string;
  /** Today's date (ISO), for the issue date. */
  today: string;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);
const lines = (v: unknown, fallback: string[]) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : fallback;

export function readPerson(v: unknown, fallback: PersonDetails = EMPTY_PERSON): PersonDetails {
  const o = obj(v);
  return {
    name: str(o.name, fallback.name),
    designation: str(o.designation, fallback.designation),
    college: str(o.college, fallback.college),
    phone: str(o.phone, fallback.phone),
    email: str(o.email, fallback.email),
  };
}

/** The saved template, or null when it is missing or from the old letter format. */
function readTemplate(v: unknown): LetterTemplate | null {
  const t = obj(v);
  if (typeof t.refLine !== 'string') return null; // old format: use the GU format instead
  const d = DEFAULT_TEMPLATE;
  return {
    letterhead: lines(t.letterhead, d.letterhead),
    confidential: typeof t.confidential === 'string' ? t.confidential : d.confidential,
    refLine: typeof t.refLine === 'string' ? t.refLine : d.refLine,
    toLines: lines(t.toLines, d.toLines),
    subjectLine: str(t.subjectLine, d.subjectLine),
    salutation: typeof t.salutation === 'string' ? t.salutation : d.salutation,
    opening: str(t.opening, d.opening),
    afterTable: typeof t.afterTable === 'string' ? t.afterTable : d.afterTable,
    closing: typeof t.closing === 'string' ? t.closing : d.closing,
    signOff: lines(t.signOff, d.signOff),
    guidelinesHeading: lines(t.guidelinesHeading, d.guidelinesHeading),
    guidelines: lines(t.guidelines, d.guidelines),
    billNote: typeof t.billNote === 'string' ? t.billNote : d.billNote,
    showRefAndDate: typeof t.showRefAndDate === 'boolean' ? t.showRefAndDate : d.showRefAndDate,
  };
}

/**
 * Settings for an exam: what was saved for it, else what the previous exam
 * used (template, exam name, time, rate, letter number prefix), else the
 * defaults and values from the timetable.
 */
export function readLetterSettings(stored: unknown, auto: AutoValues, inherited?: unknown): LetterSettings {
  const s = obj(stored);
  const p = obj(inherited);
  const pick = <T>(key: string, ok: (v: unknown) => boolean, fallback: T): T =>
    (ok(s[key]) ? s[key] : ok(p[key]) ? p[key] : fallback) as T;
  const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const isRate = (v: unknown) => typeof v === 'number' && v >= 0;
  return {
    // Per exam, never carried over: from this exam's title unless typed.
    examName: str(s.examName, examNameFromTitle(auto.examTitle ?? '')),
    semesterLabel: str(s.semesterLabel, semesterLabel(semesterFromCodes(auto.subjectCodes))),
    examMonth: str(s.examMonth, examMonthFromDates(auto.dates)),
    examTime: pick('examTime', isText, '11:00 to 1:00 pm'),
    issueDate: str(s.issueDate, auto.today),
    refPrefix: pick('refPrefix', isText, `GU/BCA/PR/${auto.today.slice(0, 4)}/`),
    ratePerStudent: pick('ratePerStudent', isRate, 15),
    billLastDate: str(s.billLastDate, ''),
    reportingTime: pick('reportingTime', isText, '30 minutes before the examination'),
    template: readTemplate(s.template) ?? readTemplate(p.template) ?? DEFAULT_TEMPLATE,
  };
}

/** Contacts from stored JSON. Old settings had one `chairperson` and one `coordinator`. */
export function readContacts(raw: unknown, chairName?: string | null): Contacts {
  const o = obj(raw);
  const contacts = obj(o.contacts);
  const coordinators = Array.isArray(contacts.coordinators)
    ? contacts.coordinators.map((c) => readPerson(c))
    : o.coordinator
      ? [readPerson(o.coordinator)].filter((c) => c.name.trim())
      : [];
  return {
    chairperson: readPerson(contacts.chairperson ?? o.chairperson, { ...EMPTY_PERSON, name: chairName ?? '' }),
    coordinators,
    email: str(contacts.email, ''),
    savedAt: str(contacts.savedAt, ''),
  };
}

/** The latest saved contacts among several exams' letter settings. */
export function latestContacts(allStored: readonly unknown[], chairName?: string | null): Contacts {
  let best: Contacts | null = null;
  for (const raw of allStored) {
    const o = obj(raw);
    if (!o.contacts && !o.chairperson && !o.coordinator) continue;
    const c = readContacts(raw, chairName);
    if (!best || c.savedAt > best.savedAt) best = c;
  }
  return best ?? readContacts({}, chairName);
}

/** What still needs filling in before letters are generated. */
export function missingSettings(s: LetterSettings, contacts: Contacts): string[] {
  const out: string[] = [];
  if (!s.semesterLabel.trim()) out.push('Semester');
  if (!s.examMonth.trim()) out.push('Exam month');
  if (!contacts.chairperson.name.trim()) out.push('Chairperson name');
  if (!contacts.coordinators.some((c) => c.name.trim())) out.push('At least one coordinator');
  const t = s.template;
  const uses = (ph: string) =>
    [t.refLine, t.subjectLine, t.opening, t.afterTable, t.closing, t.billNote, ...t.toLines, ...t.guidelinesHeading, ...t.guidelines]
      .some((x) => x.includes(ph));
  if (uses('{{rate}}') && !s.ratePerStudent) out.push('Rate per student');
  if (uses('{{billLastDate}}') && !s.billLastDate) out.push('Bill last date');
  return out;
}
