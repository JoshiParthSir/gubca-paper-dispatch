import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  Ban, ClipboardList, Download, FileText, Globe, GlobeLock, Loader2, Plus, SlidersHorizontal, Upload, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { hasCached, useCachedState } from '@/lib/page-cache';
import {
  createSession,
  listSessions,
  loadSessionData,
  readRules,
  setPublished,
  type DutySession,
  type SessionData,
} from '@/lib/duty/store';
import { ImportTab } from '@/components/duty/ImportTab';
import { FacultyTab } from '@/components/duty/FacultyTab';
import { RulesTab } from '@/components/duty/RulesTab';
import { AllocateTab } from '@/components/duty/AllocateTab';
import { LettersTab } from '@/components/duty/LettersTab';
import { CancellationsTab } from '@/components/duty/CancellationsTab';
import { ExamActions } from '@/components/duty/ExamActions';
import { ComingViewDialog } from '@/components/duty/ComingViewDialog';
import { DownloadsTab } from '@/components/duty/DownloadsTab';

const EMPTY: SessionData = { subjects: [], colleges: [], faculty: [], timetable: [], assignments: [], letters: [] };

interface Step {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Small count shown next to the label. */
  count?: number;
}

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
  const [publishing, setPublishing] = useState(false);

  const sessionId = params.get('s') ?? sessions[0]?.id ?? '';
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  // Memoised so the Rules form is not reset on every re-render.
  const rules = useMemo(() => readRules(session), [session]);

  // Errors stay on the page until closed: only one toast shows at a time, so
  // a later success message would otherwise hide an error before it is read.
  const [lastError, setLastError] = useState<{ message: string; at: Date } | null>(null);
  const onError = useCallback((e: unknown) => {
    const message = (e as { message?: string })?.message ?? 'Something went wrong';
    console.error('[duty]', e);
    setLastError({ message, at: new Date() });
    toast({ title: 'Error', description: message, variant: 'destructive', duration: Infinity });
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
  const published = session?.status === 'published';

  // Publish only when every examiner with a duty has a finalised letter.
  const examiners = new Set(data.assignments.filter((a) => a.status === 'active').map((a) => a.faculty_id));
  const finalised = new Set(data.letters.filter((l) => l.finalised_at).map((l) => l.faculty_id));
  const notReady = [...examiners].filter((id) => !finalised.has(id)).length;
  const cancelledCount = data.assignments.filter((a) => a.status === 'cancelled').length;
  const steps: Step[] = [
    { value: 'import', label: 'Import', icon: Upload },
    { value: 'faculty', label: data.faculty.length ? `Faculty (${seniors} senior)` : 'Faculty', icon: Users },
    { value: 'rules', label: 'Rules', icon: SlidersHorizontal },
    { value: 'allocate', label: 'Allocate', icon: ClipboardList },
    { value: 'letters', label: 'Letters', icon: FileText, count: data.letters.length },
    { value: 'cancellations', label: 'Cancellations', icon: Ban, count: cancelledCount },
    { value: 'downloads', label: 'Downloads', icon: Download },
  ];

  const togglePublish = async () => {
    if (!session) return;
    const msg = published
      ? 'Unpublish? College admins lose access to these duties and letters until you publish again.'
      : `Publish? Each college admin will see their faculty's duties and the examiners coming to their college. Letters are sent separately from the Letters tab.`;
    if (!confirm(msg)) return;
    setPublishing(true);
    try {
      await setPublished(session.id, !published);
      toast({ title: published ? 'Unpublished' : 'Published' });
      await refreshSessions();
    } catch (e) {
      onError(e);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1>Duty Allocation</h1>
        <p className="text-sm text-muted-foreground">Practical examiner duties: import, mark seniors, allocate, letters, publish.</p>
      </div>

      {/* Exam: choose, options, create */}
      <Card>
        <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
          <div className="flex min-w-0 items-center gap-2">
            {sessions.length > 0 ? (
              <Select value={sessionId} onValueChange={(v) => { setParams({ s: v }); setTab('import'); }}>
                <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex-1 text-sm text-muted-foreground">No exam yet. Create one to start.</span>
            )}
            {session && (
              <ExamActions
                session={session}
                data={data}
                onRenamed={refreshSessions}
                onCleared={reload}
                onDeleted={async () => {
                  setParams({});
                  setData(EMPTY);
                  setTab('import');
                  await refreshSessions();
                }}
                onError={onError}
              />
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Input
              placeholder="New exam, e.g. BCA Sem 5 Nov 2026"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              className="min-w-0 flex-1"
            />
            <Button onClick={create} disabled={!newTitle.trim() || creating} className="shrink-0">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              New
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastError && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center justify-between gap-2">
            <span>Error at {lastError.at.toLocaleTimeString('en-IN')}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Close error" onClick={() => setLastError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="select-text break-words">{lastError.message}</AlertDescription>
        </Alert>
      )}

      {!session ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Create an exam to start.</CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          {/* Status and publishing */}
          <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={published ? 'default' : 'outline'} className="capitalize">{session.status}</Badge>
              {loadingData && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:ml-auto sm:flex sm:flex-wrap sm:items-center">
              <ComingViewDialog sessionId={session.id} data={data} rules={rules} onSaved={refreshSessions} onError={onError} />
              <Button
                size="sm"
                variant={published ? 'outline' : 'default'}
                onClick={togglePublish}
                disabled={publishing || (!published && (notReady > 0 || examiners.size === 0))}
                title={!published && notReady ? `${notReady} examiner(s) still need a finalised letter` : undefined}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : published ? <GlobeLock className="mr-2 h-4 w-4" /> : <Globe className="mr-2 h-4 w-4" />}
                {published ? 'Unpublish' : 'Publish'}
              </Button>
            </div>
            {!published && examiners.size > 0 && notReady > 0 && (
              <p className="text-xs text-muted-foreground sm:basis-full">{notReady} examiner(s) still need a finalised letter before publishing.</p>
            )}
          </div>

          {/* Steps: a dropdown on phones, a scrollable bar on larger screens */}
          <div className="sm:hidden">
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger className="h-11 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {steps.map((st, i) => (
                  <SelectItem key={st.value} value={st.value}>
                    Step {i + 1} of {steps.length} · {st.label}{st.count ? ` (${st.count})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden overflow-x-auto pb-1 sm:block">
            <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1">
              {steps.map((st, i) => (
                <TabsTrigger key={st.value} value={st.value} className="gap-2 px-3 py-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/15 text-[11px] font-semibold">{i + 1}</span>
                  <st.icon className="h-4 w-4" />
                  {st.label}
                  {!!st.count && <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{st.count}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="import" className="mt-4"><ImportTab {...tabProps} rules={rules} onRulesChanged={refreshSessions} /></TabsContent>
          <TabsContent value="faculty" className="mt-4"><FacultyTab {...tabProps} /></TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RulesTab {...tabProps} rules={rules} onSaved={refreshSessions} />
          </TabsContent>
          <TabsContent value="allocate" className="mt-4"><AllocateTab {...tabProps} rules={rules} published={published} session={session} /></TabsContent>
          <TabsContent value="letters" className="mt-4">
            <LettersTab {...tabProps} session={session} onSessionSaved={refreshSessions} />
          </TabsContent>
          <TabsContent value="cancellations" className="mt-4"><CancellationsTab {...tabProps} title={session.title} /></TabsContent>
          <TabsContent value="downloads" className="mt-4"><DownloadsTab {...tabProps} title={session.title} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
