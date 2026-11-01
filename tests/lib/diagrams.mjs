// Diagram and stylesheet helpers shared by the tests that read built pages. Not a test
// file itself: `npm test` only runs tests/**/*.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Hostname-like text: a label plus a public suffix this site's projects use. */
export const HOSTNAME = /\b[a-z0-9-]+\.(?:com|app|net|io|dev|org|eu|ie|local|ts\.net)\b/i;

/** Every outer diagram <svg>…</svg> on the page, nested views included, in page order. */
export function diagramSvgs(html) {
  const out = [];
  const open = /<svg\b[^>]*\brole="img"/g;
  for (let o; (o = open.exec(html)); ) {
    const tag = /<svg\b|<\/svg>/g;
    tag.lastIndex = o.index;
    let depth = 0;
    let end = -1;
    for (let m; (m = tag.exec(html)); ) {
      depth += m[0] === '</svg>' ? -1 : 1;
      if (depth === 0) {
        end = tag.lastIndex;
        break;
      }
    }
    assert.notEqual(end, -1, 'unterminated diagram svg');
    out.push(html.slice(o.index, end));
    open.lastIndex = end;
  }
  return out;
}

export const textOf = (svg) =>
  svg
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Text of every stylesheet the page uses: inline <style> blocks and linked /_astro/*.css files. */
export function pageCss(html) {
  const inline = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) ?? []).join('\n');
  const linked = (html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [])
    .map((tag) => tag.match(/href="\/([^"]+\.css)"/)?.[1])
    .filter(Boolean)
    .map((href) => readFileSync(`dist/${href}`, 'utf8'));
  return [inline, ...linked].join('\n');
}

