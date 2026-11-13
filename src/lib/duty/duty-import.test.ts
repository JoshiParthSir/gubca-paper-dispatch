import { describe, expect, it } from 'vitest';
import { cleanCollegeCode, parseNameCell } from './names';
import { classifyHeader, parseFormResponses } from './formImport';
import { matchCentres, parseExamDate, parseTimetable, seatCount } from './timetableImport';
import { facultyTier, summarisePools } from './pools';

const names = (cell: unknown) => parseNameCell(cell).names.map((n) => `${n.title} ${n.name}${n.isVisiting ? ' (V)' : ''}`);

describe('parseNameCell', () => {
  it('strips titles in any form and re-cases capitals', () => {
    expect(names('PROF. ASHA MEHTA')).toEqual(['Prof. Asha Mehta']);
    expect(names('Prof.Ravi Desai')).toEqual(['Prof. Ravi Desai']);
    expect(names('DR. KIRAN SHAH')).toEqual(['Dr. Kiran Shah']);
    expect(names('dr ravi joshi')).toEqual(['Dr. Ravi Joshi']);
    expect(names('Jatin modi')).toEqual(['Prof. Jatin Modi']);
    expect(names('Chirag V Makwana')).toEqual(['Prof. Chirag V Makwana']);
    expect(names('Neha McDonald')).toEqual(['Prof. Neha McDonald']);
  });

  it('splits several people and marks visiting faculty', () => {
    expect(names('Asha Mehta, Ravi Desai')).toEqual(['Prof. Asha Mehta', 'Prof. Ravi Desai']);
    expect(names('Asha Mehta & Ravi Desai (Visiting)')).toEqual(['Prof. Asha Mehta', 'Prof. Ravi Desai (V)']);
    expect(names('Prof. Kiran Buch(VF)')).toEqual(['Prof. Kiran Buch (V)']);
    expect(names('Kiran Shah ( Visiting)')).toEqual(['Prof. Kiran Shah (V)']);
  });

  it('skips placeholders with a warning', () => {
    for (const cell of ['NA', 'N/A', 'Visiting', '-']) {
      const r = parseNameCell(cell);
      expect(r.names).toEqual([]);
      expect(r.warnings.length).toBe(1);
    }
  });

  it('flags nicknames and single-word names', () => {
    const r = parseNameCell("PROF. ASHA MA'AM");
    expect(r.names[0].name).toBe('Asha');
    expect(r.warnings[0]).toMatch(/nickname/);
    expect(parseNameCell('Asha').warnings[0]).toMatch(/one word/);
  });

  it('keeps names that merely contain "and"', () => {
    expect(names('Anand Patel')).toEqual(['Prof. Anand Patel']);
  });
});

describe('cleanCollegeCode', () => {
  it('drops the place in brackets', () => {
    expect(cleanCollegeCode('NGCCA (Ashram Road)')).toBe('NGCCA');
    expect(cleanCollegeCode(' ljcca ')).toBe('LJCCA');
    expect(cleanCollegeCode('S P Mahilla College')).toBe('S P Mahilla College');
  });
});

describe('classifyHeader', () => {
  it('reads subject code and name from faculty headers', () => {
    expect(classifyHeader('Names of Faculty(ies) handling the subject of  DSC-C-BCA-353 P : Practical Solutions Using Python'))
      .toEqual({ kind: 'faculty', code: 'DSC-C-BCA-353P', name: 'Practical Solutions Using Python' });
    expect(classifyHeader('Names of Faculty(ies) handling the subject of DSC-C-BCA-351T : System Analysis: Design & Development'))
      .toEqual({ kind: 'faculty', code: 'DSC-C-BCA-351T', name: 'System Analysis: Design & Development' });
    expect(classifyHeader('Name of the faculty(ies) handling the subject of SEC-356')).toMatchObject({ kind: 'faculty', code: 'SEC-356' });
    expect(classifyHeader('Names of subject offered in SEC-356')).toEqual({ kind: 'elective' });
  });
});

const HEADERS = [
  'Timestamp',
  'Name of your College:',
  'Total Number of Students in Semester 5:',
  'Total Number of Computers for the practical examination to be conducted. (Please give the maximum number)',
  'Names of Faculty(ies) handling the subject of DSC-C-BCA-352 T : Problem Solving Using Python',
  'Names of Faculty(ies) handling the subject of  DSC-C-BCA-353 P : Practical Solutions Using Python',
  'Names of Faculty(ies) handling the subject of  DSC-M-BCA-355 P : Web Applications Development using PHP',
  'Mail Id  for examination related communication',
];

