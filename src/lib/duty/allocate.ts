// Practical examiner allocation.
//
// Order of filling (the chairperson's rule: no junior gets a duty until
// every senior has one):
//   1. Senior seats   <- seniors, those with no duty first.
//   2. Junior seats   <- seniors who still have no duty.
//   3. Junior seats   <- juniors, those with no duty first.
//   4. Any empty seat <- anyone eligible, up to the maximum duties.
// Only faculty who teach the practical are used; a seat with no free
// teacher of that subject stays empty for the chairperson to fill by hand.
// Within each step candidates are ranked by fewest duties so far, then a
// seeded tie-break so a re-run gives the same result. Each
// step first allows one duty, then up to the preferred count, and only
// then up to the maximum, so the load stays spread.
//
// Hard rules (never broken by the automatic run):
//   - only faculty who teach this practical
//   - one duty per examiner per day (the same person listed by two
//     colleges counts as one examiner)
//   - never above the maximum duties
//   - not at their own college (when the rule is on)
//   - not at a centre the chairperson blocked for them
//   - not if marked unavailable, or visiting while visiting is excluded

import { facultyTier, type PoolTier } from './pools';

export interface AllocationRules {
  /** Centres with at least this many PCs get the "large" seat counts. */
  pcThreshold: number;
  smallSeniors: number;
  smallJuniors: number;
  largeSeniors: number;
  largeJuniors: number;
  preferredDuties: number;
  maxDuties: number;
  avoidOwnCollege: boolean;
  includeVisiting: boolean;
  /** Seed for tie-breaks. Same seed + same data = same allocation. */
  seed: number;
}

export const DEFAULT_RULES: AllocationRules = {
  pcThreshold: 80,
  smallSeniors: 1,
  smallJuniors: 1,
  largeSeniors: 1,
  largeJuniors: 2,
  preferredDuties: 2,
  maxDuties: 4,
  avoidOwnCollege: true,
  includeVisiting: true,
  seed: 1,
};

export interface AllocFaculty {
  id: string;
  /**
   * The same person can be listed by two colleges (e.g. visiting faculty).
   * Records with the same key are one person: one duty a day, one duty
   * count, and none of their colleges. Defaults to the id.
   */
  personKey?: string;
  /** duty_college_data id of their college. */
  collegeId: string;
  isSenior: boolean;
  isVisiting: boolean;
  isAvailable: boolean;
  subjectCodes: readonly string[];
}

export interface AllocCentre {
  /** duty_college_data id of the centre. */
  id: string;
  pcs: number | null;
}

/** One practical at one centre on one day (all its batches together). */
export interface AllocSlot {
  date: string;
  centreId: string;
  subjectCode: string;
  students: number;
  batches: number;
}

export interface FixedDuty {
  date: string;
  centreId: string;
  subjectCode: string;
  facultyId: string;
  seatRole: SeatRole;
}

export type SeatRole = 'senior' | 'junior';

export interface Duty {
  date: string;
  centreId: string;
  subjectCode: string;
  facultyId: string;
  seatRole: SeatRole;
  tier: PoolTier;
  fixed: boolean;
}

export interface UnfilledSeat {
  date: string;
  centreId: string;
  subjectCode: string;
  seatRole: SeatRole;
}

export interface AllocationResult {
  duties: Duty[];
  unfilled: UnfilledSeat[];
  /** Eligible seniors who could not be given any duty. */
  seniorsWithoutDuty: string[];
  stats: {
    seats: number;
    filled: number;
    examiners: number;
    seniorsUsed: number;
    seniorsTotal: number;
    abovePreferred: number;
  };
}

export interface AllocationInput {
  slots: readonly AllocSlot[];
  centres: readonly AllocCentre[];
  faculty: readonly AllocFaculty[];
  rules: AllocationRules;
  /** Practical subject codes in this timetable (for the tiers). */
  practicalCodes: readonly string[];
  /** facultyId -> centre ids they must not be sent to. */
  blocked?: ReadonlyMap<string, ReadonlySet<string>>;
  /** Duties already decided by hand; kept as they are. */
  fixed?: readonly FixedDuty[];
}

export const slotKey = (s: { date: string; centreId: string; subjectCode: string }) =>
  `${s.date}|${s.centreId}|${s.subjectCode}`;

