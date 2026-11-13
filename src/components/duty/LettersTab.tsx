import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Download, Eye, FileArchive, FileSpreadsheet, FileText, Loader2, Lock, LockOpen, Pencil, Printer, RefreshCw, Send, Sparkles, Trash2, Undo2,
} from 'lucide-react';
import {
  dutiesMatch,
  dutyRowsByFaculty,
  hasActiveDuty,
  letterFileNames,
  nextRefNumbers,
  readLetterContent,
  type LetterContent,
} from '@/lib/duty/letter';
import { dutyTableRows } from '@/lib/duty/dutyTable';
import {
  createLetters, deleteDraftLetters, deleteLetter, describeLetterSync, setFinalised, setSent, syncLetters, updateLetterContent,
  type NewLetterState,
  type DutyFaculty, type DutyLetter, type DutySession,
} from '@/lib/duty/store';
import { ContactsCard } from './ContactsCard';
import { useLetterBuilder } from './useLetterBuilder';
import { LetterEditor } from './LetterEditor';
import { LetterPreview } from './LetterPreview';
import { LetterSettingsCard } from './LetterSettingsCard';
import { SendLettersDialog } from './SendLettersDialog';
import { Stat } from './shared';
import { useLookups, type TabProps } from './lookups';

type Busy = '' | 'generate' | 'sync' | 'finalise-all' | 'delete-drafts' | 'zip' | 'one-pdf' | 'table-pdf' | 'table-xlsx' | `row:${string}`;

interface Row {
  letter: DutyLetter;
  content: LetterContent;
  faculty: DutyFaculty | undefined;
  collegeCode: string;
  finalised: boolean;
  /** Sent to the college admin (shown on their My Duties page). */
  sent: boolean;
  /** The examiner's college is linked to an account, so there is someone to send to. */
  hasAccount: boolean;
  matches: boolean;
  activeDuties: number;
}

