import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, CheckCircle2, Clock, Download, FileText, Loader2, Lock, Radio } from 'lucide-react';
import { getPaperUrl } from '@/lib/paperStorage';
import { useServerNow } from '@/hooks/use-server-clock';
import {
  examPhase,
  examWindow,
  formatCountdown,
  formatExamDate,
  formatTime,
  type ExamPhase,
  type ExamWindow,
} from '@/lib/exam-time';

interface AllocatedPaper {
  id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  papers: {
    id: string;
    title: string;
    subject: string;
    duration_minutes: number;
    google_drive_link: string | null;
    file_path: string | null;
    file_name: string | null;
    purged_at: string | null;
  };
}

interface Item extends AllocatedPaper {
  window: ExamWindow;
  phase: ExamPhase;
}

// New or changed allocations from the university appear within this time
const REFRESH_MS = 30_000;

export default function MyPapers() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useCachedState<AllocatedPaper[]>('mypapers:papers', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('mypapers:papers'));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const now = useServerNow(1000);
  const previousPhases = useRef<Map<string, ExamPhase> | null>(null);

  const collegeId = profile?.college_id as string | undefined;

  const fetchAllocatedPapers = useCallback(
    async (silent = false) => {
      if (!collegeId) return;
      try {
        // One request: the database security rules already limit college admins
        // to published allocations for their own college.
        const { data, error } = await supabase
          .from('allocations')
          .select(
            'id, exam_date, start_time, end_time, papers(id, title, subject, duration_minutes, google_drive_link, file_path, file_name, purged_at)',
          )
          .eq('is_published', true)
          .order('exam_date', { ascending: true })
          .order('start_time', { ascending: true });
        if (error) throw error;
        setPapers((data as AllocatedPaper[]) || []);
      } catch (error) {
        if (!silent) {
          toast({
            title: 'Error',
            description: (error as { message?: string })?.message ?? 'Could not load papers',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [collegeId, toast],
  );

  // Initial load, background refresh, and refresh when the tab regains focus
  useEffect(() => {
    if (!profile) return;
    if (!collegeId) {
      setLoading(false);
      return;
    }
    void fetchAllocatedPapers();
    const id = window.setInterval(() => void fetchAllocatedPapers(true), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchAllocatedPapers(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [profile, collegeId, fetchAllocatedPapers]);

  const items: Item[] = useMemo(
    () =>
      papers
        .filter((p) => p.papers)
        .map((p) => {
          const w = examWindow(p.exam_date, p.start_time, p.end_time);
          return { ...p, window: w, phase: examPhase(w, now) };
        }),
    [papers, now],
  );

  // Announce papers the moment their window opens
  useEffect(() => {
    const current = new Map(items.map((i) => [i.id, i.phase]));
    const prev = previousPhases.current;
    if (prev) {
      for (const item of items) {
        if (item.phase === 'open' && prev.get(item.id) === 'upcoming') {
          toast({
            title: 'Paper now available',
            description: `${item.papers.title} can be downloaded now.`,
          });
        }
      }
    }
    previousPhases.current = current;
  }, [items, toast]);

  const open = items.filter((i) => i.phase === 'open');
  const upcoming = items.filter((i) => i.phase === 'upcoming');
  const closed = items.filter((i) => i.phase === 'closed');

  const handleDownload = async (item: Item) => {
    const paper = item.papers;
    setDownloadingId(item.id);
    try {
      let url: string;
      if (paper.file_path) {
        try {
          url = await getPaperUrl(paper.file_path, paper.file_name || `${paper.title}.pdf`);
        } catch {
          throw new Error('This paper can only be downloaded during its exam window.');
        }
      } else if (paper.google_drive_link && /^https:\/\/drive\.google\.com\//.test(paper.google_drive_link)) {
        url = paper.google_drive_link;
      } else if (paper.purged_at) {
        throw new Error('This paper was removed from storage after the exam.');
      } else {
        throw new Error('The paper file has not been uploaded yet. Please contact the university.');
      }

      const { error: logError } = await supabase
        .from('download_logs')
        .insert([{ allocation_id: item.id, downloaded_by: user!.id }]);
      if (logError) console.error('Failed to log access:', logError);

      if (paper.file_path) {
        // Served as an attachment, so this downloads without leaving the page
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch (error) {
      toast({
        title: 'Cannot download',
        description: error instanceof Error ? error.message : 'Failed to access the paper',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const clock = new Date(now).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });

  if (loading) {
    return <PageSkeleton cards={4} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>My Papers</h1>
          <p className="text-muted-foreground">Papers unlock automatically when each exam starts. No need to refresh.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-primary px-4 py-2.5 text-white shadow-[0_8px_20px_-10px_hsl(var(--primary))]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-gold-500" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
          </span>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Server time · IST</p>
            <p className="font-mono text-base font-semibold tabular">{clock}</p>
          </div>
        </div>
      </div>

      {!collegeId ? (
        <EmptyState
          title="No college assigned"
          text="Your account is not linked to a college yet. Please contact the university."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No papers scheduled yet"
          text="Papers appear here automatically as soon as the university publishes them."
        />
      ) : (
        <>
          {open.length > 0 && (
            <Group title="Available now" icon={Radio} accent>
              {open.map((item) => (
                <PaperCard
                  key={item.id}
                  item={item}
                  now={now}
                  downloading={downloadingId === item.id}
                  onDownload={() => handleDownload(item)}
                />
              ))}
            </Group>
          )}
          {upcoming.length > 0 && (
            <Group title="Upcoming" icon={CalendarClock}>
              {upcoming.map((item) => (
                <PaperCard key={item.id} item={item} now={now} downloading={false} onDownload={() => undefined} />
              ))}
            </Group>
          )}
          {closed.length > 0 && (
            <Group title="Completed" icon={CheckCircle2} muted>
              {closed.map((item) => (
                <PaperCard key={item.id} item={item} now={now} downloading={false} onDownload={() => undefined} />
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  accent,
  muted,
  children,
}: {
  title: string;
  icon: typeof Radio;
  accent?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent ? 'text-success' : muted ? 'text-muted-foreground' : 'text-primary'}`} />
        <h2 className={`text-sm font-bold uppercase tracking-wider ${muted ? 'text-muted-foreground' : 'text-primary'}`}>
          {title}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">{count}</span>
      </div>
      <div className="stagger grid gap-3 xl:grid-cols-2">{children}</div>
    </section>
  );
}

function PaperCard({
  item,
  now,
  downloading,
  onDownload,
}: {
  item: Item;
  now: number;
  downloading: boolean;
  onDownload: () => void;
}) {
  const { phase, window: w, papers: paper } = item;
  const progress = phase === 'open' ? Math.min(100, ((now - w.start) / Math.max(1, w.end - w.start)) * 100) : 0;
  const day = new Date(`${item.exam_date}T00:00:00+05:30`);

  return (
    <article
      className={`card-elevated relative overflow-hidden p-4 transition-all duration-500 sm:p-5 ${
        phase === 'open' ? 'border-success/40 ring-1 ring-success/20' : phase === 'closed' ? 'opacity-70' : ''
      }`}
    >
      {phase === 'open' && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-gold-500" />}

      <div className="flex gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${
            phase === 'open' ? 'bg-success text-white' : 'bg-secondary text-primary'
          }`}
        >
          <span className="text-[10px] font-bold uppercase leading-none">
            {day.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}
          </span>
          <span className="text-xl font-extrabold leading-tight">
            {day.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold">{paper.title}</h3>
              <p className="truncate text-sm text-muted-foreground">{paper.subject}</p>
            </div>
            <StatusChip phase={phase} now={now} w={w} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatExamDate(item.exam_date)}</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" />
              {formatTime(item.start_time)} – {formatTime(item.end_time)}
            </span>
            <span>{paper.duration_minutes} min</span>
          </div>

          {phase === 'open' && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-gold-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {phase === 'upcoming' && `Unlocks automatically at ${formatTime(item.start_time)} IST`}
          {phase === 'open' && 'Download is logged for the university'}
          {phase === 'closed' && (paper.purged_at ? 'Exam over · file removed from storage' : 'Exam over · downloads closed')}
        </p>
        {phase === 'open' ? (
          <Button variant="gold" onClick={onDownload} disabled={downloading} className="w-full sm:w-auto">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download paper
          </Button>
        ) : (
          <Button variant="outline" disabled className="w-full sm:w-auto">
            <Lock className="h-4 w-4" />
            {phase === 'upcoming' ? `Opens at ${formatTime(item.start_time)}` : 'Closed'}
          </Button>
        )}
      </div>
    </article>
  );
}

function StatusChip({ phase, now, w }: { phase: ExamPhase; now: number; w: ExamWindow }) {
  if (phase === 'open') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-success" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        Closes in <span className="font-mono tabular">{formatCountdown(w.end - now)}</span>
      </span>
    );
  }
  if (phase === 'upcoming') {
    return (
      <span className="shrink-0 rounded-full bg-gold-500/20 px-2.5 py-1 text-xs font-semibold text-navy-900">
        Opens in <span className="font-mono tabular">{formatCountdown(w.start - now)}</span>
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      Exam over
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="card-elevated flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <FileText className="h-7 w-7" />
      </span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
