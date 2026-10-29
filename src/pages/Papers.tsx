import { useEffect, useMemo, useRef, useState } from 'react';
import { hasCached, useCachedState } from '@/lib/page-cache';
import { PageSkeleton } from '@/components/PageFallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Upload, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { BulkPaperUploadDialog } from '@/components/papers/BulkPaperUploadDialog';
import {
  formatBytes,
  getPaperUrl,
  removePaperFiles,
  triggerExpiredPaperCleanup,
  uploadPaperFile,
  validatePdf,
} from '@/lib/paperStorage';

interface Paper {
  id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  google_drive_link: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  expires_at: string | null;
  purged_at: string | null;
  batch_id: string;
  created_at: string;
  batches: { name: string } | null;
}

interface Batch {
  id: string;
  name: string;
}

const emptyForm = { title: '', subject: '', duration_minutes: 180, batch_id: '' };

function FileStatus({ paper }: { paper: Paper }) {
  if (paper.file_path) {
    return paper.expires_at ? (
      <Badge variant="secondary">Auto-deletes {new Date(paper.expires_at).toLocaleDateString()}</Badge>
    ) : (
      <Badge variant="outline">Stored · expires 7 days after its last exam</Badge>
    );
  }
  if (paper.purged_at) {
    return <Badge variant="destructive">File deleted {new Date(paper.purged_at).toLocaleDateString()}</Badge>;
  }
  if (paper.google_drive_link) return <Badge variant="outline">Legacy Google Drive link</Badge>;
  return <Badge variant="destructive">No file</Badge>;
}

