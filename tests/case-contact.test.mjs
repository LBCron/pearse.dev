// Asserts every visible case study closes with one contact block (#103): a labelled
// <section data-case-contact="private|repo|public"> between the optional "Writing about
// this project" section and the Previous/Next nav, with a mailto link and, for public code,
// the repo link. Assertions on links run on the sliced block only: the layout and footer
// carry their own github.com and mailto links. Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projects } from './lib/projects.mjs';
import { contactHref, contactVariant } from '../src/lib/contact.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const EMAIL = 'pearse@pearse.dev';
const visible = projects().filter((p) => p.visible);
const page = (slug) => readFileSync(`dist/work/${slug}/index.html`, 'utf8');
const expected = (p) => (p.visibility === 'private' ? 'private' : p.repo ? 'repo' : 'public');
const hrefs = (html) => [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1].replaceAll('&#38;', '&').replaceAll('&amp;', '&'));
const sectionTags = (html) => [...html.matchAll(/<section\b[^>]*\bdata-case-contact="[^"]*"[^>]*>/g)];

test('there are visible case studies to check, public and private', () => {
  assert.ok(visible.length >= 8);
  assert.ok(visible.some((p) => expected(p) === 'private'));
  assert.ok(visible.some((p) => expected(p) === 'repo'));
});

test('every case study has exactly one labelled contact section of the expected variant', () => {
  for (const p of visible) {
    const html = page(p.slug);
    const tags = sectionTags(html);
    assert.equal(tags.length, 1, `${p.slug}: one <section data-case-contact>`);
    assert.match(tags[0][0], new RegExp(`data-case-contact="${expected(p)}"`), `${p.slug}: variant`);
    assert.match(tags[0][0], /\baria-labelledby="contact-title"/, `${p.slug}: labelled by contact-title`);
    assert.doesNotMatch(tags[0][0], /\baria-label=/, `${p.slug}: no aria-label`);
    assert.equal(html.match(/\bid="contact-title"/g)?.length, 1, `${p.slug}: one contact-title`);
    assert.ok(!/<nav\b[^>]*data-case-contact/.test(html), `${p.slug}: not a <nav>`);
  }
});

test('the block has a mailto about the project, and the right code link', () => {
  for (const p of visible) {
    const html = page(p.slug);
    const start = html.search(/<section\b[^>]*data-case-contact=/);
    const end = html.indexOf('<nav class="case-nav');
    assert.ok(start > 0 && end > start, `${p.slug}: block before the nav`);
    const block = html.slice(start, end);
    const links = hrefs(block);

    const mails = links.filter((h) => h.startsWith('mailto:'));
    assert.equal(mails.length, 1, `${p.slug}: one mailto`);
    assert.ok(mails[0].startsWith(`mailto:${EMAIL}?subject=About%20`), `${p.slug}: mailto form`);
    assert.equal(decodeURIComponent(mails[0].split('subject=')[1]), `About ${p.title}`, `${p.slug}: subject`);

    const github = links.filter((h) => h.includes('github.com'));
    if (expected(p) === 'private') {
      assert.equal(github.length, 0, `${p.slug}: no github.com link`);
      assert.ok(
        block.includes('The code is private. Happy to walk you through how it was built on a call.'),
        `${p.slug}: private sentence`,
      );
    } else if (expected(p) === 'repo') {
      assert.deepEqual(github, [p.repo], `${p.slug}: the repo link, once`);
    } else {
      assert.equal(github.length, 0, `${p.slug}: no repo to link`);
    }
  }
});

test('the block sits before the Previous/Next nav, and after "Writing about this project" when present', () => {
  for (const p of visible) {
    const html = page(p.slug);
    const at = html.search(/<section\b[^>]*data-case-contact=/);
    assert.ok(at > 0 && at < html.indexOf('<nav class="case-nav'), `${p.slug}: before the nav`);
    const related = html.indexOf('id="related-title"');
    if (related !== -1) assert.ok(related < at, `${p.slug}: after the related writing`);
  }
});

test('contactHref builds an encoded mailto from the title and address it is given', () => {
  assert.equal(contactHref('MTS Hub', 'a@b.c'), 'mailto:a@b.c?subject=About%20MTS%20Hub');
  const odd = contactHref('Q&A? Time', 'a@b.c');
  assert.ok(odd.includes('Q%26A%3F%20Time'), odd);
  assert.ok(!odd.slice(odd.indexOf('subject=')).match(/[&?]/), 'no raw & or ? in the subject');
});

test('contactVariant is a pure function of visibility and repo', () => {
  assert.equal(contactVariant({ visibility: 'private' }), 'private');
  assert.equal(contactVariant({ visibility: 'private', repo: 'https://github.com/x/y' }), 'private');
  assert.equal(contactVariant({ visibility: 'public', repo: 'https://github.com/x/y' }), 'repo');
  assert.equal(contactVariant({ visibility: 'public' }), 'public');
});
