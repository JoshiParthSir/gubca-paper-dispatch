import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { checkDuty, personIndex } from '@/lib/duty/allocate';
import { samePersonKey } from '@/lib/duty/names';
import { facultyTier, TIER_ORDER } from '@/lib/duty/pools';
import { useAuth } from '@/hooks/useAuth';
import {
  addDuty, cancelDuty, changeDutyFaculty, deleteDuty, describeLetterSync, syncLetters,
  type DutyAssignment, type SessionData, type SessionRules,
} from '@/lib/duty/store';
import type { LetterBuilder } from './useLetterBuilder';
import { RankBadge, TierBadge } from './shared';
import { fmtDate, useLookups } from './lookups';

/** The seat being changed: an existing duty, or an empty seat to fill. */
export interface SeatTarget {
  date: string;
  centreId: string;
  subjectCode: string;
  seatRole: 'senior' | 'junior';
  assignment: DutyAssignment | null;
}

interface Props {
  sessionId: string;
  target: SeatTarget | null;
  data: SessionData;
  rules: SessionRules;
  published: boolean;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
  onError: (e: unknown) => void;
  /** Builds letters, so the letters follow the change (replaced, new or removed). */
  letters: LetterBuilder;
}

type Mode = 'change' | 'cancel';

export function DutyChangeDialog({ sessionId, target, data, rules, published, onClose, onDone, onError, letters }: Props) {
  const { user } = useAuth();
  const { college, faculty, subject, practicalCodes } = useLookups(data);
  const [pick, setPick] = useState('');
  const [mode, setMode] = useState<Mode>('change');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  /** Also cancel the examiner's other duty days (each recorded separately). */
  const [alsoOthers, setAlsoOthers] = useState(false);

  useEffect(() => {
    setPick('');
    setReason('');
    setSearch('');
    // After publishing, a duty can only be cancelled (kept as history).
    setMode(published && target?.assignment ? 'cancel' : 'change');
    setAlsoOthers(false);
  }, [target, published]);

  const candidates = useMemo(() => {
    if (!target) return [];
    const active = data.assignments.filter((a) => a.status === 'active' && a.id !== target.assignment?.id);
    const others = active.map((a) => ({ date: a.exam_date, facultyId: a.faculty_id }));
    const blocked = new Map<string, Set<string>>();
    for (const b of rules.blocked) {
      if (!blocked.has(b.facultyId)) blocked.set(b.facultyId, new Set());
      blocked.get(b.facultyId)!.add(b.centreId);
    }
    // The same person listed by two colleges counts as one examiner.
    const people = personIndex(data.faculty.map((f) => ({
      id: f.id, personKey: samePersonKey(f.name, f.id), collegeId: f.college_data_id,
      isSenior: f.is_senior, isVisiting: f.is_visiting, isAvailable: f.is_available, subjectCodes: f.subject_codes,
    })));
    // Seniors first for a senior seat, juniors first for a junior seat.
    const roleFit = (senior: boolean) => (senior === (target.seatRole === 'senior') ? 0 : 1);
    return data.faculty
      .filter((f) => f.id !== target.assignment?.faculty_id)
      .map((f) => {
        const problems = checkDuty(
          { date: target.date, centreId: target.centreId, facultyId: f.id },
          { id: f.id, collegeId: f.college_data_id, isSenior: f.is_senior, isVisiting: f.is_visiting, isAvailable: f.is_available, subjectCodes: f.subject_codes },
          others,
          rules,
          blocked.get(f.id),
          people,
        );
        if (f.is_visiting && !rules.includeVisiting) problems.push('Visiting faculty are excluded');
        return {
          f,
          problems,
          tier: facultyTier(f.subject_codes, target.subjectCode, practicalCodes),
          duties: others.filter((o) => people.person(o.facultyId) === people.person(f.id)).length,
        };
      })
      .sort((a, b) =>
        Number(a.problems.length > 0) - Number(b.problems.length > 0)
        || roleFit(a.f.is_senior) - roleFit(b.f.is_senior)
        || TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
        || a.duties - b.duties
        || a.f.name.localeCompare(b.f.name));
  }, [target, data, rules, practicalCodes]);

  if (!target) return null;
  const current = target.assignment ? faculty.get(target.assignment.faculty_id) : null;
  const centre = college.get(target.centreId);
  const q = search.trim().toLowerCase();
  const list = candidates.filter((c) => !q || c.f.name.toLowerCase().includes(q) || (college.get(c.f.college_data_id)?.code ?? '').toLowerCase().includes(q));
  const chosen = candidates.find((c) => c.f.id === pick);
  // The examiner's other active duties (other days), for "cancel all days".
  const otherDuties = target.assignment
    ? data.assignments
      .filter((a) => a.status === 'active' && a.faculty_id === target.assignment!.faculty_id && a.id !== target.assignment!.id)
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    : [];

  const submit = async (removeOnly = false) => {
    if (!removeOnly && chosen?.problems.length && !confirm(`${chosen.f.name}: ${chosen.problems.join(', ')}. Give the duty anyway?`)) return;
    if (!removeOnly && chosen && chosen.tier !== 'subject'
      && !confirm(`${chosen.f.name} does not teach ${subject.get(target.subjectCode)?.name ?? target.subjectCode}. Give the duty anyway?`)) return;
    // Letters follow the change: the old examiner's letter is replaced with
    // the duties left (or removed), the new examiner's letter gets the duty
    // (or a new letter is made, finalised and sent like the one it replaces).
    const oldId = target.assignment?.faculty_id ?? null;
    const oldLetter = oldId ? data.letters.find((l) => l.faculty_id === oldId) : undefined;
    const followLetters = async (message: string) => {
      let note = '';
      try {
        const r = await syncLetters(sessionId, [oldId, removeOnly ? null : pick].filter((x): x is string => !!x), {
          build: letters.build,
          refPrefix: letters.settings.refPrefix,
          newLetter: { finalised: !!oldLetter?.finalised_at, sent: !!oldLetter?.sent_at },
          userId: user?.id ?? null,
        });
        note = describeLetterSync(r);
      } catch (e) {
        onError(e);
        note = 'letters not updated, check the Letters tab';
      }
      await onDone(note ? `${message} · ${note}` : message);
    };

    setSaving(true);
    try {
      if (!target.assignment) {
        await addDuty(sessionId, { date: target.date, centreId: target.centreId, subjectCode: target.subjectCode, facultyId: pick, seatRole: target.seatRole });
        await followLetters('Seat filled');
      } else if (mode === 'cancel') {
        await cancelDuty(target.assignment.id, removeOnly ? null : pick, reason.trim());
        // Other days: each cancelled on its own (one record per day); their seats become empty to fill.
        const others = alsoOthers ? otherDuties : [];
        for (const o of others) await cancelDuty(o.id, null, reason.trim());
        const days = others.length ? ` (and ${others.length} other day(s), seats left empty to fill)` : '';
        await followLetters(`${removeOnly ? 'Duty cancelled' : 'Duty cancelled and given to the new examiner'}${days}`);
      } else if (removeOnly) {
        if (!confirm('Remove this duty? The seat becomes empty.')) return;
        await deleteDuty(target.assignment.id);
        await followLetters('Duty removed');
      } else {
        await changeDutyFaculty(target.assignment.id, pick);
        await followLetters('Examiner changed');
      }
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const needReason = mode === 'cancel' && !reason.trim();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target.assignment ? 'Change examiner' : 'Fill empty seat'}</DialogTitle>
          <DialogDescription>
            {fmtDate(target.date)} · {centre?.code} · {subject.get(target.subjectCode)?.name ?? target.subjectCode} · {target.seatRole === 'senior' ? 'Senior seat' : 'Junior seat'}
            {current && <> · now: <b>{current.title} {current.name}</b></>}
          </DialogDescription>
        </DialogHeader>

        {target.assignment && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === 'change' ? 'default' : 'outline'} disabled={published} onClick={() => setMode('change')}>
              Change (before publishing)
            </Button>
            <Button size="sm" variant={mode === 'cancel' ? 'default' : 'outline'} onClick={() => setMode('cancel')}>
              Cancel duty
            </Button>
          </div>
        )}
        {mode === 'cancel' && target.assignment && (
          <div className="space-y-2">
            <Alert>
              <AlertDescription>
                The cancelled duty is kept only in the Cancellations tab. The new examiner gets an ordinary duty; nothing elsewhere shows the change. Letters are updated straight away: in the examiner's letter this day shows "Cancelled" in place of the centre, and the new examiner's letter gets this day.
              </AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason (required)</Label>
              <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Medical leave" />
            </div>
            {otherDuties.length > 0 && (
              <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <Checkbox className="mt-0.5" checked={alsoOthers} onCheckedChange={(v) => setAlsoOthers(v === true)} />
                <span>
                  Also cancel their other {otherDuties.length} duty day(s):{' '}
                  {otherDuties.map((o) => `${fmtDate(o.exam_date)} (${college.get(o.centre_id)?.code ?? ''})`).join(', ')}.
                  <span className="block text-xs text-muted-foreground">
                    Each day is cancelled and recorded separately with this reason. The examiner chosen below takes only this day; the other seats are left empty to fill.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        <Input placeholder="Search name or college" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[45vh] space-y-1 overflow-y-auto rounded-md border p-1">
          {list.map(({ f, problems, tier, duties }) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPick(f.id)}
              className={`flex w-full flex-wrap items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${pick === f.id ? 'bg-muted ring-1 ring-primary' : ''} ${problems.length ? 'opacity-70' : ''}`}
            >
              <span className="font-medium">{f.title} {f.name}</span>
              <span className="text-muted-foreground">{college.get(f.college_data_id)?.code}</span>
              <RankBadge senior={f.is_senior} />
              <TierBadge tier={tier} />
              <span className="text-xs text-muted-foreground">{duties} dut{duties === 1 ? 'y' : 'ies'}</span>
              {problems.map((p) => <Badge key={p} variant="destructive" className="font-normal">{p}</Badge>)}
            </button>
          ))}
          {!list.length && <p className="p-2 text-sm text-muted-foreground">Nobody found.</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {target.assignment ? (
            <Button variant="ghost" disabled={saving || needReason} onClick={() => submit(true)}>
              {mode === 'cancel' ? 'Cancel without replacement' : 'Remove duty'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button disabled={!pick || saving || needReason} onClick={() => submit(false)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {target.assignment ? (mode === 'cancel' ? 'Cancel and give to selected' : 'Give to selected') : 'Give seat'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
