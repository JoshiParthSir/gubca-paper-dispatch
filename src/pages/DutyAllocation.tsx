import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageSkeleton } from '@/components/PageFallback';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import {
  createSession,
  listSessions,
  loadSessionData,
  readRules,
  type DutySession,
  type SessionData,
} from '@/lib/duty/store';
import { ImportTab } from '@/components/duty/ImportTab';
import { FacultyTab } from '@/components/duty/FacultyTab';
import { RulesTab } from '@/components/duty/RulesTab';
import { AllocateTab } from '@/components/duty/AllocateTab';

const EMPTY: SessionData = { subjects: [], colleges: [], faculty: [], timetable: [], assignments: [] };

export default function DutyAllocation() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useCachedState<DutySession[]>('duty:sessions', []);
  const [loading, setLoading] = useState(!hasCached('duty:sessions'));
  const [data, setData] = useState<SessionData>(EMPTY);
  const [loadingData, setLoadingData] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('import');

  const sessionId = params.get('s') ?? sessions[0]?.id ?? '';
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const rules = readRules(session);

  const onError = useCallback((e: unknown) => {
    toast({ title: 'Error', description: (e as { message?: string })?.message ?? 'Something went wrong', variant: 'destructive' });
  }, [toast]);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [setSessions, onError]);

  const reload = useCallback(async () => {
    if (!sessionId) return setData(EMPTY);
    setLoadingData(true);
    try {
      setData(await loadSessionData(sessionId));
    } catch (e) {
      onError(e);
    } finally {
      setLoadingData(false);
    }
  }, [sessionId, onError]);

  useEffect(() => { void refreshSessions(); }, [refreshSessions]);
  useEffect(() => { void reload(); }, [reload]);

  const create = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const s = await createSession(title);
      setNewTitle('');
      await refreshSessions();
      setParams({ s: s.id });
      setTab('import');
    } catch (e) {
      onError(e);
    } finally {
      setCreating(false);
    }
  };

  if (profile && profile.role !== 'chairperson') {
    return <p className="text-muted-foreground">Duty allocation is managed by the chairperson.</p>;
  }
  if (loading) return <PageSkeleton cards={3} />;

  const tabProps = { sessionId, data, reload, onError };
  const seniors = data.faculty.filter((f) => f.is_senior).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Duty Allocation</h1>
          <p className="text-sm text-muted-foreground">Practical examiner duties: import, mark seniors, allocate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 0 && (
            <Select value={sessionId} onValueChange={(v) => setParams({ s: v })}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Choose an exam" /></SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="New exam, e.g. BCA Sem 5 Nov 2026"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="w-[260px]"
          />
          <Button onClick={create} disabled={!newTitle.trim() || creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New
          </Button>
        </div>
      </div>

      {!session ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Create an exam to start.</CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList className="flex-wrap">
              <TabsTrigger value="import">1. Import</TabsTrigger>
              <TabsTrigger value="faculty">2. Faculty{data.faculty.length ? ` (${seniors} senior)` : ''}</TabsTrigger>
              <TabsTrigger value="rules">3. Rules</TabsTrigger>
              <TabsTrigger value="allocate">4. Allocate</TabsTrigger>
            </TabsList>
            <Badge variant="outline" className="capitalize">{session.status}</Badge>
            {loadingData && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <TabsContent value="import" className="mt-4"><ImportTab {...tabProps} /></TabsContent>
          <TabsContent value="faculty" className="mt-4"><FacultyTab {...tabProps} /></TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RulesTab {...tabProps} rules={rules} onSaved={refreshSessions} />
          </TabsContent>
          <TabsContent value="allocate" className="mt-4"><AllocateTab {...tabProps} rules={rules} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