/** Seats a centre needs, from its PCs. */
export function seatsFor(pcs: number | null, rules: AllocationRules): { senior: number; junior: number } {
  return (pcs ?? 0) >= rules.pcThreshold
    ? { senior: rules.largeSeniors, junior: rules.largeJuniors }
    : { senior: rules.smallSeniors, junior: rules.smallJuniors };
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Seat {
  slot: AllocSlot;
  role: SeatRole;
  facultyId: string | null;
}

export function allocate(input: AllocationInput): AllocationResult {
  const { rules, practicalCodes } = input;
  const blocked = input.blocked ?? new Map();
  const random = rng(rules.seed);
  const jitter = new Map(input.faculty.map((f) => [f.id, random()]));
  const pcsOf = new Map(input.centres.map((c) => [c.id, c.pcs]));
  const facultyById = new Map(input.faculty.map((f) => [f.id, f]));

  const people = personIndex(input.faculty);
  const person = people.person;
  const count = new Map<string, number>(); // person -> duties
  const busy = new Map<string, Set<string>>(); // person -> dates
  const duties: Duty[] = [];

  const usable = (f: AllocFaculty) => f.isAvailable && (rules.includeVisiting || !f.isVisiting);

  // Build every seat.
  const seats: Seat[] = [];
  for (const slot of input.slots) {
    const n = seatsFor(pcsOf.get(slot.centreId) ?? null, rules);
    for (let i = 0; i < n.senior; i++) seats.push({ slot, role: 'senior', facultyId: null });
    for (let i = 0; i < n.junior; i++) seats.push({ slot, role: 'junior', facultyId: null });
  }

  const take = (seat: Seat, f: AllocFaculty, fixed: boolean) => {
    seat.facultyId = f.id;
    const p = person(f.id);
    count.set(p, (count.get(p) ?? 0) + 1);
    if (!busy.has(p)) busy.set(p, new Set());
    busy.get(p)!.add(seat.slot.date);
    duties.push({
      date: seat.slot.date,
      centreId: seat.slot.centreId,
      subjectCode: seat.slot.subjectCode,
      facultyId: f.id,
      seatRole: seat.role,
      tier: facultyTier(f.subjectCodes, seat.slot.subjectCode, practicalCodes),
      fixed,
    });
  };

  // Hand-made duties first: they occupy a matching seat (or an extra one).
  for (const fd of input.fixed ?? []) {
    const f = facultyById.get(fd.facultyId);
    if (!f) continue;
    const key = slotKey(fd);
    let seat = seats.find((s) => !s.facultyId && s.role === fd.seatRole && slotKey(s.slot) === key)
      ?? seats.find((s) => !s.facultyId && slotKey(s.slot) === key);
    if (!seat) {
      const slot = input.slots.find((s) => slotKey(s) === key);
      if (!slot) continue;
      seat = { slot, role: fd.seatRole, facultyId: null };
      seats.push(seat);
    }
    take(seat, f, true);
  }

  const teaches = (f: AllocFaculty, seat: Seat) => f.subjectCodes.includes(seat.slot.subjectCode);

  const canSit = (f: AllocFaculty, seat: Seat, limit: number) =>
    usable(f)
    && teaches(f, seat)
    && (count.get(person(f.id)) ?? 0) < limit
    && !busy.get(person(f.id))?.has(seat.slot.date)
    && !(rules.avoidOwnCollege && people.colleges(f.id).has(seat.slot.centreId))
    && !blocked.get(f.id)?.has(seat.slot.centreId);

  // Everyone who can sit teaches the practical; the duty limits passed to
  // fill() keep the load spread.
  const rank = (f: AllocFaculty) => [
    count.get(person(f.id)) ?? 0,
    jitter.get(f.id)!,
  ];
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  /**
   * Fill empty seats of `role` from `pool`. Seats with the fewest eligible
   * candidates are filled first so rare fits are not used up elsewhere.
   */
  const fill = (role: SeatRole | 'any', pool: AllocFaculty[], limit: number, onlyNew = false) => {
    for (;;) {
      let bestSeat: Seat | null = null;
      let bestOptions: AllocFaculty[] = [];
      for (const seat of seats) {
        if (seat.facultyId || (role !== 'any' && seat.role !== role)) continue;
        const options = pool.filter((f) => (!onlyNew || !count.get(person(f.id))) && canSit(f, seat, limit));
        if (!options.length) continue;
        if (!bestSeat || options.length < bestOptions.length) {
          bestSeat = seat;
          bestOptions = options;
        }
      }
      if (!bestSeat) return;
      let pick = bestOptions[0];
      let pickRank = rank(pick);
      for (const f of bestOptions.slice(1)) {
        const r = rank(f);
        if (better(r, pickRank)) {
          pick = f;
          pickRank = r;
        }
      }
      take(bestSeat, pick, false);
    }
  };

  const seniors = input.faculty.filter((f) => f.isSenior && usable(f));
  const juniors = input.faculty.filter((f) => !f.isSenior && usable(f));

  // 1. Senior seats: first one duty each, then up to the preferred count.
  fill('senior', seniors, 1, true);
  // 2. Seniors still without a duty take junior seats before any junior.
  fill('junior', seniors, 1, true);
  fill('senior', seniors, rules.preferredDuties);
  // 3. Juniors up to the preferred count.
  fill('junior', juniors, 1);
  fill('junior', juniors, rules.preferredDuties);
  // 4. Whatever is still empty, up to the maximum.
  fill('senior', seniors, rules.maxDuties);
  fill('junior', [...juniors, ...seniors], rules.preferredDuties);
  fill('junior', [...juniors, ...seniors], rules.maxDuties);

  const unfilled = seats
    .filter((s) => !s.facultyId)
    .map((s) => ({ date: s.slot.date, centreId: s.slot.centreId, subjectCode: s.slot.subjectCode, seatRole: s.role }));

  duties.sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.centreId.localeCompare(b.centreId)
    || a.subjectCode.localeCompare(b.subjectCode)
    || (a.seatRole === b.seatRole ? 0 : a.seatRole === 'senior' ? -1 : 1));

  const examiners = new Set(duties.map((d) => person(d.facultyId)));
  const seniorPeople = [...new Map(seniors.map((f) => [person(f.id), f])).values()];
  return {
    duties,
    unfilled,
    seniorsWithoutDuty: seniorPeople.filter((f) => !examiners.has(person(f.id))).map((f) => f.id),
    stats: {
      seats: seats.length,
      filled: duties.length,
      examiners: examiners.size,
      seniorsUsed: seniorPeople.filter((f) => examiners.has(person(f.id))).length,
      seniorsTotal: seniorPeople.length,
      abovePreferred: [...count.values()].filter((c) => c > rules.preferredDuties).length,
    },
  };
}

