import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Play, Plus, Save, Shuffle } from 'lucide-react';
import { allocate, buildSlots, seatsFor, slotKey, type AllocationResult, type Duty, type UnfilledSeat } from '@/lib/duty/allocate';
import { samePersonKey } from '@/lib/duty/names';
import { facultyTier } from '@/lib/duty/pools';
import { saveAllocation, saveRules, type DutyAssignment, type DutySession, type SessionRules } from '@/lib/duty/store';
import { DutyChangeDialog, type SeatTarget } from './DutyChangeDialog';
import { useLetterBuilder } from './useLetterBuilder';
import { RankBadge, Stat, TierBadge } from './shared';
import { fmtDate, useLookups, type TabProps } from './lookups';

export function AllocateTab({ sessionId, data, reload, onError, rules, published, session }: TabProps & { rules: SessionRules; published: boolean; session: DutySession }) {
  const { toast } = useToast();
  // Hand changes to duties update the letters too.
  const letters = useLetterBuilder(session, data, onError);
  const { college, faculty, subject, practicalCodes } = useLookups(data);
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [seed, setSeed] = useState(rules.seed);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<SeatTarget | null>(null);

  const slots = useMemo(
    () => buildSlots(data.timetable.map((t) => ({ date: t.exam_date, centreId: t.centre_id, subjectCode: t.subject_code, students: t.students }))),
    [data.timetable],
  );
  const active = useMemo(() => data.assignments.filter((a) => a.status === 'active'), [data.assignments]);
  // Cancelled duties stay visible on their day, so the chairperson sees what happened.
  const cancelled = useMemo(() => data.assignments.filter((a) => a.status === 'cancelled'), [data.assignments]);
  const cancelledIn = (s: { date: string; centreId: string; subjectCode: string }) =>
    cancelled.filter((a) => a.exam_date === s.date && a.centre_id === s.centreId && a.subject_code === s.subjectCode);
  const seniors = data.faculty.filter((f) => f.is_senior && f.is_available).length;

  const run = (useSeed = seed) => {
    const blocked = new Map<string, Set<string>>();
    for (const b of rules.blocked) {
      if (!blocked.has(b.facultyId)) blocked.set(b.facultyId, new Set());
      blocked.get(b.facultyId)!.add(b.centreId);
    }
    setResult(allocate({
      slots,
      centres: data.colleges.map((c) => ({ id: c.id, pcs: c.pcs })),
      faculty: data.faculty.map((f) => ({
        id: f.id,
        personKey: samePersonKey(f.name, f.id),
        collegeId: f.college_data_id,
        isSenior: f.is_senior,
        isVisiting: f.is_visiting,
        isAvailable: f.is_available,
        subjectCodes: f.subject_codes,
      })),
      rules: { ...rules, seed: useSeed },
      practicalCodes,
      blocked,
    }));
  };

  const save = async () => {
    if (!result) return;
    const letters = data.letters.length;
    const warn = [
      active.length && `This replaces the ${active.length} saved duties with the new allocation.`,
      letters && `${letters} letter(s) already exist. They are not rebuilt and will show "Check duties" where the duties differ.`,
    ].filter(Boolean);
    if (warn.length && !confirm(`${warn.join(' ')} Continue?`)) return;
    setSaving(true);
    try {
      await saveAllocation(sessionId, result.duties);
      if (seed !== rules.seed) await saveRules(sessionId, { ...rules, seed });
      toast({ title: 'Allocation saved', description: `${result.duties.length} duties.` });
      setResult(null);
      await reload();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  // What to show: a fresh run, or else the saved duties.
  const shown: { duties: Duty[]; unfilled: UnfilledSeat[] } | null = useMemo(() => {
    if (result) return result;
    if (!active.length) return null;
    const duties: Duty[] = active.map((a) => ({
      date: a.exam_date,
      centreId: a.centre_id,
      subjectCode: a.subject_code,
      facultyId: a.faculty_id,
      seatRole: a.seat_role as Duty['seatRole'],
      tier: facultyTier(faculty.get(a.faculty_id)?.subject_codes ?? [], a.subject_code, practicalCodes),
      fixed: false,
    }));
    // Seats the saved allocation leaves empty.
    const unfilled: UnfilledSeat[] = [];
    for (const s of slots) {
      const need = seatsFor(college.get(s.centreId)?.pcs ?? null, rules);
      const here = duties.filter((d) => slotKey(d) === slotKey(s));
      for (const role of ['senior', 'junior'] as const) {
        const missing = need[role] - here.filter((d) => d.seatRole === role).length;
        for (let i = 0; i < missing; i++) unfilled.push({ date: s.date, centreId: s.centreId, subjectCode: s.subjectCode, seatRole: role });
      }
    }
    return { duties, unfilled };
  }, [result, active, faculty, practicalCodes, slots, college, rules]);

  // Saved duties by slot + examiner, so a line can be changed.
  const savedRow = useMemo(() => {
    const m = new Map<string, DutyAssignment>();
    for (const a of active) m.set(`${a.exam_date}|${a.centre_id}|${a.subject_code}|${a.faculty_id}`, a);
    return m;
  }, [active]);
  const editable = !result;

  const byDate = useMemo(() => {
    const dates = [...new Set(slots.map((s) => s.date))].sort();
    return dates.map((date) => ({
      date,
      slots: slots
        .filter((s) => s.date === date)
        .sort((a, b) => (college.get(a.centreId)?.code ?? '').localeCompare(college.get(b.centreId)?.code ?? '')),
    }));
  }, [slots, college]);

  if (!data.timetable.length || !data.faculty.length) {
    return <p className="text-muted-foreground">Import the college data and the timetable first.</p>;
  }

  const stats = shown && {
    seats: shown.duties.length + shown.unfilled.length,
    filled: shown.duties.length,
    examiners: new Set(shown.duties.map((d) => d.facultyId)).size,
    notTeaching: shown.duties.filter((d) => d.tier !== 'subject').length,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Allocate duties</CardTitle>
          <CardDescription>
            Order: senior seats to seniors, then seniors without a duty take junior seats, then juniors. Only faculty who teach the practical are allocated. Where no teacher of the subject is free, the seat stays empty: fill it by hand with anyone you choose.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {seniors === 0 && (
            <Alert variant="destructive">
              <AlertTitle>No seniors marked</AlertTitle>
              <AlertDescription>Mark the senior faculty in the Faculty tab first, or every seat will go to juniors.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run()} disabled={published}>
              <Play className="mr-2 h-4 w-4" /> {active.length ? 'Run again' : 'Run allocation'}
            </Button>
            {result && (
              <>
                <Button variant="outline" onClick={() => { const s = seed + 1; setSeed(s); run(s); }}>
                  <Shuffle className="mr-2 h-4 w-4" /> Try another mix
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save allocation
                </Button>
                <Button variant="ghost" onClick={() => setResult(null)}>Discard</Button>
              </>
            )}
          </div>
          {result && <Badge variant="outline">Not saved yet</Badge>}
          {published && (
            <p className="text-sm text-muted-foreground">
              This exam is published. To give a duty to someone else, use the pencil on that duty: it is cancelled and given to the new examiner, and only the Cancellations tab shows it.
            </p>
          )}

          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Examiner seats filled" value={`${stats.filled}/${stats.seats}`} tone={stats.filled === stats.seats ? 'ok' : 'warn'} />
              <Stat label="Examiners" value={stats.examiners} />
              <Stat label="Seniors with a duty" value={result ? `${result.stats.seniorsUsed}/${result.stats.seniorsTotal}` : '–'} tone={result && result.seniorsWithoutDuty.length ? 'warn' : undefined} />
              <Stat label="Picked by hand (not teaching)" value={stats.notTeaching} />
            </div>
          )}

          {result && result.seniorsWithoutDuty.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>{result.seniorsWithoutDuty.length} senior(s) could not be given a duty</AlertTitle>
              <AlertDescription>
                {result.seniorsWithoutDuty.map((id) => faculty.get(id)?.name).join(', ')}. Usually there is no free seat outside their own college on a day they are free.
              </AlertDescription>
            </Alert>
          )}
          {shown && shown.unfilled.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>{shown.unfilled.length} seat(s) could not be filled</AlertTitle>
              <AlertDescription>
                No free faculty who teach the practical. Fill these by hand (click the empty seat): you can pick anyone, including faculty who do not teach it. Or mark more faculty available or raise the maximum duties.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {shown && byDate.map(({ date, slots: daySlots }) => (
        <Card key={date}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{fmtDate(date)}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="hidden grid-cols-[240px_1fr] gap-4 border-b px-3 pb-2 text-sm font-medium text-muted-foreground md:grid">
              <span>Centre and practical</span>
              <span>Examiners</span>
            </div>
            <div className="divide-y">
                {daySlots.map((s) => {
                  const c = college.get(s.centreId);
                  const here = shown.duties.filter((d) => slotKey(d) === slotKey(s));
                  const empty = shown.unfilled.filter((u) => slotKey(u) === slotKey(s));
                  return (
                    <div key={slotKey(s)} className="grid gap-2 py-3 md:grid-cols-[240px_1fr] md:gap-4 md:px-3">
                      <div>
                        <div className="font-medium">{c?.code} <span className="text-xs text-muted-foreground">{c?.pcs ?? '?'} PCs</span></div>
                        <div className="text-sm">{subject.get(s.subjectCode)?.name ?? s.subjectCode}</div>
                        <div className="text-xs text-muted-foreground">{s.students} students · {s.batches} batches</div>
                      </div>
                      <div>
                        <ul className="space-y-2 md:space-y-1.5">
                          {here.map((d) => {
                            const f = faculty.get(d.facultyId);
                            return (
                              <li key={d.facultyId} className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="w-full text-xs text-muted-foreground sm:w-24">{d.seatRole === 'senior' ? 'Senior seat' : 'Junior seat'}</span>
                                <span className="font-medium">{f ? `${f.title} ${f.name}` : 'Unknown'}</span>
                                <span className="text-muted-foreground">{f && college.get(f.college_data_id)?.code}</span>
                                {f && <RankBadge senior={f.is_senior} />}
                                <TierBadge tier={d.tier} />
                                {editable && savedRow.get(`${slotKey(d)}|${d.facultyId}`) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label="Change examiner"
                                    title="Change examiner"
                                    onClick={() => setTarget({ ...s, seatRole: d.seatRole, assignment: savedRow.get(`${slotKey(d)}|${d.facultyId}`)! })}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                          {!result && cancelledIn(s).map((a) => {
                            const f = faculty.get(a.faculty_id);
                            const next = a.replaced_by ? data.assignments.find((x) => x.id === a.replaced_by) : undefined;
                            const nf = next ? faculty.get(next.faculty_id) : undefined;
                            return (
                              <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span className="w-full text-xs sm:w-24">{a.seat_role === 'senior' ? 'Senior seat' : 'Junior seat'}</span>
                                <span className="line-through">{f ? `${f.title} ${f.name}` : 'Unknown'}</span>
                                <span>{f && college.get(f.college_data_id)?.code}</span>
                                <Badge variant="destructive" className="font-normal">Cancelled</Badge>
                                {a.cancel_reason && <span className="text-xs">({a.cancel_reason})</span>}
                                {nf && <span className="text-xs">given to {nf.title} {nf.name}</span>}
                              </li>
                            );
                          })}
                          {empty.map((u, i) => (
                            <li key={`empty-${i}`} className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                              <span className="w-full text-xs sm:w-24">{u.seatRole === 'senior' ? 'Senior seat' : 'Junior seat'}</span>
                              Not filled
                              {editable && (
                                <Button variant="outline" size="sm" className="h-7" onClick={() => setTarget({ ...s, seatRole: u.seatRole, assignment: null })}>
                                  <Plus className="mr-1 h-3.5 w-3.5" /> Fill
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ))}

      {target && (
        <DutyChangeDialog
          sessionId={sessionId}
          target={target}
          data={data}
          rules={rules}
          published={published}
          onClose={() => setTarget(null)}
          onDone={async (message) => {
            toast({ title: message });
            setTarget(null);
            await reload();
          }}
          onError={onError}
          letters={letters}
        />
      )}
    </div>
  );
}
