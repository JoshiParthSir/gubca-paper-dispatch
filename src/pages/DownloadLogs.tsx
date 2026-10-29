import { useEffect, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Calendar, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/csv';

interface DownloadLog {
  id: string;
  download_time: string;
  ip_address: string | null;
  user_agent: string | null;
  profiles: {
    full_name: string;
    email: string;
    college_id?: string | null;
    college?: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  allocations: {
    exam_date: string;
    papers: {
      title: string;
      subject: string;
    };
    colleges: {
      name: string;
      code: string;
    };
  };
}

export default function DownloadLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useCachedState<DownloadLog[]>('downloadlogs:logs', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('downloadlogs:logs'));

  useEffect(() => {
    fetchLogs();
  }, []);

  // Two requests in total, however many logs there are: one joined query for
  // logs + allocation + paper + colleges, and one for the downloaders' profiles.
  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('download_logs')
        .select(
          `id, download_time, ip_address, user_agent, downloaded_by,
           allocations(exam_date, papers(title, subject), allocation_colleges(colleges(name, code)))`,
        )
        .order('download_time', { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const userIds = [...new Set(rows.map((r) => r.downloaded_by).filter(Boolean))] as string[];

      const profilesById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, college_id, colleges(id, name, code)')
          .in('user_id', userIds);
        if (profileError) throw profileError;
        for (const prof of profiles ?? []) profilesById.set(prof.user_id, prof);
      }

      setLogs(
        rows.map((log) => {
          const prof = log.downloaded_by ? profilesById.get(log.downloaded_by) : null;
          const allocationCollege = log.allocations?.allocation_colleges?.[0]?.colleges ?? null;
          return {
            id: log.id,
            download_time: log.download_time,
            ip_address: log.ip_address as string | null,
            user_agent: log.user_agent as string | null,
            profiles: {
              full_name: prof?.full_name || (log.downloaded_by ? 'Unknown' : 'Deleted admin'),
              email: prof?.email || 'N/A',
              college_id: prof?.college_id || null,
              college: prof?.colleges ?? null,
            },
            allocations: {
              exam_date: log.allocations?.exam_date || 'N/A',
              papers: log.allocations?.papers || { title: 'Unknown', subject: 'N/A' },
              colleges: allocationCollege || { name: 'Unknown', code: 'N/A' },
            },
          } as DownloadLog;
        }),
      );
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

  const exportCsv = () => {
    downloadCsv(`download-logs-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['downloaded_at', 'paper', 'subject', 'exam_date', 'admin_name', 'admin_email', 'college', 'college_code', 'ip_address'],
      ...logs.map((log) => {
        const college = log.profiles.college ?? log.allocations.colleges;
        return [
          new Date(log.download_time).toLocaleString(),
          log.allocations.papers.title,
          log.allocations.papers.subject,
          log.allocations.exam_date,
          log.profiles.full_name,
          log.profiles.email,
          college?.name ?? '',
          college?.code ?? '',
          log.ip_address ?? '',
        ];
      }),
    ]);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Download Logs</h1>
          <p className="text-muted-foreground">Track all paper downloads across the system</p>
        </div>
        <Button variant="outline" disabled={logs.length === 0} onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="stagger grid gap-4">
        {logs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No download logs found</p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => {
            if (!log.allocations || !log.allocations.papers || !log.allocations.colleges || !log.profiles) {
              return null;
            }
            
            return (
              <Card key={log.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-primary" />
                      <span>{log.allocations.papers.title}</span>
                    </div>
                    <Badge variant="secondary">{log.allocations.papers.subject}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{log.profiles.full_name}</span>
                      <span className="text-muted-foreground">({log.profiles.email})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {/* Show downloader's college in the main "College" field if available, otherwise fall back to allocation college */}
                      { (log.profiles.college && log.profiles.college.name) ? (
                        <span>College: {log.profiles.college.name} ({log.profiles.college.code})</span>
                      ) : (
                        <span>College: {log.allocations.colleges.name} ({log.allocations.colleges.code})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Downloaded: {new Date(log.download_time).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      IP: {log.ip_address || 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
