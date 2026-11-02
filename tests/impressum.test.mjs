// The fail-closed Impressum route (#155). `legalState()` is covered with placeholder fixtures in
// every run. The dist checks branch on the `LEGAL` block in src/lib/site.ts, read under type
// stripping: the shipped (unset) branch checks that nothing is built, linked or listed. The
// complete branch runs only when a block is set locally, for the manual check in the issue; CI
// runs only the unset branch, because the committed config ships `LEGAL` unset. An incomplete
// block never reaches these tests: the build fails first. Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL, SITE } from '../src/lib/site.ts';
import { legalError, legalState } from '../src/lib/legal.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const read = (f) => readFileSync(f, 'utf8');
const FOOTER_PAGES = ['dist/index.html', 'dist/cv/index.html', 'dist/now/index.html'];
const PAGE = 'dist/impressum/index.html';
const footer = (html) => {
  const start = html.indexOf('<footer');
  assert.notEqual(start, -1, 'footer present');
  return html.slice(start, html.indexOf('</footer>', start));
};

// Obvious placeholders only: no real name, address or registration detail belongs in a fixture.
const COMPLETE = {
  heading: 'Example heading',
  name: 'Example Person',
  address: ['c/o Example 1', '0000 Example'],
  sections: [{ heading: 'Example section', body: 'Example paragraph.\n\nSecond example paragraph.' }],
  details: [{ label: 'Example label', value: 'Example value' }],
};
const REQUIRED = ['heading', 'name', 'address', 'sections'];

test('legalState: no block is unset', () => {
  assert.deepEqual(legalState(undefined), { state: 'unset' });
  assert.deepEqual(legalState(null), { state: 'unset' });
});

test('legalState: the placeholder block is complete, with or without details', () => {
  assert.deepEqual(legalState(COMPLETE), { state: 'complete' });
  const { details: _details, ...noDetails } = COMPLETE;
  assert.deepEqual(legalState(noDetails), { state: 'complete' });
  assert.deepEqual(legalState({ ...COMPLETE, details: [] }), { state: 'complete' });
});

test('legalState: removing or blanking each required field gives incomplete and names it', () => {
  for (const field of REQUIRED) {
    const removed = { ...COMPLETE };
    delete removed[field];
    const blanks = field === 'heading' || field === 'name' ? ['', '   '] : [[], '', undefined];
    for (const block of [removed, ...blanks.map((v) => ({ ...COMPLETE, [field]: v }))]) {
      const s = legalState(block);
      assert.equal(s.state, 'incomplete', `${field}: ${JSON.stringify(block[field])}`);
      assert.deepEqual(s.missing, [field], `${field}: ${JSON.stringify(block[field])}`);
    }
  }
});

test('legalState: empty address and empty sections arrays are incomplete', () => {
  assert.deepEqual(legalState({ ...COMPLETE, address: [] }), { state: 'incomplete', missing: ['address'] });
  assert.deepEqual(legalState({ ...COMPLETE, sections: [] }), { state: 'incomplete', missing: ['sections'] });
});

test('legalState: blank lines inside the arrays are named by path', () => {
  assert.deepEqual(legalState({ ...COMPLETE, address: ['c/o Example 1', ' '] }), {
    state: 'incomplete',
    missing: ['address[1]'],
  });
  assert.deepEqual(legalState({ ...COMPLETE, sections: [{ heading: 'Example section', body: '' }, {}] }), {
    state: 'incomplete',
    missing: ['sections[0].body', 'sections[1].heading', 'sections[1].body'],
  });
  assert.deepEqual(legalState({ ...COMPLETE, details: [{ label: 'Example label' }] }), {
    state: 'incomplete',
    missing: ['details[0].value'],
  });
});

test('legalState: every missing field is reported at once', () => {
  assert.deepEqual(legalState({}), { state: 'incomplete', missing: REQUIRED });
});

test('legalError names the fields and echoes no values', () => {
  const err = legalError(['address', 'sections[0].body']);
  assert.match(err.message, /address/);
  assert.match(err.message, /sections\[0\]\.body/);
  assert.doesNotMatch(err.message, /Example/);
});

const state = legalState(LEGAL).state;

test('the committed config is never incomplete (the build would have failed)', () => {
  assert.notEqual(state, 'incomplete');
});

if (state === 'unset') {
  test('unset: no /impressum/ page, footer link or sitemap entry', () => {
    assert.equal(existsSync(PAGE), false, `${PAGE} must not be built`);
    for (const f of FOOTER_PAGES) assert.equal(footer(read(f)).includes('/impressum/'), false, `${f}: footer link`);
    assert.equal(read('dist/sitemap-0.xml').includes('impressum'), false, 'sitemap entry');
  });
}

if (state === 'complete') {
  test('complete: the page is built, noindex, mails SITE.email and renders the block', () => {
    assert.ok(existsSync(PAGE), `${PAGE} built`);
    const html = read(PAGE);
    assert.ok(html.includes('<meta name="robots" content="noindex">'), 'noindex meta');
    assert.ok(html.includes(`href="mailto:${SITE.email}"`), 'mailto SITE.email');
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one h1');
  });

  test('complete: absent from the sitemap', () => {
    assert.equal(read('dist/sitemap-0.xml').includes('impressum'), false);
  });

  test('complete: the footer links it on the key pages', () => {
    for (const f of FOOTER_PAGES) assert.ok(footer(read(f)).includes('href="/impressum/"'), `${f}: footer link`);
  });
}