/** Group timetable batches into one slot per date + centre + subject. */
export function buildSlots(
  rows: readonly { date: string; centreId: string; subjectCode: string; students: number | null }[],
): AllocSlot[] {
  const map = new Map<string, AllocSlot>();
  for (const r of rows) {
    const key = slotKey(r);
    const s = map.get(key) ?? { date: r.date, centreId: r.centreId, subjectCode: r.subjectCode, students: 0, batches: 0 };
    s.students += r.students ?? 0;
    s.batches += 1;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
}

/** Groups faculty records that are the same person (see AllocFaculty.personKey). */
export function personIndex(faculty: readonly AllocFaculty[]) {
  const personOf = new Map(faculty.map((f) => [f.id, f.personKey || f.id]));
  const collegesOf = new Map<string, Set<string>>();
  for (const f of faculty) {
    const p = personOf.get(f.id)!;
    if (!collegesOf.has(p)) collegesOf.set(p, new Set());
    collegesOf.get(p)!.add(f.collegeId);
  }
  const person = (id: string) => personOf.get(id) ?? id;
  return {
    person,
    /** Every college this record's person belongs to. */
    colleges: (id: string) => collegesOf.get(person(id)) ?? new Set<string>(),
  };
}

/**
 * Rules the automatic run never breaks; used to check hand edits too.
 * Pass `people` so another record of the same person counts as well.
 */
export function checkDuty(
  d: { date: string; centreId: string; facultyId: string },
  faculty: AllocFaculty,
  others: readonly { date: string; facultyId: string }[],
  rules: AllocationRules,
  blocked?: ReadonlySet<string>,
  people?: ReturnType<typeof personIndex>,
): string[] {
  const person = people?.person ?? ((id: string) => id);
  const me = person(d.facultyId);
  const mine = others.filter((o) => person(o.facultyId) === me);
  const colleges = people?.colleges(d.facultyId) ?? new Set([faculty.collegeId]);
  const problems: string[] = [];
  if (mine.some((o) => o.date === d.date)) problems.push('Already has a duty that day');
  if (rules.avoidOwnCollege && colleges.has(d.centreId)) problems.push('Own college');
  if (blocked?.has(d.centreId)) problems.push('Blocked for this centre');
  if (!faculty.isAvailable) problems.push('Marked unavailable');
  if (mine.length >= rules.maxDuties) problems.push('Above maximum duties');
  return problems;
}
