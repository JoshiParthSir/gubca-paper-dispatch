import { useEffect, useMemo, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Calendar, Upload, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { normalizeDate, normalizeTime, parseBool } from '@/lib/csv';

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

interface NewAllocation {
  paper_id: string;
  college_ids: string[];
  exam_date: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
}

const emptyForm: NewAllocation = {
  paper_id: '',
  college_ids: [],
  exam_date: '',
  start_time: '',
  end_time: '',
  is_published: false,
};

export default function Allocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allocations, setAllocations] = useCachedState<Allocation[]>('allocations:allocations', []);
  const [colleges, setColleges] = useCachedState<College[]>('allocations:colleges', []);
  const [papers, setPapers] = useCachedState<Paper[]>('allocations:papers', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('allocations:allocations'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<NewAllocation>(emptyForm);

  useEffect(() => {
    fetchAllocations();
    fetchColleges();
    fetchPapers();
  }, []);

  const showError = (error: unknown) => {
    toast({
      title: 'Error',
      description: (error as { message?: string })?.message ?? 'Something went wrong',
      variant: 'destructive',
    });
  };

  const fetchAllocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allocations')
        .select(`
          *,
          allocation_colleges(colleges(name, code)),
          papers(title, subject)
        `)
        .order('exam_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAllocations((data as Allocation[]) || []);
      setSelected(new Set());
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const { data, error } = await supabase.from('colleges').select('id, name, code').order('name');
      if (error) throw error;
      setColleges(data || []);
    } catch (error) {
      showError(error);
    }
  };

  const fetchPapers = async () => {
    try {
      const { data, error } = await supabase.from('papers').select('id, title, subject').order('title');
      if (error) throw error;
      setPapers(data || []);
    } catch (error) {
      showError(error);
    }
  };

  // Creates the allocation and its college links; rolls back the allocation
  // if linking colleges fails so no orphan allocations are left behind.
  const createAllocation = async (values: NewAllocation) => {
    const { data: allocation, error: allocError } = await supabase
      .from('allocations')
      .insert([{
        paper_id: values.paper_id,
        exam_date: values.exam_date,
        start_time: values.start_time,
        end_time: values.end_time,
        is_published: values.is_published,
        allocated_by: user!.id,
        college_id: null,
      }])
      .select()
      .single();

    if (allocError) throw allocError;

    const { error: junctionError } = await supabase
      .from('allocation_colleges')
      .insert(values.college_ids.map((college_id) => ({ allocation_id: allocation.id, college_id })));

    if (junctionError) {
      await supabase.from('allocations').delete().eq('id', allocation.id);
      throw junctionError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.paper_id) {
      toast({ title: 'Error', description: 'Please select a paper', variant: 'destructive' });
      return;
    }
    if (formData.college_ids.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one college', variant: 'destructive' });
      return;
    }
    if (formData.end_time <= formData.start_time) {
      toast({ title: 'Error', description: 'End time must be after start time', variant: 'destructive' });
      return;
    }

    try {
      setWorking(true);
      await createAllocation(formData);
      toast({ title: 'Allocation created successfully' });
      setDialogOpen(false);
      setFormData(emptyForm);
      fetchAllocations();
    } catch (error) {
      showError(error);
    } finally {
      setWorking(false);
    }
  };

  const deleteAllocations = async (ids: string[]) => {
    const label = ids.length === 1 ? 'this allocation' : `${ids.length} allocations`;
    if (!confirm(`Delete ${label}?`)) return;

    try {
      setWorking(true);
      const { error } = await supabase.from('allocations').delete().in('id', ids);
      if (error) throw error;
      toast({ title: `Deleted ${label}` });
      fetchAllocations();
    } catch (error) {
      showError(error);
    } finally {
      setWorking(false);
    }
  };

  const setPublished = async (ids: string[], is_published: boolean) => {
    try {
      setWorking(true);
      const { error } = await supabase.from('allocations').update({ is_published }).in('id', ids);
      if (error) throw error;
      toast({
        title: `${ids.length === 1 ? 'Allocation' : `${ids.length} allocations`} ${is_published ? 'published' : 'unpublished'}`,
      });
      fetchAllocations();
    } catch (error) {
      showError(error);
    } finally {
      setWorking(false);
    }
  };

  const toggleCollegeSelection = (collegeId: string) => {
    setFormData((prev) => ({
      ...prev,
      college_ids: prev.college_ids.includes(collegeId)
        ? prev.college_ids.filter((id) => id !== collegeId)
        : [...prev.college_ids, collegeId],
    }));
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAllocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allocations;
    return allocations.filter((a) =>
      [a.papers?.title ?? '', a.papers?.subject ?? '', a.exam_date, ...a.allocation_colleges.map((ac) => ac.colleges?.name ?? '')]
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [allocations, search]);

  const allVisibleSelected =
    filteredAllocations.length > 0 && filteredAllocations.every((a) => selected.has(a.id));

  // ---- Bulk import ----
  const collegesByCode = useMemo(
    () => new Map(colleges.map((c) => [c.code.trim().toLowerCase(), c])),
    [colleges],
  );

  const resolveImportRow = (row: Record<string, string>): NewAllocation | string => {
    const title = row.paper_title.trim().toLowerCase();
    const subject = row.paper_subject?.trim().toLowerCase();
    const matches = papers.filter(
      (p) => p.title.trim().toLowerCase() === title && (!subject || p.subject.trim().toLowerCase() === subject),
    );
    if (matches.length === 0) return `No paper titled "${row.paper_title}"${subject ? ` with subject "${row.paper_subject}"` : ''}`;
    if (matches.length > 1) return 'Several papers have this title; add paper_subject to choose one';

    const codes = row.college_codes.split(/[;|]/).map((c) => c.trim()).filter(Boolean);
    let collegeIds: string[];
    if (codes.length === 1 && codes[0].toLowerCase() === 'all') {
      collegeIds = colleges.map((c) => c.id);
    } else {
      const unknown = codes.filter((c) => !collegesByCode.has(c.toLowerCase()));
      if (unknown.length) return `Unknown college code(s): ${unknown.join(', ')}`;
      collegeIds = [...new Set(codes.map((c) => collegesByCode.get(c.toLowerCase())!.id))];
    }
    if (collegeIds.length === 0) return 'No colleges';

    const exam_date = normalizeDate(row.exam_date);
    if (!exam_date) return 'Invalid exam_date (use YYYY-MM-DD or DD-MM-YYYY)';
    const start_time = normalizeTime(row.start_time);
    const end_time = normalizeTime(row.end_time);
    if (!start_time) return 'Invalid start_time (use HH:MM)';
    if (!end_time) return 'Invalid end_time (use HH:MM)';
    if (end_time <= start_time) return 'end_time must be after start_time';

    return {
      paper_id: matches[0].id,
      college_ids: collegeIds,
      exam_date,
      start_time,
      end_time,
      is_published: parseBool(row.publish, false),
    };
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1>Paper Allocations</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Allocation
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by paper, subject, college or date"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {filteredAllocations.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(filteredAllocations.map((a) => a.id)) : new Set())
              }
            />
            Select all
          </label>
        )}
        {selected.size > 0 && (
          <>
            <Button size="sm" disabled={working} onClick={() => setPublished([...selected], true)}>
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish {selected.size}
            </Button>
            <Button size="sm" variant="secondary" disabled={working} onClick={() => setPublished([...selected], false)}>
              Unpublish {selected.size}
            </Button>
            <Button size="sm" variant="destructive" disabled={working} onClick={() => deleteAllocations([...selected])}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selected.size}
            </Button>
          </>
        )}
      </div>

      <div className="stagger grid gap-4">
        {filteredAllocations.map((allocation) => (
          <Card key={allocation.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap justify-between items-start gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-1.5"
                    checked={selected.has(allocation.id)}
                    onCheckedChange={() => toggleSelected(allocation.id)}
                  />
                  <Calendar className="h-5 w-5 mt-1" />
                  <div>
                    <div>{allocation.papers?.title}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {allocation.allocation_colleges.map((ac) => ac.colleges?.name).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={allocation.is_published ? 'secondary' : 'default'}
                    size="sm"
                    disabled={working}
                    onClick={() => setPublished([allocation.id], !allocation.is_published)}
                  >
                    {allocation.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={working}
                    onClick={() => deleteAllocations([allocation.id])}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <strong>Subject:</strong> {allocation.papers?.subject}
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

        {filteredAllocations.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {allocations.length === 0 ? 'No allocations yet' : 'No allocations match your search'}
            </p>
          </Card>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormData(emptyForm);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Allocation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Paper</Label>
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
              <div className="flex items-center justify-between">
                <Label>Colleges (Select Multiple)</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      college_ids: prev.college_ids.length === colleges.length ? [] : colleges.map((c) => c.id),
                    }))
                  }
                >
                  {formData.college_ids.length === colleges.length ? 'Clear all' : 'Select all'}
                </Button>
              </div>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                {colleges.map((college) => (
                  <div key={college.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`college-${college.id}`}
                      checked={formData.college_ids.includes(college.id)}
                      onCheckedChange={() => toggleCollegeSelection(college.id)}
                    />
                    <label htmlFor={`college-${college.id}`} className="text-sm font-medium leading-none cursor-pointer">
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
              <Label htmlFor="is_published">Publish Immediately</Label>
            </div>
            <Button type="submit" className="w-full" disabled={working}>
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Allocation
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Import Allocations"
        description="Schedule many papers at once. Each row creates one allocation for one or more colleges."
        templateFileName="allocations-template.csv"
        columns={[
          { key: 'paper_title', required: true, hint: 'exact title from the Papers page' },
          { key: 'paper_subject', hint: 'only needed if two papers share a title' },
          { key: 'college_codes', required: true, hint: 'codes separated by ; (e.g. COL001;COL002) or ALL' },
          { key: 'exam_date', required: true, hint: 'YYYY-MM-DD or DD-MM-YYYY' },
          { key: 'start_time', required: true, hint: 'HH:MM, 24-hour or 10:00 AM' },
          { key: 'end_time', required: true },
          { key: 'publish', hint: 'yes / no (default no)' },
        ]}
        sampleRows={[
          [papers[0]?.title ?? 'Programming in C', papers[0]?.subject ?? 'Computer Science', 'ALL', '2026-11-15', '10:00', '13:00', 'no'],
        ]}
        validateRow={(row) => {
          const resolved = resolveImportRow(row);
          return typeof resolved === 'string' ? resolved : null;
        }}
        processRow={async (row) => {
          const resolved = resolveImportRow(row);
          if (typeof resolved === 'string') throw new Error(resolved);
          await createAllocation(resolved);
          return `Created for ${resolved.college_ids.length} college(s)`;
        }}
        onComplete={fetchAllocations}
      />
    </div>
  );
}
