// The social `short` cap is one rule in all three places the copy lives (ADR 0002): case
// studies, standalone social posts and articles. Reads the schema source and the post files,
// so it needs no build. The build itself rejects a longer `short` (the posts schema).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const config = readFileSync(`${ROOT}/src/content.config.ts`, 'utf8');

test('every schema that has a social `short` caps it at 300', () => {
  const shorts = [...config.matchAll(/\bshort:\s*(z\.string\(\)[^,\n]*)/g)].map((m) => m[1]);
  assert.equal(shorts.length, 3, 'case studies, articles and standalone social posts each declare `short`');
  for (const s of shorts) assert.equal(s, 'z.string().max(300)');
});

test('every article `short` fits the cap', () => {
  const dir = `${ROOT}/src/content/posts`;
  for (const f of readdirSync(dir).filter((f) => /\.mdx?$/.test(f))) {
    const short = parse(readFileSync(`${dir}/${f}`, 'utf8').split(/^---$/m)[1])?.social?.short;
    assert.ok(typeof short === 'string' && short.length <= 300, `${f}: social.short is ${short?.length} chars`);
  }
});
