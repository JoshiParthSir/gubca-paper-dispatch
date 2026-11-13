// Duty table: the active duties, one row per practical at a centre on a
// day, with its examiners. Shared by the PDF and Excel exports.

import { collegeName, type DutySource } from './letter';

export interface DutyTableExaminer {
  role: 'senior' | 'junior';
  name: string;
  collegeCode: string;
}

export interface DutyTableRow {
  date: string;
  centreCode: string;
  centreName: string;
  subjectCode: string;
  subject: string;
  students: number;
  batches: number;
  examiners: DutyTableExaminer[];
}

export interface DutyTableSource extends DutySource {
  assignments: readonly (DutySource['assignments'][number] & { seat_role: string })[];
  faculty: readonly { id: string; title: string; name: string; college_data_id: string }[];
}

export function dutyTableRows(src: DutyTableSource): DutyTableRow[] {
  const college = new Map(src.colleges.map((c) => [c.id, c]));
  const faculty = new Map(src.faculty.map((f) => [f.id, f]));
  const subject = new Map(src.subjects.map((s) => [s.code, s.name]));
  const rows = new Map<string, DutyTableRow>();

  for (const t of src.timetable) {
    const k = `${t.exam_date}|${t.centre_id}|${t.subject_code}`;
    const c = college.get(t.centre_id);
    const r = rows.get(k) ?? {
      date: t.exam_date,
      centreCode: c?.code ?? '',
      centreName: collegeName(c),
      subjectCode: t.subject_code,
      subject: subject.get(t.subject_code) ?? t.subject_code,
      students: 0,
      batches: 0,
      examiners: [],
    };
    r.students += t.students ?? 0;
    r.batches += 1;
    rows.set(k, r);
  }

  for (const a of src.assignments) {
    if (a.status !== 'active') continue;
    const k = `${a.exam_date}|${a.centre_id}|${a.subject_code}`;
    let r = rows.get(k);
    if (!r) {
      // A duty without a timetable row (should not happen, but never hide it).
      const c = college.get(a.centre_id);
      r = {
        date: a.exam_date,
        centreCode: c?.code ?? '',
        centreName: collegeName(c),
        subjectCode: a.subject_code,
        subject: subject.get(a.subject_code) ?? a.subject_code,
        students: 0,
        batches: 0,
        examiners: [],
      };
      rows.set(k, r);
    }
    const f = faculty.get(a.faculty_id);
    r.examiners.push({
      role: a.seat_role === 'senior' ? 'senior' : 'junior',
      name: f ? `${f.title} ${f.name}` : 'Unknown',
      collegeCode: f ? college.get(f.college_data_id)?.code ?? '' : '',
    });
  }

  for (const r of rows.values()) {
    r.examiners.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'senior' ? -1 : 1));
  }
  return [...rows.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.centreCode.localeCompare(b.centreCode) || a.subjectCode.localeCompare(b.subjectCode),
  );
}
