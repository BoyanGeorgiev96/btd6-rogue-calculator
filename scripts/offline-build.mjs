import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { transform } from 'esbuild';

// Generate from the finished output, so code, data and the notebook form one
// release. Request integrity prevents installing a mixed/partial deployment.
export async function buildOfflineWorker(directory) {
  const indexPath = join(directory, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  if (!html.includes('name="rogue-lab-offline"')) {
    await writeFile(indexPath, html.replace('</head>', '  <meta name="rogue-lab-offline" content="enabled">\n</head>'));
  }
  async function inventory(path = '') {
    const entries = await readdir(join(directory, path), { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => {
      const relative = path ? `${path}/${entry.name}` : entry.name;
      return entry.isDirectory() ? inventory(relative) : relative;
    }));
    return nested.flat().filter(path => path !== 'sw.js').sort();
  }
  const files = await Promise.all((await inventory()).map(async url => ({
    url, integrity: 'sha256-' + createHash('sha256').update(await readFile(join(directory, url))).digest('base64')
  })));
  const template = (await transform(await readFile(new URL('./service-worker.js', import.meta.url), 'utf8'), {
    loader: 'js', target: 'es2022', minify: true, legalComments: 'inline'
  })).code;
  const release = createHash('sha256').update(JSON.stringify(files)).update(template).digest('hex').slice(0, 20);
  await writeFile(join(directory, 'sw.js'), `const RELEASE = ${JSON.stringify(release)};\nconst FILES = ${JSON.stringify(files)};\n${template}`);
}
