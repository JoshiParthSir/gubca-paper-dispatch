// PDF, ZIP and Excel output for Duty Allocation, built in the browser.
//
// jsPDF, jspdf-autotable and JSZip are bundled (the site CSP blocks CDN
// scripts) and loaded with import() only when a file is made, so they stay
// out of the main bundle.
//
// Never embed the PDFs in an iframe or <object>: the CSP has
// frame-src 'none' and object-src 'none'. Preview in HTML, then download or
// open the PDF in a new tab.

import type { jsPDF as JsPDF } from 'jspdf';
import { fmtIsoDate, fmtLetterDate } from './letterSettings';
import { letterFileNames, printCode, rowCentre, tableSubject, type LetterContent } from './letter';
import type { DutyTableRow } from './dutyTable';

async function libs() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}

/**
 * The built-in Helvetica only covers Latin-1. Replace typographic quotes
 * and dashes, and drop anything else it cannot draw.
 */
const PDF_SUBSTITUTES: Record<number, string> = {
  0x2018: "'", 0x2019: "'", 0x201b: "'", 0x2032: "'",
  0x201c: '"', 0x201d: '"', 0x201f: '"', 0x2033: '"',
  0x2013: '-', 0x2014: '-', 0x2212: '-',
  0x2026: '...',
  0x20b9: 'Rs.',
  0x00a0: ' ', 0x2007: ' ', 0x202f: ' ',
};

export function pdfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code in PDF_SUBSTITUTES) out += PDF_SUBSTITUTES[code];
    else if (code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) out += ch;
  }
  return out;
}

const weekday = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long' });
};

const MARGIN = 20;

type AutoTable = Awaited<ReturnType<typeof libs>>['autoTable'];

/** Small envelope drawn before the exam email (the PDF fonts have no envelope character). */
function envelope(doc: JsPDF, x: number, baseline: number) {
  const w = 3.6;
  const h = 2.6;
  const top = baseline - h;
  doc.setLineWidth(0.25);
  doc.rect(x, top, w, h);
  doc.line(x, top, x + w / 2, top + h * 0.55);
  doc.line(x + w, top, x + w / 2, top + h * 0.55);
}

