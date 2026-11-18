import { readFile } from 'node:fs/promises';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function versionedIndex(html) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  return html.replaceAll('__APP_VERSION__', escape(version));
}

// The changelog deliberately uses only headings, paragraphs and bullet lists.
// Escape all content so release notes never introduce executable markup.
export async function changelogPage() {
  const markdown = await readFile('CHANGELOG.md', 'utf8');
  let list = false;
  const blocks = [];
  for (const line of markdown.split('\n')) {
    if (list && !line.startsWith('- ')) { blocks.push('</ul>'); list = false; }
    if (!line.trim()) continue;
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) blocks.push(`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`);
    else if (line.startsWith('- ')) {
      if (!list) { blocks.push('<ul>'); list = true; }
      blocks.push(`<li>${escape(line.slice(2))}</li>`);
    } else blocks.push(`<p>${escape(line)}</p>`);
  }
  if (list) blocks.push('</ul>');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Changelog — Rogue Lab</title><link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./src/style.css"></head>
<body><main class="release-notes"><a class="release-back" href="./">← Rogue Lab</a>${blocks.join('\n')}</main></body></html>\n`;
}
