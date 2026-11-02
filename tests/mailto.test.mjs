// Every mailto on the built site goes through src/lib/mailto.ts (#153): the address is
// SITE.email, the query carries only `subject` and/or `body`, and every subject is in the
// closed set (plus "About <title>" on that case study's own page, #103). Also checks the home
// brief form, the copy-email buttons and the /now/ order. Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/lib/site.ts';
import { MAX_BODY, SUBJECTS } from '../src/lib/mailto.ts';
import { find, hasClass, parseHtml, text } from './lib/html.mjs';
import { projects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const read = (f) => readFileSync(f, 'utf8');
const walk = (dir, keep) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, keep) : keep(p) ? [p] : [];
  });

/** Attribute values as a browser reads them: Astro escapes `&` as `&amp;` or `&#38;`. */
const decode = (v) =>
  v
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const PAGES = walk('dist', (p) => p.endsWith('.html'));
const CLOSED = new Set(Object.values(SUBJECTS));
/** dist path of each visible case study -> the one extra subject its page may carry. */
const CASE_SUBJECT = new Map(projects().filter((p) => p.visible).map((p) => [join('dist', 'work', p.slug, 'index.html'), `About ${p.title}`]));

/** Every mailto href, plus every form action that is a mailto, decoded. */
function mailtos(html) {
  const hrefs = [...html.matchAll(/\shref="(mailto:[^"]+)"/g)].map((m) => decode(m[1]));
  const actions = [...html.matchAll(/<form\b[^>]*\saction="(mailto:[^"]*)"/g)].map((m) => decode(m[1]));
  return [...hrefs, ...actions];
}

test('the key pages carry mailto links', () => {
  for (const f of ['dist/index.html', 'dist/cv/index.html', 'dist/now/index.html']) {
    assert.ok(PAGES.includes(f), f);
    assert.ok(mailtos(read(f)).length > 0, `${f}: no mailto`);
  }
});

test('every mailto on every page is SITE.email with only subject/body and a closed-set subject', () => {
  let n = 0;
  for (const f of PAGES) {
    for (const raw of mailtos(read(f))) {
      n++;
      const url = new URL(raw);
      assert.equal(url.pathname, SITE.email, `${f}: ${raw}`);
      for (const key of url.searchParams.keys()) assert.ok(key === 'subject' || key === 'body', `${f}: query key ${key}`);
      assert.ok(url.searchParams.getAll('subject').length <= 1, `${f}: one subject at most`);
      const subject = url.searchParams.get('subject');
      if (subject === null) continue;
      assert.ok(CLOSED.has(subject) || CASE_SUBJECT.get(f) === subject, `${f}: subject "${subject}" not in the closed set`);
    }
  }
  assert.ok(n >= 3);
});

test('the home, /cv/ and /now/ links carry their own subjects', () => {
  const subjects = (f) => mailtos(read(f)).map((h) => new URL(h).searchParams.get('subject'));
  assert.ok(subjects('dist/index.html').includes(SUBJECTS.home));
  assert.ok(subjects('dist/cv/index.html').includes(SUBJECTS.cv));
  assert.ok(subjects('dist/now/index.html').includes(SUBJECTS.now));
});

const home = () => parseHtml(read('dist/index.html'));
const byId = (root, id) => find(root, (e) => e.attrs.id === id)[0];

test('#contact has the native GET brief form to the bare address', () => {
  const contact = byId(home(), 'contact');
  assert.ok(contact, '#contact');
  const forms = find(contact, (e) => e.tag === 'form');
  assert.equal(forms.length, 1, 'one form');
  const form = forms[0];
  assert.equal(form.attrs.method, 'get');
  assert.equal(decode(form.attrs.action), `mailto:${SITE.email}`);
  assert.ok(!('enctype' in form.attrs), 'no enctype');
  assert.ok(!('hidden' in form.attrs), 'never hidden');

  const named = find(form, (e) => 'name' in e.attrs);
  assert.deepEqual(named.map((e) => e.attrs.name).sort(), ['body', 'subject'], 'only subject and body are named');
  const subject = named.find((e) => e.attrs.name === 'subject');
  assert.equal(subject.tag, 'input');
  assert.equal(subject.attrs.type, 'hidden');
  assert.equal(decode(subject.attrs.value), SUBJECTS.brief);

  const body = named.find((e) => e.attrs.name === 'body');
  assert.equal(body.tag, 'textarea');
  const max = Number(body.attrs.maxlength);
  assert.ok(Number.isInteger(max) && max > 0 && max <= MAX_BODY, `maxlength ${body.attrs.maxlength}`);
  assert.ok(body.attrs.id, 'textarea id');
  const labels = find(form, (e) => e.tag === 'label' && e.attrs.for === body.attrs.id);
  assert.equal(labels.length, 1, 'a <label for> matching the textarea');
  assert.equal(text(labels[0]).trim(), 'What do you need?');
});

