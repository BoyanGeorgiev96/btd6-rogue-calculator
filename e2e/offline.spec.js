import { test, expect } from '@playwright/test';
import { cp, mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { buildOfflineWorker } from '../scripts/offline-build.mjs';
import { sourceRoots, sourceArchive } from '../scripts/source-package.mjs';

let directory, server, origin, site;
test.beforeAll(async () => {
  test.setTimeout(90000);
  directory = await mkdtemp(join(tmpdir(), 'rogue-offline-'));
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(directory, 'node_modules'), 'dir');
  for (const path of sourceRoots) {
    await cp(path, join(directory, path), { recursive: true });
  }
  await promisify(execFile)(process.execPath, ['scripts/build.mjs'], { cwd: directory });
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.md':'text/markdown' };
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = resolve(directory, '.' + decodeURIComponent(url.pathname).replace(/\/$/, '/index.html'));
      if (!path.startsWith(directory + sep)) { response.writeHead(403).end(); return; }
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) await rm(directory, { recursive:true, force:true });
});
test.beforeEach(async () => {
  site = 'calculator-' + crypto.randomUUID();
  await cp(join(directory, 'dist'), join(directory, site), { recursive:true });
});
async function ready(page) {
  await page.goto(`${origin}/${site}/`);
  await expect(page.locator('#offline-status')).toContainText('Offline copy ready', { timeout:30000 });
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'calculator');
}

