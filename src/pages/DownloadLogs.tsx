import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Calendar, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('download_logs')
        .select(`
          id,
          download_time,
          ip_address,
          user_agent,
          downloaded_by,
          allocation_id
        `)
        .order('download_time', { ascending: false });

      if (error) throw error;

      const enrichedLogs = await Promise.all(
        (data || []).map(async (log: any) => {
          // Fetch profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email, college_id')
            .eq('user_id', log.downloaded_by)
            .maybeSingle();

          if (profileError) {
            console.warn('profile fetch error for', log.downloaded_by, profileError);
          }

          // If profile has college_id, fetch college info
          let downloaderCollege: { id: string; name: string; code: string } | null = null;
          try {
            if (profileData?.college_id) {
              const { data: collegeByProfile } = await supabase
                .from('colleges')
                .select('id, name, code')
                .eq('id', profileData.college_id)
                .maybeSingle();
              if (collegeByProfile) downloaderCollege = collegeByProfile as any;
            }
          } catch (err) {
            console.warn('failed to fetch downloader college', err);
          }

          // Fetch allocation with paper and college
          const { data: allocationData, error: allocationError } = await supabase
            .from('allocations')
            .select('exam_date, paper_id')
            .eq('id', log.allocation_id)
            .maybeSingle();

          if (allocationError) {
            console.warn('allocation fetch error for', log.allocation_id, allocationError);
          }

          let paperData = null;
          let collegeData = null;

          if (allocationData) {
            // Fetch paper
            const { data: paper } = await supabase
              .from('papers')
              .select('title, subject')
              .eq('id', allocationData.paper_id)
              .maybeSingle();
            paperData = paper;

            // Fetch college through allocation_colleges (pick first if many)
            const { data: allocationCollege } = await supabase
              .from('allocation_colleges')
              .select('college_id')
              .eq('allocation_id', log.allocation_id)
              .limit(1)
              .maybeSingle();

            if (allocationCollege?.college_id) {
              const { data: college } = await supabase
                .from('colleges')
                .select('name, code')
                .eq('id', allocationCollege.college_id)
                .maybeSingle();
              collegeData = college;
            }
          }

          return {
            id: log.id,
            download_time: log.download_time,
            ip_address: log.ip_address as string | null,
            user_agent: log.user_agent as string | null,
            profiles: {
              full_name: profileData?.full_name || 'Unknown',
              email: profileData?.email || 'N/A',
              college_id: profileData?.college_id || null,
              college: downloaderCollege,
            },
            allocations: {
              exam_date: allocationData?.exam_date || 'N/A',
              papers: paperData || { title: 'Unknown', subject: 'N/A' },
              colleges: collegeData || { name: 'Unknown', code: 'N/A' },
            },
          } as DownloadLog;
        })
      );

      setLogs(enrichedLogs as DownloadLog[]);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Download Logs</h1>
        <p className="text-muted-foreground">Track all paper downloads across the system</p>
      </div>

      <div className="grid gap-4">
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
