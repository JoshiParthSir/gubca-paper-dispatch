import { useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { parseFormResponses, type ParsedForm } from '@/lib/duty/formImport';
import { collegeKey } from '@/lib/duty/names';
import { downloadTimetableTemplate, readSheetRows, SHEET_ACCEPT } from '@/lib/duty/readSheet';
import { saveFormImport, saveTimetable } from '@/lib/duty/store';
import { matchCentres, parseTimetable, type ParsedTimetable } from '@/lib/duty/timetableImport';
import { shortCode, type TabProps } from './lookups';

const NEW_CENTRE = '__new__';

function FilePick({ label, onFile, busy }: { label: string; onFile: (f: File) => void; busy: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={SHEET_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {label}
      </Button>
    </>
  );
}

function Warnings({ items }: { items: { college?: string; message: string }[] }) {
  if (!items.length) return null;
  return (
    <Alert>
      <AlertTitle>Please check ({items.length})</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {items.map((w, i) => (
            <li key={i}>{w.college ? <b>{w.college}: </b> : null}{w.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function ImportTab({ sessionId, data, reload, onError }: TabProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ParsedForm | null>(null);
  const [timetable, setTimetable] = useState<ParsedTimetable | null>(null);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<'' | 'form' | 'tt' | 'save-form' | 'save-tt'>('');

  const readForm = async (file: File) => {
    setBusy('form');
    try {
      setForm(parseFormResponses(await readSheetRows(file)));
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  const readTimetable = async (file: File) => {
    setBusy('tt');
    try {
      const tt = parseTimetable(await readSheetRows(file));
      const matches = matchCentres(
        tt.rows.map((r) => r.centreCode),
        data.colleges.map((c) => ({ key: collegeKey(c.code), email: c.email })),
      );
      const idByKey = new Map(data.colleges.map((c) => [collegeKey(c.code), c.id]));
      setLinks(new Map(matches.map((m) => [m.centreCode, m.collegeKey ? idByKey.get(m.collegeKey)! : NEW_CENTRE])));
      setTimetable(tt);
      setChecked(!matches.some((m) => m.confidence !== 'exact'));
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  const centreRows = useMemo(() => {
    if (!timetable) return [];
    const matches = matchCentres(
      timetable.rows.map((r) => r.centreCode),
      data.colleges.map((c) => ({ key: collegeKey(c.code), email: c.email })),
    );
    return matches.map((m) => {
      const rows = timetable.rows.filter((r) => r.centreCode === m.centreCode);
      return {
        ...m,
        students: rows.reduce((a, r) => a + (r.students ?? 0), 0),
        batches: rows.length,
        dates: [...new Set(rows.map((r) => r.date))],
        subjects: [...new Set(rows.map((r) => shortCode(r.subjectCode)))],
      };
    });
  }, [timetable, data.colleges]);

  const saveForm = async () => {
    if (!form) return;
    setBusy('save-form');
    try {
      await saveFormImport(sessionId, form);
      toast({ title: 'College data saved', description: `${form.colleges.length} colleges, ${form.colleges.reduce((a, c) => a + c.faculty.length, 0)} faculty.` });
      setForm(null);
      await reload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  const saveTt = async () => {
    if (!timetable) return;
    setBusy('save-tt');
    try {
      const map = new Map([...links].map(([code, id]) => [code, id === NEW_CENTRE ? null : id]));
      await saveTimetable(sessionId, timetable.rows, map, data.subjects);
      toast({ title: 'Timetable saved', description: `${timetable.rows.length} batches.` });
      setTimetable(null);
      await reload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  const savedFaculty = data.faculty.length;
  const needsCheck = centreRows.some((r) => r.confidence !== 'exact');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> 1. College data (Google Form responses)</CardTitle>
          <CardDescription>
            Download the responses from Google Sheets as .xlsx and upload them here. Every faculty member is kept: those who teach the practical are preferred, the rest stay as backup. If a college answered twice, the latest answer is used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FilePick label="Upload form responses" onFile={readForm} busy={busy === 'form'} />
            {savedFaculty > 0 && (
              <span className="text-sm text-muted-foreground">Saved: {data.colleges.length} colleges, {savedFaculty} faculty</span>
            )}
          </div>

          {form && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {form.subjects.map((s) => (
                  <Badge key={s.code} variant={s.isPractical ? 'default' : 'outline'} title={s.name}>
                    {s.code}{s.isPractical ? ' · practical' : ''}
                  </Badge>
                ))}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>College</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">PCs</TableHead>
                      <TableHead>Faculty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.colleges.map((c) => (
                      <TableRow key={c.key}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell className="text-right">{c.students ?? '–'}</TableCell>
                        <TableCell className="text-right">{c.pcs ?? '–'}</TableCell>
                        <TableCell className="text-sm">
                          {c.faculty.map((f) => `${f.title} ${f.name}${f.isVisiting ? ' (visiting)' : ''}`).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Warnings items={form.warnings} />
              <div className="flex gap-2">
                <Button onClick={saveForm} disabled={busy === 'save-form'}>
                  {busy === 'save-form' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save college data
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)}>Discard</Button>
              </div>
              {savedFaculty > 0 && (
                <p className="text-xs text-muted-foreground">Saving again updates names and subjects. Senior / available marks you set stay as they are.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> 2. Practical timetable</CardTitle>
          <CardDescription>
            One row per batch: Date, Centre, Subject Code, Batch, Seat From, Seat To. The practical subjects are taken from this file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FilePick label="Upload timetable" onFile={readTimetable} busy={busy === 'tt'} />
            <Button variant="ghost" onClick={() => downloadTimetableTemplate().catch(onError)}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            {data.timetable.length > 0 && (
              <span className="text-sm text-muted-foreground">Saved: {data.timetable.length} batches</span>
            )}
          </div>
          {!data.colleges.length && <p className="text-sm text-muted-foreground">Save the college data first, so centres can be linked to colleges.</p>}

          {timetable && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Centre in timetable</TableHead>
                      <TableHead>College in form data</TableHead>
                      <TableHead>Practicals</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead>Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {centreRows.map((r) => (
                      <TableRow key={r.centreCode} className={r.confidence !== 'exact' ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-medium">
                          {r.centreCode}
                          {r.confidence === 'check' && <Badge variant="outline" className="ml-2 border-amber-500/60">Check</Badge>}
                          {r.confidence === 'none' && <Badge variant="destructive" className="ml-2">Not found</Badge>}
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <Select
                            value={links.get(r.centreCode)}
                            onValueChange={(v) => setLinks((m) => new Map(m).set(r.centreCode, v))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {data.colleges.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.code}{c.email ? ` · ${c.email}` : ''}</SelectItem>
                              ))}
                              <SelectItem value={NEW_CENTRE}>New centre (did not fill the form)</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{r.subjects.join(', ')}</TableCell>
                        <TableCell className="text-right">{r.students} · {r.batches} batches</TableCell>
                        <TableCell className="text-sm">{r.dates.join(', ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Warnings items={timetable.warnings} />
              {needsCheck && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                  I have checked the centres marked "Check" / "Not found". The linked college decides the PCs and keeps its own faculty from examining there.
                </label>
              )}
              <div className="flex gap-2">
                <Button onClick={saveTt} disabled={!checked || busy === 'save-tt' || !data.colleges.length}>
                  {busy === 'save-tt' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save timetable
                </Button>
                <Button variant="ghost" onClick={() => setTimetable(null)}>Discard</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