test('the "what to include" checklist is in the server HTML', () => {
  const list = find(byId(home(), 'contact'), (e) => 'data-brief-include' in e.attrs)[0];
  assert.ok(list, 'checklist');
  const items = find(list, (e) => e.tag === 'li').map((li) => text(li).trim());
  assert.deepEqual(items, ['The problem', 'The current stack', 'The timeline', 'A link, if there is one']);
});

/** The element holding the address link also holds a copy button for that address. */
function assertCopyBeside(container, where) {
  const link = find(container, (e) => e.tag === 'a' && (e.attrs.href ?? '').startsWith('mailto:'))[0];
  assert.ok(link, `${where}: address link`);
  assert.equal(text(link).trim(), SITE.email, `${where}: the address is visible text`);
  const buttons = find(link.parent, (e) => e.tag === 'button' && 'data-copy' in e.attrs);
  assert.equal(buttons.length, 1, `${where}: one copy button beside the address`);
  const btn = buttons[0];
  assert.equal(btn.attrs['data-copy'], SITE.email, where);
  assert.equal(btn.attrs.type, 'button', where);
  assert.ok(hasClass(btn, 'btn'), `${where}: reuses .btn`);
  assert.ok(!('hidden' in btn.attrs), `${where}: space reserved with visibility, not hidden`);
  const status = find(link.parent, (e) => e.attrs['aria-live'] === 'polite');
  assert.equal(status.length, 1, `${where}: a polite status`);
  return btn;
}

test('a copy button sits beside the address on / and on /cv/, hidden in print', () => {
  assertCopyBeside(byId(home(), 'contact'), '/');
  const cv = parseHtml(read('dist/cv/index.html'));
  const list = find(cv, (e) => hasClass(e, 'cv-contact'))[0];
  assert.ok(list, '/cv/ contact list');
  const btn = assertCopyBeside(list, '/cv/');
  let screenOnly = false;
  for (let e = btn.parent; e; e = e.parent) if (hasClass(e, 'cv-screen')) screenOnly = true;
  assert.ok(screenOnly, '/cv/: the copy control is inside .cv-screen, which print hides');
});

test('the copy buttons are revealed with visibility, so no layout shift', () => {
  const css = walk('dist', (p) => p.endsWith('.css'))
    .map(read)
    .join('\n');
  const inline = [...read('dist/index.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const all = `${css}\n${inline}`.replace(/\s+/g, '');
  assert.match(all, /\.copy-email-btn[^{]*\{visibility:hidden\}/);
  assert.match(all, /\.brief-copy[^{]*\{visibility:hidden\}/);
});

test('/now/: the mailto closes "Open to conversations", the last section', () => {
  const html = read('dist/now/index.html');
  const heading = html.search(/<h2\b[^>]*>Open to conversations<\/h2>/);
  assert.ok(heading > 0, 'heading present');
  const first = html.search(/\shref="mailto:/);
  assert.ok(first > heading, 'the first mailto comes after the heading');
  assert.equal(html.slice(heading + 1).search(/<h2\b/), -1, '"Open to conversations" is the last h2');
  assert.equal((html.match(/\shref="mailto:/g) ?? []).length, 1, 'the address is linked once');
  assert.doesNotMatch(read('src/content/now/now.md'), /mailto:|@pearse\.dev/, 'no hand-typed address in now.md');
});

test('no mailto: in src outside the builder, apart from comments', () => {
  const files = walk('src', (p) => /\.(astro|ts|mjs|js|md|mdx)$/.test(p));
  const builder = join('src', 'lib', 'mailto.ts');
  const hits = [];
  for (const f of files) {
    if (f === builder) continue;
    read(f)
      .split('\n')
      .forEach((line, i) => {
        if (!line.includes('mailto:')) return;
        const t = line.trim();
        if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) return;
        hits.push(`${relative(ROOT, join(ROOT, f))}:${i + 1}`);
      });
  }
  assert.deepEqual(hits, []);
});

test('Lighthouse audits /cv/ too and caps cumulative layout shift at 0.02 on every URL', () => {
  const rc = JSON.parse(read('lighthouserc.json'));
  assert.ok(rc.ci.collect.url.includes('http://localhost/cv/'));
  // The key is the bare audit id: lhci splits keys on ":" and ".", so "audits:…" would assert nothing.
  assert.deepEqual(rc.ci.assert.assertions['cumulative-layout-shift'], ['error', { maxNumericValue: 0.02 }]);
});

test('no literal address in src outside src/lib/site.ts', () => {
  const site = join('src', 'lib', 'site.ts');
  const hits = walk('src', (p) => /\.(astro|ts|mjs|js|md|mdx|json)$/.test(p) && p !== site).filter((f) => read(f).includes(SITE.email));
  assert.deepEqual(hits, []);
});
