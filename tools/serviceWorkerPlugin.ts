import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { injectPrecache, precacheEntries, precacheVersion, type HashedFile } from './precacheManifest.ts';
import { bundleItemContent, precacheMismatch, selectHashedFiles, selfContainedProblem } from './serviceWorkerBuild.ts';

const SW_SOURCE = resolve(import.meta.dirname, '../src/pwa/sw.ts');

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  let injected: string[] = [];
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
      const problem = selfContainedProblem(worker);
      if (problem) this.error(problem);

      const publicDir = config.publicDir;
      const publicFiles: HashedFile[] = publicDir
        ? listFiles(publicDir).map((path) => ({ name: relative(publicDir, path), content: readFileSync(path) }))
        : [];
      const bundleFiles: HashedFile[] = Object.entries(bundle)
        .filter(([name]) => name !== 'sw.js')
        .map(([name, item]) => ({ name, content: bundleItemContent(item) }));

      const entries = precacheEntries(
        bundleFiles.map((file) => file.name),
        publicFiles.map((file) => file.name),
      );
      if (!entries.includes('index.html')) this.error('The precache list lacks index.html.');

      const hashed = selectHashedFiles([...bundleFiles, ...publicFiles], entries);
      const version = await precacheVersion([...hashed, { name: 'sw.js', content: worker.code }]);
      try {
        worker.code = injectPrecache(worker.code, entries, version);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      const after = selfContainedProblem(worker);
      if (after) this.error(after);
      injected = entries;
    },
    writeBundle(options) {
      const directory = options.dir;
      if (!directory) return;
      const written = listFiles(directory).map((path) => relative(directory, path));
      const { missing, extra } = precacheMismatch(injected, written);
      if (missing.length > 0 || extra.length > 0) {
        this.error(
          `The precache list differs from dist. Missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}.`,
        );
      }
    },
  };
}
