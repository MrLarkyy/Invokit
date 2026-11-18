import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { injectPrecache, normalise, precacheEntries, precacheVersion, type HashedFile } from './precacheManifest.ts';

const SW_SOURCE = resolve(import.meta.dirname, '../src/pwa/sw.ts');

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function bundleContent(item: { type: string; code?: string; source?: string | Uint8Array }): Uint8Array | string {
  if (item.type === 'chunk') return item.code ?? '';
  return item.source ?? '';
}

export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'invoo-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: SW_SOURCE, fileName: 'sw.js' });
    },
    async generateBundle(_options, bundle) {
      const worker = bundle['sw.js'];
      if (worker?.type !== 'chunk') this.error('The service worker chunk was not emitted as sw.js.');
      if (worker.imports.length > 0 || worker.dynamicImports.length > 0 || worker.exports.length > 0) {
        this.error('sw.js must be one self-contained script without import or export.');
      }
      const publicDir = config.publicDir;
      const publicFiles: HashedFile[] = publicDir
        ? listFiles(publicDir).map((path) => ({
            name: relative(publicDir, path),
            content: readFileSync(path),
          }))
        : [];
      const bundleFiles: HashedFile[] = Object.entries(bundle)
        .filter(([name]) => name !== 'sw.js')
        .map(([name, item]) => ({ name, content: bundleContent(item) }));

      const entries = precacheEntries(
        bundleFiles.map((file) => file.name),
        publicFiles.map((file) => file.name),
      );
      if (!entries.includes('index.html')) this.error('The precache list lacks index.html.');

      const kept = new Set(entries);
      const hashed = [...bundleFiles, ...publicFiles].filter((file) => kept.has(normalise(file.name)));
      const version = await precacheVersion([...hashed, { name: 'sw.js', content: worker.code }]);
      try {
        worker.code = injectPrecache(worker.code, entries, version);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      if (/^\s*(import|export)\b/m.test(worker.code)) this.error('sw.js contains import or export statements.');
    },
  };
}
