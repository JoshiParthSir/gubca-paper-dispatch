import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, Link2, Loader2 } from 'lucide-react';
import { parseOtherCodes, type MasterCollege } from '@/lib/duty/collegeLink';
import { autoLinkColleges, linkCollege, listMasterColleges, otherCodesOf, saveOtherCodes, type DutyCollege, type SessionRules } from '@/lib/duty/store';
import type { TabProps } from './lookups';

const NONE = '__none__';

/**
 * Links each college of the exam to its account college. The link decides
 * which college admin sees the published duties; the full name is printed
 * in the letters.
 */
export function CollegeLinksCard({ sessionId, data, reload, onError, rules, onRulesChanged }: TabProps & { rules: SessionRules; onRulesChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [master, setMaster] = useState<MasterCollege[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMasterColleges().then(setMaster).catch(onError);
  }, [onError]);

  useEffect(() => {
    setNames(Object.fromEntries(data.colleges.map((c) => [c.id, c.full_name ?? ''])));
    setCodes(Object.fromEntries(data.colleges.map((c) => [c.id, otherCodesOf(rules, c.code).join(', ')])));
  }, [data.colleges, rules]);

  if (!data.colleges.length) return null;

  const used = new Set([
    ...data.faculty.map((f) => f.college_data_id),
    ...data.timetable.map((t) => t.centre_id),
  ]);
  const rows = data.colleges.filter((c) => used.has(c.id));
  const unlinked = rows.filter((c) => !c.college_id).length;

  const setLink = async (c: DutyCollege, value: string) => {
    const m = master.find((x) => x.id === value);
    try {
      await linkCollege(c.id, {
        college_id: m?.id ?? null,
        ...(m && !c.full_name ? { full_name: m.name } : {}),
      });
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  const saveName = async (c: DutyCollege) => {
    const v = (names[c.id] ?? '').trim();
    if (v === (c.full_name ?? '')) return;
    try {
      await linkCollege(c.id, { full_name: v || null });
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  const saveCodes = async (c: DutyCollege) => {
    const next = parseOtherCodes(codes[c.id] ?? '');
    if (next.join(',') === otherCodesOf(rules, c.code).join(',')) {
      setCodes((x) => ({ ...x, [c.id]: next.join(', ') }));
      return;
    }
    try {
      await saveOtherCodes(sessionId, c.code, next);
      await onRulesChanged();
    } catch (e) {
      onError(e);
    }
  };

  const auto = async () => {
    setBusy(true);
    try {
      const n = await autoLinkColleges(sessionId);
      toast({ title: n ? `${n} college(s) linked` : 'Nothing new to link', description: n ? undefined : 'Pick the rest by hand.' });
      await reload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> 3. Colleges and accounts</CardTitle>
        <CardDescription>
          Link each college to its account so its college admin can see the published duties. The full name is printed in the letters.
          "Other codes" are the other names a college goes by (e.g. AAKMS is CCCA in the timetable); centres and accounts with these codes are linked automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={auto} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Link by code
          </Button>
          <span className="text-sm text-muted-foreground">
            {unlinked ? `${unlinked} of ${rows.length} not linked` : `All ${rows.length} linked`}
          </span>
        </div>
        {unlinked > 0 && (
          <Alert>
            <AlertDescription>
              A college that is not linked gets no access to its duties after publishing. Leave it unlinked only if it has no account.
            </AlertDescription>
          </Alert>
        )}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead className="min-w-[160px]">Other codes</TableHead>
                <TableHead className="min-w-[220px]">Account</TableHead>
                <TableHead className="min-w-[280px]">Full name in letters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className={c.college_id ? '' : 'bg-amber-500/5'}>
                  <TableCell className="font-medium">
                    {c.code}
                    {c.raw_name !== c.code && <div className="text-xs text-muted-foreground">{c.raw_name}</div>}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={codes[c.id] ?? ''}
                      placeholder="e.g. CCCA"
                      onChange={(e) => setCodes((x) => ({ ...x, [c.id]: e.target.value }))}
                      onBlur={() => saveCodes(c)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={c.college_id ?? NONE} onValueChange={(v) => setLink(c, v === NONE ? '' : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not linked</SelectItem>
                        {master.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.code} · {m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={names[c.id] ?? ''}
                      placeholder={c.raw_name}
                      onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                      onBlur={() => saveName(c)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
