import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Loader2, Save } from 'lucide-react';
import { DEFAULT_TEMPLATE, findChangeWords, PLACEHOLDERS, type LetterSettings } from '@/lib/duty/letterSettings';
import { saveLetterSettings } from '@/lib/duty/store';

interface Props {
  sessionId: string;
  settings: LetterSettings;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => void;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const toLines = (text: string) => text.split('\n');

/**
 * This exam's letter details and the letter format. The format, exam name,
 * time and rate carry over from the previous exam, so they are set once.
 */
export function LetterSettingsCard({ sessionId, settings, onSaved, onError }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);

  // Reset the form only when the saved settings really change, not on every
  // reload of the session data (that would throw away unsaved edits).
  const savedKey = JSON.stringify(settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(settings), [savedKey]);

  const dirty = JSON.stringify(draft) !== savedKey;
  const t = draft.template;
  const setT = (patch: Partial<LetterSettings['template']>) => setDraft({ ...draft, template: { ...t, ...patch } });
  const words = findChangeWords([t.refLine, t.subjectLine, t.opening, t.afterTable, t.closing, ...t.guidelines].join('\n'));
  const set = <K extends keyof LetterSettings>(key: K, value: LetterSettings[K]) => setDraft({ ...draft, [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      const trim = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
      await saveLetterSettings(sessionId, {
        ...draft,
        template: {
          ...t,
          letterhead: trim(t.letterhead),
          toLines: trim(t.toLines),
          signOff: trim(t.signOff),
          guidelinesHeading: trim(t.guidelinesHeading),
          guidelines: trim(t.guidelines),
        },
      });
      toast({ title: 'Letter settings saved', description: 'Used for letters made from now on, and carried over to the next exam.' });
      await onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger className="flex w-full items-start justify-between gap-4 text-left">
            <div>
              <CardTitle>Letter details and format</CardTitle>
              <CardDescription className="mt-1.5">
                {draft.examName} · {draft.semesterLabel || 'Semester ?'} · {draft.examMonth || 'Exam month ?'} · Time {draft.examTime} · Rs. {draft.ratePerStudent} per student
              </CardDescription>
            </div>
            <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Exam name" hint='e.g. "ATKT Practical Examination"'>
                <Input value={draft.examName} onChange={(e) => set('examName', e.target.value)} />
              </Field>
              <Field label="Semester" hint="From the subject codes">
                <Input value={draft.semesterLabel} onChange={(e) => set('semesterLabel', e.target.value)} />
              </Field>
              <Field label="Exam month" hint="From the timetable dates">
                <Input value={draft.examMonth} onChange={(e) => set('examMonth', e.target.value)} />
              </Field>
              <Field label="Exam time" hint="Printed under each subject">
                <Input value={draft.examTime} onChange={(e) => set('examTime', e.target.value)} />
              </Field>
              <Field label="Rate per student (Rs.)">
                <Input type="number" min={0} value={draft.ratePerStudent} onChange={(e) => set('ratePerStudent', Number(e.target.value))} />
              </Field>
              <Field label="Bill last date">
                <Input type="date" value={draft.billLastDate} onChange={(e) => set('billLastDate', e.target.value)} />
              </Field>
              <Field label="Letter date">
                <Input type="date" value={draft.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
              </Field>
              <Field label="Letter number prefix" hint="Running number is added">
                <Input value={draft.refPrefix} onChange={(e) => set('refPrefix', e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={t.showRefAndDate} onCheckedChange={(v) => setT({ showRefAndDate: v === true })} />
              Print the letter number and date on the letter
            </label>

            <Collapsible open={formatOpen} onOpenChange={setFormatOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
                <ChevronDown className={`h-4 w-4 transition-transform ${formatOpen ? 'rotate-180' : ''}`} /> Letter text (format)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Placeholders: {PLACEHOLDERS.join(' ')}</p>
                {words.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>Letters should not say what changed. Please remove: {words.map((w) => `"${w}"`).join(', ')}.</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Letterhead (one line each)">
                    <Textarea rows={2} value={t.letterhead.join('\n')} onChange={(e) => setT({ letterhead: toLines(e.target.value) })} />
                  </Field>
                  <Field label="Address (one line each)">
                    <Textarea rows={3} value={t.toLines.join('\n')} onChange={(e) => setT({ toLines: toLines(e.target.value) })} />
                  </Field>
                  <Field label="Under the letterhead">
                    <Input value={t.confidential} onChange={(e) => setT({ confidential: e.target.value })} />
                  </Field>
                  <Field label="Ref. line">
                    <Input value={t.refLine} onChange={(e) => setT({ refLine: e.target.value })} />
                  </Field>
                </div>
                <Field label="Subject line">
                  <Input value={t.subjectLine} onChange={(e) => setT({ subjectLine: e.target.value })} />
                </Field>
                <Field label="Salutation">
                  <Input value={t.salutation} onChange={(e) => setT({ salutation: e.target.value })} />
                </Field>
                <Field label="Before the duty table">
                  <Textarea rows={3} value={t.opening} onChange={(e) => setT({ opening: e.target.value })} />
                </Field>
                <Field label="After the duty table (before the chairperson and coordinators)">
                  <Textarea rows={4} value={t.afterTable} onChange={(e) => setT({ afterTable: e.target.value })} />
                </Field>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Closing">
                    <Textarea rows={2} value={t.closing} onChange={(e) => setT({ closing: e.target.value })} />
                  </Field>
                  <Field label="Signed by (one line each)">
                    <Textarea rows={2} value={t.signOff.join('\n')} onChange={(e) => setT({ signOff: toLines(e.target.value) })} />
                  </Field>
                </div>
                <Field label="Guidelines page heading (one line each)">
                  <Textarea rows={2} value={t.guidelinesHeading.join('\n')} onChange={(e) => setT({ guidelinesHeading: toLines(e.target.value) })} />
                </Field>
                <Field label="Guidelines (one per line, numbered on the letter)">
                  <Textarea rows={10} value={t.guidelines.join('\n')} onChange={(e) => setT({ guidelines: toLines(e.target.value) })} />
                </Field>
                <Field label="Under the remuneration table">
                  <Input value={t.billNote} onChange={(e) => setT({ billNote: e.target.value })} />
                </Field>
                <Button variant="ghost" size="sm" onClick={() => confirm('Put back the Gujarat University letter format?') && setDraft({ ...draft, template: DEFAULT_TEMPLATE })}>
                  Default format
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
              {dirty && <Button variant="ghost" onClick={() => setDraft(settings)}>Undo changes</Button>}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
