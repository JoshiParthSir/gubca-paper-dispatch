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
          *,
          profiles!download_logs_downloaded_by_fkey(full_name, email),
          allocations(
            exam_date,
            papers(title, subject),
            colleges(name, code)
          )
        `)
        .order('download_time', { ascending: false });

      if (error) throw error;
      setLogs((data as any) || []);
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
                      <span>College: {log.allocations.colleges.name} ({log.allocations.colleges.code})</span>
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
