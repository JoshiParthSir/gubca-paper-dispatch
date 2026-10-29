import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, FileUp, Loader2, Trash2, XCircle } from 'lucide-react';
import { runWithConcurrency } from '@/lib/csv';
import { formatBytes, guessPaperDetails, removePaperFiles, uploadPaperFile, validatePdf } from '@/lib/paperStorage';

interface Batch {
  id: string;
  name: string;
}

interface FileRow {
  file: File;
  title: string;
  subject: string;
  duration_minutes: number;
  error: string | null;
  status?: 'uploading' | 'done' | 'failed';
  message?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: Batch[];
  userId: string;
  onComplete: () => void;
}

export function BulkPaperUploadDialog({ open, onOpenChange, batches, userId, onComplete }: Props) {
  const [batchId, setBatchId] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(180);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setRows([]);
    setDone(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (running) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).map((file) => ({
      file,
      ...guessPaperDetails(file.name),
      duration_minutes: defaultDuration,
      error: validatePdf(file),
    }));
    setRows((prev) => [...prev, ...added]);
    setDone(false);
  };

  const updateRow = (index: number, patch: Partial<FileRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const rowError = (row: FileRow) => {
    if (row.error) return row.error;
    if (!row.title.trim()) return 'Title required';
    if (!row.subject.trim()) return 'Subject required';
    if (!row.duration_minutes || row.duration_minutes <= 0) return 'Invalid duration';
    return null;
  };

  const pending = rows.map((r, i) => i).filter((i) => !rowError(rows[i]) && rows[i].status !== 'done');
  const finished = rows.filter((r) => r.status === 'done' || r.status === 'failed').length;

  const runUpload = async () => {
    if (!batchId) return;
    setRunning(true);
    await runWithConcurrency(pending, 3, async (i) => {
      const row = rows[i];
      updateRow(i, { status: 'uploading', message: undefined });
      let path: string | null = null;
      try {
        path = await uploadPaperFile(row.file, batchId);
        const { error } = await supabase.from('papers').insert({
          title: row.title.trim().substring(0, 200),
          subject: row.subject.trim().substring(0, 100),
          duration_minutes: row.duration_minutes,
          batch_id: batchId,
          file_path: path,
          file_name: row.file.name,
          file_size: row.file.size,
          uploaded_by: userId,
        });
        if (error) throw error;
        updateRow(i, { status: 'done', message: 'Uploaded' });
      } catch (err) {
        if (path) await removePaperFiles([path]).catch(() => undefined);
        updateRow(i, { status: 'failed', message: err instanceof Error ? err.message : 'Upload failed' });
      }
    });
    setRunning(false);
    setDone(true);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Papers</DialogTitle>
          <DialogDescription>
            Select many PDFs at once. Name files like <code>Subject - Title.pdf</code> to fill in details
            automatically; you can edit them before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Batch (applies to all files)</Label>
            <Select value={batchId} onValueChange={setBatchId} disabled={running}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk_duration">Default duration (minutes)</Label>
            <Input
              id="bulk_duration"
              type="number"
              min={1}
              value={defaultDuration}
              disabled={running}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setDefaultDuration(value);
                setRows((prev) => prev.map((r) => (r.status === 'done' ? r : { ...r, duration_minutes: value })));
              }}
            />
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/50">
          <FileUp className="h-6 w-6" />
          <span>Choose PDF files (max 50 MB each)</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            disabled={running}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {rows.length > 0 && (
          <>
            {(running || done) && <Progress value={(finished / Math.max(1, finished + pending.length)) * 100} />}
            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-24">Minutes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const err = rowError(row);
                    const locked = running || row.status === 'done';
                    return (
                      <TableRow key={`${row.file.name}-${i}`}>
                        <TableCell className="max-w-[160px] truncate text-xs" title={row.file.name}>
                          {row.file.name}
                          <div className="text-muted-foreground">{formatBytes(row.file.size)}</div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.title}
                            disabled={locked}
                            onChange={(e) => updateRow(i, { title: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.subject}
                            disabled={locked}
                            onChange={(e) => updateRow(i, { subject: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={row.duration_minutes}
                            disabled={locked}
                            onChange={(e) => updateRow(i, { duration_minutes: parseInt(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="min-w-[120px] text-xs">
                          {row.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : row.status === 'done' ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> Uploaded
                            </span>
                          ) : row.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <XCircle className="h-3 w-3 shrink-0" /> {row.message}
                            </span>
                          ) : err ? (
                            <span className="text-destructive">{err}</span>
                          ) : (
                            <span className="text-muted-foreground">Ready</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!batchId && rows.length > 0 && <span className="text-sm text-destructive">Select a batch first</span>}
          <Button variant="outline" disabled={running} onClick={() => handleOpenChange(false)}>
            {done ? 'Close' : 'Cancel'}
          </Button>
          <Button disabled={running || !batchId || pending.length === 0} onClick={runUpload}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {done && pending.length > 0 ? 'Retry' : 'Upload'} {pending.length} file{pending.length === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
