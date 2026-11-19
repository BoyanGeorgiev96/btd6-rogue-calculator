import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, readFile, writeFile, readdir, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildOfflineWorker } from '../scripts/offline-build.mjs';
import { buildSourcePackage, sourceRoots, sourceArchive } from '../scripts/source-package.mjs';
const run = promisify(execFile);

test('production build ships only active data and preserves the last build on review failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'rogue-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(directory, 'node_modules'), 'dir');
  for (const path of sourceRoots)
    await cp(new URL(`../${path}`, import.meta.url), join(directory, path), { recursive: true });
  await writeFile(join(directory, 'data/artifacts.candidate.json'), '{}');
  await writeFile(join(directory, 'data/refresh-report.md'), 'Pending review');
  await mkdir(join(directory, '.local-notes'));
  await writeFile(join(directory, '.local-notes/private.md'), 'private sentinel');
  await writeFile(join(directory, 'AGENTS.md'), 'local instructions');
  await run(process.execPath, ['scripts/build.mjs'], { cwd: directory });
  assert.deepEqual(await readdir(join(directory, 'dist/data')), ['ARTIFACT-NOTICES.md', 'artifacts.json', 'heroes.json', 'power-source-models.json', 'powers.json', 'towers.json']);
  const html = await readFile(join(directory, 'dist/index.html'), 'utf8');
  assert.match(html, /name="rogue-lab-offline"/);
  const { version } = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  assert.ok(html.includes(`v${version} · Beta`));
  assert.doesNotMatch(html, /__APP_VERSION__/);
  assert.match(await readFile(join(directory, 'dist/changelog.html'), 'utf8'), /<h1>Changelog<\/h1>/);
  assert.match(html, /href="\.\/source\/rogue-lab-source\.tar\.gz" data-release-source download/);
  const manifest = JSON.parse(await readFile(join(directory, 'dist/source/manifest.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert.equal(manifest.license, 'GPL-3.0-only');
  assert.equal(manifest.archiveSha256, createHash('sha256').update(await readFile(join(directory, 'dist', sourceArchive))).digest('hex'));
  const extracted = join(directory, 'extracted');
  await mkdir(extracted);
  await run('tar', ['-xzf', join(directory, 'dist', sourceArchive), '-C', extracted]);
  for (const { path, sha256 } of manifest.files) {
    const bytes = await readFile(join(extracted, path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `${path} matches the archive manifest`);
    assert.deepEqual(bytes, await readFile(join(directory, path)), `${path} matches this build's editable input`);
  }
  assert.ok(manifest.files.some(file => file.path === 'data/catalog-contract.json'));
  assert.ok(manifest.files.some(file => file.path === 'package-lock.json'));
  assert.ok(manifest.files.some(file => file.path === 'tests/build.test.js'));
  assert.ok(!manifest.files.some(file => /candidate|refresh-report|local-notes|AGENTS|TODO|node_modules|^dist\//.test(file.path)));
  const innerManifest = JSON.parse(await readFile(join(extracted, 'SOURCE-MANIFEST.json'), 'utf8'));
  assert.deepEqual(innerManifest.files, manifest.files);
  // The source offer must actually build without Git metadata or upstream data.
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(extracted, 'node_modules'), 'dir');
  await run(process.execPath, ['scripts/build.mjs'], { cwd: extracted });
  for (const path of ['index.html', 'src/app.js', 'data/artifacts.json', 'data/towers.json']) {
    assert.deepEqual(await readFile(join(extracted, 'dist', path)), await readFile(join(directory, 'dist', path)), `${path} rebuilds from offered source`);
  }
  const workerPath = join(directory, 'dist/sw.js');
  const worker = await readFile(workerPath, 'utf8');
  assert.match(worker, /docs\/mechanics-notebook.md/);
  assert.match(worker, /src\/app.js/);
  assert.match(worker, /sha256-/);
  const files = JSON.parse(worker.match(/const FILES = (.*);/)[1]);
  for (const { url, integrity } of files) {
    const output = await readFile(join(directory, 'dist', url));
    assert.equal(integrity, 'sha256-' + createHash('sha256').update(output).digest('base64'), `${url} hashes the final output`);
    if (url.startsWith('data/') && url.endsWith('.json')) {
      const source = await readFile(join(directory, url), 'utf8');
      assert.deepEqual(JSON.parse(output), JSON.parse(source), `${url} preserves catalog values`);
      assert.ok(output.length < Buffer.byteLength(source), `${url} is compacted`);
    }
  }
  for (const path of ['src/app.js', 'src/style.css']) {
    assert.ok((await readFile(join(directory, 'dist', path))).length < (await readFile(join(directory, path))).length, `${path} is minified`);
  }
  for (const path of ['LICENSE', 'DISTRIBUTION.md', 'data/ARTIFACT-NOTICES.md', 'third-party/BTD6-API-Explorer-LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'docs/user-guide.md', 'docs/user-guide.html', 'docs/calculation-scope.html', 'docs/tower-stats.md', 'docs/powers.md', 'docs/ability-cooldowns.md', 'docs/ability-durations.md']) {
    if (!path.endsWith('.html')) assert.equal(await readFile(join(directory, 'dist', path), 'utf8'), await readFile(join(directory, path), 'utf8'));
    assert.ok(worker.includes(`"url":"${path}"`), `${path} is available offline`);
  }
  assert.doesNotMatch(worker, /candidate|refresh-report|tower-source/);
  await buildOfflineWorker(join(directory, 'dist'));
  assert.equal(await readFile(workerPath, 'utf8'), worker, 'identical output keeps the same worker');
  await writeFile(join(directory, 'dist/data/heroes.json'), '{}');
  await buildOfflineWorker(join(directory, 'dist'));
  assert.notEqual(await readFile(workerPath, 'utf8'), worker, 'data-only changes create a new release');
  const catalog = JSON.parse(await readFile(join(directory, 'data/artifacts.json'), 'utf8'));
  const variant = catalog.artifacts.find(a => a.id === 'OneMonkeyArmy').variants[0];
  variant.sourceTemplate = variant.sourceTemplate.replace('2x', '3x');
  variant.description = variant.sourceTemplate;
  await writeFile(join(directory, 'data/artifacts.json'), JSON.stringify(catalog));
  await assert.rejects(run(process.execPath, ['scripts/build.mjs'], { cwd: directory }), /Source description/);
  assert.equal(await readFile(join(directory, 'dist/index.html'), 'utf8'), html);
  await symlink(join(directory, '.local-notes/private.md'), join(directory, 'src/linked-private.md'));
  await assert.rejects(buildSourcePackage(join(directory, 'rejected'), directory), /rejects symlink/);
});
