import { FILE_TOO_LARGE, LIMITS } from '../domain/limits';
import type { AppData } from './appData';
import { parseAppData } from './appDataSchema';

export function backupFileName(today: string): string {
  return `invoo-zaloha-${today}.json`;
}

/** The backup text: compact (no indentation), so a backup of anything localStorage holds stays under the limit. */
export function backupText(data: AppData): string {
  return JSON.stringify(data);
}

/** Offers the text as a file to save; it is created in the browser, nothing is uploaded. */
export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadBackup(data: AppData, today: string): void {
  downloadText(backupText(data), backupFileName(today));
}

/** Reads a backup (v2, or v1 migrated); throws a Czech message, before reading a file over the size limit too. */
export async function readBackup(file: File): Promise<AppData> {
  if (file.size > LIMITS.fileBytes) throw new Error(FILE_TOO_LARGE);
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Soubor se nepodařilo přečíst.');
  }
  return parseAppData(text);
}
