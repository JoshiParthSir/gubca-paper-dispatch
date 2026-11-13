// Turns an uploaded .xlsx / .xls / .csv into rows of cells (first sheet).
// SheetJS is loaded only when a file is actually read, so it stays out of
// the main bundle.

import { TIMETABLE_HEADERS } from './timetableImport';

export const SHEET_ACCEPT = '.xlsx,.xls,.csv';
export const MAX_SHEET_BYTES = 5 * 1024 * 1024;

export async function readSheetRows(file: File): Promise<unknown[][]> {
  if (file.size > MAX_SHEET_BYTES) throw new Error('File is larger than 5 MB. Please upload the sheet only.');
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Please upload an .xlsx, .xls or .csv file.');
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true, dense: true });
  const first = wb.SheetNames[0];
  if (!first) throw new Error('The file has no sheets.');
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], { header: 1, raw: true, defval: null, blankrows: false });
}

/** Download an empty timetable template with the expected headers. */
export async function downloadTimetableTemplate() {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([
    [...TIMETABLE_HEADERS],
    ['18-11-2026', 'LJCCA', 'DSC-C-BCA-353P', '1', '1001', '1060', ''],
  ]);
  ws['!cols'] = TIMETABLE_HEADERS.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  XLSX.writeFile(wb, 'practical-timetable-template.xlsx');
}
