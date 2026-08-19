import { buildWorkbookPlan, describeWorkbook, type WorkbookPlan } from '@scope/engine';
import type { Engagement, EngagementAnalysis } from '@scope/engine';

export { buildWorkbookPlan, describeWorkbook };
export type { WorkbookPlan };

/**
 * Turn the workbook plan into a file.
 *
 * SheetJS is loaded on demand — it dwarfs the rest of the app, and most sessions never
 * export anything.
 */
export async function downloadWorkbook(
  engagement: Engagement,
  analysis: EngagementAnalysis,
  scenarioId: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const plan = buildWorkbookPlan(engagement, analysis, scenarioId);
  const book = XLSX.utils.book_new();

  for (const sheet of plan.sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows.map((row) => row.map((cell) => cell ?? '')));
    for (const [key, entry] of Object.entries(sheet.formulas ?? {})) {
      const [row, column] = key.split(',').map(Number);
      const address = XLSX.utils.encode_cell({ r: row!, c: column! });
      worksheet[address] = { t: 'n', f: entry.formula, v: entry.value };
    }
    if (sheet.widths) worksheet['!cols'] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, worksheet, sheet.name);
  }

  // The file is named for the client, the engagement and the deal, so it arrives in an
  // inbox saying what it is. Note this cannot be checked in the headless browser used
  // here — it reports "download" even for a hand-built anchor with an explicit
  // download attribute — so the filename is verified by unit test on the plan instead.
  XLSX.writeFile(book, plan.filename, { compression: true });
}

/** A page cannot save a file from inside an embedded frame. Say so rather than fail silently. */
export function downloadsAreBlocked(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
