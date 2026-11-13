// Database access for Duty Allocation. Pages call these instead of talking
// to Supabase directly, so the save rules live in one place.

import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { DEFAULT_RULES, type AllocationRules, type Duty } from './allocate';
import type { ParsedForm } from './formImport';
import { collegeKey } from './names';
import type { TimetableRow } from './timetableImport';
import { matchMasterCollege, type MasterCollege } from './collegeLink';
import { dutiesMatch, dutyRowsByFaculty, hasActiveDuty, nextRefNumbers, readLetterContent, type LetterContent, type LetterDutyRow } from './letter';
import { latestContacts, type Contacts, type LetterSettings } from './letterSettings';

export type DutySession = Tables<'duty_sessions'>;
export type DutySubject = Tables<'duty_subjects'>;
export type DutyCollege = Tables<'duty_college_data'>;
export type DutyFaculty = Tables<'duty_faculty'>;
export type DutyTimetableRow = Tables<'duty_timetable'>;
export type DutyAssignment = Tables<'duty_assignments'>;
export type DutyLetter = Tables<'duty_letters'>;

export interface BlockRule {
  facultyId: string;
  centreId: string;
}

export interface SessionRules extends AllocationRules {
  blocked: BlockRule[];
  /**
   * Other codes each college goes by in this exam, keyed by collegeKey of
   * its code: { AAKMS: ['CCCA'] }. Kept by code, so it survives clearing
   * and re-importing the data. Only saveOtherCodes/addOtherCodes write it.
   */
  otherCodes: Record<string, string[]>;
  /**
   * Which colleges see "Examiners coming to our college" after publishing:
   * all, none, or only the listed centres (duty_college_data ids). Enforced
   * by the database (duty_centre_view_on). Only saveShowComing writes it.
   */
  showComing: ShowComing;
}

export interface ShowComing {
  mode: 'all' | 'none' | 'selected';
  colleges: string[];
}

export function readShowComing(v: unknown): ShowComing {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ShowComing>;
  const mode = o.mode === 'none' || o.mode === 'selected' ? o.mode : 'all';
  return { mode, colleges: Array.isArray(o.colleges) ? o.colleges.filter((x): x is string => typeof x === 'string') : [] };
}

/** Whether this centre's college admin sees the examiners coming to it. */
export function comingVisible(show: ShowComing, centreId: string): boolean {
  return show.mode === 'all' || (show.mode === 'selected' && show.colleges.includes(centreId));
}