describe('parseFormResponses', () => {
  const form = parseFormResponses([
    HEADERS,
    [new Date('2026-08-29T10:00:00'), 'AAA', 100, 60, 'Asha Mehta', 'PROF. ASHA MEHTA', 'Ravi Desai', 'a@x.in'],
    [new Date('2026-08-30T10:00:00'), 'BBB (City)', 50, 40, 'Kiran Shah', 'Kiran Shah, Nita Rao', 'NA', 'b@x.in'],
    [new Date('2026-08-31T10:00:00'), 'aaa', 120, 70, 'Asha Mehta', 'Asha Mehta', 'Ravi Desai, Meena Iyer', 'a2@x.in'],
  ]);

  it('finds subjects and marks practicals', () => {
    expect(form.subjects.map((s) => [s.code, s.isPractical])).toEqual([
      ['DSC-C-BCA-352T', false],
      ['DSC-C-BCA-353P', true],
      ['DSC-M-BCA-355P', true],
    ]);
  });

  it('keeps only the latest response per college', () => {
    const a = form.colleges.find((c) => c.code === 'AAA')!;
    expect(a.responses).toBe(2);
    expect(a.pcs).toBe(70);
    expect(a.email).toBe('a2@x.in');
    expect(form.warnings.some((w) => w.college === 'AAA' && /latest/.test(w.message))).toBe(true);
  });

  it('merges one person across subjects and keeps theory-only faculty', () => {
    const a = form.colleges.find((c) => c.code === 'AAA')!;
    expect(a.faculty.map((f) => [f.name, f.subjectCodes])).toEqual([
      ['Asha Mehta', ['DSC-C-BCA-352T', 'DSC-C-BCA-353P']],
      ['Ravi Desai', ['DSC-M-BCA-355P']],
      ['Meena Iyer', ['DSC-M-BCA-355P']],
    ]);
    const b = form.colleges.find((c) => c.code === 'BBB')!;
    expect(b.faculty.map((f) => f.name)).toEqual(['Kiran Shah', 'Nita Rao']);
  });
});

describe('timetable', () => {
  it('parses Indian date formats', () => {
    expect(parseExamDate('18-11-2026')).toBe('2026-11-18');
    expect(parseExamDate('18/11/26')).toBe('2026-11-18');
    expect(parseExamDate('18-Nov-26')).toBe('2026-11-18');
    expect(parseExamDate('18 November 2026')).toBe('2026-11-18');
    expect(parseExamDate('2026-11-18')).toBe('2026-11-18');
    expect(parseExamDate(new Date(2026, 10, 18))).toBe('2026-11-18');
    expect(parseExamDate(46344)).toBe('2026-11-18');
    expect(parseExamDate('31-02-2026')).toBeNull();
  });

  it('counts seats', () => {
    expect(seatCount('1001', '1060')).toBe(60);
    expect(seatCount('BCA101', 'BCA160')).toBe(60);
    expect(seatCount('', '10')).toBeNull();
  });

  it('reads rows and lists the practical subjects', () => {
    const t = parseTimetable([
      ['Date', 'Centre', 'Subject Code', 'Batch', 'Seat From', 'Seat To'],
      ['18-11-2026', 'AAA', 'DSC-C-BCA-353 P', '1', '1001', '1060'],
      ['19-11-2026', 'bbb', 'DSC-M-BCA-355P', '1', '2001', '2040'],
      ['bad date', 'AAA', 'DSC-C-BCA-353P', '2', '1', '2'],
    ]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toMatchObject({ date: '2026-11-18', centreCode: 'AAA', subjectCode: 'DSC-C-BCA-353P', students: 60 });
    expect(t.subjectCodes).toEqual(['DSC-C-BCA-353P', 'DSC-M-BCA-355P']);
    expect(t.warnings).toHaveLength(1);
  });

  it('links centres, flagging near-miss spellings', () => {
    const colleges = [
      { key: 'LJCCA', email: 'info@lj.in' },
      { key: 'PRSDTBCA', email: null },
      { key: 'LCCA', email: 'x@yahoo.com' },
      { key: 'AAKMS', email: 'CCCA.BCA2009@GMAIL.COM' },
      { key: 'KHYATIBCA', email: null },
      { key: 'UCCA', email: 'principal.kdpatelumiyabca@gmail.com' },
    ];
    expect(matchCentres(['LJCCA', 'PRSTDBCA', 'CCCA', 'KHYATI', 'UMIYABCA', 'XYZ', 'NGCCA'], colleges)).toEqual([
      { centreCode: 'LJCCA', collegeKey: 'LJCCA', confidence: 'exact' },
      { centreCode: 'PRSTDBCA', collegeKey: 'PRSDTBCA', confidence: 'check' },
      // Short codes one letter apart (CCCA / LCCA) are never guessed; the email links it.
      { centreCode: 'CCCA', collegeKey: 'AAKMS', confidence: 'check' },
      { centreCode: 'KHYATI', collegeKey: 'KHYATIBCA', confidence: 'check' },
      { centreCode: 'UMIYABCA', collegeKey: 'UCCA', confidence: 'check' },
      { centreCode: 'XYZ', collegeKey: null, confidence: 'none' },
      { centreCode: 'NGCCA', collegeKey: null, confidence: 'none' },
    ]);
  });
});

describe('pools', () => {
  const practicals = ['DSC-C-BCA-353P', 'DSC-M-BCA-355P'];
  it('prefers subject teachers but keeps everyone', () => {
    expect(facultyTier(['DSC-C-BCA-353P'], 'DSC-C-BCA-353P', practicals)).toBe('subject');
    expect(facultyTier(['DSC-M-BCA-355P'], 'DSC-C-BCA-353P', practicals)).toBe('practical');
    expect(facultyTier(['DSC-C-BCA-351T'], 'DSC-C-BCA-353P', practicals)).toBe('backup');
    expect(summarisePools([{ subjectCodes: ['DSC-C-BCA-353P'] }, { subjectCodes: [] }], practicals)).toEqual([
      { subjectCode: 'DSC-C-BCA-353P', subject: 1, practical: 0, backup: 1 },
      { subjectCode: 'DSC-M-BCA-355P', subject: 0, practical: 1, backup: 1 },
    ]);
  });
});