test('production calculator, all workspace routes, data and notebook work offline at a repository path', async ({ page, context }, testInfo) => {
  await ready(page);
  await page.locator('[data-select="SlowerIsHarder"]').check();
  const stats = await page.locator('#stats').innerText();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#stats')).toHaveText(stats, { useInnerText:true });
  await expect(page.locator('[data-select="SlowerIsHarder"]')).toBeChecked();
  await expect(page.locator('#offline-status')).toContainText('You are offline');
  for (const workspace of ['planner', 'compare', 'reference', 'calculator']) {
    await page.goto(`${origin}/${site}/?workspace=${workspace}`);
    await expect(page.locator('body')).toHaveAttribute('data-workspace', workspace);
  }
  expect(await page.evaluate(async () => (await fetch('./docs/mechanics-notebook.md')).text())).toContain('no in-game observations');
  for (const path of ['LICENSE', 'DISTRIBUTION.md', 'data/ARTIFACT-NOTICES.md', 'third-party/Rogue-Lab-MIT-NOTICE.txt', 'third-party/BTD6-API-Explorer-LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'changelog.html', 'docs/tower-stats.md', 'docs/powers.md', 'docs/ability-cooldowns.md', 'docs/ability-durations.md']) {
    const response = await page.evaluate(async path => {
      const response = await fetch(`./${path}`);
      return { status: response.status, text: await response.text() };
    }, path);
    expect(response.status).toBe(200);
    expect(response.text).toBe(await readFile(join(directory, 'dist', path), 'utf8'));
  }
  await page.goto(`${origin}/${site}/?workspace=reference`);
  await expect(page.getByRole('link', { name: 'Download matching source' })).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('source-desktop.png')});
  await page.setViewportSize({ width:390, height:844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('source-phone.png')});
  await page.setViewportSize({ width:1440, height:900 });
  const archive = await page.evaluate(async path => {
    const response = await fetch(`./${path}`);
    return { status: response.status, bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
  }, sourceArchive);
  expect(archive.status).toBe(200);
  expect(Buffer.from(archive.bytes)).toEqual(await readFile(join(directory, 'dist', sourceArchive)));
  const saved = await page.evaluate(() => localStorage.getItem('rogue-lab-v1'));
  await page.goto(`${origin}/${site}/index.html?workspace=compare&tool=target-matrix#build=${encodeURIComponent(saved)}`);
  await expect(page.locator('#matrix-values')).toBeVisible();
  await expect(page.locator('#stats')).toHaveText(stats, { useInnerText:true });
  await page.locator('#offline-status').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('offline-desktop.png')});
  await page.setViewportSize({ width:390, height:844 });
  await page.locator('#offline-status').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('offline-phone.png')});

  await page.locator('.site-footer').getByRole('link', { name:'User guide', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Using Rogue Lab', exact:true })).toBeVisible();
  await page.getByRole('link', { name:'calculation scope', exact:true }).click();
  await expect(page.locator('h1')).toBeVisible();
  await page.getByRole('link', { name:'User guide', exact:true }).click();
  await page.getByRole('navigation', { name:'On this page' }).getByRole('link', { name:'Offline use and updates', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Offline use and updates', exact:true })).toBeInViewport();
  await page.reload();
  await expect(page.getByRole('heading', { name:'Offline use and updates', exact:true })).toBeInViewport();
  await page.setViewportSize({ width:1440, height:900 });
  await page.goto(`${origin}/${site}/docs/user-guide.html`);
  await page.screenshot({path:testInfo.outputPath('guide-desktop.png')});
  await page.setViewportSize({ width:390, height:844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('guide-phone.png')});

});

test('code/data update waits without changing a running plan; closing every tab activates it', async ({ page, context }) => {
  await ready(page);
  await page.locator('[data-workspace="planner"]').click();
  await page.locator('#plan-tower').selectOption('Ninja Monkey');
  const stats = await page.locator('#stats').innerText();
  const file = join(directory, site, 'index.html');
  const original=await readFile(file,'utf8');
  const updated=original.replace(/<html\b/,'<html data-test-release="updated"');
  expect(updated).not.toBe(original);
  await writeFile(file,updated);
  await buildOfflineWorker(join(directory, site));
  const nextWorkerPromise = context.waitForEvent('serviceworker');
  await page.locator('#offline-check').click();
  const nextWorker = await nextWorkerPromise;
  await expect(page.locator('#offline-status')).toContainText('Update ready', {timeout:30000});
  await expect(page.locator('#plan-tower')).toHaveValue('Ninja Monkey');
  await expect(page.locator('#stats')).toHaveText(stats, { useInnerText:true });
  await expect(page.locator('html')).not.toHaveAttribute('data-test-release','updated');
  const other = await context.newPage();
  await other.goto(`${origin}/${site}/?workspace=reference`);
  await page.close();
  await expect(other.locator('#offline-status')).toContainText('Update ready');
  await expect(other.locator('html')).not.toHaveAttribute('data-test-release','updated');
  await other.close();
  await expect.poll(() => nextWorker.evaluate(() => self.registration.waiting === null && self.registration.active?.state === 'activated')).toBe(true);
  const reopened = await context.newPage();
  await reopened.goto(`${origin}/${site}/`);
  // If activation is completing, the new navigation waits for the ready worker.
  await expect(reopened.locator('html')).toHaveAttribute('data-test-release','updated');
  await expect(reopened.locator('#offline-status')).toContainText('Offline copy ready');
  expect(await reopened.evaluate(scope => caches.keys().then(names => names.filter(name => name.startsWith(`rogue-lab:${scope}:`)).length), `${origin}/${site}/`)).toBe(1);
});

test('incomplete release fails integrity checks and keeps the prior offline code/data', async ({ page, context }) => {
  await ready(page);
  const app = join(directory, site, 'src/app.js');
  await writeFile(app, (await readFile(app, 'utf8')) + '\n// new release\n');
  await buildOfflineWorker(join(directory, site));
  // Simulate a deployment whose assets do not match its advertised release.
  await writeFile(app, '// incomplete deployment');
  await page.locator('#offline-check').click();
  await expect(page.locator('#offline-status')).toContainText('The update check failed', {timeout:30000});
  const stats = await page.locator('#stats').innerText();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#stats')).toHaveText(stats, { useInnerText:true });
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'calculator');
});

test('worker caches are isolated between calculators on the same origin', async ({ page, context }) => {
  await ready(page);
  const secondSite = 'second-' + crypto.randomUUID();
  await cp(join(directory, 'dist'), join(directory, secondSite), {recursive:true});
  const other = await context.newPage();
  await other.goto(`${origin}/${secondSite}/`);
  await expect(other.locator('#offline-status')).toContainText('Offline copy ready');
  const cachesBefore = await page.evaluate(() => caches.keys());
  expect(cachesBefore.some(name => name.includes(`/${site}/`))).toBeTruthy();
  expect(cachesBefore.some(name => name.includes(`/${secondSite}/`))).toBeTruthy();
  await context.setOffline(true);
  await page.reload(); await other.reload();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'calculator');
  await expect(other.locator('body')).toHaveAttribute('data-workspace', 'calculator');
});
