import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  google_drive_link: string;
  batch_id: string;
  created_at: string;
  batches: {
    name: string;
  };
}

interface Batch {
  id: string;
  name: string;
}

export default function Papers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    duration_minutes: 180,
    batch_id: '',
    google_drive_link: '',
  });

  useEffect(() => {
    fetchPapers();
    fetchBatches();
  }, []);

  const fetchPapers = async () => {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*, batches(name)')
        .order('created_at', { ascending: false });

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

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.google_drive_link) {
      toast({
        title: 'Error',
        description: 'Please provide a Google Drive link',
        variant: 'destructive',
      });
      return;
    }

    // Validate and sanitize URL
    let sanitizedUrl = formData.google_drive_link.trim();
    
    // Validate URL is from Google Drive
    const urlPattern = /^https:\/\/drive\.google\.com\/(file\/d\/|drive\/folders\/|open\?id=)/;
    if (!urlPattern.test(sanitizedUrl)) {
      toast({
        title: 'Error',
        description: 'Please provide a valid Google Drive link',
        variant: 'destructive',
      });
      return;
    }

    // Additional XSS protection: Remove any potential script injection
    try {
      const url = new URL(sanitizedUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
        toast({
          title: 'Error',
          description: 'Only HTTPS Google Drive links are allowed',
          variant: 'destructive',
        });
        return;
      }
      sanitizedUrl = url.toString();
    } catch {
      toast({
        title: 'Error',
        description: 'Invalid URL format',
        variant: 'destructive',
      });
      return;
    }

    // Validate other fields
    if (!formData.title.trim() || !formData.subject.trim()) {
      toast({
        title: 'Error',
        description: 'Title and subject are required',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const { error: insertError } = await supabase
        .from('papers')
        .insert([{
          title: formData.title.trim().substring(0, 200),
          subject: formData.subject.trim().substring(0, 100),
          duration_minutes: formData.duration_minutes,
          batch_id: formData.batch_id,
          google_drive_link: sanitizedUrl,
          uploaded_by: user!.id,
        }]);

      if (insertError) throw insertError;

      toast({ title: 'Paper added successfully' });
      setDialogOpen(false);
      resetForm();
      fetchPapers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    try {
      const { error } = await supabase
        .from('papers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Paper deleted successfully' });
      fetchPapers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subject: '',
      duration_minutes: 180,
      batch_id: '',
      google_drive_link: '',
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animate-fade-in-down">
        <h1 className="text-3xl font-bold">Exam Papers</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="hover-scale hover-glow">
              <Plus className="mr-2 h-4 w-4" />
              Add Paper
            </Button>
          </DialogTrigger>
          <DialogContent className="animate-scale-in bg-popover z-50">
            <DialogHeader>
              <DialogTitle>Add New Paper</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Paper Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="batch">Batch</Label>
                <Select
                  value={formData.batch_id}
                  onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="google_drive_link">Google Drive Link</Label>
                <Input
                  id="google_drive_link"
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={formData.google_drive_link}
                  onChange={(e) => setFormData({ ...formData, google_drive_link: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full hover-scale" disabled={uploading}>
                {uploading ? 'Adding...' : 'Add Paper'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {papers.map((paper, index) => (
          <Card 
            key={paper.id}
            className="hover-lift animate-fade-in-up card-gradient"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <div className="flex items-start gap-2">
                  <FileText className="h-5 w-5 mt-1 text-primary" />
                  <span>{paper.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(paper.id)}
                  className="hover-scale hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Subject:</strong> {paper.subject}</p>
                <p><strong>Duration:</strong> {paper.duration_minutes} minutes</p>
                <p><strong>Batch:</strong> {paper.batches.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
