import { describe, expect, it } from 'vitest';
import { bundleItemContent, precacheMismatch, selectHashedFiles, selfContainedProblem } from './serviceWorkerBuild.ts';

const chunk = { code: 'self.skip();', imports: [], dynamicImports: [], exports: [] };

describe('bundleItemContent', () => {
  it('reads the code of a chunk and the source of an asset', () => {
    expect(bundleItemContent({ type: 'chunk', code: 'a' })).toBe('a');
    expect(bundleItemContent({ type: 'asset', source: 'b' })).toBe('b');
    expect(bundleItemContent({ type: 'asset' })).toBe('');
  });
});

describe('selectHashedFiles', () => {
  it('keeps only files named in the entries, with Windows paths normalised', () => {
    const files = [
      { name: 'index.html', content: 'a' },
      { name: 'icons\\x.png', content: 'b' },
      { name: 'CNAME', content: 'c' },
    ];
    expect(selectHashedFiles(files, ['icons/x.png', 'index.html']).map((file) => file.name)).toEqual([
      'index.html',
      'icons\\x.png',
    ]);
  });
});

describe('selfContainedProblem', () => {
  it('accepts a plain script', () => {
    expect(selfContainedProblem(chunk)).toBeNull();
  });

  it('rejects imports, dynamic imports and exports of the chunk', () => {
    expect(selfContainedProblem({ ...chunk, imports: ['a.js'] })).toContain('self-contained');
    expect(selfContainedProblem({ ...chunk, dynamicImports: ['a.js'] })).toContain('self-contained');
    expect(selfContainedProblem({ ...chunk, exports: ['x'] })).toContain('self-contained');
  });

  it('rejects import or export statements left in the code', () => {
    expect(selfContainedProblem({ ...chunk, code: 'a();\nexport {x};' })).toContain('import or export');
  });
});

describe('precacheMismatch', () => {
  it('is empty when the list equals the written files minus the excluded ones', () => {
    const written = ['index.html', 'sw.js', 'CNAME', 'assets/a.js', 'assets/a.js.map', '.nojekyll'];
    expect(precacheMismatch(['assets/a.js', 'index.html'], written)).toEqual({ missing: [], extra: [] });
  });

  it('reports a written file that is not listed and a listed file that was not written', () => {
    expect(precacheMismatch(['index.html', 'gone.js'], ['index.html', 'new.css'])).toEqual({
      missing: ['new.css'],
      extra: ['gone.js'],
    });
  });
});
