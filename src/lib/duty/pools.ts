// Who fits which practical. Only faculty who teach the practical are given
// its duties automatically; anyone else can be picked only by the
// chairperson, by hand, when no teacher of the subject is available.

export type PoolTier = 'subject' | 'practical' | 'other';

export const TIER_ORDER: Record<PoolTier, number> = { subject: 0, practical: 1, other: 2 };

export const TIER_LABEL: Record<PoolTier, string> = {
  subject: 'Teaches this practical',
  practical: 'Teaches another practical',
  other: 'Does not teach a practical',
};

/**
 * subject   - handles this practical subject at their college
 * practical - handles another practical subject in this timetable
 * other     - everyone else (theory / other subjects)
 */
export function facultyTier(subjectCodes: readonly string[], subjectCode: string, practicalCodes: readonly string[]): PoolTier {
  if (subjectCodes.includes(subjectCode)) return 'subject';
  if (subjectCodes.some((c) => practicalCodes.includes(c))) return 'practical';
  return 'other';
}

export interface PoolSummary {
  subjectCode: string;
  subject: number;
  practical: number;
  other: number;
}

/** How many faculty fall into each tier for every practical in the timetable. */
export function summarisePools(
  faculty: readonly { subjectCodes: readonly string[] }[],
  practicalCodes: readonly string[],
): PoolSummary[] {
  return practicalCodes.map((subjectCode) => {
    const s: PoolSummary = { subjectCode, subject: 0, practical: 0, other: 0 };
    for (const f of faculty) s[facultyTier(f.subjectCodes, subjectCode, practicalCodes)] += 1;
    return s;
  });
}
