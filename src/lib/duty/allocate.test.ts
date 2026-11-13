import { describe, expect, it } from 'vitest';
import { allocate, buildSlots, DEFAULT_RULES, seatsFor, type AllocFaculty, type AllocationInput } from './allocate';

const PY = 'DSC-C-BCA-353P';
const PHP = 'DSC-M-BCA-355P';

let n = 0;
const fac = (collegeId: string, isSenior: boolean, subjectCodes: string[] = [], extra: Partial<AllocFaculty> = {}): AllocFaculty => ({
  id: `f${++n}`,
  collegeId,
  isSenior,
  isVisiting: false,
  isAvailable: true,
  subjectCodes,
  ...extra,
});

function input(over: Partial<AllocationInput> = {}): AllocationInput {
  return {
    slots: [],
    centres: [],
    faculty: [],
    rules: DEFAULT_RULES,
    practicalCodes: [PY, PHP],
    ...over,
  };
}

const slot = (date: string, centreId: string, subjectCode = PY) => ({ date, centreId, subjectCode, students: 60, batches: 1 });

describe('seatsFor', () => {
  it('uses the PC threshold', () => {
    expect(seatsFor(79, DEFAULT_RULES)).toEqual({ senior: 1, junior: 1 });
    expect(seatsFor(80, DEFAULT_RULES)).toEqual({ senior: 1, junior: 2 });
    expect(seatsFor(null, DEFAULT_RULES)).toEqual({ senior: 1, junior: 1 });
  });
});

