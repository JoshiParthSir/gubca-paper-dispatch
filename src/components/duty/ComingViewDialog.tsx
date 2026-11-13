import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Eye, Loader2 } from 'lucide-react';
import { saveShowComing, type SessionData, type SessionRules, type ShowComing } from '@/lib/duty/store';

interface Props {
  sessionId: string;
  data: SessionData;
  rules: SessionRules;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => void;
}

const LABEL: Record<ShowComing['mode'], string> = {
  all: 'All colleges',
  none: 'No college',
  selected: 'Selected colleges',
};

/**
 * Which colleges see "Examiners coming to our college" on their My Duties
 * page after publishing. Their own faculty's duties are always shown.
 */
export function ComingViewDialog({ sessionId, data, rules, onSaved, onError }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShowComing>(rules.showComing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(rules.showComing);
  }, [open, rules.showComing]);

  // Colleges that are examination centres in this exam.
  const centres = useMemo(() => {
    const ids = new Set(data.timetable.map((t) => t.centre_id));
    return data.colleges.filter((c) => ids.has(c.id)).sort((a, b) => a.code.localeCompare(b.code));
  }, [data.timetable, data.colleges]);

  const picked = new Set(draft.colleges);
  const toggle = (id: string, on: boolean) =>
    setDraft((d) => ({ ...d, colleges: on ? [...new Set([...d.colleges, id])] : d.colleges.filter((x) => x !== id) }));

  const summary = rules.showComing.mode === 'selected'
    ? `${rules.showComing.colleges.length} selected`
    : LABEL[rules.showComing.mode];

  const save = async () => {
    setSaving(true);
    try {
      await saveShowComing(sessionId, draft);
      toast({ title: 'Saved', description: `"Examiners coming to our college" is shown to: ${draft.mode === 'selected' ? `${draft.colleges.length} selected college(s)` : LABEL[draft.mode].toLowerCase()}.` });
      setOpen(false);
      await onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title='Which colleges see "Examiners coming to our college"'>
        <Eye className="mr-2 h-4 w-4" /> Examiners coming: {summary}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Who sees "Examiners coming to our college"</DialogTitle>
            <DialogDescription>
              After publishing, a college admin sees the examiners coming to their college only if it is allowed here. Their own faculty's duties and the letters sent to them are not affected.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={draft.mode} onValueChange={(v) => setDraft({ ...draft, mode: v as ShowComing['mode'] })} className="space-y-2">
            {(['all', 'none', 'selected'] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-3 text-sm">
                <RadioGroupItem value={m} /> {LABEL[m]}
              </label>
            ))}
          </RadioGroup>
          {draft.mode === 'selected' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, colleges: centres.map((c) => c.id) })}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, colleges: [] })}>Clear</Button>
              </div>
              {!centres.length ? (
                <p className="text-sm text-muted-foreground">Save the timetable first: the centres come from it.</p>
              ) : (
                <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
                  {centres.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                      <Checkbox checked={picked.has(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
                      <span className="font-medium">{c.code}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={save} disabled={saving || (draft.mode === 'selected' && !draft.colleges.length)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
