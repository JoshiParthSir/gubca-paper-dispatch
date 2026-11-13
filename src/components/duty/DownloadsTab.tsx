import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { MasterCollege } from '@/lib/duty/collegeLink';
import { listDutyDownloads, listMasterColleges, type DutyDownload } from '@/lib/duty/store';
import { Stat } from './shared';
import { useLookups, type TabProps } from './lookups';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Which college admin downloaded which duty letter, and when. */
export function DownloadsTab({ sessionId, data, onError, title = 'Duties' }: TabProps & { title?: string }) {
  const { faculty, college: dutyCollege } = useLookups(data);
  const [logs, setLogs] = useState<DutyDownload[]>([]);
  const [colleges, setColleges] = useState<Map<string, MasterCollege>>(new Map());
  const [people, setPeople] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, master] = await Promise.all([listDutyDownloads(sessionId), listMasterColleges()]);
      setLogs(rows);
      setColleges(new Map(master.map((c) => [c.id, c])));
      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (ids.length) {
        const { data: ps, error } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        if (error) throw error;
        setPeople(Object.fromEntries((ps ?? []).map((p) => [p.user_id, p.full_name])));
      }
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [sessionId, onError]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => logs.map((l) => {
    const f = l.faculty_id ? faculty.get(l.faculty_id) : undefined;
    const c = l.college_id ? colleges.get(l.college_id) : undefined;
    return {
      ...l,
      collegeText: c ? `${c.code} · ${c.name}` : '–',
      by: people[l.user_id] ?? 'College admin',
      what: l.kind === 'all_letters'
        ? `All letters (ZIP)${l.detail ? `: ${l.detail}` : ''}`
        : f ? `${f.title} ${f.name} (${dutyCollege.get(f.college_data_id)?.code ?? ''})` : l.detail ?? 'Letter',
    };
  }), [logs, faculty, colleges, people, dutyCollege]);

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.collegeText} ${r.by} ${r.what}`.toLowerCase().includes(q));
  const collegesDownloaded = new Set(logs.map((l) => l.college_id).filter(Boolean)).size;

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const aoa: (string | number)[][] = [
        ['No.', 'Downloaded on', 'College', 'Downloaded by', 'What'],
        ...shown.map((r, i) => [i + 1, when(r.downloaded_at), r.collegeText, r.by, r.what]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [5, 22, 40, 26, 60].map((wch) => ({ wch }));
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 4 } }) };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Letter downloads');
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const { downloadBlob } = await import('@/lib/duty/pdf');
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${title.replace(/[^A-Za-z0-9]+/g, '_')}_letter_downloads.xlsx`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Letter downloads</CardTitle>
        <CardDescription>Every time a college admin downloads a duty letter (one PDF or all as ZIP), with the college, the account and the time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Downloads" value={logs.length} />
          <Stat label="Colleges that downloaded" value={collegesDownloaded} />
          <Stat label="Letters sent" value={data.letters.filter((l) => l.sent_at).length} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search college, person or examiner" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh
          </Button>
          <Button variant="outline" onClick={exportXlsx} disabled={busy || !shown.length}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />} Download Excel
          </Button>
        </div>
        {!loading && !logs.length ? (
          <p className="text-sm text-muted-foreground">No letter has been downloaded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Downloaded on</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead>Downloaded by</TableHead>
                  <TableHead>What</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{when(r.downloaded_at)}</TableCell>
                    <TableCell className="text-sm">{r.collegeText}</TableCell>
                    <TableCell className="text-sm">{r.by}</TableCell>
                    <TableCell className="text-sm">{r.what}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
