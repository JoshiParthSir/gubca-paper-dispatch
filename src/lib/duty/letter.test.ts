import { describe, expect, it } from 'vitest';
import {
  buildLetter,
  dutiesMatch,
  dutyRowsByFaculty,
  fillPlaceholders,
  hasActiveDuty,
  rowCentre,
  letterFileNames,
  letterText,
  nextRefNumbers,
  printCode,
  readLetterContent,
  tableSubject,
  type LetterDutyRow,
} from './letter';
import {
  CHANGE_WORDS,
  DEFAULT_TEMPLATE,
  examMonthFromDates,
  findChangeWords,
  fmtLetterDate,
  fmtLongDate,
  latestContacts,
  missingSettings,
  readContacts,
  readLetterSettings,
  semesterFromCodes,
  yearOfSemester,
} from './letterSettings';
import { collegeAliases, matchMasterCollege, masterKeys, parseOtherCodes } from './collegeLink';
import { dutyTableRows } from './dutyTable';

const auto = {
  subjectCodes: ['DSC-C-BCA-353P', 'DSC-M-BCA-355P'],
  dates: ['2026-11-03', '2026-11-02'],
  chairName: 'Dr. Chair Person',
  today: '2026-11-13',
};

const settings = () => readLetterSettings({ ratePerStudent: 15, billLastDate: '2026-11-05' }, { ...auto, examTitle: 'BCA Sem 5 ATKT Oct 2026' });

const contacts = () => readContacts({
  contacts: {
    chairperson: { name: 'Dr. Anuradha Sharma', college: 'L.J.C.C.A', phone: '96382 62644' },
    coordinators: [
      { name: 'Dr. Prakash Khuman', college: 'L.C.C.A.', phone: '9898984466' },
      { name: 'Prof. Second Coordinator', college: 'NGCCA', phone: '9800000000' },
    ],
    email: 'guniv.bca.exam@gmail.com',
    savedAt: '2026-11-13T10:00:00Z',
  },
});

const row = (over: Partial<LetterDutyRow> = {}): LetterDutyRow => ({
  date: '2026-10-26',
  centreCode: 'LJCCA',
  centreName: 'L.J. College of Computer Applications',
  subjectCode: 'DSC-C-BCA-353P',
  subject: 'Practical Solutions using Python',
  students: 120,
  batches: 2,
  ...over,
});

describe('letter settings', () => {
  it('fills semester and exam month from the timetable', () => {
    const s = settings();
    expect(s.semesterLabel).toBe('Semester 5');
    expect(s.examMonth).toBe('November 2026');
    expect(s.issueDate).toBe('2026-11-13');
    expect(s.examName).toBe('ATKT Practical Examination');
    expect(readLetterSettings({}, { ...auto, examTitle: 'BCA Sem 5 Nov 2026' }).examName).toBe('Practical Examination');
  });

  it('keeps what the chairperson saved over auto values', () => {
    const s = readLetterSettings({ semesterLabel: 'Sem 5 (NEP)', examMonth: 'Nov 2026' }, auto);
    expect(s.semesterLabel).toBe('Sem 5 (NEP)');
    expect(s.examMonth).toBe('Nov 2026');
  });

  it('carries the format, exam name, time and rate over from the previous exam', () => {
    const prev = {
      examName: 'ATKT Practical Examination',
      examTime: '2:00 to 4:00 pm',
      ratePerStudent: 20,
      semesterLabel: 'Semester 3',
      template: { ...DEFAULT_TEMPLATE, salutation: 'Respected Sir/ Madam,' },
    };
    const s = readLetterSettings({}, auto, prev);
    // The exam name is per exam: from this exam's title, not the previous exam.
    expect(s.examName).toBe('Practical Examination');
    expect(s.examTime).toBe('2:00 to 4:00 pm');
    expect(s.ratePerStudent).toBe(20);
    expect(s.template.salutation).toBe('Respected Sir/ Madam,');
    // Exam-specific values are not carried over.
    expect(s.semesterLabel).toBe('Semester 5');
  });

  it('ignores a template saved in the old letter format', () => {
    const s = readLetterSettings({ template: { subjectLine: 'old', opening: 'Dear {{title}} {{name}}', guidelines: ['x'] } }, auto);
    expect(s.template).toEqual(DEFAULT_TEMPLATE);
  });

  it('reads the semester from GU codes', () => {
    expect(semesterFromCodes(['DSC-C-BCA-353P'])).toBe(5);
    expect(semesterFromCodes(['DSC-C-BCA-141P', 'DSC-C-BCA-142P'])).toBe(4);
    expect(semesterFromCodes(['SEC-356'])).toBe(5);
    expect(semesterFromCodes([])).toBeNull();
    expect(yearOfSemester('Semester 5')).toBe('Third');
  });

  it('writes the exam month across months', () => {
    expect(examMonthFromDates(['2026-11-30', '2026-12-01'])).toBe('November - December 2026');
    expect(examMonthFromDates([])).toBe('');
  });

  it('lists what is missing', () => {
    expect(missingSettings(readLetterSettings({}, auto), readContacts({})))
      .toEqual(expect.arrayContaining(['Chairperson name', 'At least one coordinator', 'Bill last date']));
    expect(missingSettings(settings(), contacts())).toEqual([]);
  });
});

