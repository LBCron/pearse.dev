// While docs/verify-answer-sheet.md exists, it must list every [VERIFY marker in src/content,
// one entry per marker, each quoting its source line word for word. Slice B deletes the sheet
// once every marker is resolved; the test then has nothing to check and is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const SHEET = 'docs/verify-answer-sheet.md';
const present = existsSync(SHEET);

/** Every `[VERIFY` in src/content as "file:line", one item per marker. */
function sourceMarkers() {
  const found = [];
  for (const dir of ['posts', 'social']) {
    for (const f of readdirSync(`src/content/${dir}`)) {
      const path = `src/content/${dir}/${f}`;
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const _ of line.matchAll(/\[VERIFY/g)) found.push(`${path}:${i + 1}`);
      });
    }
  }
  return found;
}

function entries() {
  return readFileSync(SHEET, 'utf8').split(/^## /m).slice(1).map((block) => ({
    file: block.match(/^- File: `([^`]+)`/m)?.[1],
    line: Number(block.match(/^- Line: (\d+)/m)?.[1]),
    date: block.match(/^- Date: (\d{4}-\d{2}-\d{2})/m)?.[1],
    marker: block.match(/^- Marker: `(.+)`$/m)?.[1],
    question: block.match(/^- Question: (.+)$/m)?.[1],
  }));
}

test('answer sheet has one entry per marker in src/content', { skip: !present }, () => {
  const list = entries();
  assert.deepEqual(list.map((e) => `${e.file}:${e.line}`).sort(), sourceMarkers().sort());
});

test('answer sheet entries quote their source line, are dated in order and carry a question', { skip: !present }, () => {
  const list = entries();
  for (const e of list) {
    assert.ok(e.file && e.line && e.date && e.marker && e.question, JSON.stringify(e));
    const line = readFileSync(e.file, 'utf8').split('\n')[e.line - 1];
    assert.ok(line.includes(e.marker), `${e.file}:${e.line} does not contain the quoted marker`);
  }
  const dates = list.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
});
