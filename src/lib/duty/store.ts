// Database access for Duty Allocation. Pages call these instead of talking
// to Supabase directly, so the save rules live in one place.

import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { DEFAULT_RULES, type AllocationRules, type Duty } from './allocate';
import type { ParsedForm } from './formImport';
import { collegeKey } from './names';
import type { TimetableRow } from './timetableImport';

export type DutySession = Tables<'duty_sessions'>;
export type DutySubject = Tables<'duty_subjects'>;
export type DutyCollege = Tables<'duty_college_data'>;
export type DutyFaculty = Tables<'duty_faculty'>;
export type DutyTimetableRow = Tables<'duty_timetable'>;
export type DutyAssignment = Tables<'duty_assignments'>;

export interface BlockRule {
  facultyId: string;
  centreId: string;
}

export interface SessionRules extends AllocationRules {
  blocked: BlockRule[];
}

export interface SessionData {
  subjects: DutySubject[];
  colleges: DutyCollege[];
  faculty: DutyFaculty[];
  timetable: DutyTimetableRow[];
  assignments: DutyAssignment[];
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** Rules stored on the session, filled in with defaults for anything missing. */
export function readRules(session: Pick<DutySession, 'rules'> | null | undefined): SessionRules {
  const raw = (session?.rules ?? {}) as Partial<SessionRules>;
  return { ...DEFAULT_RULES, ...raw, blocked: Array.isArray(raw.blocked) ? raw.blocked : [] };
}

export async function listSessions(): Promise<DutySession[]> {
  const { data, error } = await supabase.from('duty_sessions').select('*').order('created_at', { ascending: false });
  fail(error);
  return data ?? [];
}

export async function createSession(title: string): Promise<DutySession> {
  const { data, error } = await supabase
    .from('duty_sessions')
    .insert({ title, rules: { ...DEFAULT_RULES, blocked: [] } as unknown as Json })
    .select()
    .single();
  fail(error);
  return data!;
}

export async function saveRules(sessionId: string, rules: SessionRules) {
  const { error } = await supabase.from('duty_sessions').update({ rules: rules as unknown as Json }).eq('id', sessionId);
  fail(error);
}

export async function updateSession(sessionId: string, patch: Partial<Pick<DutySession, 'title' | 'semester_label' | 'exam_month'>>) {
  const { error } = await supabase.from('duty_sessions').update(patch).eq('id', sessionId);
  fail(error);
}

export async function loadSessionData(sessionId: string): Promise<SessionData> {
  const [subjects, colleges, faculty, timetable, assignments] = await Promise.all([
    supabase.from('duty_subjects').select('*').eq('session_id', sessionId).order('code'),
    supabase.from('duty_college_data').select('*').eq('session_id', sessionId).order('code'),
    supabase.from('duty_faculty').select('*').eq('session_id', sessionId).order('name'),
    supabase.from('duty_timetable').select('*').eq('session_id', sessionId).order('exam_date'),
    supabase.from('duty_assignments').select('*').eq('session_id', sessionId).order('exam_date'),
  ]);
  for (const r of [subjects, colleges, faculty, timetable, assignments]) fail(r.error);
  return {
    subjects: subjects.data ?? [],
    colleges: colleges.data ?? [],
    faculty: faculty.data ?? [],
    timetable: timetable.data ?? [],
    assignments: assignments.data ?? [],
  };
}

/**
 * Save the Google Form import. Re-importing updates names, subjects and
 * college figures but never touches what the chairperson set by hand
 * (senior, available, college link, full name).
 */
export async function saveFormImport(sessionId: string, form: ParsedForm) {
  if (form.subjects.length) {
    const { error } = await supabase.from('duty_subjects').upsert(
      form.subjects.map((s) => ({ session_id: sessionId, code: s.code, name: s.name, is_practical: s.isPractical })),
      { onConflict: 'session_id,code' },
    );
    fail(error);
  }

  const { data: rows, error } = await supabase
    .from('duty_college_data')
    .upsert(
      form.colleges.map((c) => ({
        session_id: sessionId,
        code: c.code,
        raw_name: c.rawName,
        students: c.students,
        pcs: c.pcs,
        email: c.email,
        submitted_at: c.submittedAt?.toISOString() ?? null,
      })),
      { onConflict: 'session_id,code' },
    )
    .select('id, code');
  fail(error);

  const idByCode = new Map((rows ?? []).map((r) => [r.code, r.id]));
  const faculty = form.colleges.flatMap((c) =>
    c.faculty.map((f) => ({
      session_id: sessionId,
      college_data_id: idByCode.get(c.code)!,
      name: f.name,
      name_key: f.key,
      title: f.title,
      is_visiting: f.isVisiting,
      subject_codes: f.subjectCodes,
    })),
  );
  if (faculty.length) {
    const { error: fe } = await supabase.from('duty_faculty').upsert(faculty, { onConflict: 'session_id,college_data_id,name_key' });
    fail(fe);
  }
}

/**
 * Replace the session's timetable. `links` maps each timetable centre code
 * to a duty_college_data id, or to null to create a centre-only college
 * (a centre that did not fill the form).
 */
export async function saveTimetable(sessionId: string, rows: TimetableRow[], links: Map<string, string | null>, subjects: DutySubject[]) {
  const ids = new Map<string, string>();
  const create = [...links].filter(([, id]) => !id).map(([code]) => code);
  if (create.length) {
    const { data, error } = await supabase
      .from('duty_college_data')
      .upsert(create.map((code) => ({ session_id: sessionId, code, raw_name: code })), { onConflict: 'session_id,code' })
      .select('id, code');
    fail(error);
    for (const r of data ?? []) ids.set(collegeKey(r.code), r.id);
  }
  const centreId = (code: string) => links.get(code) ?? ids.get(collegeKey(code))!;

  // Subjects that are in the timetable but not in the form headers.
  const known = new Set(subjects.map((s) => s.code));
  const extra = [...new Set(rows.map((r) => r.subjectCode))].filter((c) => !known.has(c));
  if (extra.length) {
    const { error } = await supabase
      .from('duty_subjects')
      .upsert(extra.map((code) => ({ session_id: sessionId, code, name: code, is_practical: true })), { onConflict: 'session_id,code' });
    fail(error);
  }

  const { error: de } = await supabase.from('duty_timetable').delete().eq('session_id', sessionId);
  fail(de);
  const { error: ie } = await supabase.from('duty_timetable').insert(
    rows.map((r) => ({
      session_id: sessionId,
      exam_date: r.date,
      centre_id: centreId(r.centreCode),
      subject_code: r.subjectCode,
      batch: r.batch,
      seat_from: r.seatFrom,
      seat_to: r.seatTo,
      students: r.students,
    })),
  );
  fail(ie);
}

export async function updateFaculty(id: string, patch: Partial<Pick<DutyFaculty, 'is_senior' | 'is_available' | 'is_visiting' | 'name' | 'title'>>) {
  const { error } = await supabase.from('duty_faculty').update(patch).eq('id', id);
  fail(error);
}

export async function setSeniors(ids: string[], isSenior: boolean) {
  if (!ids.length) return;
  const { error } = await supabase.from('duty_faculty').update({ is_senior: isSenior }).in('id', ids);
  fail(error);
}

export async function linkCollege(id: string, patch: Partial<Pick<DutyCollege, 'college_id' | 'full_name' | 'pcs'>>) {
  const { error } = await supabase.from('duty_college_data').update(patch).eq('id', id);
  fail(error);
}

/**
 * Replace the active duties with a new allocation. Cancelled duties are
 * history and are kept.
 */
export async function saveAllocation(sessionId: string, duties: Duty[]) {
  const { error: de } = await supabase.from('duty_assignments').delete().eq('session_id', sessionId).eq('status', 'active');
  fail(de);
  if (!duties.length) return;
  const { error } = await supabase.from('duty_assignments').insert(
    duties.map((d) => ({
      session_id: sessionId,
      exam_date: d.date,
      centre_id: d.centreId,
      subject_code: d.subjectCode,
      faculty_id: d.facultyId,
      seat_role: d.seatRole,
    })),
  );
  fail(error);
}