describe('allocate', () => {
  it('gives every senior a duty before any junior gets one', () => {
    // 2 centres x 2 days, 1+1 seats each = 4 senior + 4 junior seats.
    const centres = [{ id: 'A', pcs: 60 }, { id: 'B', pcs: 60 }];
    const slots = [slot('d1', 'A'), slot('d1', 'B'), slot('d2', 'A'), slot('d2', 'B')];
    const seniors = Array.from({ length: 6 }, (_, i) => fac(i % 2 ? 'C' : 'D', true, [PY]));
    const juniors = Array.from({ length: 6 }, () => fac('C', false, [PY]));
    const r = allocate(input({ slots, centres, faculty: [...seniors, ...juniors] }));

    expect(r.unfilled).toEqual([]);
    expect(r.seniorsWithoutDuty).toEqual([]);
    // 6 seniors for 8 seats: all 6 seniors used, so only 2 junior duties.
    const juniorIds = new Set(juniors.map((j) => j.id));
    expect(r.duties.filter((d) => juniorIds.has(d.facultyId))).toHaveLength(2);
    // Seniors who overflow sit in junior seats.
    expect(r.duties.filter((d) => d.seatRole === 'junior' && !juniorIds.has(d.facultyId))).toHaveLength(2);
  });

  it('never breaks the hard rules', () => {
    const centres = ['A', 'B', 'C', 'D'].map((id) => ({ id, pcs: 100 }));
    const dates = ['d1', 'd2', 'd3'];
    const slots = dates.flatMap((d) => centres.map((c) => slot(d, c.id, c.id < 'C' ? PY : PHP)));
    const faculty = ['A', 'B', 'C', 'D'].flatMap((c) => [fac(c, true, [PY]), fac(c, false, [PHP]), fac(c, false, []), fac(c, false, [PY])]);
    const blocked = new Map([[faculty[0].id, new Set(['B'])]]);
    const r = allocate(input({ slots, centres, faculty, blocked }));

    const byId = new Map(faculty.map((f) => [f.id, f]));
    const perDay = new Set<string>();
    const per = new Map<string, number>();
    for (const d of r.duties) {
      expect(byId.get(d.facultyId)!.collegeId).not.toBe(d.centreId);
      const k = `${d.facultyId}|${d.date}`;
      expect(perDay.has(k)).toBe(false);
      perDay.add(k);
      per.set(d.facultyId, (per.get(d.facultyId) ?? 0) + 1);
      if (d.facultyId === faculty[0].id) expect(d.centreId).not.toBe('B');
    }
    for (const c of per.values()) expect(c).toBeLessThanOrEqual(DEFAULT_RULES.maxDuties);
    expect(r.stats.filled + r.unfilled.length).toBe(r.stats.seats);
  });

  it('allocates only faculty who teach the practical', () => {
    const centres = [{ id: 'A', pcs: 60 }];
    const teacher = fac('B', false, [PY]);
    const other = fac('B', false, ['DSC-C-BCA-351T']);
    const senior = fac('C', true, [PY]);
    const r = allocate(input({ slots: [slot('d1', 'A')], centres, faculty: [other, teacher, senior] }));
    expect(r.duties.map((d) => [d.facultyId, d.tier])).toEqual([
      [senior.id, 'subject'],
      [teacher.id, 'subject'],
    ]);

    // With no subject teacher left, the seat stays empty for the
    // chairperson to fill by hand; nobody who does not teach it is used.
    const r2 = allocate(input({ slots: [slot('d1', 'A')], centres, faculty: [other, senior] }));
    expect(r2.duties.map((d) => d.facultyId)).toEqual([senior.id]);
    expect(r2.unfilled).toEqual([{ date: 'd1', centreId: 'A', subjectCode: PY, seatRole: 'junior' }]);
  });

  it('never gives one person two duties on a day, even when two colleges list them', () => {
    const centres = [{ id: 'A', pcs: 60 }, { id: 'B', pcs: 60 }, { id: 'C', pcs: 60 }];
    // Same person, listed by college B and college C.
    const atB = fac('B', true, [PY], { personKey: 'asha mehta' });
    const atC = fac('C', true, [PY], { personKey: 'asha mehta' });
    const r = allocate(input({ slots: [slot('d1', 'A'), slot('d1', 'B')], centres, faculty: [atB, atC] }));
    // One duty that day, and never at B or C (both are her colleges).
    expect(r.duties).toHaveLength(1);
    expect(r.duties[0].centreId).toBe('A');
    expect(r.stats.examiners).toBe(1);
  });

  it('spreads duties up to the preferred count before going higher', () => {
    const centres = [{ id: 'A', pcs: 60 }];
    const slots = ['d1', 'd2', 'd3', 'd4'].map((d) => slot(d, 'A'));
    const s1 = fac('B', true, [PY]);
    const s2 = fac('B', true, [PY]);
    const j1 = fac('B', false, [PY]);
    const r = allocate(input({ slots, centres, faculty: [s1, s2, j1] }));
    const count = (id: string) => r.duties.filter((d) => d.facultyId === id).length;
    // 8 seats, 3 people: spread as evenly as possible (3, 3, 2), never 4/4/0.
    expect([s1, s2, j1].map((f) => count(f.id)).sort()).toEqual([2, 3, 3]);
    expect(r.unfilled).toEqual([]);
    expect(r.stats.abovePreferred).toBe(2);

    // With enough people nobody goes above the preferred count.
    const more = [fac('B', true, [PY]), fac('B', true, [PY]), fac('B', false, [PY]), fac('B', false, [PY])];
    const r2 = allocate(input({ slots, centres, faculty: more }));
    expect(more.map((f) => r2.duties.filter((d) => d.facultyId === f.id).length)).toEqual([2, 2, 2, 2]);
  });

  it('reports seats it cannot fill instead of breaking a rule', () => {
    const centres = [{ id: 'A', pcs: 60 }];
    const own = fac('A', true, [PY]);
    const r = allocate(input({ slots: [slot('d1', 'A')], centres, faculty: [own] }));
    expect(r.duties).toEqual([]);
    expect(r.unfilled).toHaveLength(2);
    expect(r.seniorsWithoutDuty).toEqual([own.id]);
  });

  it('skips unavailable and (optionally) visiting faculty', () => {
    const centres = [{ id: 'A', pcs: 60 }];
    const away = fac('B', true, [PY], { isAvailable: false });
    const visiting = fac('B', true, [PY], { isVisiting: true });
    const r = allocate(input({ slots: [slot('d1', 'A')], centres, faculty: [away, visiting], rules: { ...DEFAULT_RULES, includeVisiting: false } }));
    expect(r.duties).toEqual([]);
    expect(r.seniorsWithoutDuty).toEqual([]);
  });

  it('keeps hand-made duties and builds around them', () => {
    const centres = [{ id: 'A', pcs: 60 }];
    const s1 = fac('B', true, [PY]);
    const s2 = fac('B', true, [PY]);
    const r = allocate(input({
      slots: [slot('d1', 'A')],
      centres,
      faculty: [s1, s2],
      fixed: [{ date: 'd1', centreId: 'A', subjectCode: PY, facultyId: s2.id, seatRole: 'senior' }],
    }));
    expect(r.duties.find((d) => d.seatRole === 'senior')).toMatchObject({ facultyId: s2.id, fixed: true });
    expect(r.duties.find((d) => d.seatRole === 'junior')).toMatchObject({ facultyId: s1.id, fixed: false });
  });

  it('is repeatable for the same seed', () => {
    const centres = [{ id: 'A', pcs: 100 }, { id: 'B', pcs: 60 }];
    const slots = [slot('d1', 'A'), slot('d1', 'B'), slot('d2', 'A', PHP)];
    const faculty = Array.from({ length: 10 }, (_, i) => fac(i % 2 ? 'C' : 'D', i < 3, [i % 3 ? PY : PHP]));
    const a = allocate(input({ slots, centres, faculty }));
    const b = allocate(input({ slots, centres, faculty }));
    expect(a.duties).toEqual(b.duties);
  });
});

describe('buildSlots', () => {
  it('merges batches of the same practical', () => {
    expect(buildSlots([
      { date: 'd1', centreId: 'A', subjectCode: PY, students: 60 },
      { date: 'd1', centreId: 'A', subjectCode: PY, students: 40 },
      { date: 'd1', centreId: 'B', subjectCode: PY, students: null },
    ])).toEqual([
      { date: 'd1', centreId: 'A', subjectCode: PY, students: 100, batches: 2 },
      { date: 'd1', centreId: 'B', subjectCode: PY, students: 0, batches: 1 },
    ]);
  });
});
