import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { CancellationExportRow } from '@/lib/duty/pdf';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fmtDate, useLookups, type TabProps } from './lookups';

/**
 * The only place a cancelled duty is shown (rule 4). Allocation, letters
 * and the college admin's view read active duties only.
 */
export function CancellationsTab({ data, onError, title = 'Duties' }: TabProps & { title?: string }) {
  const { college, faculty, subject } = useLookups(data);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'pdf' | 'xlsx'>('');

  const cancelled = useMemo(
    () => data.assignments
      .filter((a) => a.status === 'cancelled')
      .sort((a, b) => (b.cancelled_at ?? '').localeCompare(a.cancelled_at ?? '')),
    [data.assignments],
  );
  const byId = useMemo(() => new Map(data.assignments.map((a) => [a.id, a])), [data.assignments]);

  useEffect(() => {
    const ids = [...new Set(cancelled.map((a) => a.cancelled_by).filter((x): x is string => !!x))];
    if (!ids.length) return;
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', ids)
      .then(({ data: rows, error }) => {
        if (error) return onError(error);
        setPeople(Object.fromEntries((rows ?? []).map((r) => [r.user_id, r.full_name])));
      });
  }, [cancelled, onError]);

  const who = (id: string | null | undefined) => {
    const f = id ? faculty.get(id) : undefined;
    return f ? `${f.title} ${f.name} (${college.get(f.college_data_id)?.code ?? ''})` : '–';
  };

  // The same record for download, oldest first (by duty date).
  const exportRows = (): CancellationExportRow[] => [...cancelled]
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || (a.cancelled_at ?? '').localeCompare(b.cancelled_at ?? ''))
    .map((a) => {
      const f = faculty.get(a.faculty_id);
      const next = a.replaced_by ? byId.get(a.replaced_by) : undefined;
      const nf = next ? faculty.get(next.faculty_id) : undefined;
      return {
        date: a.exam_date,
        centre: college.get(a.centre_id)?.code ?? '',
        subjectCode: a.subject_code,
        subject: subject.get(a.subject_code)?.name ?? a.subject_code,
        examiner: f ? `${f.title} ${f.name}` : '',
        examinerCollege: f ? college.get(f.college_data_id)?.code ?? '' : '',
        seat: a.seat_role === 'senior' ? 'Senior' : 'Junior',
        reason: a.cancel_reason ?? '',
        givenTo: nf ? `${nf.title} ${nf.name}${next?.status === 'cancelled' ? ' (also cancelled later)' : ''}` : a.replaced_by ? 'Later removed' : 'Not given to anyone',
        givenToCollege: nf ? college.get(nf.college_data_id)?.code ?? '' : '',
        when: a.cancelled_at ? new Date(a.cancelled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '',
        by: (a.cancelled_by && people[a.cancelled_by]) || 'Chairperson',
      };
    });

  const base = title.replace(/[^A-Za-z0-9]+/g, '_');
  const download = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind);
    try {
      const { cancellationsPdf, cancellationsXlsx, downloadBlob } = await import('@/lib/duty/pdf');
      const rows = exportRows();
      if (kind === 'pdf') {
        downloadBlob(await cancellationsPdf(rows, { title: `${title}: cancelled duties`, subtitle: `${rows.length} cancelled duty record(s)` }), `${base}_cancellations.pdf`);
      } else {
        downloadBlob(await cancellationsXlsx(rows), `${base}_cancellations.xlsx`);
      }
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancellations</CardTitle>
        <CardDescription>
          Cancelled duties and who took them over, one row per cancelled day. Download it as Excel or PDF to keep on file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cancelled.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => download('xlsx')} disabled={busy !== ''}>
              {busy === 'xlsx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => download('pdf')} disabled={busy !== ''}>
              {busy === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        )}
        {!cancelled.length ? (
          <p className="text-sm text-muted-foreground">No duty has been cancelled.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Cancelled examiner</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Given to</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelled.map((a) => {
                  const next = a.replaced_by ? byId.get(a.replaced_by) : undefined;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(a.exam_date)}</TableCell>
                      <TableCell>{college.get(a.centre_id)?.code}</TableCell>
                      <TableCell>{subject.get(a.subject_code)?.name ?? a.subject_code}</TableCell>
                      <TableCell>{who(a.faculty_id)}<div className="text-xs text-muted-foreground capitalize">{a.seat_role} seat</div></TableCell>
                      <TableCell>{a.cancel_reason}</TableCell>
                      <TableCell>
                        {next ? who(next.faculty_id) : a.replaced_by ? 'Later removed' : 'Not given to anyone'}
                        {next?.status === 'cancelled' && <div className="text-xs text-muted-foreground">also cancelled later</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {a.cancelled_at && new Date(a.cancelled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell className="text-sm">{(a.cancelled_by && people[a.cancelled_by]) || 'Chairperson'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
