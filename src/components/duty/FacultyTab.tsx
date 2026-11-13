import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { facultyTier } from '@/lib/duty/pools';
import { setSeniors, updateFaculty, type DutyFaculty } from '@/lib/duty/store';
import { Stat } from './shared';
import { shortCode, useLookups, type TabProps } from './lookups';

const ALL = '__all__';

export function FacultyTab({ data, reload, onError }: TabProps) {
  const { college, practicalCodes } = useLookups(data);
  const [search, setSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState(ALL);
  const [show, setShow] = useState<'all' | 'teaches' | 'backup'>('all');
  const [local, setLocal] = useState<Record<string, Partial<DutyFaculty>>>({});

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.faculty
      .map((f) => ({ ...f, ...local[f.id] }))
      .filter((f) => collegeFilter === ALL || f.college_data_id === collegeFilter)
      .filter((f) => !q || f.name.toLowerCase().includes(q) || college.get(f.college_data_id)?.code.toLowerCase().includes(q))
      .filter((f) => {
        if (show === 'all') return true;
        const teaches = practicalCodes.some((p) => facultyTier(f.subject_codes, p, practicalCodes) === 'subject');
        return show === 'teaches' ? teaches : !teaches;
      })
      .sort((a, b) =>
        (college.get(a.college_data_id)?.code ?? '').localeCompare(college.get(b.college_data_id)?.code ?? '')
        || a.name.localeCompare(b.name));
  }, [data.faculty, local, search, collegeFilter, show, college, practicalCodes]);

  const merged = data.faculty.map((f) => ({ ...f, ...local[f.id] }));
  const seniors = merged.filter((f) => f.is_senior).length;
  const available = merged.filter((f) => f.is_available).length;

  const toggle = async (f: DutyFaculty, patch: Partial<DutyFaculty>) => {
    setLocal((m) => ({ ...m, [f.id]: { ...m[f.id], ...patch } }));
    try {
      await updateFaculty(f.id, patch);
    } catch (e) {
      setLocal((m) => ({ ...m, [f.id]: { ...m[f.id], ...Object.fromEntries(Object.keys(patch).map((k) => [k, f[k as keyof DutyFaculty]])) } }));
      onError(e);
    }
  };

  const bulkSenior = async (value: boolean) => {
    const ids = rows.map((r) => r.id);
    if (!ids.length || !confirm(`Mark ${ids.length} shown faculty as ${value ? 'senior' : 'junior'}?`)) return;
    try {
      await setSeniors(ids, value);
      setLocal({});
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  if (!data.faculty.length) {
    return <p className="text-muted-foreground">Import the college data first.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty and seniors</CardTitle>
        <CardDescription>
          Mark the senior faculty. Every senior gets a duty before any junior does. Switch off anyone who cannot take a duty.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Faculty" value={merged.length} />
          <Stat label="Seniors" value={seniors} tone={seniors ? undefined : 'warn'} />
          <Stat label="Available" value={available} />
          <Stat label="Visiting" value={merged.filter((f) => f.is_visiting).length} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search name or college" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={collegeFilter} onValueChange={setCollegeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All colleges</SelectItem>
              {data.colleges.filter((c) => data.faculty.some((f) => f.college_data_id === c.id)).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {practicalCodes.length > 0 && (
            <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="teaches">Teaches a practical</SelectItem>
                <SelectItem value="backup">Backup only</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => bulkSenior(true)}>Shown → senior</Button>
            <Button variant="outline" size="sm" onClick={() => bulkSenior(false)}>Shown → junior</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>College</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead className="text-center">Senior</TableHead>
                <TableHead className="text-center">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id} className={f.is_available ? '' : 'opacity-50'}>
                  <TableCell className="font-medium">{college.get(f.college_data_id)?.code}</TableCell>
                  <TableCell>
                    {f.title} {f.name}
                    {f.is_visiting && <Badge variant="outline" className="ml-2">Visiting</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {f.subject_codes.map((c) => (
                        <Badge key={c} variant={practicalCodes.includes(c) ? 'default' : 'outline'} className="font-mono text-[11px]">{shortCode(c)}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={f.is_senior} onCheckedChange={(v) => toggle(f, { is_senior: v })} aria-label={`Senior: ${f.name}`} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={f.is_available} onCheckedChange={(v) => toggle(f, { is_available: v })} aria-label={`Available: ${f.name}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {practicalCodes.length > 0 && (
          <p className="text-xs text-muted-foreground">Filled badges are practicals in this timetable.</p>
        )}
      </CardContent>
    </Card>
  );
}
