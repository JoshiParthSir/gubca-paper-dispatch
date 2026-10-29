import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Download, FileUp, Loader2, XCircle } from 'lucide-react';
import { downloadCsv, parseCsvObjects, runWithConcurrency } from '@/lib/csv';

export interface BulkColumn {
  key: string;
  required?: boolean;
  hint?: string;
}

type Row = Record<string, string>;

interface RowResult {
  ok: boolean;
  message: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  columns: BulkColumn[];
  sampleRows: string[][];
  templateFileName: string;
  /** Return an error message for an invalid row, or null if it is valid. */
  validateRow?: (row: Row, index: number, all: Row[]) => string | null;
  /** Import one row. Return an optional success message (shown in results). */
  processRow: (row: Row) => Promise<string | void>;
  concurrency?: number;
  onComplete?: () => void;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  title,
  description,
  columns,
  sampleRows,
  templateFileName,
  validateRow,
  processRow,
  concurrency = 4,
  onComplete,
}: BulkImportDialogProps) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [results, setResults] = useState<(RowResult | undefined)[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const errors = useMemo(() => {
    if (!rows) return [];
    return rows.map((row, i, all) => {
      const missing = columns.filter((c) => c.required && !row[c.key]?.trim()).map((c) => c.key);
      if (missing.length) return `Missing ${missing.join(', ')}`;
      return validateRow?.(row, i, all) ?? null;
    });
  }, [rows, columns, validateRow]);

  const validCount = errors.filter((e) => !e).length;
  const finished = results.filter(Boolean).length;
  const succeeded = results.filter((r) => r?.ok).length;

  const reset = () => {
    setText('');
    setRows(null);
    setResults([]);
    setDone(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (running) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    setRows(parseCsvObjects(content));
  };

  const downloadTemplate = () => {
    downloadCsv(templateFileName, [columns.map((c) => c.key), ...sampleRows]);
  };

  const runImport = async () => {
    if (!rows) return;
    setRunning(true);
    setResults([]);
    const indexes = rows.map((_, i) => i).filter((i) => !errors[i]);
    await runWithConcurrency(indexes, concurrency, async (i) => {
      let result: RowResult;
      try {
        const message = await processRow(rows[i]);
        result = { ok: true, message: message || 'Imported' };
      } catch (err) {
        result = { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
      setResults((prev) => {
        const next = [...prev];
        next[i] = result;
        return next;
      });
    });
    setRunning(false);
    setDone(true);
    onComplete?.();
  };

  const downloadResults = () => {
    if (!rows) return;
    const keys = columns.map((c) => c.key);
    downloadCsv(templateFileName.replace(/\.csv$/, '') + '-results.csv', [
      [...keys, 'status', 'message'],
      ...rows.map((row, i) => [
        ...keys.map((k) => row[k] ?? ''),
        errors[i] ? 'skipped' : results[i]?.ok ? 'success' : results[i] ? 'failed' : 'not run',
        errors[i] ?? results[i]?.message ?? '',
      ]),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {!rows ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4 text-sm space-y-2">
              <p className="font-medium">CSV columns</p>
              <ul className="space-y-1">
                {columns.map((c) => (
                  <li key={c.key}>
                    <code className="rounded bg-muted px-1">{c.key}</code>
                    {c.required && <span className="text-destructive"> *</span>}
                    {c.hint && <span className="text-muted-foreground"> — {c.hint}</span>}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/50">
              <FileUp className="h-6 w-6" />
              <span>Choose a CSV file (export from Excel or Google Sheets as CSV)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">…or paste CSV text, including the header row:</p>
              <Textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={columns.map((c) => c.key).join(',')}
                className="font-mono text-xs"
              />
              <Button type="button" disabled={!text.trim()} onClick={() => setRows(parseCsvObjects(text))}>
                Preview
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{rows.length} rows</Badge>
              <Badge>{validCount} valid</Badge>
              {rows.length - validCount > 0 && (
                <Badge variant="destructive">{rows.length - validCount} with errors (will be skipped)</Badge>
              )}
              {(running || done) && (
                <span className="text-muted-foreground">
                  {succeeded} succeeded, {finished - succeeded} failed
                </span>
              )}
            </div>

            {(running || done) && <Progress value={validCount ? (finished / validCount) * 100 : 100} />}

            <div className="max-h-[45vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {columns.map((c) => (
                      <TableHead key={c.key}>{c.key}</TableHead>
                    ))}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {columns.map((c) => (
                        <TableCell key={c.key} className="max-w-[180px] truncate">
                          {row[c.key]}
                        </TableCell>
                      ))}
                      <TableCell className="min-w-[160px] text-xs">
                        {errors[i] ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3 w-3 shrink-0" /> {errors[i]}
                          </span>
                        ) : results[i] ? (
                          <span
                            className={`flex items-center gap-1 break-all ${
                              results[i]!.ok ? 'text-green-600' : 'text-destructive'
                            }`}
                          >
                            {results[i]!.ok ? (
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 shrink-0" />
                            )}
                            {results[i]!.message}
                          </span>
                        ) : running ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="text-muted-foreground">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {done ? (
                <>
                  <Button variant="outline" onClick={downloadResults}>
                    <Download className="mr-2 h-4 w-4" />
                    Download results
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Import another file
                  </Button>
                  <Button onClick={() => handleOpenChange(false)}>Close</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" disabled={running} onClick={() => setRows(null)}>
                    Back
                  </Button>
                  <Button disabled={running || validCount === 0} onClick={runImport}>
                    {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {validCount} row{validCount === 1 ? '' : 's'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
