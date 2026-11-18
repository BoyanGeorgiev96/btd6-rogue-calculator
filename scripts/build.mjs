import { cp, mkdir, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { transform } from 'esbuild';
import { checkData } from './check-data.mjs';
import { buildOfflineWorker } from './offline-build.mjs';
import { buildSourcePackage } from './source-package.mjs';
import { documentPage } from './document-pages.mjs';
import { versionedIndex, changelogPage } from './release-pages.mjs';
// Validate before touching a previous build. Review files and pending candidates
// stay in the source repository; only the active catalog ships to visitors.
await checkData();
await rm('dist', { recursive: true, force: true });
await mkdir('dist/data', { recursive: true });
for (const path of ['index.html', 'src', 'favicon.svg', 'LICENSE', 'third-party', 'THIRD_PARTY_NOTICES.md', 'data/artifacts.json', 'data/towers.json', 'data/heroes.json', 'data/powers.json', 'data/power-source-models.json']) await cp(path, `dist/${path}`, { recursive: true });
await mkdir('dist/docs', { recursive: true });
// Render documentation links as readable pages; retain Markdown downloads.
for (const name of await readdir('docs')) {
  if (!name.endsWith('.md')) continue;
  await cp(`docs/${name}`, `dist/docs/${name}`);
  await writeFile(`dist/docs/${name.replace(/\.md$/, '.html')}`, await documentPage(name.slice(0, -3)));
}
await writeFile('dist/index.html', await versionedIndex(await readFile('index.html', 'utf8')));
await writeFile('dist/changelog.html', await changelogPage());
await cp('CHANGELOG.md', 'dist/CHANGELOG.md');
// Keep the source readable and preserve module/asset paths. Finish all output
// transformations before the offline manifest hashes the release.
async function minifyAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await minifyAssets(path);
      continue;
    }
    const extension = extname(path);
    if (!['.js', '.css', '.json'].includes(extension)) continue;
    const source = await readFile(path, 'utf8');
    const output = extension === '.json'
      ? JSON.stringify(JSON.parse(source)) + '\n'
      : (await transform(source, {
        loader: extension === '.js' ? 'js' : 'css',
        ...(extension === '.js' ? { format: 'esm', target: 'es2022' } : {}),
        minify: true,
        legalComments: 'inline',
        sourcefile: path
      })).code;
    await writeFile(path, output);
  }
}
await minifyAssets('dist');
await buildSourcePackage('dist');
await buildOfflineWorker('dist');
console.log('Static site built in dist/');