/** Draw one letter (duty page + guidelines page) starting on the current page of `doc`. */
function drawLetter(doc: JsPDF, autoTable: AutoTable, c: LetterContent) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - MARGIN * 2;
  let y = MARGIN;
  const BODY = 11;
  const FONT = 'times';

  const ensure = (h: number) => {
    if (y + h > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const lineH = (size: number) => size * 0.3528 * 1.25; // pt -> mm, with leading
  type Style = 'normal' | 'bold' | 'italic' | 'bolditalic';
  const lastY = (fallback: number) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;

  const write = (
    text: string,
    opts: { size?: number; style?: Style; font?: string; indent?: number; gap?: number; align?: 'left' | 'center' | 'right'; underline?: boolean } = {},
  ) => {
    const size = opts.size ?? BODY;
    doc.setFont(opts.font ?? FONT, opts.style ?? 'normal');
    doc.setFontSize(size);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(pdfText(text), width - indent) as string[];
    for (const line of lines) {
      ensure(lineH(size));
      const x = opts.align === 'center' ? pageW / 2 : opts.align === 'right' ? pageW - MARGIN : MARGIN + indent;
      const base = y + lineH(size) * 0.78;
      doc.text(line, x, base, { align: opts.align ?? 'left' });
      if (opts.underline) {
        const w = doc.getTextWidth(line);
        const x0 = opts.align === 'center' ? x - w / 2 : x;
        doc.setLineWidth(0.25);
        doc.line(x0, base + 0.7, x0 + w, base + 0.7);
      }
      y += lineH(size);
    }
    y += opts.gap ?? 0;
  };
  const paragraphs = (text: string, style: Style = 'normal', gap = 3) => {
    for (const p of text.split(/\n\s*\n/)) {
      if (!p.trim()) continue;
      for (const line of p.split('\n')) write(line, { style });
      y += gap;
    }
  };
  const tableStyles = { font: FONT, textColor: 0, lineColor: 0, lineWidth: 0.25 } as const;

  // --- Page 1: the duty letter -------------------------------------------
  c.letterhead.forEach((l) => write(l, { size: 12, style: 'bold', align: 'center' }));
  y += 6;

  if (c.showRefAndDate && (c.refNo || c.issueDate)) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(BODY);
    ensure(lineH(BODY));
    if (c.refNo) doc.text(pdfText(`No.: ${c.refNo}`), MARGIN, y + 4);
    if (c.issueDate) doc.text(`Date: ${fmtIsoDate(c.issueDate)}`, pageW - MARGIN, y + 4, { align: 'right' });
    y += lineH(BODY) + 3;
  }
  if (c.confidential.trim()) write(c.confidential, { style: 'bold', gap: 5 });
  if (c.refLine.trim()) write(c.refLine, { gap: 5 });
  c.toLines.forEach((l) => write(l));
  y += 5;

  if (c.subjectLine.trim()) write(`Subject: ${c.subjectLine}`, { style: 'bolditalic', gap: 8 });
  if (c.salutation.trim()) write(c.salutation, { gap: 4 });
  paragraphs(c.opening, 'normal', 2);

  // Duty table: Date | College | Subject (name, code, time)
  if (c.duties.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN + 9, right: MARGIN - 3 },
      theme: 'grid',
      styles: { ...tableStyles, fontSize: 10.5, cellPadding: { top: 0.6, bottom: 0.6, left: 1.2, right: 1.2 }, valign: 'middle' },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      bodyStyles: { fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 37 }, 1: { cellWidth: 45, halign: 'center' }, 2: { halign: 'center' } },
      head: [['Date', { content: 'College', styles: { halign: 'center' } }, { content: 'Subject', styles: { halign: 'center' } }]],
      body: c.duties.map((d) => [
        fmtLetterDate(d.date),
        pdfText(rowCentre(d)),
        pdfText([
          tableSubject(d.subject || d.subjectCode),
          d.subject && d.subject !== d.subjectCode ? `(${printCode(d.subjectCode)})` : '',
          c.examTime ? `[ Time : ${c.examTime} ]` : '',
        ].filter(Boolean).join('\n')),
      ]),
    });
    y = lastY(y) + 7;
  }

  paragraphs(c.afterTable, 'normal', 4);

  // Chairperson and coordinators: first on the left, last on the right edge.
  if (c.contacts.length) {
    const perRow = Math.min(3, c.contacts.length);
    for (let i = 0; i < c.contacts.length; i += perRow) {
      const group = c.contacts.slice(i, i + perRow);
      const blocks = group.map((p) => [
        p.name,
        p.designation,
        p.college,
        p.phone && `Phone : ${p.phone}`,
        p.email && `Email : ${p.email}`,
      ].filter((x) => x && x.trim()).map((x) => pdfText(x as string)));
      doc.setFont(FONT, 'bold');
      doc.setFontSize(BODY);
      const blockW = Math.min(width / group.length, Math.max(...blocks.flat().map((l) => doc.getTextWidth(l))) + 2);
      const h = Math.max(...blocks.map((b) => b.length)) * lineH(BODY) + 4;
      ensure(h);
      blocks.forEach((b, j) => {
        const x = group.length === 1 ? MARGIN : MARGIN + j * ((width - blockW) / (group.length - 1));
        b.forEach((line, k) => {
          const fitted = (doc.splitTextToSize(line, blockW) as string[])[0] ?? '';
          doc.text(fitted, x, y + lineH(BODY) * (k + 0.78));
        });
      });
      y += h;
    }
    y += 2;
  }
  if (c.contactEmail.trim()) {
    ensure(lineH(BODY));
    doc.setFont(FONT, 'bold');
    doc.setFontSize(BODY);
    const base = y + lineH(BODY) * 0.78;
    envelope(doc, MARGIN, base);
    doc.text(pdfText(c.contactEmail), MARGIN + 4.6, base);
    y += lineH(BODY) + 8;
  }

  paragraphs(c.closing, 'normal', 2);
  ensure(lineH(BODY) * (c.signOff.length + 1) + 22);
  y += 22;
  c.signOff.forEach((l) => write(l));

  // --- Page 2: guidelines and remuneration table --------------------------
  if (c.guidelines.length || c.guidelinesHeading.length) {
    doc.addPage();
    y = MARGIN;
    c.guidelinesHeading.forEach((l, i) => {
      if (i === 0) write(l, { size: 14, style: 'bold', font: 'helvetica', align: 'center', gap: 4 });
      else write(l, { style: 'bold', underline: i === 1 });
    });
    y += 3;
    c.guidelines.forEach((g, i) => {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(BODY);
      const lines = doc.splitTextToSize(pdfText(g), width - 8) as string[];
      lines.forEach((line, j) => {
        ensure(lineH(BODY));
        if (j === 0) doc.text(`${i + 1}.`, MARGIN, y + lineH(BODY) * 0.78);
        doc.text(line, MARGIN + 8, y + lineH(BODY) * 0.78);
        y += lineH(BODY);
      });
      y += 0.8;
    });
    y += 5;

    // Remuneration table: the allotted dates and colleges are filled in;
    // the number of students is left for the examiner to write.
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN + 3, right: MARGIN + 13 },
      theme: 'grid',
      styles: { ...tableStyles, fontSize: 11, cellPadding: 2, minCellHeight: 9, valign: 'middle' },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 12.5 },
      columnStyles: { 0: { cellWidth: 18, halign: 'center' }, 1: { cellWidth: 28 }, 3: { cellWidth: 40 } },
      head: [['S.no', 'Date', 'College', 'No. of students evaluated']],
      body: (c.duties.length ? c.duties : [null]).map((d, i) => (d
        ? [String(i + 1), fmtLetterDate(d.date), pdfText(d.cancelled ? 'Cancelled' : d.centreName && d.centreName !== d.centreCode ? `${d.centreCode} - ${d.centreName}` : d.centreCode), '']
        : ['', '', '', ''])),
    });
    y = lastY(y) + 7;
    if (c.billNote.trim()) write(c.billNote, { indent: 45 });
  }
}

