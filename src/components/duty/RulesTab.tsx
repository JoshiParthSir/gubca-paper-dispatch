import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { saveRules, type SessionRules } from '@/lib/duty/store';
import { useLookups, type TabProps } from './lookups';

const NUMBERS: { key: keyof SessionRules; label: string }[] = [
  { key: 'pcThreshold', label: 'PC threshold' },
  { key: 'smallSeniors', label: 'Below threshold: seniors' },
  { key: 'smallJuniors', label: 'Below threshold: juniors' },
  { key: 'largeSeniors', label: 'At or above threshold: seniors' },
  { key: 'largeJuniors', label: 'At or above threshold: juniors' },
  { key: 'preferredDuties', label: 'Preferred duties per examiner' },
  { key: 'maxDuties', label: 'Maximum duties per examiner' },
];

export function RulesTab({ sessionId, data, rules, onSaved, onError }: TabProps & { rules: SessionRules; onSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const { college, faculty } = useLookups(data);
  const [draft, setDraft] = useState(rules);
  const [saving, setSaving] = useState(false);
  const [blockFaculty, setBlockFaculty] = useState('');
  const [blockCentre, setBlockCentre] = useState('');

  useEffect(() => setDraft(rules), [rules]);

  const centres = data.colleges.filter((c) => data.timetable.some((t) => t.centre_id === c.id));
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  const invalid = draft.maxDuties < draft.preferredDuties || NUMBERS.some((n) => !(Number(draft[n.key]) >= 0));

  const save = async () => {
    setSaving(true);
    try {
      await saveRules(sessionId, draft);
      toast({ title: 'Rules saved' });
      await onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation rules</CardTitle>
        <CardDescription>Seats per centre come from its PCs. Seniors always come first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBERS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={0}
                value={String(draft[key])}
                onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
        {draft.maxDuties < draft.preferredDuties && (
          <p className="text-sm text-destructive">Maximum duties cannot be less than the preferred duties.</p>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={draft.avoidOwnCollege} onCheckedChange={(v) => setDraft({ ...draft, avoidOwnCollege: v })} />
            No duty at their own college
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={draft.includeVisiting} onCheckedChange={(v) => setDraft({ ...draft, includeVisiting: v })} />
            Visiting faculty can get duties
          </label>
        </div>

        <div className="space-y-3">
          <Label>Blocked: faculty who must not go to a centre</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={blockFaculty} onValueChange={setBlockFaculty}>
              <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Faculty" /></SelectTrigger>
              <SelectContent>
                {[...data.faculty]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} · {college.get(f.college_data_id)?.code}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={blockCentre} onValueChange={setBlockCentre}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Centre" /></SelectTrigger>
              <SelectContent>
                {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!blockFaculty || !blockCentre}
              onClick={() => {
                if (!draft.blocked.some((b) => b.facultyId === blockFaculty && b.centreId === blockCentre)) {
                  setDraft({ ...draft, blocked: [...draft.blocked, { facultyId: blockFaculty, centreId: blockCentre }] });
                }
                setBlockFaculty('');
                setBlockCentre('');
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          {draft.blocked.length > 0 && (
            <ul className="space-y-1 text-sm">
              {draft.blocked.map((b, i) => (
                <li key={`${b.facultyId}-${b.centreId}`} className="flex items-center gap-2">
                  {faculty.get(b.facultyId)?.name ?? 'Removed faculty'} → {college.get(b.centreId)?.code ?? 'Removed centre'}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Remove"
                    onClick={() => setDraft({ ...draft, blocked: draft.blocked.filter((_, j) => j !== i) })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={!dirty || invalid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save rules
          </Button>
          {dirty && <Button variant="ghost" onClick={() => setDraft(rules)}>Reset</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
