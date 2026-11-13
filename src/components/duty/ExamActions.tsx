import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Eraser, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  clearIncludes,
  clearSessionData,
  CLEAR_ORDER,
  deleteSession,
  renameSession,
  type ClearPart,
  type DutySession,
  type SessionData,
} from '@/lib/duty/store';

interface Props {
  session: DutySession;
  data: SessionData;
  /** After rename. */
  onRenamed: () => Promise<void>;
  /** After clearing data. */
  onCleared: () => Promise<void>;
  /** After deleting the exam. */
  onDeleted: () => Promise<void>;
  onError: (e: unknown) => void;
}

const PART_TEXT: Record<ClearPart, { title: string; detail: string }> = {
  letters: { title: 'Letters only', detail: 'All letters, finalised or not. Duties stay.' },
  duties: { title: 'Duties and letters', detail: 'The allocation, cancellations and letters. Import stays.' },
  timetable: { title: 'Timetable, duties and letters', detail: 'Upload the timetable again afterwards. College data stays.' },
  colleges: { title: 'Everything imported', detail: 'College data, faculty, seniors, timetable, duties and letters. The exam, its rules and letter settings stay.' },
};

type Open = '' | 'rename' | 'clear' | 'delete';

/** Rename the exam, clear what was imported or generated, or delete the exam. */
export function ExamActions({ session, data, onRenamed, onCleared, onDeleted, onError }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState<Open>('');
  const [title, setTitle] = useState(session.title);
  const [part, setPart] = useState<ClearPart>('duties');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const published = session.status === 'published';

  const show = (o: Open) => {
    setTitle(session.title);
    setTyped('');
    setPart('duties');
    setOpen(o);
  };

  const counts: Record<ClearPart, number> = {
    letters: data.letters.length,
    duties: data.assignments.length,
    timetable: data.timetable.length,
    colleges: data.colleges.length + data.faculty.length,
  };
  const summary = (p: ClearPart) => {
    const n = {
      letters: `${data.letters.length} letter(s)`,
      duties: `${data.assignments.length} duty record(s)`,
      timetable: `${data.timetable.length} timetable batch(es)`,
      colleges: `${data.colleges.length} college(s) and ${data.faculty.length} faculty`,
    };
    return clearIncludes(p).filter((x) => counts[x]).map((x) => n[x]).join(', ') || 'nothing (already empty)';
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setOpen('');
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const rename = () => run(async () => {
    await renameSession(session.id, title.trim());
    toast({ title: 'Exam renamed' });
    await onRenamed();
  });

  const clear = () => run(async () => {
    await clearSessionData(session.id, part);
    toast({ title: 'Data deleted', description: PART_TEXT[part].title });
    await onCleared();
  });

  const remove = () => run(async () => {
    await deleteSession(session.id);
    toast({ title: 'Exam deleted', description: session.title });
    await onDeleted();
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Exam options"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => show('rename')}><Pencil className="mr-2 h-4 w-4" /> Rename exam</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => show('clear')}><Eraser className="mr-2 h-4 w-4" /> Delete data…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => show('delete')}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete exam
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open === 'rename'} onOpenChange={(o) => !o && setOpen('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename exam</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exam-title">Name</Label>
            <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && title.trim() && rename()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen('')}>Close</Button>
            <Button onClick={rename} disabled={busy || !title.trim() || title.trim() === session.title}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'clear'} onOpenChange={(o) => !o && setOpen('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete data</DialogTitle>
            <DialogDescription>{session.title}: choose what to delete. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {published ? (
            <Alert variant="destructive"><AlertDescription>This exam is published. Unpublish it first.</AlertDescription></Alert>
          ) : (
            <>
              <RadioGroup value={part} onValueChange={(v) => setPart(v as ClearPart)} className="space-y-2">
                {CLEAR_ORDER.map((p) => (
                  <label key={p} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
                    <RadioGroupItem value={p} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{PART_TEXT[p].title}</span>
                      <span className="block text-xs text-muted-foreground">{PART_TEXT[p].detail}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-sm">Will delete: <b>{summary(part)}</b></p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen('')}>Close</Button>
            <Button variant="destructive" onClick={clear} disabled={busy || published}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'delete'} onOpenChange={(o) => !o && setOpen('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete exam</DialogTitle>
            <DialogDescription>
              Deletes <b>{session.title}</b> with all its college data, faculty, timetable, duties, cancellations and letters. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {published ? (
            <Alert variant="destructive"><AlertDescription>This exam is published. Unpublish it first.</AlertDescription></Alert>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="exam-confirm">Type the exam name to confirm</Label>
              <Input id="exam-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={session.title} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen('')}>Close</Button>
            <Button variant="destructive" onClick={remove} disabled={busy || published || typed.trim() !== session.title.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
