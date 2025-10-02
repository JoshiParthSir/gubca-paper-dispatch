import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, FileText, Calendar, Download, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  is_published: boolean;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    colleges: 0,
    batches: 0,
    papers: 0,
    allocations: 0,
    scheduledToday: 0,
    upcomingWeek: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      if (profile?.role === 'chairperson') {
        // Fetch chairperson stats
        const [collegesRes, batchesRes, papersRes, allocationsRes] = await Promise.all([
          supabase.from('colleges').select('id', { count: 'exact', head: true }),
          supabase.from('batches').select('id', { count: 'exact', head: true }),
          supabase.from('papers').select('id', { count: 'exact', head: true }),
          supabase.from('allocations').select('id', { count: 'exact', head: true }),
        ]);

        // Fetch upcoming exams
        const today = new Date().toISOString().split('T')[0];
        const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data: upcomingData } = await supabase
          .from('allocations')
          .select('id, exam_date, start_time, is_published, papers(title)')
          .gte('exam_date', today)
          .lte('exam_date', weekLater)
          .order('exam_date', { ascending: true })
          .limit(5);

        setStats({
          colleges: collegesRes.count || 0,
          batches: batchesRes.count || 0,
          papers: papersRes.count || 0,
          allocations: allocationsRes.count || 0,
          scheduledToday: 0,
          upcomingWeek: 0,
        });

        setUpcomingExams(upcomingData?.map(item => ({
          id: item.id,
          paper_title: item.papers?.title || 'Unknown',
          exam_date: item.exam_date,
          start_time: item.start_time,
          is_published: item.is_published,
        })) || []);

      } else {
        // Fetch college admin stats
        const { data: allocationColleges } = await supabase
          .from('allocation_colleges')
          .select('allocation_id')
          .eq('college_id', profile!.college_id);

        if (allocationColleges && allocationColleges.length > 0) {
          const allocationIds = allocationColleges.map(ac => ac.allocation_id);
          
          const today = new Date().toISOString().split('T')[0];
          const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const { data: todayExams, count: todayCount } = await supabase
            .from('allocations')
            .select('id', { count: 'exact' })
            .in('id', allocationIds)
            .eq('exam_date', today)
            .eq('is_published', true);

          const { data: weekExams, count: weekCount } = await supabase
            .from('allocations')
            .select('id', { count: 'exact' })
            .in('id', allocationIds)
            .gte('exam_date', today)
            .lte('exam_date', weekLater)
            .eq('is_published', true);

          const { data: upcomingData } = await supabase
            .from('allocations')
            .select('id, exam_date, start_time, is_published, papers(title)')
            .in('id', allocationIds)
            .gte('exam_date', today)
            .lte('exam_date', weekLater)
            .eq('is_published', true)
            .order('exam_date', { ascending: true })
            .limit(5);

          setStats({
            colleges: 0,
            batches: 0,
            papers: 0,
            allocations: 0,
            scheduledToday: todayCount || 0,
            upcomingWeek: weekCount || 0,
          });

          setUpcomingExams(upcomingData?.map(item => ({
            id: item.id,
            paper_title: item.papers?.title || 'Unknown',
            exam_date: item.exam_date,
            start_time: item.start_time,
            is_published: item.is_published,
          })) || []);
        }
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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading dashboard...</div>;
  }

  if (profile?.role === 'chairperson') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chairperson Dashboard</h1>
          <p className="text-muted-foreground">
            Manage colleges, batches, and exam paper allocations
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Colleges</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.colleges}</div>
              <p className="text-xs text-muted-foreground">
                Registered colleges
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.batches}</div>
              <p className="text-xs text-muted-foreground">
                Current academic batches
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exam Papers</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.papers}</div>
              <p className="text-xs text-muted-foreground">
                Total papers in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Allocations</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.allocations}</div>
              <p className="text-xs text-muted-foreground">
                Paper allocations made
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Exams</CardTitle>
            <CardDescription>Scheduled for the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming exams scheduled</p>
            ) : (
              <div className="space-y-4">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{exam.paper_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(exam.exam_date)}, {exam.start_time}
                      </p>
                    </div>
                    <div className={`text-sm font-medium ${exam.is_published ? 'text-success' : 'text-warning'}`}>
                      {exam.is_published ? 'Published' : 'Draft'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">College Admin Dashboard</h1>
        <p className="text-muted-foreground">
          View scheduled exams and download papers
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledToday}</div>
            <p className="text-xs text-muted-foreground">
              Exams scheduled for today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Now</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingExams.filter(e => {
                const now = new Date();
                const examDate = new Date(`${e.exam_date}T${e.start_time}`);
                return examDate <= now;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Papers ready to download
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingWeek}</div>
            <p className="text-xs text-muted-foreground">
              Total exams this week
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Schedule</CardTitle>
          <CardDescription>Your scheduled exams for this week</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingExams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming exams scheduled</p>
          ) : (
            <div className="space-y-4">
              {upcomingExams.map((exam) => {
                const now = new Date();
                const examDateTime = new Date(`${exam.exam_date}T${exam.start_time}`);
                const isAvailable = now >= examDateTime;

                return (
                  <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{exam.paper_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(exam.exam_date)}, {exam.start_time}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${isAvailable ? 'text-success' : 'text-muted-foreground'}`}>
                        {isAvailable ? 'Available' : 'Pending'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isAvailable ? 'Download now' : 'Not yet available'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
