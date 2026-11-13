import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { findChangeWords } from '@/lib/duty/letterSettings';
import { letterText, type LetterContent, type LetterDutyRow } from '@/lib/duty/letter';

interface Props {
  open: boolean;
  content: LetterContent | null;
  /** Fresh content from the template, for "Reset to template". */
  template: () => LetterContent | null;
  onClose: () => void;
  onSave: (c: LetterContent) => Promise<void>;
}

const EMPTY_ROW: LetterDutyRow = { date: '', centreCode: '', centreName: '', subjectCode: '', subject: '', students: 0, batches: 0 };

/** Field-by-field editor for one draft letter. Saving writes `content` only. */
export function LetterEditor({ open, content, template, onClose, onSave }: Props) {
  const [c, setC] = useState<LetterContent | null>(content);
  const [saving, setSaving] = useState(false);

  useEffect(() => setC(content), [content]);

  if (!c) return null;
  const set = (patch: Partial<LetterContent>) => setC({ ...c, ...patch });
  const setRow = (i: number, patch: Partial<LetterDutyRow>) =>
    set({ duties: c.duties.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const words = findChangeWords(letterText(c));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...c,
        guidelines: c.guidelines.map((g) => g.trim()).filter(Boolean),
        letterhead: c.letterhead.map((l) => l.trim()).filter(Boolean),
        toLines: c.toLines.map((l) => l.trim()).filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    const fresh = template();
    if (!fresh) return;
    if (!confirm('Rebuild this letter from the current template and duties? Your edits to this letter are lost. The letter number stays the same.')) return;
    setC({ ...fresh, refNo: c.refNo });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit letter: {c.to.title} {c.to.name}</DialogTitle>
          <DialogDescription>Changes apply to this letter only. Finalise it when it is ready.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {words.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                The letter should not say what changed. Please remove: {words.map((w) => `"${w}"`).join(', ')}.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Letter number</Label>
              <Input value={c.refNo} onChange={(e) => set({ refNo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={c.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address (one line each)</Label>
            <Textarea rows={3} value={c.toLines.join('\n')} onChange={(e) => set({ toLines: e.target.value.split('\n') })} />
          </div>

          <div className="space-y-1.5">
            <Label>Subject line</Label>
            <Input value={c.subjectLine} onChange={(e) => set({ subjectLine: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Before the duty table</Label>
            <Textarea rows={3} value={c.opening} onChange={(e) => set({ opening: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Exam time (printed under each subject)</Label>
            <Input value={c.examTime} onChange={(e) => set({ examTime: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Duties</Label>
            {c.duties.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[140px_1fr_1fr_80px_80px_auto]">
                <Input type="date" value={d.date} onChange={(e) => setRow(i, { date: e.target.value })} aria-label="Date" />
                <div className="space-y-1">
                  <Input value={d.centreCode} placeholder="Centre code" onChange={(e) => setRow(i, { centreCode: e.target.value })} aria-label="Centre code" />
                  <Input value={d.centreName} placeholder="Centre name" onChange={(e) => setRow(i, { centreName: e.target.value })} aria-label="Centre name" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={!!d.cancelled} onCheckedChange={(v) => setRow(i, { cancelled: v === true })} />
                    Cancelled (shows "Cancelled" instead of the centre)
                  </label>
                </div>
                <div className="space-y-1">
                  <Input value={d.subject} placeholder="Subject" onChange={(e) => setRow(i, { subject: e.target.value })} aria-label="Subject" />
                  <Input value={d.subjectCode} placeholder="Subject code" onChange={(e) => setRow(i, { subjectCode: e.target.value })} aria-label="Subject code" />
                </div>
                <Input type="number" min={0} value={d.students} onChange={(e) => setRow(i, { students: Number(e.target.value) })} aria-label="Students" />
                <Input type="number" min={0} value={d.batches} onChange={(e) => setRow(i, { batches: Number(e.target.value) })} aria-label="Batches" />
                <Button variant="ghost" size="icon" aria-label="Remove duty row" onClick={() => set({ duties: c.duties.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set({ duties: [...c.duties, { ...EMPTY_ROW }] })}>
              <Plus className="mr-1 h-4 w-4" /> Add row
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>After the duty table</Label>
            <Textarea rows={4} value={c.afterTable} onChange={(e) => set({ afterTable: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Guidelines (one per line)</Label>
            <Textarea
              rows={7}
              value={c.guidelines.join('\n')}
              onChange={(e) => set({ guidelines: e.target.value.split('\n') })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Closing</Label>
            <Textarea rows={2} value={c.closing} onChange={(e) => set({ closing: e.target.value })} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to template
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save letter
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