export default function Papers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useCachedState<Paper[]>('papers:papers', []);
  const [batches, setBatches] = useCachedState<Batch[]>('papers:batches', []);
  // Only the first visit shows a skeleton; later visits render cached data instantly
  const [loading, setLoading] = useState(!hasCached('papers:papers'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<Paper | null>(null);

  useEffect(() => {
    triggerExpiredPaperCleanup();
    fetchPapers();
    fetchBatches();
  }, []);

  const showError = (error: unknown) => {
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Something went wrong',
      variant: 'destructive',
    });
  };

  const fetchPapers = async () => {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*, batches(name)')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPapers((data as Paper[]) || []);
      setSelected(new Set());
    } catch (error) {
      showError(error);
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
    } catch (error) {
      showError(error);
    }
  };

  const filteredPapers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter((p) =>
      [p.title, p.subject, p.batches?.name ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }, [papers, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.subject.trim()) {
      toast({ title: 'Error', description: 'Title and subject are required', variant: 'destructive' });
      return;
    }
    if (!formData.batch_id) {
      toast({ title: 'Error', description: 'Please select a batch', variant: 'destructive' });
      return;
    }
    if (!formData.duration_minutes || formData.duration_minutes <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid duration', variant: 'destructive' });
      return;
    }
    const fileError = file ? validatePdf(file) : 'Please choose a PDF file';
    if (fileError) {
      toast({ title: 'Error', description: fileError, variant: 'destructive' });
      return;
    }

    setUploading(true);
    let path: string | null = null;
    try {
      path = await uploadPaperFile(file!, formData.batch_id);
      const { error } = await supabase.from('papers').insert({
        title: formData.title.trim().substring(0, 200),
        subject: formData.subject.trim().substring(0, 100),
        duration_minutes: formData.duration_minutes,
        batch_id: formData.batch_id,
        file_path: path,
        file_name: file!.name,
        file_size: file!.size,
        uploaded_by: user!.id,
      });
      if (error) throw error;

      toast({ title: 'Paper uploaded successfully' });
      setDialogOpen(false);
      resetForm();
      fetchPapers();
    } catch (error) {
      if (path) await removePaperFiles([path]).catch(() => undefined);
      showError(error);
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async (paper: Paper, newFile: File | undefined) => {
    if (!newFile) return;
    const fileError = validatePdf(newFile);
    if (fileError) {
      toast({ title: 'Error', description: fileError, variant: 'destructive' });
      return;
    }

    setBusyId(paper.id);
    let path: string | null = null;
    try {
      path = await uploadPaperFile(newFile, paper.batch_id);
      const { error } = await supabase
        .from('papers')
        .update({ file_path: path, file_name: newFile.name, file_size: newFile.size, purged_at: null })
        .eq('id', paper.id);
      if (error) throw error;
      if (paper.file_path) await removePaperFiles([paper.file_path]).catch(() => undefined);
      toast({ title: 'File updated' });
      fetchPapers();
    } catch (error) {
      if (path) await removePaperFiles([path]).catch(() => undefined);
      showError(error);
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (paper: Paper) => {
    // Open the tab synchronously so popup blockers allow it, then navigate.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    try {
      const url = paper.file_path ? await getPaperUrl(paper.file_path) : paper.google_drive_link;
      if (!url) throw new Error('This paper has no file');
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (error) {
      win?.close();
      showError(error);
    }
  };

  const deletePapers = async (ids: string[]) => {
    const label = ids.length === 1 ? 'this paper' : `${ids.length} papers`;
    if (!confirm(`Delete ${label}? Its allocations and stored file will also be deleted.`)) return;

    setUploading(true);
    try {
      const targets = papers.filter((p) => ids.includes(p.id));
      const { error } = await supabase.from('papers').delete().in('id', ids);
      if (error) throw error;
      await removePaperFiles(targets.map((p) => p.file_path).filter((p): p is string => !!p)).catch(() => undefined);
      toast({ title: `Deleted ${label}` });
      fetchPapers();
    } catch (error) {
      showError(error);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setFile(null);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filteredPapers.length > 0 && filteredPapers.every((p) => selected.has(p.id));

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4 animate-fade-in-down">
        <div>
          <h1>Exam Papers</h1>
          <p className="text-muted-foreground">
            PDFs are stored privately and deleted automatically 7 days after their last exam.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button className="hover-scale hover-glow" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Paper
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by title, subject or batch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {filteredPapers.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(filteredPapers.map((p) => p.id)) : new Set())
              }
            />
            Select all
          </label>
        )}
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" disabled={uploading} onClick={() => deletePapers([...selected])}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selected.size} selected
          </Button>
        )}
      </div>

      <input
        ref={replaceInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          if (replaceTarget.current) handleReplaceFile(replaceTarget.current, e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredPapers.map((paper, index) => (
          <Card
            key={paper.id}
            className="hover-lift card-gradient"
          >
            <CardHeader>
              <CardTitle className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-1.5"
                    checked={selected.has(paper.id)}
                    onCheckedChange={() => toggleSelected(paper.id)}
                  />
                  <FileText className="h-5 w-5 mt-1 shrink-0 text-primary" />
                  <span>{paper.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePapers([paper.id])}
                  className="shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Subject:</strong> {paper.subject}</p>
                <p><strong>Duration:</strong> {paper.duration_minutes} minutes</p>
                <p><strong>Batch:</strong> {paper.batches?.name ?? '—'}</p>
                {paper.file_name && (
                  <p className="truncate text-muted-foreground" title={paper.file_name}>
                    {paper.file_name} {paper.file_size ? `· ${formatBytes(paper.file_size)}` : ''}
                  </p>
                )}
                <FileStatus paper={paper} />
                <div className="flex flex-wrap gap-2 pt-2">
                  {(paper.file_path || paper.google_drive_link) && (
                    <Button variant="outline" size="sm" onClick={() => handlePreview(paper)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === paper.id}
                    onClick={() => {
                      replaceTarget.current = paper;
                      replaceInput.current?.click();
                    }}
                  >
                    {busyId === paper.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {paper.file_path ? 'Replace PDF' : 'Upload PDF'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPapers.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{papers.length === 0 ? 'No papers yet' : 'No papers match your search'}</p>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (uploading) return;
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="animate-scale-in bg-popover z-50">
          <DialogHeader>
            <DialogTitle>Add New Paper</DialogTitle>
            <DialogDescription>Upload the question paper as a PDF (max 50 MB).</DialogDescription>
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
                min={1}
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label>Batch</Label>
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
              <Label htmlFor="paper_file">Question Paper (PDF)</Label>
              <Input
                id="paper_file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              {file && <p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)}</p>}
            </div>
            <Button type="submit" className="w-full hover-scale" disabled={uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : 'Upload Paper'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {user && (
        <BulkPaperUploadDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          batches={batches}
          userId={user.id}
          onComplete={fetchPapers}
        />
      )}
    </div>
  );
}
