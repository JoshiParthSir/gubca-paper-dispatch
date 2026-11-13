import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';

/** A finalised letter that has not been sent yet and whose college has an account. */
export interface SendableLetter {
  id: string;
  name: string;
  collegeCode: string;
}

interface Props {
  open: boolean;
  letters: readonly SendableLetter[];
  /** Finalised, unsent letters whose college is not linked to an account. */
  noAccount: number;
  onClose: () => void;
  onSend: (ids: string[]) => Promise<void>;
}

type Scope = 'all' | 'colleges' | 'one';

/**
 * Choose which letters go to the college admins: every college, some
 * colleges, or one faculty member. Each letter goes to the admin of the
 * examiner's own college.
 */
export function SendLettersDialog({ open, letters, noAccount, onClose, onSend }: Props) {
  const [scope, setScope] = useState<Scope>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [one, setOne] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope('all');
    setPicked(new Set());
    setOne('');
  }, [open]);

  const byCollege = useMemo(() => {
    const m = new Map<string, SendableLetter[]>();
    for (const l of letters) {
      if (!m.has(l.collegeCode)) m.set(l.collegeCode, []);
      m.get(l.collegeCode)!.push(l);
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b));
  }, [letters]);

  const ids =
    scope === 'all' ? letters.map((l) => l.id)
      : scope === 'colleges' ? letters.filter((l) => picked.has(l.collegeCode)).map((l) => l.id)
        : one ? [one] : [];
  const colleges = new Set(letters.filter((l) => ids.includes(l.id)).map((l) => l.collegeCode)).size;

  const toggle = (code: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(code);
      else n.delete(code);
      return n;
    });

  const send = async () => {
    setSending(true);
    try {
      await onSend(ids);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send letters to college admins</DialogTitle>
          <DialogDescription>
            Each letter goes to the college admin of the examiner's own college and appears on their My Duties page. Only finalised letters not sent yet are listed.
          </DialogDescription>
        </DialogHeader>

        {!letters.length ? (
          <p className="text-sm text-muted-foreground">Nothing to send. Finalise letters first.</p>
        ) : (
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <RadioGroupItem value="all" />
              <span className="text-sm">All colleges ({letters.length} letters, {byCollege.length} colleges)</span>
            </label>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3">
                <RadioGroupItem value="colleges" />
                <span className="text-sm">Selected colleges</span>
              </label>
              {scope === 'colleges' && (
                <div className="ml-7 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(byCollege.map(([c]) => c)))}>Select all</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
                  </div>
                  <div className="grid max-h-60 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                    {byCollege.map(([code, list]) => (
                      <label key={code} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                        <Checkbox checked={picked.has(code)} onCheckedChange={(v) => toggle(code, v === true)} />
                        <span className="font-medium">{code}</span>
                        <span className="text-muted-foreground">({list.length})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3">
                <RadioGroupItem value="one" />
                <span className="text-sm">One faculty member</span>
              </label>
              {scope === 'one' && (
                <div className="ml-7 space-y-1">
                  <Label className="sr-only">Faculty member</Label>
                  <Select value={one} onValueChange={setOne}>
                    <SelectTrigger><SelectValue placeholder="Choose a faculty member" /></SelectTrigger>
                    <SelectContent>
                      {[...letters].sort((a, b) => a.collegeCode.localeCompare(b.collegeCode) || a.name.localeCompare(b.name)).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.collegeCode} · {l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </RadioGroup>
        )}

        {noAccount > 0 && (
          <Alert>
            <AlertDescription>
              {noAccount} finalised letter(s) cannot be sent: their college is not linked to an account. Link it in Import, under Colleges and accounts.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={send} disabled={!ids.length || sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send {ids.length || ''} letter{ids.length === 1 ? '' : 's'}{colleges > 1 ? ` to ${colleges} colleges` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