function newDoc(jsPDF: Awaited<ReturnType<typeof libs>>['jsPDF'], title: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: pdfText(title), creator: 'paperdispatch.app' });
  return doc;
}

/** One letter as a PDF. */
export async function renderLetterPdf(content: LetterContent): Promise<Blob> {
  const { jsPDF, autoTable } = await libs();
  const doc = newDoc(jsPDF, `Letter ${content.refNo}`);
  drawLetter(doc, autoTable, content);
  return doc.output('blob');
}

/** Every letter in one PDF, each starting on a new page, for printing. */
export async function allLettersPdf(letters: readonly LetterContent[]): Promise<Blob> {
  const { jsPDF, autoTable } = await libs();
  const doc = newDoc(jsPDF, 'Examiner letters');
  letters.forEach((c, i) => {
    if (i > 0) doc.addPage();
    drawLetter(doc, autoTable, c);
  });
  return doc.output('blob');
}

/** One PDF per examiner in a ZIP, named <COLLEGE>_<Name_Surname>.pdf. */
export async function lettersZip(letters: readonly LetterContent[], onProgress?: (done: number) => void): Promise<Blob> {
  const [{ default: JSZip }, { jsPDF, autoTable }] = await Promise.all([import('jszip'), libs()]);
  const zip = new JSZip();
  const names = letterFileNames(letters);
  for (let i = 0; i < letters.length; i++) {
    const doc = newDoc(jsPDF, `Letter ${letters[i].refNo}`);
    drawLetter(doc, autoTable, letters[i]);
    zip.file(names[i], doc.output('arraybuffer'));
    onProgress?.(i + 1);
    // Let the page repaint between letters.
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export interface DutyTableMeta {
  title: string;
  subtitle?: string;
}

/** Date-wise, centre-wise table of the active duties (landscape). */
export async function dutyTablePdf(rows: readonly DutyTableRow[], meta: DutyTableMeta): Promise<Blob> {
  const { jsPDF, autoTable } = await libs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  doc.setProperties({ title: pdfText(meta.title), creator: 'paperdispatch.app' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(pdfText(meta.title), pageW / 2, 14, { align: 'center' });
  if (meta.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfText(meta.subtitle), pageW / 2, 20, { align: 'center' });
  }
  const names = (r: DutyTableRow, role: 'senior' | 'junior') =>
    r.examiners.filter((e) => e.role === role).map((e) => `${e.name} (${e.collegeCode})`).join('\n');
  autoTable(doc, {
    startY: meta.subtitle ? 25 : 20,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, textColor: 20, lineColor: 140, lineWidth: 0.15, valign: 'top' },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22 }, 4: { halign: 'center', cellWidth: 16 }, 5: { halign: 'center', cellWidth: 15 } },
    head: [['Date', 'Centre', 'Subject', 'Code', 'Students', 'Batches', 'Senior examiner', 'Junior examiner(s)']],
    body: rows.map((r) => [
      `${fmtIsoDate(r.date)}\n${weekday(r.date)}`,
      pdfText(r.centreName && r.centreName !== r.centreCode ? `${r.centreCode}\n${r.centreName}` : r.centreCode),
      pdfText(r.subject),
      r.subjectCode,
      r.students ? String(r.students) : '',
      r.batches ? String(r.batches) : '',
      pdfText(names(r, 'senior')),
      pdfText(names(r, 'junior')),
    ]),
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 12, h - 6, { align: 'right' });
    },
  });
  return doc.output('blob');
}

