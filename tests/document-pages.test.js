import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument, documentPage } from '../scripts/document-pages.mjs';

test('documentation renders readable headings, tables, inline formatting and safe code', () => {
  const html = renderDocument('# Guide\n\nIntro **bold** and `code`.\n\n## Saves\n\n| Format | Value |\n| --- | --- |\n| JSON | `a|b` |\n\n```text\n<script>alert(1)</script>\n```\n\nSee [timing](ability-durations.md#review).');
  assert.match(html, /href="#saves"/);
  assert.match(html, /<h2 id="saves">Saves<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<td><code>a\|b<\/code><\/td>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /href="ability-durations.html#review"/);
  assert.doesNotMatch(html, /<script\b/i);
});

test('documentation rejects executable links and raw markup while retaining HTTPS and fragments', () => {
  const html = renderDocument('[bad](javascript:alert) [data](data:text/html,bad) [remote](//evil.test) [good](https://example.com) [section](#saves) <img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /href="(?:javascript:|data:|\/\/)/);
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="#saves"/);
});

test('website guide comes from the maintained Markdown and has working relative assets', async () => {
  const html = await documentPage('user-guide');
  assert.match(html, /<title>User guide — Rogue Lab<\/title>/);
  assert.match(html, /href="\.\.\/src\/style.css"/);
  assert.match(html, /<h1 id="using-rogue-lab">Using Rogue Lab/);
  assert.match(html, /href="calculation-scope.html"/);
  assert.match(html, /aria-label="On this page"/);
  await assert.rejects(documentPage('../private'), /Invalid document name/);
});
