import { LIMITS } from '../domain/limits';
import type { AppData } from './appData';
import { parseAppData } from './appDataSchema';

export function backupFileName(today: string): string {
  return `invoo-zaloha-${today}.json`;
}

/** Offers the data as a JSON file to save; the file is created in the browser, nothing is uploaded. */
export function downloadBackup(data: AppData, today: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(today);
  link.click();
  URL.revokeObjectURL(url);
}

/** Reads a backup (v2, or v1 migrated); throws a Czech message, before reading a file over the size limit too. */
export async function readBackup(file: File): Promise<AppData> {
  if (file.size > LIMITS.fileBytes) throw new Error('Soubor je příliš velký (nejvýš 5 MB).');
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Soubor se nepodařilo přečíst.');
  }
  return parseAppData(text);
}
