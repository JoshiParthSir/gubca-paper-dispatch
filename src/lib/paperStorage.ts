import { supabase } from '@/integrations/supabase/client';

export const PAPERS_BUCKET = 'papers';
export const MAX_PAPER_BYTES = 50 * 1024 * 1024;

export function validatePdf(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Only PDF files are allowed';
  if (file.size > MAX_PAPER_BYTES) return 'File is larger than 50 MB';
  if (file.size === 0) return 'File is empty';
  return null;
}

export async function uploadPaperFile(file: File, batchId: string): Promise<string> {
  const path = `${batchId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(PAPERS_BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return path;
}

export async function removePaperFiles(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PAPERS_BUCKET).remove(paths);
  if (error) throw error;
}

export async function getPaperUrl(path: string, downloadName?: string) {
  const { data, error } = await supabase.storage
    .from(PAPERS_BUCKET)
    .createSignedUrl(path, 60, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "Maths - Semester 1 Final.pdf" -> { subject: "Maths", title: "Semester 1 Final" }
export function guessPaperDetails(fileName: string) {
  const base = fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sep = base.indexOf(' - ');
  if (sep > 0) {
    return { subject: base.slice(0, sep).trim(), title: base.slice(sep + 3).trim() || base };
  }
  return { subject: base, title: base };
}

// Fire-and-forget: deletes files whose retention period has ended.
// The hourly cron job does this too; calling it here keeps things tidy
// even if the cron job is not set up.
export function triggerExpiredPaperCleanup() {
  supabase.functions.invoke('cleanup-expired-papers', { body: {} }).catch(() => undefined);
}
