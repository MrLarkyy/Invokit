import type { AppData } from './appData';
import { parseAppData } from './appDataStorage';

/** Offers the data as a JSON file to save; the file is created in the browser, nothing is uploaded. */
export function downloadBackup(data: AppData, today: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invokit-zaloha-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readBackup(file: File): Promise<AppData> {
  return parseAppData(await file.text());
}