/** The same duties as a flat Excel sheet (one row per examiner) for filtering. */
export async function dutyTableXlsx(rows: readonly DutyTableRow[], sheetTitle = 'Duties'): Promise<Blob> {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    ['Date', 'Day', 'Centre code', 'Centre', 'Subject code', 'Subject', 'Students', 'Batches', 'Seat', 'Examiner', 'Examiner college'],
  ];
  for (const r of rows) {
    const base = [fmtIsoDate(r.date), weekday(r.date), r.centreCode, r.centreName, r.subjectCode, r.subject, r.students || '', r.batches || ''];
    if (!r.examiners.length) aoa.push([...base, '', 'Not filled', '']);
    for (const e of r.examiners) aoa.push([...base, e.role === 'senior' ? 'Senior' : 'Junior', e.name, e.collegeCode]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [12, 11, 12, 40, 18, 36, 9, 8, 8, 30, 14].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: aoa[0].length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 31));
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------------------------------------------------------------------------
// Cancellations record

export interface CancellationExportRow {
  /** ISO date of the duty. */
  date: string;
  centre: string;
  subjectCode: string;
  subject: string;
  examiner: string;
  examinerCollege: string;
  seat: string;
  reason: string;
  givenTo: string;
  givenToCollege: string;
  /** When it was cancelled, already formatted. */
  when: string;
  by: string;
}

/** The cancellations record as a PDF (landscape), for keeping on file. */
export async function cancellationsPdf(rows: readonly CancellationExportRow[], meta: DutyTableMeta): Promise<Blob> {
  const { jsPDF, autoTable } = await libs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  doc.setProperties({ title: pdfText(meta.title), creator: 'paperdispatch.app' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(pdfText(meta.title), pageW / 2, 14, { align: 'center' });
  if (meta.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfText(meta.subtitle), pageW / 2, 20, { align: 'center' });
  }
  autoTable(doc, {
    startY: meta.subtitle ? 25 : 20,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, textColor: 20, lineColor: 140, lineWidth: 0.15, valign: 'top' },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 22 }, 2: { cellWidth: 20 } },
    head: [['No.', 'Date', 'Centre', 'Subject', 'Cancelled examiner', 'Seat', 'Reason', 'Given to', 'Cancelled on', 'By']],
    body: rows.map((r, i) => [
      String(i + 1),
      `${fmtIsoDate(r.date)}\n${weekday(r.date)}`,
      pdfText(r.centre),
      pdfText(`${r.subject}\n(${r.subjectCode})`),
      pdfText(r.examinerCollege ? `${r.examiner}\n(${r.examinerCollege})` : r.examiner),
      r.seat,
      pdfText(r.reason),
      pdfText(r.givenToCollege ? `${r.givenTo}\n(${r.givenToCollege})` : r.givenTo),
      pdfText(r.when),
      pdfText(r.by),
    ]),
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 10, h - 6, { align: 'right' });
      doc.text(pdfText(`Downloaded ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`), 10, h - 6);
    },
  });
  return doc.output('blob');
}

/** The cancellations record as an Excel sheet, one row per cancelled duty. */
export async function cancellationsXlsx(rows: readonly CancellationExportRow[], sheetTitle = 'Cancellations'): Promise<Blob> {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    ['No.', 'Date', 'Day', 'Centre', 'Subject code', 'Subject', 'Cancelled examiner', 'Examiner college', 'Seat', 'Reason', 'Given to', 'Given to college', 'Cancelled on', 'Cancelled by'],
    ...rows.map((r, i) => [
      i + 1, fmtIsoDate(r.date), weekday(r.date), r.centre, r.subjectCode, r.subject, r.examiner, r.examinerCollege,
      r.seat, r.reason, r.givenTo, r.givenToCollege, r.when, r.by,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [5, 12, 11, 12, 18, 34, 28, 14, 8, 30, 28, 14, 20, 20].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: aoa[0].length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 31));
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------------------------------------------------------------------------
// Getting a file to the user

/** Save a file through a temporary download link. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Open a PDF in a new tab (never in an iframe: the CSP blocks frames).
 * Falls back to a download when the browser blocks the new tab.
 */
export function openBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  // No 'noopener' feature here: with it window.open always returns null and
  // a blocked tab could not be told apart. The opener is cut by hand instead.
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    downloadBlob(blob, fileName);
    return;
  }
  win.opener = null;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

export const safeFileName = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';

export { letterFileNames };
