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

const SEPARATORS = /\s*(?:,|&|;|\/|\n|\band\b)\s*/i;
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
  for (const part of String(cell).split(SEPARATORS)) {
    const { value, warning } = cleanOneName(part);
    if (warning) warnings.push(warning);
    if (value && !names.some((n) => n.key === value.key)) names.push(value);
  }
  return { names, warnings };
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