export function LettersTab({ sessionId, data, reload, onError, session, onSessionSaved }: TabProps & { session: DutySession; onSessionSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { college, faculty } = useLookups(data);
  const [busy, setBusy] = useState<Busy>('');
  const [preview, setPreview] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [status, setStatus] = useState<'all' | 'draft' | 'final' | 'sent' | 'unsent' | 'check'>('all');

  // Settings, carried-over format, chairperson and coordinators.
  const { settings, contacts, missing, reloadShared: loadShared, build } = useLetterBuilder(session, data, onError);

  const dutyRows = useMemo(() => dutyRowsByFaculty(data), [data]);

  const rows: Row[] = useMemo(() => data.letters
    .map((l) => {
      const f = faculty.get(l.faculty_id);
      const content = readLetterContent(l.content);
      const active = dutyRows.get(l.faculty_id) ?? [];
      return {
        letter: l,
        content,
        faculty: f,
        collegeCode: f ? college.get(f.college_data_id)?.code ?? '' : content.to.collegeCode,
        finalised: !!l.finalised_at,
        sent: !!l.sent_at,
        hasAccount: !!(f && college.get(f.college_data_id)?.college_id),
        matches: dutiesMatch(content.duties, active),
        activeDuties: active.filter((d) => !d.cancelled).length,
      };
    })
    .sort((a, b) => a.collegeCode.localeCompare(b.collegeCode) || a.content.to.name.localeCompare(b.content.to.name)),
  [data.letters, faculty, college, dutyRows]);

  const withLetter = new Set(data.letters.map((l) => l.faculty_id));
  // Only examiners with a duty still to do need a letter; cancelled days alone do not.
  const needLetter = [...dutyRows].filter(([id, rows]) => !withLetter.has(id) && hasActiveDuty(rows)).map(([id]) => id);
  const mismatched = rows.filter((r) => !r.matches);
  const drafts = rows.filter((r) => !r.finalised);

  const shown = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !`${r.content.to.name} ${r.collegeCode} ${r.content.refNo}`.toLowerCase().includes(q)) return false;
    if (status === 'draft') return !r.finalised;
    if (status === 'final') return r.finalised;
    if (status === 'sent') return r.sent;
    if (status === 'unsent') return r.finalised && !r.sent;
    if (status === 'check') return !r.matches;
    return true;
  });

  /** A fresh letter for one examiner from the current settings and duties. */
  const fromTemplate = (facultyId: string, refNo: string): LetterContent | null =>
    build(facultyId, refNo, dutyRows.get(facultyId) ?? []);

  const run = async (key: Busy, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  const generate = () => run('generate', async () => {
    const ids = needLetter
      .map((id) => faculty.get(id))
      .filter((f): f is DutyFaculty => !!f)
      .sort((a, b) =>
        (college.get(a.college_data_id)?.code ?? '').localeCompare(college.get(b.college_data_id)?.code ?? '')
        || a.name.localeCompare(b.name))
      .map((f) => f.id);
    const refs = nextRefNumbers(rows.map((r) => r.content.refNo), settings.refPrefix, ids.length);
    const letters = ids.map((id, i) => ({ facultyId: id, content: fromTemplate(id, refs[i])! })).filter((l) => l.content);
    await createLetters(sessionId, letters);
    toast({ title: `${letters.length} letter(s) created`, description: 'Existing letters were not touched.' });
    await reload();
  });

  /**
   * A letter made for someone who took over a cancelled duty is finalised
   * and sent like the letter of the examiner they replaced; others are drafts.
   */
  const newLetterState = (facultyId: string): NewLetterState => {
    const mine = new Set(data.assignments.filter((a) => a.status === 'active' && a.faculty_id === facultyId).map((a) => a.id));
    const replaced = data.assignments.find((a) => a.status === 'cancelled' && a.replaced_by && mine.has(a.replaced_by));
    const before = replaced && data.letters.find((l) => l.faculty_id === replaced.faculty_id);
    return { finalised: !!before?.finalised_at, sent: !!before?.sent_at };
  };

  /** Bring every letter in line with the current duties (after earlier cancellations or changes). */
  const syncAll = () => run('sync', async () => {
    const ids = [...new Set([...mismatched.map((r) => r.letter.faculty_id), ...needLetter])];
    if (!ids.length) return void toast({ title: 'All letters match the duties' });
    if (!confirm(`Update the letters of ${ids.length} examiner(s) to their current duties? Letters whose duties changed are rebuilt with the same number (hand edits on them are replaced), letters with no duty left are removed, and examiners without a letter get one.`)) return;
    const r = await syncLetters(sessionId, ids, {
      build,
      refPrefix: settings.refPrefix,
      newLetter: newLetterState,
      userId: user?.id ?? null,
    });
    toast({ title: 'Letters updated', description: describeLetterSync(r) || 'Nothing to change.' });
    await reload();
  });

  const finalise = (ids: string[], value: boolean) => setFinalised(ids, value, user?.id ?? null);

  const toggleFinal = (r: Row) => run(`row:${r.letter.id}`, async () => {
    if (r.finalised) {
      if (!confirm(`Un-finalise the letter for ${r.content.to.name}? It goes back to draft${r.sent ? ' and the college admin cannot see it until you finalise it again' : ''}.`)) return;
      await finalise([r.letter.id], false);
    } else {
      if (!r.matches && !confirm('This letter does not match the examiner\'s current duties. Finalise anyway?')) return;
      await finalise([r.letter.id], true);
    }
    await reload();
  });

  const finaliseAll = () => run('finalise-all', async () => {
    const ok = drafts.filter((r) => r.matches);
    const skip = drafts.length - ok.length;
    if (!ok.length) return void toast({ title: 'No draft letters to finalise', description: skip ? `${skip} draft(s) need checking first.` : undefined });
    if (!confirm(`Finalise ${ok.length} draft letter(s)?${skip ? ` ${skip} letter(s) that do not match the duties are left as drafts.` : ''}`)) return;
    await finalise(ok.map((r) => r.letter.id), true);
    toast({ title: `${ok.length} letter(s) finalised` });
    await reload();
  });

  // Sending: the letter appears on the college admin's My Duties page.
  const sendable = rows.filter((r) => r.finalised && !r.sent && r.hasAccount);
  const noAccount = rows.filter((r) => r.finalised && !r.sent && !r.hasAccount);

  const toggleSent = (r: Row) => run(`row:${r.letter.id}`, async () => {
    if (r.sent) {
      if (!confirm(`Take back the letter for ${r.content.to.name}? The ${r.collegeCode} college admin will no longer see it.`)) return;
      await setSent([r.letter.id], false, user?.id ?? null);
      toast({ title: 'Letter taken back' });
    } else {
      if (!r.finalised) return void toast({ title: 'Finalise the letter first' });
      if (!r.hasAccount) return void toast({ title: `${r.collegeCode} is not linked to an account`, description: 'Link it in Import -> Colleges and accounts.' });
      await setSent([r.letter.id], true, user?.id ?? null);
      toast({ title: 'Letter sent', description: `The ${r.collegeCode} college admin can now see and download it.` });
    }
    await reload();
  });

  /** Send the chosen letters (from the send dialog). */
  const sendChosen = async (ids: string[]) => {
    try {
      const n = await setSent(ids, true, user?.id ?? null);
      toast({ title: `${n} letter(s) sent`, description: 'The college admins can now see and download them.' });
      setSendOpen(false);
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  const deleteAllDrafts = () => run('delete-drafts', async () => {
    if (!drafts.length) return;
    if (!confirm(`Delete all ${drafts.length} draft letter(s)? Finalised letters are kept. "Generate letters" can make them again.`)) return;
    const n = await deleteDraftLetters(drafts.map((r) => r.letter.id));
    toast({ title: `${n} draft letter(s) deleted` });
    await reload();
  });

  const remove = (r: Row) => run(`row:${r.letter.id}`, async () => {
    if (!confirm(`Delete the draft letter for ${r.content.to.name}? ${r.activeDuties ? 'They still have duties, so "Generate letters" will make a new one.' : 'They have no duty left.'}`)) return;
    await deleteLetter(r.letter.id);
    await reload();
  });

  const saveEdit = async (c: LetterContent) => {
    if (!editing) return;
    try {
      await updateLetterContent(editing.letter.id, c);
      toast({ title: 'Letter saved' });
      setEditing(null);
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  const pdf = () => import('@/lib/duty/pdf');

  const downloadOne = (r: Row, open = false) => run(`row:${r.letter.id}`, async () => {
    const { renderLetterPdf, downloadBlob, openBlob } = await pdf();
    const blob = await renderLetterPdf(r.content);
    const [name] = letterFileNames([r.content]);
    if (open) openBlob(blob, name);
    else downloadBlob(blob, name);
  });

  const base = (session.title || 'duties').replace(/[^A-Za-z0-9]+/g, '_');
  const exportable = () => {
    const list = rows.filter((r) => r.finalised);
    if (list.length < rows.length && !confirm(`${rows.length - list.length} letter(s) are still drafts. Include only the ${list.length} finalised letter(s)?`)) return null;
    if (!list.length) {
      toast({ title: 'No finalised letters yet' });
      return null;
    }
    return list.map((r) => r.content);
  };

  const zip = () => run('zip', async () => {
    const list = exportable();
    if (!list) return;
    const { lettersZip, downloadBlob } = await pdf();
    downloadBlob(await lettersZip(list), `${base}_letters.zip`);
  });

  const onePdf = () => run('one-pdf', async () => {
    const list = exportable();
    if (!list) return;
    const { allLettersPdf, downloadBlob } = await pdf();
    downloadBlob(await allLettersPdf(list), `${base}_all_letters.pdf`);
  });

  const tableMeta = { title: `${settings.semesterLabel} BCA Practical Examination, ${settings.examMonth}`.trim(), subtitle: 'Examiner duties' };
  const tablePdf = () => run('table-pdf', async () => {
    const { dutyTablePdf, downloadBlob } = await pdf();
    downloadBlob(await dutyTablePdf(dutyTableRows(data), tableMeta), `${base}_duty_table.pdf`);
  });
  const tableXlsx = () => run('table-xlsx', async () => {
    const { dutyTableXlsx, downloadBlob } = await pdf();
    downloadBlob(await dutyTableXlsx(dutyTableRows(data)), `${base}_duty_table.xlsx`);
  });

  if (!data.assignments.some((a) => a.status === 'active')) {
    return <p className="text-muted-foreground">Save an allocation first.</p>;
  }

  const spin = (key: Busy) => busy === key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-6">
      <ContactsCard
        sessionId={sessionId}
        contacts={contacts}
        onSaved={async () => { await onSessionSaved(); await loadShared(); }}
        onError={onError}
      />
      <LetterSettingsCard sessionId={sessionId} settings={settings} onSaved={onSessionSaved} onError={onError} />

      <Card>
        <CardHeader>
          <CardTitle>Letters</CardTitle>
          <CardDescription>
            Each letter is made once and then only changes when you edit it. Finalised letters are locked; un-finalise to edit. Send finalised letters to the college admins one by one or all together: they appear on the admin's My Duties page. PDFs are made on the spot and never stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Examiners without a letter" value={needLetter.length} tone={needLetter.length ? 'warn' : 'ok'} />
            <Stat label="Draft" value={drafts.length} />
            <Stat label="Finalised" value={rows.length - drafts.length} tone={rows.length && !drafts.length ? 'ok' : undefined} />
            <Stat label="Need checking" value={mismatched.length} tone={mismatched.length ? 'warn' : undefined} />
          </div>

          {missing.length > 0 && (
            <Alert>
              <AlertTitle>Fill these in before making letters</AlertTitle>
              <AlertDescription>{missing.join(', ')}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={!needLetter.length || missing.length > 0 || busy !== ''}>
              {spin('generate') || <Sparkles className="mr-2 h-4 w-4" />}
              Generate letters{needLetter.length ? ` (${needLetter.length})` : ''}
            </Button>
            {data.letters.length > 0 && (mismatched.length > 0 || needLetter.length > 0) && (
              <Button onClick={syncAll} disabled={busy !== ''}>
                {spin('sync') || <RefreshCw className="mr-2 h-4 w-4" />} Update letters to match duties ({mismatched.length + needLetter.length})
              </Button>
            )}
            <Button variant="outline" onClick={finaliseAll} disabled={!drafts.length || busy !== ''}>
              {spin('finalise-all') || <Lock className="mr-2 h-4 w-4" />} Finalise all drafts
            </Button>
            <Button variant="outline" onClick={() => setSendOpen(true)} disabled={busy !== ''}>
              <Send className="mr-2 h-4 w-4" /> Send to college admins{sendable.length ? ` (${sendable.length})` : ''}
            </Button>
            <Button variant="outline" onClick={deleteAllDrafts} disabled={!drafts.length || busy !== ''}>
              {spin('delete-drafts') || <Trash2 className="mr-2 h-4 w-4" />} Delete all drafts{drafts.length ? ` (${drafts.length})` : ''}
            </Button>
            <Button variant="outline" onClick={zip} disabled={!rows.length || busy !== ''}>
              {spin('zip') || <FileArchive className="mr-2 h-4 w-4" />} Download all (ZIP)
            </Button>
            <Button variant="outline" onClick={onePdf} disabled={!rows.length || busy !== ''}>
              {spin('one-pdf') || <Printer className="mr-2 h-4 w-4" />} All letters in one PDF
            </Button>
            <Button variant="outline" onClick={tablePdf} disabled={busy !== ''}>
              {spin('table-pdf') || <FileText className="mr-2 h-4 w-4" />} Duty table PDF
            </Button>
            <Button variant="outline" onClick={tableXlsx} disabled={busy !== ''}>
              {spin('table-xlsx') || <FileSpreadsheet className="mr-2 h-4 w-4" />} Duty table Excel
            </Button>
          </div>

          {mismatched.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>{mismatched.length} letter(s) do not match the current duties</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Changes made with the pencil on the Allocate tab update the letters by themselves. These differ because the allocation was run again or a letter was edited by hand: un-finalise, edit the duty rows (or delete the letter if no duty is left), and finalise again. Do not mention the change in the letter.</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {mismatched.map((r) => (
                    <li key={r.letter.id}>
                      {r.content.to.title} {r.content.to.name} ({r.collegeCode}): letter has {r.content.duties.length} duty row(s), current duties {r.activeDuties}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search name, college or number" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All letters</SelectItem>
                    <SelectItem value="draft">Drafts</SelectItem>
                    <SelectItem value="final">Finalised</SelectItem>
                    <SelectItem value="unsent">Finalised, not sent</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="check">Need checking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Examiner</TableHead>
                      <TableHead className="hidden lg:table-cell">Number</TableHead>
                      <TableHead className="hidden md:table-cell">Duties</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((r) => {
                      const rowBusy = busy === `row:${r.letter.id}`;
                      return (
                        <TableRow key={r.letter.id}>
                          <TableCell>
                            <div className="font-medium">{r.content.to.title} {r.content.to.name}</div>
                            <div className="text-xs text-muted-foreground">{r.collegeCode}<span className="lg:hidden"> · {r.content.refNo}</span></div>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-sm lg:table-cell">{r.content.refNo}</TableCell>
                          <TableCell className="hidden text-sm md:table-cell">
                            {r.content.duties.map((d) => `${d.date.slice(8, 10)}/${d.date.slice(5, 7)} ${d.cancelled ? 'Cancelled' : d.centreCode}`).join(', ')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.finalised ? <Badge>Finalised</Badge> : <Badge variant="secondary">Draft</Badge>}
                              {r.sent && <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Sent</Badge>}
                              {r.finalised && !r.sent && !r.hasAccount && <Badge variant="outline" title="Link the college to an account in Import">No account</Badge>}
                              {!r.matches && <Badge variant="destructive">Check duties</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button variant="ghost" size="icon" aria-label="Preview" title="Preview" onClick={() => setPreview(r)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Edit" title={r.finalised ? 'Un-finalise to edit' : 'Edit'} disabled={r.finalised} onClick={() => setEditing(r)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-9" title={r.finalised ? 'Back to draft, so the letter can be edited' : 'Lock the letter'} disabled={rowBusy} onClick={() => toggleFinal(r)}>
                                {r.finalised ? <LockOpen className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
                                {r.finalised ? 'Un-finalise' : 'Finalise'}
                              </Button>
                              {r.finalised && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={r.sent ? 'Take back' : 'Send to college admin'}
                                  title={r.sent ? 'Take back from college admin' : r.hasAccount ? 'Send to college admin' : 'College not linked to an account'}
                                  disabled={rowBusy || (!r.sent && !r.hasAccount)}
                                  onClick={() => toggleSent(r)}
                                >
                                  {r.sent ? <Undo2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" aria-label="Download PDF" title="Download PDF" disabled={rowBusy} onClick={() => downloadOne(r)}>
                                {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              </Button>
                              {!r.finalised && (
                                <Button variant="ghost" size="icon" aria-label="Delete draft" title="Delete draft" disabled={rowBusy} onClick={() => remove(r)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.content.to.title} {preview?.content.to.name}</DialogTitle>
          </DialogHeader>
          {preview && <LetterPreview content={preview.content} />}
          <DialogFooter className="gap-2">
            {preview && (
              <>
                <Button variant="outline" onClick={() => downloadOne(preview, true)}>Open PDF in new tab</Button>
                <Button onClick={() => downloadOne(preview)}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendLettersDialog
        open={sendOpen}
        letters={sendable.map((r) => ({ id: r.letter.id, name: `${r.content.to.title} ${r.content.to.name}`.trim(), collegeCode: r.collegeCode }))}
        noAccount={noAccount.length}
        onClose={() => setSendOpen(false)}
        onSend={sendChosen}
      />

      <LetterEditor
        open={!!editing}
        content={editing?.content ?? null}
        template={() => (editing ? fromTemplate(editing.letter.faculty_id, editing.content.refNo) : null)}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
    </div>
  );
}
