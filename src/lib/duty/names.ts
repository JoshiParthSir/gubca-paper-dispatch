// Cleaning for the free-text names colleges type into the Google Form.
//
// One form cell can hold several people ("A, B", "A & B"), titles in any
// form ("PROF.", "Prof.Niku", "Dr"), status notes ("(Visiting)", "(VF)")
// and placeholders ("Visiting", "NA"). Everything here is pure so it can
// be tested without a browser.

export interface CleanName {
  /** Display name without the title, e.g. "Niku Brahmbhatt". */
  name: string;
  /** Lower-case key used to merge the same person across columns. */
  key: string;
  /** "Dr." when the form said Dr, otherwise "Prof.". */
  title: 'Dr.' | 'Prof.';
  isVisiting: boolean;
}

export interface NameCellResult {
  names: CleanName[];
  /** Human-readable notes for the chairperson, e.g. skipped placeholders. */
  warnings: string[];
}

const SEPARATORS = /\s*(?:,|&|;|\/|\+|\||\n|\band\b)\s*/i;
const TITLE_WORD = String.raw`(?:dr|prof|professor|mr|mrs|ms|miss|shri|smt)\b\.?`;
/** A title in the middle of a cell starts a new person ("Prof. A Shah Prof. B Mehta"), unless it follows another title ("Prof. Dr. X"). */
const TITLE_MID = new RegExp(String.raw`(?<!\b${TITLE_WORD})\s+(?=${TITLE_WORD}\s*[a-z])`, 'gi');
/** List numbering ("1. A Shah 2) B Mehta") starts a new person. */
const NUMBERING = /(?:^|\s)\d{1,2}\s*[.)]\s*/g;
const VISITING = /\(\s*(?:visiting|vf|v\.f\.?)\s*\)|\b(?:visiting faculty|visiting)\b\s*$/i;
const TITLE = /^(?:(dr|prof|professor|mr|mrs|ms|miss|shri|smt)\b\.?\s*)+/i;
const HONORIFIC_SUFFIX = /\s+(?:ma'?am|madam|mam|sir)\.?$/i;
const PLACEHOLDER = /^(?:na|n\/a|nil|none|-+|\.+|visiting|vf|not applicable|no|tbd|vacant)$/i;

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

/** Re-case only words typed all in capitals or all in lower case ("Jatin modi" -> "Jatin Modi"). */
const fixWordCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (w.length > 1 && (w === w.toUpperCase() || w === w.toLowerCase()) ? titleCase(w) : w))
    .join(' ');

/** Clean one person's name. Returns null for placeholders like "NA". */
export function cleanOneName(raw: string): { value: CleanName | null; warning?: string } {
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return { value: null };

  let isVisiting = false;
  if (VISITING.test(s)) {
    isVisiting = true;
    s = s.replace(VISITING, '').trim();
  }

  if (!s || PLACEHOLDER.test(s)) {
    return {
      value: null,
      warning: isVisiting || /visiting/i.test(raw)
        ? `"${raw.trim()}" has no name (visiting faculty not named), skipped`
        : `"${raw.trim()}" is not a name, skipped`,
    };
  }

  let title: CleanName['title'] = 'Prof.';
  const t = s.match(TITLE);
  if (t) {
    if (/\bdr\b/i.test(t[0])) title = 'Dr.';
    s = s.slice(t[0].length).trim();
  }

  let warning: string | undefined;
  if (HONORIFIC_SUFFIX.test(s)) {
    s = s.replace(HONORIFIC_SUFFIX, '').trim();
    warning = `"${raw.trim()}" looks like a nickname; please check the full name`;
  }

  s = s.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || PLACEHOLDER.test(s)) return { value: null, warning: `"${raw.trim()}" is not a name, skipped` };

  // Single-letter initials ("Chirag V Makwana") are left as typed.
  const name = fixWordCase(s);
  if (!warning && !name.includes(' ')) warning = `"${raw.trim()}" has only one word; please check the full name`;

  return { value: { name, key: nameKey(name), title, isVisiting }, warning };
}

/** Split a form cell into people and clean each one. */
export function parseNameCell(cell: unknown): NameCellResult {
  const names: CleanName[] = [];
  const warnings: string[] = [];
  if (cell === null || cell === undefined) return { names, warnings };
  const whole = String(cell).trim();
  if (!whole) return { names, warnings };
  // Check the whole cell first so "N/A" is not split on the slash.
  if (PLACEHOLDER.test(whole)) {
    warnings.push(cleanOneName(whole).warning ?? `"${whole}" is not a name, skipped`);
    return { names, warnings };
  }
  const marked = whole.replace(NUMBERING, ', ').replace(TITLE_MID, ', ');
  for (const part of marked.split(SEPARATORS)) {
    const { value, warning } = cleanOneName(part);
    if (warning) warnings.push(warning);
    if (value && !names.some((n) => n.key === value.key)) names.push(value);
  }
  return { names, warnings };
}

/**
 * Key for "the same person written another way": word order and initials
 * are ignored, so "Asha R. Mehta", "Mehta Asha" and "ASHA MEHTA" match.
 */
export function personKey(name: string): string {
  return nameKey(name)
    .split(' ')
    .filter((w) => w.length > 1)
    .sort()
    .join(' ');
}

/**
 * Key to treat faculty records as one person across colleges: their
 * person key when the name has at least two words, otherwise `fallback`
 * (a one-word name like "Asha" is too common to match on).
 */
export function samePersonKey(name: string, fallback: string): string {
  const p = personKey(name);
  return p.includes(' ') ? p : fallback;
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

/** Key that ignores case, dots, spacing and initials' punctuation. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * College code as used in the timetable. The form sometimes adds a place
 * in brackets ("NGCCA (Ashram Road)"); single-word codes are upper-cased.
 */
export function cleanCollegeCode(raw: unknown): string {
  const s = String(raw ?? '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.includes(' ') ? s : s.toUpperCase();
}

/** Key for matching college codes that differ only in case, spaces or dots. */
export function collegeKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