describe('contacts', () => {
  it('uses the latest saved list from any exam', () => {
    const older = { contacts: { chairperson: { name: 'Old Chair' }, coordinators: [], savedAt: '2026-01-01T00:00:00Z' } };
    const newer = { contacts: { chairperson: { name: 'New Chair' }, coordinators: [{ name: 'A' }, { name: 'B' }], savedAt: '2026-11-01T00:00:00Z' } };
    const c = latestContacts([{}, newer, older, null]);
    expect(c.chairperson.name).toBe('New Chair');
    expect(c.coordinators.map((x) => x.name)).toEqual(['A', 'B']);
  });

  it('reads the old single chairperson / coordinator settings', () => {
    const c = readContacts({ chairperson: { name: 'Dr. X' }, coordinator: { name: 'Prof. Y', phone: '1' } });
    expect(c.chairperson.name).toBe('Dr. X');
    expect(c.coordinators).toEqual([expect.objectContaining({ name: 'Prof. Y', phone: '1' })]);
  });
});

describe('buildLetter', () => {
  const build = (duties = [row()]) =>
    buildLetter({
      faculty: { title: 'Prof.', name: 'Parth Joshi' },
      college: { code: 'LJCCA', fullName: 'L.J. College of Computer Applications' },
      duties,
      settings: settings(),
      contacts: contacts(),
      refNo: 'GU/BCA/PR/2026/001',
    });

  it('follows the Gujarat University format', () => {
    const c = build();
    expect(letterText(c)).not.toMatch(/\{\{/);
    expect(c.letterhead).toEqual(['GUJARAT UNIVERSITY', 'Ahmedabad - 380009']);
    expect(c.confidential).toBe('Confidential');
    expect(c.refLine).toBe('Ref. Examination BS (B.C.A.) Semester 5 NEP 2020, November 2026');
    expect(c.toLines).toEqual(['To,', 'Parth Joshi,', 'L.J. College of Computer Applications.']);
    expect(c.subjectLine).toBe('ATKT Practical Examination of BS(B.C.A.) Semester 5 NEP 2020, November 2026 to be conducted by Gujarat University.');
    expect(c.opening).toBe('You are requested to conduct the ATKT Practical Examination for BS (B.C.A.) Semester 5 NEP 2020 as per the following Schedule.');
    expect(c.examTime).toBe('11:00 to 1:00 pm');
    expect(c.guidelinesHeading.slice(1)).toEqual(['General guidelines for Computer ATKT Practical Examinations of Gujarat University at Third Year', 'Semester-5 NEP 2020']);
    expect(c.guidelines[2]).toContain('Practical Solutions using Python Practical (DSC-C-BCA-353 P) has to be');
    expect(c.guidelines[c.guidelines.length - 1]).toContain('by the 05th of November, 2026.');
    expect(c.billNote).toBe('Total Amount = No. of students x 15 Rs.');
    expect(c.showRefAndDate).toBe(false);
  });

  it('prints the chairperson and every coordinator', () => {
    const c = build();
    // Designation is printed only when the chairperson typed one.
    expect(c.contacts.map((p) => [p.name, p.designation])).toEqual([
      ['Dr. Anuradha Sharma', ''],
      ['Dr. Prakash Khuman', ''],
      ['Prof. Second Coordinator', ''],
    ]);
    expect(c.contactEmail).toBe('guniv.bca.exam@gmail.com');
  });

  it('formats dates, codes and subjects like GU', () => {
    expect(fmtLetterDate('2026-10-26')).toBe('26 Oct 2026');
    expect(fmtLongDate('2026-11-05')).toBe('05th of November, 2026');
    expect(printCode('DSC-C-BCA-353P')).toBe('DSC-C-BCA-353 P');
    expect(tableSubject('Practical Solutions using Python')).toBe('Practical Solutions using Python Practical');
    expect(tableSubject('Web Practical')).toBe('Web Practical');
  });

  it('joins several subjects and sorts duties by date', () => {
    const c = build([
      row({ date: '2026-10-27', subjectCode: 'DSC-C-BCA-355P', subject: 'Web Applications Development using PHP' }),
      row(),
    ]);
    expect(c.duties.map((d) => d.date)).toEqual(['2026-10-26', '2026-10-27']);
    expect(c.guidelines[2]).toContain('Python Practical (DSC-C-BCA-353 P) and Web Applications Development using PHP Practical (DSC-C-BCA-355 P)');
    expect(c.guidelines[2]).toContain('Distribution of marks for DSC-C-BCA-353 P and DSC-C-BCA-355 P is');
  });

  it('never says what changed (rule 5)', () => {
    expect(findChangeWords(letterText(build()))).toEqual([]);
    const t = DEFAULT_TEMPLATE;
    const all = [t.refLine, t.subjectLine, t.opening, t.afterTable, t.closing, ...t.guidelines].join(' ').toLowerCase();
    for (const w of [...CHANGE_WORDS, 'change', 'cancel', 'replace']) expect(all).not.toContain(w);
  });

  it('spots change words typed by hand', () => {
    expect(findChangeWords('This is a Revised letter in  place of the earlier one')).toEqual(['revised', 'in place of']);
  });

  it('leaves unknown placeholders visible', () => {
    expect(fillPlaceholders('Hi {{name}} {{nope}}', { name: 'A' })).toBe('Hi A {{nope}}');
  });

  it('reads letters saved in the old format', () => {
    const c = readLetterContent({ to: { title: 'Dr.', name: 'A B', college: 'X' }, signatory: { name: 'Chair' }, coordinator: { name: 'Co' }, opening: 'Hi' });
    expect(c.toLines).toEqual(['To,', 'Dr. A B', 'X']);
    expect(c.contacts.map((p) => p.name)).toEqual(['Chair', 'Co']);
    expect(c.showRefAndDate).toBe(true);
  });
});

describe('duty rows', () => {
  const src = {
    assignments: [
      { faculty_id: 'f1', exam_date: '2026-11-03', centre_id: 'c2', subject_code: 'P2', status: 'active', seat_role: 'junior' },
      { faculty_id: 'f1', exam_date: '2026-11-02', centre_id: 'c2', subject_code: 'P1', status: 'active', seat_role: 'senior' },
      { faculty_id: 'f1', exam_date: '2026-11-04', centre_id: 'c2', subject_code: 'P1', status: 'cancelled', seat_role: 'senior' },
    ],
    timetable: [
      { exam_date: '2026-11-02', centre_id: 'c2', subject_code: 'P1', students: 60 },
      { exam_date: '2026-11-02', centre_id: 'c2', subject_code: 'P1', students: 55 },
      { exam_date: '2026-11-03', centre_id: 'c2', subject_code: 'P2', students: 40 },
    ],
    colleges: [
      { id: 'c1', code: 'LJCCA', full_name: null, raw_name: 'LJCCA' },
      { id: 'c2', code: 'NGCCA', full_name: 'Navgujarat College', raw_name: 'NGCCA' },
    ],
    subjects: [{ code: 'P1', name: 'Python' }, { code: 'P2', name: 'PHP' }],
    faculty: [{ id: 'f1', title: 'Dr.', name: 'A B', college_data_id: 'c1' }],
  };

  it('lists active duties, and cancelled days marked as cancelled', () => {
    const rows = dutyRowsByFaculty(src).get('f1')!;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-11-02', centreName: 'Navgujarat College', subject: 'Python', students: 115, batches: 2 });
    expect(rows.map((r) => !!r.cancelled)).toEqual([false, false, true]);
    expect(rowCentre(rows[2])).toBe('Cancelled');
    expect(rowCentre(rows[0])).toBe('NGCCA');
    expect(hasActiveDuty(rows)).toBe(true);
    expect(hasActiveDuty(rows.slice(2))).toBe(false);
  });

  it('shows a day given back to the same examiner once, as active', () => {
    const again = { ...src, assignments: [...src.assignments, { faculty_id: 'f1', exam_date: '2026-11-04', centre_id: 'c2', subject_code: 'P1', status: 'active', seat_role: 'senior' }] };
    const rows = dutyRowsByFaculty(again).get('f1')!;
    expect(rows.filter((r) => r.date === '2026-11-04').map((r) => !!r.cancelled)).toEqual([false]);
  });

  it('detects a letter that no longer matches the duties', () => {
    const rows = dutyRowsByFaculty(src).get('f1')!;
    expect(dutiesMatch(rows, [...rows].reverse())).toBe(true);
    expect(dutiesMatch(rows.slice(0, 2), rows)).toBe(false);
    expect(dutiesMatch([{ ...rows[0], centreName: 'typed by hand' }, rows[1], rows[2]], rows)).toBe(true);
    // A day that became cancelled no longer matches.
    expect(dutiesMatch([rows[0], rows[1], { ...rows[2], cancelled: undefined }], rows)).toBe(false);
  });

  it('builds the duty table', () => {
    const t = dutyTableRows(src);
    expect(t).toHaveLength(2);
    expect(t[0].examiners).toEqual([{ role: 'senior', name: 'Dr. A B', collegeCode: 'LJCCA' }]);
  });
});

describe('letter numbers and file names', () => {
  it('continues after the highest number and never reuses one', () => {
    expect(nextRefNumbers([], 'GU/', 2)).toEqual(['GU/001', 'GU/002']);
    expect(nextRefNumbers(['GU/007', 'GU/003', 'X/099'], 'GU/', 1)).toEqual(['GU/008']);
  });

  it('gives clashing names a suffix', () => {
    const l = (name: string, collegeCode: string) => ({ to: { name, collegeCode } });
    expect(letterFileNames([l('Niku Brahmbhatt', 'LJCCA'), l('Niku  Brahmbhatt', 'LJCCA'), l("D'Souza J.", 'S P Mahilla College')]))
      .toEqual(['LJCCA_Niku_Brahmbhatt.pdf', 'LJCCA_Niku_Brahmbhatt_2.pdf', 'S_P_Mahilla_College_D_Souza_J.pdf']);
  });
});

describe('college links', () => {
  // Codes as stored in the colleges table.
  const master = [
    { id: '1', code: 'AAKMS (CCCA)', name: 'Akhil Anjana' },
    { id: '2', code: 'KDPICA (UCCA)', name: 'K D Patel' },
    { id: '3', code: 'NAVGUJBCA  (Gandhingar)', name: 'Navgujarat' },
    { id: '4', code: 'LJCCA', name: 'L J' },
    { id: '5', code: 'LCCA', name: 'Lokmanya' },
    { id: '6', code: 'KHYATIBCA', name: 'Khyati' },
  ];

  it('reads bracketed old codes but not places', () => {
    expect(masterKeys('AAKMS (CCCA)')).toEqual(['AAKMS', 'CCCA']);
    expect(masterKeys('NAVGUJBCA  (Gandhingar)')).toEqual(['NAVGUJBCA']);
  });

  it('links by code or by the old code', () => {
    expect(matchMasterCollege('AAKMS', master)?.id).toBe('1');
    expect(matchMasterCollege('CCCA', master)?.id).toBe('1');
    expect(matchMasterCollege('UCCA', master)?.id).toBe('2');
    expect(matchMasterCollege('NAVGUJBCA', master)?.id).toBe('3');
    expect(matchMasterCollege('LCCA', master)?.id).toBe('5');
    expect(matchMasterCollege('S P Mahilla College', master)).toBeNull();
  });

  it('links a code that is the start of the account code', () => {
    expect(matchMasterCollege('KHYATI', master)?.id).toBe('6');
    expect(collegeAliases('AAKMS', master)).toEqual(['AAKMS', 'CCCA']);
    expect(collegeAliases('KHYATI', master)).toEqual(['KHYATI', 'KHYATIBCA']);
  });

  it('uses the other codes typed by the chairperson', () => {
    expect(parseOtherCodes(' ccca, U.C.C.A /ccca ')).toEqual(['CCCA', 'UCCA']);
    expect(matchMasterCollege('NEWNAME', master, ['LCCA'])?.id).toBe('5');
    expect(collegeAliases('NEWNAME', master, ['LCCA'])).toEqual(['NEWNAME', 'LCCA']);
  });
});
