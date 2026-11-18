import { normalise, precacheEntries, type HashedFile } from './precacheManifest.ts';

export interface BundleItem {
  type: string;
  code?: string;
  source?: string | Uint8Array;
}

export interface WorkerChunk {
  code: string;
  imports: readonly string[];
  dynamicImports: readonly string[];
  exports: readonly string[];
}

export function bundleItemContent(item: BundleItem): Uint8Array | string {
  return item.type === 'chunk' ? (item.code ?? '') : (item.source ?? '');
}

// Only files that end up in the precache list are hashed into the version.
export function selectHashedFiles(files: readonly HashedFile[], entries: readonly string[]): HashedFile[] {
  const kept = new Set(entries);
  return files.filter((file) => kept.has(normalise(file.name)));
}

export function selfContainedProblem(chunk: WorkerChunk): string | null {
  if (chunk.imports.length > 0 || chunk.dynamicImports.length > 0 || chunk.exports.length > 0) {
    return 'sw.js must be one self-contained script without import or export.';
  }
  if (/^\s*(import|export)\b/m.test(chunk.code)) return 'sw.js contains import or export statements.';
  return null;
}

export interface PrecacheMismatch {
  missing: string[];
  extra: string[];
}

// `written` are the files found in the output directory; the list must equal them minus the excluded ones.
export function precacheMismatch(entries: readonly string[], written: readonly string[]): PrecacheMismatch {
  const expected = new Set(precacheEntries(written, []));
  const listed = new Set(entries);
  return {
    missing: [...expected].filter((name) => !listed.has(name)).sort(),
    extra: [...listed].filter((name) => !expected.has(name)).sort(),
  };
}
