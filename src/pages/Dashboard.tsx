import { useEffect, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Clock,
  Download,
  FileText,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { serverNow, useServerNow } from '@/hooks/use-server-clock';
import { examPhase, examWindow } from '@/lib/exam-time';

interface DashboardStats {
  colleges: number;
  batches: number;
  papers: number;
  allocations: number;
  scheduledToday: number;
  upcomingWeek: number;
}

interface RecentActivity {
  type: 'paper' | 'college' | 'allocation';
  title: string;
  subtitle: string;
  time: string;
}

interface UpcomingExam {
  id: string;
  paper_title: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useCachedState<DashboardStats>('dashboard:stats', {
    colleges: 0,
    batches: 0,
    papers: 0,
    allocations: 0,
    scheduledToday: 0,
    upcomingWeek: 0,
  });
  const [upcomingExams, setUpcomingExams] = useCachedState<UpcomingExam[]>('dashboard:upcoming', []);
  const [loading, setLoading] = useState(!hasCached('dashboard:stats'));
  // Server-aligned clock so exam status flips to Open/Closed without a refresh
  const nowMs = useServerNow(1000);

  useEffect(() => {
    if (!profile) return;
    fetchDashboardData();
    // Pick up newly published exams in the background
    const id = window.setInterval(() => fetchDashboardData(), 60_000);
    return () => window.clearInterval(id);
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      // Calendar dates in India time (UTC dates would be a day behind before 05:30 IST)
      const istDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const today = istDate(serverNow());
      const weekLater = istDate(serverNow() + 7 * 24 * 60 * 60 * 1000);
      const toUpcoming = (rows: any[] | null) =>
        (rows ?? []).map((item) => ({
          id: item.id,
          paper_title: item.papers?.title || 'Unknown',
          exam_date: item.exam_date,
          start_time: item.start_time,
          end_time: item.end_time,
          is_published: item.is_published,
        }));

      if (profile?.role === 'chairperson') {
        // All five requests run in parallel
        const [collegesRes, batchesRes, papersRes, allocationsRes, upcomingRes] = await Promise.all([
          supabase.from('colleges').select('id', { count: 'exact', head: true }),
          supabase.from('batches').select('id', { count: 'exact', head: true }),
          supabase.from('papers').select('id', { count: 'exact', head: true }),
          supabase.from('allocations').select('id', { count: 'exact', head: true }),
          supabase
            .from('allocations')
            .select('id, exam_date, start_time, end_time, is_published, papers(title)')
            .gte('exam_date', today)
            .lte('exam_date', weekLater)
            .order('exam_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(5),
        ]);

        setStats({
          colleges: collegesRes.count || 0,
          batches: batchesRes.count || 0,
          papers: papersRes.count || 0,
          allocations: allocationsRes.count || 0,
          scheduledToday: 0,
          upcomingWeek: 0,
        });
        setUpcomingExams(toUpcoming(upcomingRes.data));
      } else {
        // One request: database rules already limit college admins to their
        // own college's published exams; counts are derived from the result.
        const { data, error } = await supabase
          .from('allocations')
          .select('id, exam_date, start_time, end_time, is_published, papers(title)')
          .eq('is_published', true)
          .gte('exam_date', today)
          .lte('exam_date', weekLater)
          .order('exam_date', { ascending: true })
          .order('start_time', { ascending: true });
        if (error) throw error;

        const week = toUpcoming(data);
        setStats({
          colleges: 0,
          batches: 0,
          papers: 0,
          allocations: 0,
          scheduledToday: week.filter((e) => e.exam_date === today).length,
          upcomingWeek: week.length,
        });
        setUpcomingExams(week.slice(0, 5));
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  };

  const formatTime = (time: string) => time?.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const isChair = profile?.role === 'chairperson';
  const phaseOf = (exam: UpcomingExam) => examPhase(examWindow(exam.exam_date, exam.start_time, exam.end_time), nowMs);
  const isOpen = (exam: UpcomingExam) => phaseOf(exam) === 'open';
  const firstName = profile?.full_name?.split(' ')[0];

  const tiles: { label: string; value: number; note: string; to: string; icon: LucideIcon; gold?: boolean }[] = isChair
    ? [
        { label: 'Colleges', value: stats.colleges, note: 'Registered', to: '/dashboard/colleges', icon: Building2 },
        { label: 'Batches', value: stats.batches, note: 'Academic batches', to: '/dashboard/batches', icon: Layers, gold: true },
        { label: 'Papers', value: stats.papers, note: 'Uploaded', to: '/dashboard/papers', icon: FileText },
        { label: 'Allocations', value: stats.allocations, note: 'Exams scheduled', to: '/dashboard/allocations', icon: CalendarClock, gold: true },
      ]
    : [
        { label: 'Today', value: stats.scheduledToday, note: 'Exams today', to: '/dashboard/scheduled', icon: CalendarClock },
        { label: 'Available now', value: upcomingExams.filter(isOpen).length, note: 'Ready to download', to: '/dashboard/scheduled', icon: Download, gold: true },
        { label: 'This week', value: stats.upcomingWeek, note: 'Next 7 days', to: '/dashboard/scheduled', icon: Clock },
      ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <section className="surface-navy relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold-500/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-500">
              {isChair ? 'Chairperson' : 'College Admin'}
            </span>
            <h1 className="mt-3 !text-2xl !text-white sm:!text-3xl">
              Welcome back{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 max-w-lg text-sm text-white/70">
              {isChair
                ? 'Here is the state of colleges, papers and exam allocations.'
                : 'Your scheduled exams and the papers ready to download.'}
            </p>
          </div>
          <Link
            to={isChair ? '/dashboard/papers' : '/dashboard/scheduled'}
            className="btn-gold h-11 self-start text-sm sm:self-auto"
          >
            {isChair ? 'Upload papers' : 'View my papers'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className={`stagger grid grid-cols-2 gap-3 sm:gap-4 ${isChair ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {tiles.map((tile, i) => (
          <Link
            key={tile.label}
            to={tile.to}
            className={`card-elevated group p-4 transition-all hover:-translate-y-0.5 hover:border-primary/25 sm:p-5 ${!isChair && i === 2 ? 'col-span-2 lg:col-span-1' : ''}`}
          >
            <div className="flex items-start justify-between">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${tile.gold ? 'gold-tile' : 'bg-primary text-gold-500'}`}
              >
                <tile.icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-primary tabular sm:text-4xl">{tile.value}</p>
            <p className="mt-0.5 text-sm font-semibold">{tile.label}</p>
            <p className="text-xs text-muted-foreground">{tile.note}</p>
          </Link>
        ))}
      </section>

      {/* Upcoming */}
      <section className="card-elevated overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-primary sm:text-lg">{isChair ? 'Upcoming exams' : 'Your schedule'}</h2>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </div>
          <Link
            to={isChair ? '/dashboard/allocations' : '/dashboard/scheduled'}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
          >
            View all
          </Link>
        </div>

        {upcomingExams.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <CalendarClock className="h-6 w-6" />
            </span>
            <p className="mt-3 font-semibold">No exams in the next 7 days</p>
            <p className="text-sm text-muted-foreground">
              {isChair ? 'Create an allocation to schedule one.' : 'New exams will appear here once published.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {upcomingExams.map((exam) => {
              const open = isOpen(exam);
              const status = isChair
                ? exam.is_published
                  ? { label: 'Published', cls: 'bg-success/10 text-success' }
                  : { label: 'Draft', cls: 'bg-gold-500/20 text-navy-900' }
                : open
                  ? { label: 'Open now', cls: 'bg-success/10 text-success' }
                  : phaseOf(exam) === 'closed'
                    ? { label: 'Closed', cls: 'bg-secondary text-muted-foreground' }
                    : { label: 'Upcoming', cls: 'bg-secondary text-primary' };
              return (
                <li key={exam.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-primary">
                    <span className="text-[10px] font-bold uppercase leading-none">
                      {new Date(exam.exam_date).toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                    <span className="text-lg font-extrabold leading-tight">{new Date(exam.exam_date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{exam.paper_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(exam.exam_date)} · <span className="font-mono">{formatTime(exam.start_time)}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
