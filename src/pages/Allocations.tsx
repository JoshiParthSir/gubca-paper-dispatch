import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Allocation {
  id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
  allocation_colleges: {
    colleges: {
      name: string;
      code: string;
    };
  }[];
  papers: {
    title: string;
    subject: string;
  };
}

interface College {
  id: string;
  name: string;
  code: string;
}

interface Paper {
  id: string;
  title: string;
  subject: string;
}

export default function Allocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    paper_id: '',
    college_ids: [] as string[],
    exam_date: '',
    start_time: '',
    end_time: '',
    is_published: false,
  });

  useEffect(() => {
    fetchAllocations();
    fetchColleges();
    fetchPapers();
  }, []);

  const fetchAllocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allocations')
        .select(`
          *,
          allocation_colleges(colleges(name, code)),
          papers(title, subject)
        `)
        .order('exam_date', { ascending: false });

      if (error) throw error;
      setAllocations(data || []);
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

  const fetchColleges = async () => {
    try {
      const { data, error } = await supabase
        .from('colleges')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setColleges(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchPapers = async () => {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('id, title, subject')
        .order('title');

      if (error) throw error;
      setPapers(data || []);
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
    
    if (formData.college_ids.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one college',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create allocation
      const { data: allocation, error: allocError } = await supabase
        .from('allocations')
        .insert([{
          paper_id: formData.paper_id,
          exam_date: formData.exam_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_published: formData.is_published,
          allocated_by: user!.id,
          college_id: null,
        }])
        .select()
        .single();

      if (allocError) throw allocError;

      // Create allocation_colleges entries
      const allocationColleges = formData.college_ids.map(college_id => ({
        allocation_id: allocation.id,
        college_id,
      }));

      const { error: junctionError } = await supabase
        .from('allocation_colleges')
        .insert(allocationColleges);

      if (junctionError) throw junctionError;

      toast({ title: 'Allocation created successfully' });
      setDialogOpen(false);
      resetForm();
      fetchAllocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return;

    try {
      const { error } = await supabase
        .from('allocations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Allocation deleted successfully' });
      fetchAllocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('allocations')
        .update({ is_published: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast({ title: `Allocation ${!currentStatus ? 'published' : 'unpublished'} successfully` });
      fetchAllocations();
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
      paper_id: '',
      college_ids: [],
      exam_date: '',
      start_time: '',
      end_time: '',
      is_published: false,
    });
  };

  const toggleCollegeSelection = (collegeId: string) => {
    setFormData(prev => ({
      ...prev,
      college_ids: prev.college_ids.includes(collegeId)
        ? prev.college_ids.filter(id => id !== collegeId)
        : [...prev.college_ids, collegeId]
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Paper Allocations</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Allocation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Allocation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="paper">Paper</Label>
                <Select
                  value={formData.paper_id}
                  onValueChange={(value) => setFormData({ ...formData, paper_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select paper" />
                  </SelectTrigger>
                  <SelectContent>
                    {papers.map((paper) => (
                      <SelectItem key={paper.id} value={paper.id}>
                        {paper.title} - {paper.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Colleges (Select Multiple)</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                  {colleges.map((college) => (
                    <div key={college.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={college.id}
                        checked={formData.college_ids.includes(college.id)}
                        onChange={() => toggleCollegeSelection(college.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={college.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {college.name} ({college.code})
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.college_ids.length} college(s) selected
                </p>
              </div>
              <div>
                <Label htmlFor="exam_date">Exam Date</Label>
                <Input
                  id="exam_date"
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label htmlFor="is_published">Publish Immediately</Label>
              </div>
              <Button type="submit" className="w-full">
                Create Allocation
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {allocations.map((allocation) => (
          <Card key={allocation.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 mt-1" />
                  <div>
                    <div>{allocation.papers.title}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {allocation.allocation_colleges.map(ac => ac.colleges.name).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={allocation.is_published ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => togglePublish(allocation.id, allocation.is_published)}
                  >
                    {allocation.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(allocation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <strong>Subject:</strong> {allocation.papers.subject}
                </div>
                <div>
                  <strong>Date:</strong> {new Date(allocation.exam_date).toLocaleDateString()}
                </div>
                <div>
                  <strong>Time:</strong> {allocation.start_time} - {allocation.end_time}
                </div>
                <Badge variant={allocation.is_published ? 'default' : 'secondary'}>
                  {allocation.is_published ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
