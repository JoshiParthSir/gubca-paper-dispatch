import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildLetter, collegeName, type LetterContent, type LetterDutyRow } from '@/lib/duty/letter';
import {
  missingSettings,
  readContacts,
  readLetterSettings,
  type AutoValues,
  type Contacts,
  type LetterSettings,
} from '@/lib/duty/letterSettings';
import { loadContacts, previousLetterSettings, type DutySession, type SessionData } from '@/lib/duty/store';
import { useLookups } from './lookups';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface LetterBuilder {
  settings: LetterSettings;
  contacts: Contacts;
  /** What must be filled in before letters can be made. */
  missing: string[];
  /** Reload the shared parts (carried-over format, chairperson and coordinators). */
  reloadShared: () => Promise<void>;
  /** A letter for one examiner with the given duties, from the current settings. */
  build: (facultyId: string, refNo: string, duties: readonly LetterDutyRow[]) => LetterContent | null;
}

/**
 * Everything needed to build letters for an exam: its settings (with the
 * format carried over from the previous exam) and the chairperson and
 * coordinators entered once for every exam. Used by the Letters tab and
 * when a duty change rebuilds letters.
 */
export function useLetterBuilder(session: DutySession, data: SessionData, onError: (e: unknown) => void): LetterBuilder {
  const { profile } = useAuth();
  const { college, faculty, subject, practicalCodes } = useLookups(data);
  // Every practical of the exam, for the guidelines ("{{allSubjects}}").
  const examSubjects = useMemo(
    () => practicalCodes.map((code) => ({ code, name: subject.get(code)?.name ?? code })),
    [practicalCodes, subject],
  );

  const auto: AutoValues = useMemo(() => ({
    subjectCodes: [...new Set(data.timetable.map((t) => t.subject_code))],
    dates: [...new Set(data.timetable.map((t) => t.exam_date))],
    chairName: profile?.full_name ?? null,
    examTitle: session.title,
    today: todayIso(),
  }), [data.timetable, profile?.full_name, session.title]);

  const [inherited, setInherited] = useState<unknown>(null);
  const [contacts, setContacts] = useState<Contacts>(() => readContacts({}, profile?.full_name));
  const reloadShared = useCallback(async () => {
    try {
      const [prev, people] = await Promise.all([previousLetterSettings(session.id), loadContacts(profile?.full_name)]);
      setInherited(prev);
      setContacts(people);
    } catch (e) {
      onError(e);
    }
  }, [session.id, profile?.full_name, onError]);
  useEffect(() => { void reloadShared(); }, [reloadShared]);

  const settings = useMemo(() => readLetterSettings(session.letter_settings, auto, inherited), [session.letter_settings, auto, inherited]);
  const missing = missingSettings(settings, contacts);

  const build = useCallback((facultyId: string, refNo: string, duties: readonly LetterDutyRow[]) => {
    const f = faculty.get(facultyId);
    if (!f) return null;
    const c = college.get(f.college_data_id);
    return buildLetter({
      faculty: { title: f.title, name: f.name },
      college: { code: c?.code ?? '', fullName: collegeName(c) },
      duties,
      settings,
      contacts,
      refNo,
      examSubjects,
    });
  }, [faculty, college, settings, contacts, examSubjects]);

  return { settings, contacts, missing, reloadShared, build };
}
