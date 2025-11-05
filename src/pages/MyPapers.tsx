import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    google_drive_link: string;
  };
}

export default function MyPapers() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useState<AllocatedPaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.college_id) {
      fetchAllocatedPapers();
    } else if (profile) {
      // Profile loaded but no college_id, stop loading
      setLoading(false);
    }
  }, [profile]);

  const fetchAllocatedPapers = async () => {
    try {
      // First get allocation IDs for this college
      const { data: allocationColleges, error: acError } = await supabase
        .from('allocation_colleges')
        .select('allocation_id')
        .eq('college_id', profile!.college_id);

      if (acError) throw acError;

      if (!allocationColleges || allocationColleges.length === 0) {
        setPapers([]);
        setLoading(false);
        return;
      }

      const allocationIds = allocationColleges.map(ac => ac.allocation_id);

      // Then get allocations with papers
      const { data, error } = await supabase
        .from('allocations')
        .select('id, exam_date, start_time, end_time, papers(id, title, subject, duration_minutes, google_drive_link)')
        .in('id', allocationIds)
        .eq('is_published', true)
        .order('exam_date', { ascending: true });

      if (error) throw error;
      setPapers(data || []);
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

  const canDownload = (examDate: string, startTime: string, endTime: string) => {
    const now = new Date();
    const examDateTime = new Date(`${examDate}T${startTime}`);
    const endDateTime = new Date(`${examDate}T${endTime}`);
    
    return now >= examDateTime && now <= endDateTime;
  };

  const handleOpenPaper = async (allocationId: string, googleDriveLink: string) => {
    try {
      // Validate the URL before opening
      const urlPattern = /^https:\/\/drive\.google\.com\/(file\/d\/|drive\/folders\/|open\?id=)/;
      if (!urlPattern.test(googleDriveLink)) {
        toast({
          title: 'Error',
          description: 'Invalid paper link',
          variant: 'destructive',
        });
        return;
      }

      // Log the access
      const { error: logError } = await supabase
        .from('download_logs')
        .insert([{
          allocation_id: allocationId,
          downloaded_by: user!.id,
        }]);

      if (logError) console.error('Failed to log access:', logError);

      // Open Google Drive link in new tab
      window.open(googleDriveLink, '_blank');
      
    } catch (error: any) {
      console.error('Access error:', error);
      toast({
        title: 'Error',
        description: 'Failed to access the paper',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold animate-fade-in-down">My Allocated Papers</h1>

      {papers.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 animate-bounce-in" />
            <p className="text-muted-foreground animate-fade-in-up">No papers allocated yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {papers.map((allocation, index) => {
            const downloadable = canDownload(
              allocation.exam_date,
              allocation.start_time,
              allocation.end_time
            );

            return (
              <Card 
                key={allocation.id}
                className="hover-lift animate-fade-in-up card-gradient"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 mt-1" />
                      <div>
                        <div>{allocation.papers.title}</div>
                        <div className="text-sm font-normal text-muted-foreground">
                          {allocation.papers.subject}
                        </div>
                      </div>
                    </div>
                    {downloadable ? (
                      <Button
                        onClick={() =>
                          handleOpenPaper(
                            allocation.id,
                            allocation.papers.google_drive_link
                          )
                        }
                        className="hover-scale hover-glow"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="animate-pulse">
                        <Clock className="mr-1 h-3 w-3" />
                        Not Available
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm">
                    <div className="flex gap-4">
                      <div>
                        <strong>Exam Date:</strong>{' '}
                        {new Date(allocation.exam_date).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Time:</strong> {allocation.start_time} - {allocation.end_time}
                      </div>
                      <div>
                        <strong>Duration:</strong> {allocation.papers.duration_minutes} minutes
                      </div>
                    </div>
                    {!downloadable && (
                      <p className="text-muted-foreground mt-2">
                        This paper will be available for download during the exam time window.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
