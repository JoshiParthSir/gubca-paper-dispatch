// Who is preferred for which practical. Nobody is ever dropped: faculty who
// do not teach the subject stay in the pool as backup.

export type PoolTier = 'subject' | 'practical' | 'backup';

export const TIER_ORDER: Record<PoolTier, number> = { subject: 0, practical: 1, backup: 2 };

export const TIER_LABEL: Record<PoolTier, string> = {
  subject: 'Teaches this practical',
  practical: 'Teaches another practical',
  backup: 'Backup (theory / other subject)',
};

/**
 * subject   - handles this practical subject at their college
 * practical - handles another practical subject in this timetable
 * backup    - everyone else
 */
export function facultyTier(subjectCodes: readonly string[], subjectCode: string, practicalCodes: readonly string[]): PoolTier {
  if (subjectCodes.includes(subjectCode)) return 'subject';
  if (subjectCodes.some((c) => practicalCodes.includes(c))) return 'practical';
  return 'backup';
}

export interface PoolSummary {
  subjectCode: string;
  subject: number;
  practical: number;
  backup: number;
}

/** How many faculty fall into each tier for every practical in the timetable. */
export function summarisePools(
  faculty: readonly { subjectCodes: readonly string[] }[],
  practicalCodes: readonly string[],
): PoolSummary[] {
  return practicalCodes.map((subjectCode) => {
    const s: PoolSummary = { subjectCode, subject: 0, practical: 0, backup: 0 };
    for (const f of faculty) s[facultyTier(f.subjectCodes, subjectCode, practicalCodes)] += 1;
    return s;
  });
}