export interface SessionData {
  subjects: DutySubject[];
  colleges: DutyCollege[];
  faculty: DutyFaculty[];
  timetable: DutyTimetableRow[];
  assignments: DutyAssignment[];
  letters: DutyLetter[];
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** Rules stored on the session, filled in with defaults for anything missing. */
export function readRules(session: Pick<DutySession, 'rules'> | null | undefined): SessionRules {
  const raw = (session?.rules ?? {}) as Partial<SessionRules>;
  const other = raw.otherCodes && typeof raw.otherCodes === 'object' && !Array.isArray(raw.otherCodes) ? raw.otherCodes : {};
  return {
    ...DEFAULT_RULES,
    ...raw,
    blocked: Array.isArray(raw.blocked) ? raw.blocked : [],
    otherCodes: other,
    showComing: readShowComing(raw.showComing),
  };
}

async function readSessionRules(sessionId: string): Promise<SessionRules> {
  const { data, error } = await supabase.from('duty_sessions').select('rules').eq('id', sessionId).single();
  fail(error);
  return readRules(data);
}

async function writeSessionRules(sessionId: string, rules: SessionRules) {
  const { data, error } = await supabase.from('duty_sessions').update({ rules: rules as unknown as Json }).eq('id', sessionId).select('id');
  fail(error);
  if (!data?.length) throw new Error('Not saved. Only the chairperson can change this exam.');
}

/** The other codes of one college (by its code). */
export function otherCodesOf(rules: Pick<SessionRules, 'otherCodes'>, code: string): string[] {
  return rules.otherCodes[collegeKey(code)] ?? [];
}

/** Replace the other codes of one college. */
export async function saveOtherCodes(sessionId: string, collegeCode: string, codes: string[]) {
  const current = await readSessionRules(sessionId);
  const otherCodes = { ...current.otherCodes };
  const key = collegeKey(collegeCode);
  if (codes.length) otherCodes[key] = codes;
  else delete otherCodes[key];
  await writeSessionRules(sessionId, { ...current, otherCodes });
}

/** Add codes to colleges' other codes ({ AAKMS: ['CCCA'] }), keeping what is there. */
export async function addOtherCodes(sessionId: string, add: Record<string, string[]>) {
  const current = await readSessionRules(sessionId);
  const otherCodes = { ...current.otherCodes };
  let changed = false;
  for (const [key, codes] of Object.entries(add)) {
    const merged = [...new Set([...(otherCodes[key] ?? []), ...codes])];
    if (merged.length !== (otherCodes[key] ?? []).length) {
      otherCodes[key] = merged;
      changed = true;
    }
  }
  if (changed) await writeSessionRules(sessionId, { ...current, otherCodes });
}

export async function listSessions(): Promise<DutySession[]> {
  const { data, error } = await supabase.from('duty_sessions').select('*').order('created_at', { ascending: false });
  fail(error);
  return data ?? [];
}

export async function createSession(title: string): Promise<DutySession> {
  const { data, error } = await supabase
    .from('duty_sessions')
    .insert({ title, rules: { ...DEFAULT_RULES, blocked: [], otherCodes: {} } as unknown as Json })
    .select()
    .single();
  fail(error);
  return data!;
}

/** Save the allocation rules. Other codes are kept as they are in the database. */
export async function saveRules(sessionId: string, rules: SessionRules) {
  const current = await readSessionRules(sessionId);
  await writeSessionRules(sessionId, { ...rules, otherCodes: current.otherCodes, showComing: current.showComing });
}

/** Set which colleges see "Examiners coming to our college". */
export async function saveShowComing(sessionId: string, show: ShowComing) {
  const current = await readSessionRules(sessionId);
  await writeSessionRules(sessionId, { ...current, showComing: show });
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<DutySession, 'title' | 'semester_label' | 'exam_month' | 'status' | 'published_at'>>,
) {
  const { error } = await supabase.from('duty_sessions').update(patch).eq('id', sessionId);
  fail(error);
}

export async function renameSession(sessionId: string, title: string) {
  const { data, error } = await supabase.from('duty_sessions').update({ title }).eq('id', sessionId).select('id');
  fail(error);
  if (!data?.length) throw new Error('The exam was not renamed. Only the chairperson can change exams.');
}

/** Delete an exam and everything in it (colleges, faculty, timetable, duties, letters). */
export async function deleteSession(sessionId: string) {
  // Until the settings table exists the chairperson and coordinators may be
  // stored with this exam: copy them to another exam first so they are kept.
  const contacts = await loadContacts().catch(() => null);
  const { data, error } = await supabase.from('duty_sessions').delete().eq('id', sessionId).select('id');
  fail(error);
  if (!data?.length) throw new Error('The exam was not deleted. Only the chairperson can delete exams.');
  if (contacts?.savedAt) {
    const after = await loadContacts().catch(() => null);
    if (after && after.savedAt < contacts.savedAt) {
      const { data: other } = await supabase.from('duty_sessions').select('id').order('created_at', { ascending: false }).limit(1);
      if (other?.[0]) {
        const current = await readStoredLetterSettings(other[0].id);
        await writeStoredLetterSettings(other[0].id, { ...current, contacts });
      }
    }
  }
}

/**
 * What can be cleared from an exam. Each part also clears what is built on
 * it: letters <- duties <- timetable <- college data.
 */
export type ClearPart = 'letters' | 'duties' | 'timetable' | 'colleges';

export const CLEAR_ORDER: ClearPart[] = ['letters', 'duties', 'timetable', 'colleges'];

/** The parts actually cleared when `part` is chosen (it and everything after it in the chain). */
export function clearIncludes(part: ClearPart): ClearPart[] {
  return CLEAR_ORDER.slice(0, CLEAR_ORDER.indexOf(part) + 1);
}

/** Clear imported or generated data from an exam, keeping the exam, its rules and letter settings. */
export async function clearSessionData(sessionId: string, part: ClearPart) {
  const parts = new Set(clearIncludes(part));
  const del = async (table: 'duty_letters' | 'duty_assignments' | 'duty_timetable' | 'duty_faculty' | 'duty_college_data' | 'duty_subjects') => {
    const { error } = await supabase.from(table).delete().eq('session_id', sessionId);
    fail(error);
  };
  if (parts.has('letters')) await del('duty_letters');
  if (parts.has('duties')) await del('duty_assignments');
  if (parts.has('timetable')) await del('duty_timetable');
  if (parts.has('colleges')) {
    await del('duty_faculty');
    await del('duty_college_data');
    await del('duty_subjects');
  }
}

export async function loadSessionData(sessionId: string): Promise<SessionData> {
  const [subjects, colleges, faculty, timetable, assignments, letters] = await Promise.all([
    supabase.from('duty_subjects').select('*').eq('session_id', sessionId).order('code'),
    supabase.from('duty_college_data').select('*').eq('session_id', sessionId).order('code'),
    supabase.from('duty_faculty').select('*').eq('session_id', sessionId).order('name'),
    supabase.from('duty_timetable').select('*').eq('session_id', sessionId).order('exam_date'),
    supabase.from('duty_assignments').select('*').eq('session_id', sessionId).order('exam_date'),
    supabase.from('duty_letters').select('*').eq('session_id', sessionId).order('generated_at'),
  ]);
  for (const r of [subjects, colleges, faculty, timetable, assignments, letters]) fail(r.error);
  return {
    subjects: subjects.data ?? [],
    colleges: colleges.data ?? [],
    faculty: faculty.data ?? [],
    timetable: timetable.data ?? [],
    assignments: assignments.data ?? [],
    letters: letters.data ?? [],
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

  // Remember a centre code linked to a college with a different code
  // (CCCA -> AAKMS) as one of its other codes, so the next import links it.
  const linked = [...links].filter(([, id]) => id) as [string, string][];
  if (linked.length) {
    const { data: cols, error: ce } = await supabase
      .from('duty_college_data')
      .select('id, code')
      .in('id', [...new Set(linked.map(([, id]) => id))]);
    fail(ce);
    const add: Record<string, string[]> = {};
    for (const c of cols ?? []) {
      const own = collegeKey(c.code);
      const codes = linked.filter(([code, id]) => id === c.id && collegeKey(code) !== own).map(([code]) => collegeKey(code));
      if (codes.length) add[own] = codes;
    }
    if (Object.keys(add).length) await addOtherCodes(sessionId, add);
  }

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

/**
 * Row security can make an update change nothing without an error; treat
 * that as a failure so the screen does not show a change that was not saved.
 */
const failIfNothingSaved = (rows: unknown[] | null, expected: number) => {
  if ((rows?.length ?? 0) < expected) {
    throw new Error('The change was not saved. Only the chairperson can change faculty; please sign in again and retry.');
  }
};

export async function updateFaculty(id: string, patch: Partial<Pick<DutyFaculty, 'is_senior' | 'is_available' | 'is_visiting' | 'name' | 'title'>>) {
  const { data, error } = await supabase.from('duty_faculty').update(patch).eq('id', id).select('id');
  fail(error);
  failIfNothingSaved(data, 1);
}

export async function setSeniors(ids: string[], isSenior: boolean) {
  // In batches: every id goes into the request URL.
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('duty_faculty').update({ is_senior: isSenior }).in('id', part).select('id');
    fail(error);
    failIfNothingSaved(data, part.length);
  }
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

/** Fill one empty seat by hand. */
export async function addDuty(
  sessionId: string,
  d: { date: string; centreId: string; subjectCode: string; facultyId: string; seatRole: 'senior' | 'junior' },
) {
  const { error } = await supabase.from('duty_assignments').insert({
    session_id: sessionId,
    exam_date: d.date,
    centre_id: d.centreId,
    subject_code: d.subjectCode,
    faculty_id: d.facultyId,
    seat_role: d.seatRole,
  });
  fail(error);
}

/** Before publishing: give a seat to someone else. No history is kept. */
export async function changeDutyFaculty(assignmentId: string, facultyId: string) {
  const { error } = await supabase
    .from('duty_assignments')
    .update({ faculty_id: facultyId })
    .eq('id', assignmentId)
    .eq('status', 'active');
  fail(error);
}

/** Before publishing: remove a duty outright. */
export async function deleteDuty(assignmentId: string) {
  const { error } = await supabase.from('duty_assignments').delete().eq('id', assignmentId).eq('status', 'active');
  fail(error);
}

/**
 * Cancel a duty and, when `newFacultyId` is given, give the same seat to
 * that examiner, in one database call. Only the Cancellations view shows
 * this (rule 4). Returns the new duty's id.
 */
export async function cancelDuty(assignmentId: string, newFacultyId: string | null, reason: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('duty_cancel_and_replace', {
    _assignment: assignmentId,
    // The database accepts null for "cancel only"; the generated type does not say so.
    _new_faculty: newFacultyId as string,
    _reason: reason,
  });
  fail(error);
  return data ?? null;
}

export async function setPublished(sessionId: string, publish: boolean) {
  await updateSession(
    sessionId,
    publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft', published_at: null },
  );
}

// ---------------------------------------------------------------------------
// College links

export async function listMasterColleges(): Promise<MasterCollege[]> {
  const { data, error } = await supabase.from('colleges').select('id, code, name').order('code');
  fail(error);
  return data ?? [];
}

/**
 * Link every not-yet-linked college of the session to its account college
 * when the code matches exactly one. Links set by hand are never changed.
 * Returns how many were linked.
 */
export async function autoLinkColleges(sessionId: string): Promise<number> {
  const [{ data: rows, error }, master, rules] = await Promise.all([
    supabase.from('duty_college_data').select('id, code, college_id, full_name').eq('session_id', sessionId),
    listMasterColleges(),
    readSessionRules(sessionId),
  ]);
  fail(error);
  let linked = 0;
  for (const r of rows ?? []) {
    if (r.college_id) continue;
    const m = matchMasterCollege(r.code, master, otherCodesOf(rules, r.code));
    if (!m) continue;
    await linkCollege(r.id, { college_id: m.id, ...(r.full_name ? {} : { full_name: m.name }) });
    linked += 1;
  }
  return linked;
}

// ---------------------------------------------------------------------------
// Letters

async function readStoredLetterSettings(sessionId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('duty_sessions').select('letter_settings').eq('id', sessionId).single();
  fail(error);
  const v = data?.letter_settings;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function writeStoredLetterSettings(sessionId: string, value: Record<string, unknown>, extra: { semester_label?: string; exam_month?: string } = {}) {
  const { data, error } = await supabase
    .from('duty_sessions')
    .update({ letter_settings: value as unknown as Json, ...extra })
    .eq('id', sessionId)
    .select('id');
  fail(error);
  if (!data?.length) throw new Error('Not saved. Only the chairperson can change letter settings.');
}

/** Save this exam's letter settings. The contacts stored with them are kept. */
export async function saveLetterSettings(sessionId: string, settings: LetterSettings) {
  const current = await readStoredLetterSettings(sessionId);
  await writeStoredLetterSettings(
    sessionId,
    { ...settings, ...(current.contacts ? { contacts: current.contacts } : {}) },
    { semester_label: settings.semesterLabel, exam_month: settings.examMonth },
  );
}

/** Letter settings of the most recent other exam that has any, to carry the template over. */
export async function previousLetterSettings(sessionId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('duty_sessions')
    .select('letter_settings')
    .neq('id', sessionId)
    .order('created_at', { ascending: false })
    .limit(10);
  fail(error);
  const found = (data ?? []).find((r) => r.letter_settings && Object.keys(r.letter_settings as object).length);
  return found?.letter_settings ?? null;
}

// ---------------------------------------------------------------------------
// Chairperson and coordinators: entered once, used by every exam.
//
// They live in the app-wide duty_settings table (key 'contacts'). Until that
// table exists (migration 20261113190000_duty_settings.sql), they are kept
// with the exams' letter settings instead (the newest save wins) plus a copy
// in this browser, so deleting an exam does not lose them.

const CONTACTS_KEY = 'contacts';
const LOCAL_CONTACTS = 'duty:contacts';

/** The duty_settings table has not been created yet. */
const noSettingsTable = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === 'PGRST205' || error.code === '42P01' || /duty_settings/.test(error.message ?? ''));

function localContacts(): unknown {
  try {
    const raw = localStorage.getItem(LOCAL_CONTACTS);
    return raw ? { contacts: JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function keepLocal(contacts: Contacts) {
  try {
    localStorage.setItem(LOCAL_CONTACTS, JSON.stringify(contacts));
  } catch {
    // Private window or storage blocked: the database copy is enough.
  }
}

/** Chairperson and coordinators, as last saved. */
export async function loadContacts(chairName?: string | null): Promise<Contacts> {
  const { data: row, error } = await supabase.from('duty_settings').select('value').eq('key', CONTACTS_KEY).maybeSingle();
  if (error && !noSettingsTable(error)) fail(error);
  const fromTable = !error && row ? [{ contacts: row.value }] : [];
  // Older saves inside exams (and this browser's copy) are read too; the newest wins.
  const { data: sessions, error: se } = await supabase.from('duty_sessions').select('letter_settings');
  fail(se);
  const contacts = latestContacts([...fromTable, ...(sessions ?? []).map((r) => r.letter_settings), localContacts()], chairName);
  if (contacts.savedAt) keepLocal(contacts);
  return contacts;
}

/** Save the chairperson and coordinators for every exam. */
export async function saveContacts(sessionId: string, contacts: Omit<Contacts, 'savedAt'>) {
  const value: Contacts = { ...contacts, savedAt: new Date().toISOString() };
  const { data, error } = await supabase
    .from('duty_settings')
    .upsert({ key: CONTACTS_KEY, value: value as unknown as Json, updated_at: value.savedAt }, { onConflict: 'key' })
    .select('key');
  if (error && !noSettingsTable(error)) fail(error);
  if (!error && !data?.length) throw new Error('Not saved. Only the chairperson can change these details.');
  if (error) {
    // No settings table yet: keep them with this exam.
    const current = await readStoredLetterSettings(sessionId);
    await writeStoredLetterSettings(sessionId, { ...current, contacts: value });
  }
  keepLocal(value);
}

export async function listLetters(sessionId: string): Promise<DutyLetter[]> {
  const { data, error } = await supabase.from('duty_letters').select('*').eq('session_id', sessionId).order('generated_at');
  fail(error);
  return data ?? [];
}

/**
 * Create letters for examiners who have none yet. Existing letters are
 * never overwritten (rule 3): a clash on (session, faculty) is skipped.
 */
export async function createLetters(sessionId: string, letters: { facultyId: string; content: LetterContent }[]) {
  if (!letters.length) return;
  const { error } = await supabase.from('duty_letters').upsert(
    letters.map((l) => ({ session_id: sessionId, faculty_id: l.facultyId, content: l.content as unknown as Json })),
    { onConflict: 'session_id,faculty_id', ignoreDuplicates: true },
  );
  fail(error);
}

/** Save a hand edit. A finalised letter is not touched (the trigger also refuses it). */
export async function updateLetterContent(id: string, content: LetterContent) {
  const { data, error } = await supabase
    .from('duty_letters')
    .update({ content: content as unknown as Json })
    .eq('id', id)
    .is('finalised_at', null)
    .select('id');
  fail(error);
  if (!data?.length) throw new Error('This letter is finalised. Un-finalise it before editing.');
}

// ---------------------------------------------------------------------------
// Keeping letters in step with duty changes

export interface LetterSyncResult {
  replaced: number;
  created: number;
  deleted: number;
}

export interface NewLetterState {
  finalised: boolean;
  sent: boolean;
}

export interface LetterSyncOptions {
  /** Builds a letter for an examiner with the given duties (current settings). */
  build: (facultyId: string, refNo: string, duties: readonly LetterDutyRow[]) => LetterContent | null;
  /** Letter number prefix for new letters. */
  refPrefix: string;
  /**
   * State for a letter made for someone who had none, e.g. the examiner
   * who took over a cancelled duty: like the letter it replaces.
   */
  newLetter: NewLetterState | ((facultyId: string) => NewLetterState);
  userId: string | null;
}

/** Replace a letter's text, finalised or not, keeping it finalised and sent as it was. */
async function replaceLetter(letter: DutyLetter, content: LetterContent) {
  if (letter.finalised_at) {
    // A finalised letter cannot be rewritten in one step (see the trigger).
    const { error } = await supabase.from('duty_letters').update({ finalised_at: null }).eq('id', letter.id);
    fail(error);
  }
  const { error } = await supabase
    .from('duty_letters')
    .update({ content: content as unknown as Json, finalised_at: letter.finalised_at, finalised_by: letter.finalised_by })
    .eq('id', letter.id);
  fail(error);
}

/** Delete a letter, finalised or not (the examiner has no duty left). */
async function removeLetter(letter: DutyLetter) {
  if (letter.finalised_at) {
    const { error } = await supabase.from('duty_letters').update({ finalised_at: null }).eq('id', letter.id);
    fail(error);
  }
  const { error } = await supabase.from('duty_letters').delete().eq('id', letter.id);
  fail(error);
}

/**
 * After a duty was cancelled, moved, added or removed: bring the letters
 * of these examiners in line with their active duties. A letter whose
 * duties changed is replaced (same number, still finalised and sent if it
 * was); a letter with no duty left is deleted; an examiner who now has a
 * duty but no letter gets one. Letters never say what changed (rule 5).
 * Nothing happens before letters have been generated for the exam.
 */
export async function syncLetters(sessionId: string, facultyIds: readonly string[], opts: LetterSyncOptions): Promise<LetterSyncResult> {
  const result: LetterSyncResult = { replaced: 0, created: 0, deleted: 0 };
  const fresh = await loadSessionData(sessionId);
  if (!fresh.letters.length) return result;

  const duties = dutyRowsByFaculty(fresh);
  const letterOf = new Map(fresh.letters.map((l) => [l.faculty_id, l]));
  const refs = fresh.letters.map((l) => readLetterContent(l.content).refNo);
  const facultyCollege = new Map(fresh.faculty.map((f) => [f.id, f.college_data_id]));
  const hasAccount = (facultyId: string) =>
    !!fresh.colleges.find((c) => c.id === facultyCollege.get(facultyId))?.college_id;

  for (const id of new Set(facultyIds)) {
    const rows = duties.get(id) ?? [];
    const letter = letterOf.get(id);
    if (letter) {
      if (!rows.length) {
        await removeLetter(letter);
        result.deleted += 1;
        continue;
      }
      const current = readLetterContent(letter.content);
      if (dutiesMatch(current.duties, rows)) continue;
      const content = opts.build(id, current.refNo, rows);
      if (!content) continue;
      await replaceLetter(letter, content);
      result.replaced += 1;
    } else if (hasActiveDuty(rows)) {
      const [refNo] = nextRefNumbers(refs, opts.refPrefix, 1);
      refs.push(refNo);
      const content = opts.build(id, refNo, rows);
      if (!content) continue;
      const state = typeof opts.newLetter === 'function' ? opts.newLetter(id) : opts.newLetter;
      const finalised = state.finalised;
      const { data, error } = await supabase
        .from('duty_letters')
        .insert({
          session_id: sessionId,
          faculty_id: id,
          content: content as unknown as Json,
          ...(finalised ? { finalised_at: new Date().toISOString(), finalised_by: opts.userId } : {}),
        })
        .select('id')
        .single();
      fail(error);
      result.created += 1;
      if (finalised && state.sent && data && hasAccount(id)) await setSent([data.id], true, opts.userId);
    }
  }
  return result;
}

/** "1 letter replaced, 1 new letter" for a toast; empty when nothing changed. */
export function describeLetterSync(r: LetterSyncResult): string {
  return [
    r.replaced && `${r.replaced} letter(s) updated`,
    r.created && `${r.created} new letter(s)`,
    r.deleted && `${r.deleted} letter(s) removed`,
  ].filter(Boolean).join(', ');
}

export async function setFinalised(ids: string[], finalised: boolean, userId: string | null) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('duty_letters')
    .update(finalised ? { finalised_at: new Date().toISOString(), finalised_by: userId } : { finalised_at: null, finalised_by: null })
    .in('id', ids);
  fail(error);
}

/**
 * Send finalised letters to their college admins (they appear on the
 * admin's My Duties page), or take them back. Only the letter text is
 * stored; the PDF is drawn in the browser. Returns how many changed.
 */
export async function setSent(ids: string[], sent: boolean, userId: string | null): Promise<number> {
  let changed = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const q = supabase
      .from('duty_letters')
      .update(sent ? { sent_at: new Date().toISOString(), sent_by: userId } : { sent_at: null, sent_by: null })
      .in('id', part);
    const { data, error } = await (sent ? q.not('finalised_at', 'is', null) : q).select('id');
    if (error && /sent_at|sent_by/.test(error.message)) {
      throw new Error(
        'Sending letters needs the database update (migration 20261113180000_duty_letters_send.sql). '
        + 'If you already ran it, run  NOTIFY pgrst, \'reload schema\';  in the SQL Editor and refresh. '
        + `Database said: ${error.message}`,
      );
    }
    fail(error);
    changed += data?.length ?? 0;
  }
  return changed;
}

/** Delete draft letters (finalised ones are never deleted). Returns how many were deleted. */
export async function deleteDraftLetters(ids: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('duty_letters').delete().in('id', ids.slice(i, i + 100)).is('finalised_at', null).select('id');
    fail(error);
    deleted += data?.length ?? 0;
  }
  return deleted;
}

/** Only a draft letter can be deleted (e.g. the examiner has no duty left). */
export async function deleteLetter(id: string) {
  const { error } = await supabase.from('duty_letters').delete().eq('id', id).is('finalised_at', null);
  fail(error);
}

// ---------------------------------------------------------------------------
// College admin: "My Duties". RLS returns only this college's scope:
// sessions that are published or in which a letter was sent to them,
// duties of published sessions, and letters that were sent.

export interface MyDutiesData {
  sessions: DutySession[];
  data: Record<string, SessionData>;
}

interface MyDutiesBlock {
  session: DutySession;
  letters: DutyLetter[];
  assignments: DutyAssignment[];
  faculty: DutyFaculty[];
  colleges: DutyCollege[];
  subjects: DutySubject[];
}

/** A database function is not installed yet (its migration has not been run). */
const missingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? ''));

/**
 * Everything the My Duties page shows. Uses one database call
 * (duty_my_duties, migration 20261113220000) and falls back to reading
 * table by table until that function exists.
 */
let fastMyDutiesMissing = false;

export async function loadMyDuties(): Promise<MyDutiesData> {
  // After one "function not found" the slower way is used until reload, so
  // the browser does not log a failed request on every visit.
  if (fastMyDutiesMissing) return loadMyDutiesSlow();
  const { data: fast, error: fe } = await supabase.rpc('duty_my_duties' as never);
  if (!fe) {
    const blocks = (fast ?? []) as unknown as MyDutiesBlock[];
    const data: Record<string, SessionData> = {};
    for (const b of blocks) {
      data[b.session.id] = {
        subjects: b.subjects,
        colleges: b.colleges,
        faculty: b.faculty,
        timetable: [],
        assignments: b.assignments,
        letters: b.letters,
      };
    }
    return { sessions: blocks.map((b) => b.session), data };
  }
  if (missingFunction(fe)) {
    fastMyDutiesMissing = true;
    console.info('[duty] duty_my_duties is not installed yet (migration 20261113220000); using the slower way.');
  } else {
    // Any other problem with the fast way: still show the page.
    console.warn('[duty] duty_my_duties failed, using the slower way:', fe.message);
  }
  return loadMyDutiesSlow();
}

async function loadMyDutiesSlow(): Promise<MyDutiesData> {
  const { data: sessions, error } = await supabase
    .from('duty_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  fail(error);
  const data: Record<string, SessionData> = {};
  await Promise.all(
    (sessions ?? []).map(async (s) => {
      const d = await loadSessionData(s.id);
      // Belt and braces: duties only once published, only active ones,
      // and only finalised letters that were sent.
      d.assignments = s.status === 'published' ? d.assignments.filter((a) => a.status === 'active') : [];
      d.letters = d.letters.filter((l) => l.finalised_at && l.sent_at);
      data[s.id] = d;
    }),
  );
  return { sessions: sessions ?? [], data };
}

// ---------------------------------------------------------------------------
// Download log of duty letters (who downloaded what, and when)

export interface DutyDownload {
  id: string;
  session_id: string;
  letter_id: string | null;
  faculty_id: string | null;
  college_id: string | null;
  user_id: string;
  kind: 'letter' | 'all_letters';
  detail: string | null;
  downloaded_at: string;
}

/**
 * Record a download by a college admin. Never blocks the download: if the
 * log table is not there yet (migration 20261113220000), it is skipped.
 */
export async function logDutyDownload(entry: {
  sessionId: string;
  collegeId: string | null;
  kind: DutyDownload['kind'];
  letterId?: string | null;
  facultyId?: string | null;
  detail?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('duty_download_logs' as never).insert({
    session_id: entry.sessionId,
    college_id: entry.collegeId,
    user_id: auth.user.id,
    kind: entry.kind,
    letter_id: entry.letterId ?? null,
    faculty_id: entry.facultyId ?? null,
    detail: entry.detail ?? null,
  } as never);
  if (error) console.warn('[duty] download not logged:', error.message);
}

/** The download log of one exam, newest first (chairperson). Empty until the log table exists. */
export async function listDutyDownloads(sessionId: string): Promise<DutyDownload[]> {
  const { data, error } = await supabase
    .from('duty_download_logs' as never)
    .select('*')
    .eq('session_id', sessionId)
    .order('downloaded_at', { ascending: false });
  if (error) {
    if (/duty_download_logs/.test(error.message) || error.code === 'PGRST205' || error.code === '42P01') return [];
    fail(error);
  }
  return (data ?? []) as unknown as DutyDownload[];
}
