import { readFile } from 'node:fs/promises';

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const slug = text => text.toLowerCase().replace(/[`*]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

// Render the documentation's small Markdown vocabulary without accepting raw
// HTML. Tokenize inline content before escaping, including link destinations.
function inline(text) {
  const tokens = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let html = '', start = 0;
  for (const match of text.matchAll(tokens)) {
    html += escape(text.slice(start, match.index));
    if (match[1] !== undefined) html += `<code>${escape(match[1])}</code>`;
    else if (match[2] !== undefined) {
      const href = match[3];
      // Only HTTP(S), fragments and ordinary relative document paths are links.
      const safe = /^https?:\/\//i.test(href) || (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('//') && !/[\\\u0000-\u0020]/.test(href));
      const destination = href.replace(/^([a-z\d-]+)\.md(?=#|$)/i, '$1.html');
      html += safe ? `<a href="${escape(destination)}">${inline(match[2])}</a>` : escape(match[2]);
    } else html += `<strong>${escape(match[4])}</strong>`;
    start = match.index + match[0].length;
  }
  return html + escape(text.slice(start));
}

export function renderDocument(markdown) {
  const lines = markdown.split('\n'), blocks = [], headings = [], ids = new Map();
  const cells = line => line.trim().replace(/^\||\|$/g, '').split(/\|(?=(?:[^`]*`[^`]*`)*[^`]*$)/).map(cell => cell.trim());
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++; blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      const base = slug(heading[2]), count = ids.get(base) ?? 0; ids.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      blocks.push(`<h${heading[1].length} id="${id}">${inline(heading[2])}</h${heading[1].length}>`);
      if (heading[1].length === 2) headings.push({ id, text: heading[2] });
      i++; continue;
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const header = cells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(`<div class="guide-table" tabindex="0" role="region" aria-label="${escape(header.join(', '))}"><table><thead><tr>${header.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^(?:- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line), tag = ordered ? 'ol' : 'ul', items = [];
      const pattern = ordered ? /^\d+\. (.*)$/ : /^- (.*)$/;
      while (i < lines.length && pattern.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(pattern, '$1'))}</li>`);
      blocks.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6} |```|\||- |\d+\. )/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  const contents = headings.length ? `<nav class="guide-contents" aria-label="On this page"><h2>On this page</h2><ul>${headings.map(h => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ul></nav>` : '';
  // Keep the title/intro ahead of navigation, so the page has context first.
  const firstSection = blocks.findIndex(block => block.startsWith('<h2'));
  blocks.splice(firstSection < 0 ? blocks.length : firstSection, 0, contents);
  return blocks.join('\n');
}

export async function documentPage(name) {
  if (!/^[a-z\d-]+$/.test(name)) throw new Error('Invalid document name');
  const markdown = await readFile(`docs/${name}.md`, 'utf8');
  const title = name === 'user-guide' ? 'User guide' : markdown.match(/^# (.+)$/m)?.[1] ?? name;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} — Rogue Lab</title><link rel="icon" href="../favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../src/style.css"></head>
<body><main class="release-notes user-guide"><a class="release-back" href="../">← Rogue Lab</a>${name === 'user-guide' ? '' : '<a class="release-back guide-home" href="./user-guide.html">User guide</a>'}${renderDocument(markdown)}<a class="release-back" href="../">← Rogue Lab</a></main></body></html>\n`;
}
