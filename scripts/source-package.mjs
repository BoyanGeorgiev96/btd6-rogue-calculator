import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Deliberate public-source allowlist: never archive the working directory or Git
// metadata. Editable normalized catalogs are the maintained source of the build.
export const sourceRoots = [
  'src', 'scripts', 'data', 'docs', 'tests', 'e2e', '.github', 'third-party',
  'index.html', 'favicon.svg', 'package.json', 'package-lock.json',
  'playwright.config.js', '.nvmrc', '.gitignore', 'README.md', 'CONTRIBUTING.md',
  'CHANGELOG.md', 'LICENSE', 'DISTRIBUTION.md', 'THIRD_PARTY_NOTICES.md'
];
export const sourceArchive = 'source/rogue-lab-source.tar.gz';
const excluded = path => /(^|\/)(\.DS_Store|[^/]+\.candidate\.json|refresh-report\.md|[^/]+\.tmp)$/.test(path);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildSourcePackage(output, root = '.') {
  const staging = await mkdtemp(join(tmpdir(), 'rogue-source-'));
  const files = [];
  try {
    async function collect(path) {
      if (excluded(path)) return;
      const absolute = join(root, path);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Source package rejects symlink: ${path}`);
      if (stat.isDirectory()) {
        for (const name of (await readdir(absolute)).sort()) await collect(`${path}/${name}`);
      } else if (stat.isFile()) {
        const bytes = await readFile(absolute);
        await mkdir(dirname(join(staging, path)), { recursive: true });
        await writeFile(join(staging, path), bytes);
        files.push({ path, sha256: hash(bytes) });
      } else throw new Error(`Unsupported source entry: ${path}`);
    }
    for (const path of sourceRoots) await collect(path);
    files.sort((a, b) => a.path.localeCompare(b.path));
    const { version } = JSON.parse(await readFile(join(staging, 'package.json'), 'utf8'));
    const manifest = { version, license: 'GPL-3.0-only', files };
    await writeFile(join(staging, 'SOURCE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
    await mkdir(join(output, 'source'), { recursive: true });
    // tar is build tooling only (GNU tar and macOS bsdtar are supported).
    await promisify(execFile)('tar', ['-czf', resolve(output, sourceArchive), '-C', staging, '.']);
    const archiveSha256 = hash(await readFile(join(output, sourceArchive)));
    await writeFile(join(output, 'source/manifest.json'), JSON.stringify({ ...manifest, archive: sourceArchive, archiveSha256 }, null, 2) + '\n');
    await cp(join(staging, 'DISTRIBUTION.md'), join(output, 'DISTRIBUTION.md'));
    await cp(join(staging, 'data/ARTIFACT-NOTICES.md'), join(output, 'data/ARTIFACT-NOTICES.md'));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
