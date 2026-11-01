import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = resolve('scripts/gate.mjs');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist', 'index.html'), '<p>hello PlantedSecret123 world</p>');
  return dir;
}

function run(dir, patterns) {
  const env = { ...process.env, GITHUB_ACTIONS: '' };
  delete env.CONFIDENTIAL_PATTERNS;
  if (patterns !== undefined) env.CONFIDENTIAL_PATTERNS = patterns;
  return spawnSync(process.execPath, [gate], { cwd: dir, env, encoding: 'utf8' });
}

test('hit fails, names the file and pattern index, not the text', () => {
  const dir = fixture();
  try {
    const r = run(dir, '# comment\n\nplantedsecret123\n');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /dist[\\/]index\.html: pattern #1/);
    assert.doesNotMatch(r.stdout.toLowerCase(), /plantedsecret123/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no patterns passes with a warning', () => {
  const dir = fixture();
  try {
    const r = run(dir, '');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /NO PATTERNS CONFIGURED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-matching pattern passes', () => {
  const dir = fixture();
  try {
    const r = run(dir, 'nothingmatchesthis');
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /pattern #/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing dist fails with a clear message', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    const r = run(dir, 'anything');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /dist\/ not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scans files with unusual or no extension, skips binaries', () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, 'dist', '_redirects'), '/old /plantedredirect9 301');
    writeFileSync(join(dir, 'dist', 'a.ics'), 'SUMMARY:plantedcal8');
    writeFileSync(join(dir, 'dist', 'b.png'), 'plantedpng7');
    writeFileSync(join(dir, 'dist', 'blob'), Buffer.from('plantedblob6\0\0'));
    for (const [pat, file] of [['plantedredirect9', '_redirects'], ['plantedcal8', 'a.ics']]) {
      const r = run(dir, pat);
      assert.equal(r.status, 1);
      assert.match(r.stdout, new RegExp(file.replace('.', '\\.')));
    }
    assert.equal(run(dir, 'plantedpng7').status, 0);
    assert.equal(run(dir, 'plantedblob6').status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('anchored patterns match mid-file lines', () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, 'dist', 'x.txt'), 'first\nplantedline5\nlast');
    assert.equal(run(dir, '^plantedline5$').status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A minimal, uncompressed one-page PDF built by hand: `lines` of Helvetica text (each on its
 * own line), an optional Info /Title and an optional /URI link annotation. Planted strings only.
 */
function pdf({ lines = [], title, uri } = {}) {
  const esc = (s) => s.replace(/[\\()]/g, '\\$&');
  const content = `BT /F1 12 Tf 14 TL 72 720 Td ${lines.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R${uri ? ' /Annots [6 0 R]' : ''} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  if (uri) objs.push(`<< /Type /Annot /Subtype /Link /Rect [72 600 300 620] /Border [0 0 0] /A << /S /URI /URI (${esc(uri)}) >> >>`);
  const info = title ? objs.push(`<< /Title (${esc(title)}) >>`) : 0;
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** A tree whose dist/ holds a clean page and one PDF. */
function pdfFixture(name, bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist', 'index.html'), '<p>clean</p>');
  writeFileSync(join(dir, 'dist', `${name}.pdf`), bytes);
  return dir;
}

const PDF_HITS = [
  ['text', 'a', { lines: ['before PlantedSecret123 after'] }, 'plantedsecret123'],
  ['a phrase split across two lines', 'b', { lines: ['intro PlantedFirst', 'PlantedSecond outro'] }, 'plantedfirst plantedsecond'],
  ['Info /Title only', 'c', { lines: ['clean text'], title: 'PlantedTitle456' }, 'plantedtitle456'],
  ['a /URI link annotation only', 'd', { lines: ['clean text'], uri: 'https://plantedlink789.example/x' }, 'plantedlink789'],
];

for (const [what, name, spec, pattern] of PDF_HITS) {
  test(`PDF: a planted string in ${what} fails, names the file, not the text`, () => {
    const dir = pdfFixture(name, pdf(spec));
    try {
      const r = run(dir, pattern);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, new RegExp(`dist[\\\\/]${name}\\.pdf: pattern #1`));
      for (const word of pattern.split(' ')) assert.doesNotMatch((r.stdout + r.stderr).toLowerCase(), new RegExp(word));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('PDF: an unparseable .pdf fails closed as an unreadable PDF', () => {
  const dir = pdfFixture('e', Buffer.from('%PDF-1.4\nnot really a pdf\n'));
  try {
    const r = run(dir, 'nothingmatchesthis');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /dist[\\/]e\.pdf: unreadable PDF/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PDF: a clean PDF passes, and its text really is read', () => {
  const dir = pdfFixture('clean', pdf({ lines: ['nothing to see', 'here either'], title: 'Clean title', uri: 'https://example.com/' }));
  try {
    const r = run(dir, 'plantedsecret123');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /pattern #|unreadable/);
    // The same file does hit on its own words, so passing means clean, not unread.
    assert.equal(run(dir, 'nothing to see').status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
