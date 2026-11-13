import { useCallback, useEffect, useState } from 'react';
import { PageSkeleton } from '@/components/PageFallback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Download, FileArchive, Loader2 } from 'lucide-react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { fmtDate } from '@/components/duty/lookups';
import { letterFileNames, readLetterContent, type LetterContent } from '@/lib/duty/letter';
import { comingVisible, loadMyDuties, logDutyDownload, readRules, type MyDutiesData, type SessionData, type DutySession } from '@/lib/duty/store';

/**
 * College admin view of published duties. Row level security decides what
 * comes back (own college only, active duties, finalised letters); this
 * page shows exactly that and nothing else. Read only.
 */
export default function MyDuties() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useCachedState<MyDutiesData>('duty:mine', { sessions: [], data: {} });
  const [loading, setLoading] = useState(!hasCached('duty:mine'));

  const onError = useCallback((e: unknown) => {
    toast({ title: 'Error', description: (e as { message?: string })?.message ?? 'Something went wrong', variant: 'destructive' });
  }, [toast]);

  useEffect(() => {
    loadMyDuties()
      .then(setState)
      .catch(onError)
      .finally(() => setLoading(false));
  }, [setState, onError]);

  if (loading) return <PageSkeleton cards={2} />;

  return (
    <div className="space-y-6">
      <div>
        <h1>My Duties</h1>
        <p className="text-sm text-muted-foreground">Duty letters sent to your college, and the duties once the chairperson publishes them.</p>
      </div>
      {!state.sessions.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing has been sent or published yet.</CardContent></Card>
      ) : (
        state.sessions.map((s) => (
          <SessionDuties key={s.id} session={s} data={state.data[s.id]} myCollegeId={profile?.college_id ?? null} onError={onError} />
        ))
      )}
    </div>
  );
}

function SessionDuties({ session, data, myCollegeId, onError }: { session: DutySession; data: SessionData | undefined; myCollegeId: string | null; onError: (e: unknown) => void }) {
  const [busy, setBusy] = useState('');
  if (!data) return null;

  const college = new Map(data.colleges.map((c) => [c.id, c]));
  const faculty = new Map(data.faculty.map((f) => [f.id, f]));
  const subject = new Map(data.subjects.map((s) => [s.code, s.name]));
  const mine = new Set(data.colleges.filter((c) => myCollegeId && c.college_id === myCollegeId).map((c) => c.id));
  const letterOf = new Map(data.letters.map((l) => [l.faculty_id, readLetterContent(l.content)]));

  const sortDuty = (a: { exam_date: string }, b: { exam_date: string }) => a.exam_date.localeCompare(b.exam_date);
  const ours = data.assignments.filter((a) => {
    const f = faculty.get(a.faculty_id);
    return f && mine.has(f.college_data_id);
  }).sort(sortDuty);
  const coming = data.assignments.filter((a) => mine.has(a.centre_id)).sort(sortDuty);

  // Letters sent by the chairperson (RLS returns only those), shown even
  // before the duties are published.
  const letters: { facultyId: string; content: LetterContent }[] = [...letterOf]
    .map(([facultyId, content]) => ({ facultyId, content }))
    .sort((a, b) => a.content.to.name.localeCompare(b.content.to.name));
  const published = session.status === 'published';
  // The chairperson decides which colleges see the examiners coming to them.
  const showComing = readRules(session).showComing;
  const comingAllowed = [...mine].some((id) => comingVisible(showComing, id));

  const pdf = () => import('@/lib/duty/pdf');
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };
  const one = (facultyId: string) => run(facultyId, async () => {
    const c = letterOf.get(facultyId);
    if (!c) return;
    const { renderLetterPdf, downloadBlob } = await pdf();
    downloadBlob(await renderLetterPdf(c), letterFileNames([c])[0]);
    // The chairperson sees who downloaded which letter.
    void logDutyDownload({
      sessionId: session.id,
      collegeId: myCollegeId,
      kind: 'letter',
      letterId: data.letters.find((l) => l.faculty_id === facultyId)?.id ?? null,
      facultyId,
      detail: `${c.to.title} ${c.to.name}`.trim(),
    });
  });
  const all = () => run('zip', async () => {
    const { lettersZip, downloadBlob } = await pdf();
    downloadBlob(await lettersZip(letters.map((l) => l.content)), `${session.title.replace(/[^A-Za-z0-9]+/g, '_')}_letters.zip`);
    void logDutyDownload({
      sessionId: session.id,
      collegeId: myCollegeId,
      kind: 'all_letters',
      detail: `${letters.length} letter(s): ${letters.map((l) => `${l.content.to.title} ${l.content.to.name}`.trim()).join(', ')}`,
    });
  });

  const name = (id: string) => {
    const f = faculty.get(id);
    return f ? `${f.title} ${f.name}` : '–';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{session.title}</CardTitle>
        <CardDescription>{[session.semester_label, session.exam_month].filter(Boolean).join(' · ')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Duty letters received</h3>
            {letters.length > 1 && (
              <Button variant="outline" size="sm" onClick={all} disabled={busy !== ''}>
                {busy === 'zip' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
                Download all letters (ZIP)
              </Button>
            )}
          </div>
          {!letters.length ? (
            <p className="text-sm text-muted-foreground">No letters have been sent to your college yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Examiner</TableHead>
                    <TableHead>Duties</TableHead>
                    <TableHead className="text-right">Letter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map(({ facultyId, content }) => (
                    <TableRow key={facultyId}>
                      <TableCell className="font-medium">{content.to.title} {content.to.name}</TableCell>
                      <TableCell className="text-sm">
                        {content.duties.map((d) => `${fmtDate(d.date)} · ${d.cancelled ? 'Cancelled' : d.centreCode} · ${d.subject}`).join('; ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => one(facultyId)} disabled={busy !== ''}>
                          {busy === facultyId ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {published && (
        <section className="space-y-3">
          <h3 className="font-semibold">Our faculty's duties</h3>
          {!ours.length ? (
            <p className="text-sm text-muted-foreground">None of your faculty has a duty in this exam.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Examiner</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Centre</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Letter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ours.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{name(a.faculty_id)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(a.exam_date)}</TableCell>
                      <TableCell>{college.get(a.centre_id)?.code}</TableCell>
                      <TableCell>{subject.get(a.subject_code) ?? a.subject_code}</TableCell>
                      <TableCell className="text-right">
                        {letterOf.has(a.faculty_id) ? (
                          <Button variant="ghost" size="sm" onClick={() => one(a.faculty_id)} disabled={busy !== ''}>
                            {busy === a.faculty_id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                            PDF
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not sent yet</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
        )}

        {published && comingAllowed && (
        <section className="space-y-3">
          <h3 className="font-semibold">Examiners coming to our college</h3>
          {!coming.length ? (
            <p className="text-sm text-muted-foreground">Your college is not an examination centre in this exam.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Examiner</TableHead>
                    <TableHead>Their college</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coming.map((a) => {
                    const f = faculty.get(a.faculty_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(a.exam_date)}</TableCell>
                        <TableCell>{subject.get(a.subject_code) ?? a.subject_code}</TableCell>
                        <TableCell className="font-medium">{name(a.faculty_id)}</TableCell>
                        <TableCell>{f ? college.get(f.college_data_id)?.code : '–'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
        )}
      </CardContent>
    </Card>
  );
}
