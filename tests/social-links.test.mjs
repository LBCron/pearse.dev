// Config-gated rel="me" profile links and the Bluesky atproto-did file (#157). The shipped build
// has Mastodon, Bluesky and the DID unset, so a dist-only test would prove just the empty case:
// the set state is covered by running the pure functions with placeholders. The dist tests read
// `SITE`, so they stay correct once the real values are filled in. Relies on `npm test`'s
// pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/lib/site.ts';
import { atprotoDidBody, profileLinks } from '../src/lib/profile-links.ts';
import { find, parseHtml } from './lib/html.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const MASTODON = 'https://example.social/@placeholder';
const BLUESKY = 'https://bsky.app/profile/example.invalid';
const base = { github: SITE.github, linkedin: SITE.linkedin };

test('profileLinks lists GitHub and LinkedIn, then Mastodon and Bluesky when set', () => {
  const set = profileLinks({ ...base, mastodon: MASTODON, bluesky: BLUESKY });
  assert.deepEqual(
    set.map((l) => l.label),
    ['GitHub', 'LinkedIn', 'Mastodon', 'Bluesky'],
  );
  assert.deepEqual(
    set.map((l) => l.href),
    [SITE.github, SITE.linkedin, MASTODON, BLUESKY],
  );
  const none = profileLinks({ ...base, mastodon: null, bluesky: null });
  assert.deepEqual(
    none.map((l) => l.label),
    ['GitHub', 'LinkedIn'],
  );
  assert.deepEqual(
    profileLinks({ ...base, mastodon: MASTODON, bluesky: null }).map((l) => l.label),
    ['GitHub', 'LinkedIn', 'Mastodon'],
  );
  assert.deepEqual(
    profileLinks({ ...base, mastodon: null, bluesky: BLUESKY }).map((l) => l.label),
    ['GitHub', 'LinkedIn', 'Bluesky'],
  );
});

test('profileLinks throws for a set value that is not an https URL', () => {
  for (const bad of ['http://example.social/@x', '@placeholder@example.social', 'example.social/@x', '', 'https://', 'javascript:alert(1)']) {
    assert.throws(() => profileLinks({ ...base, mastodon: bad, bluesky: null }), /SITE\.mastodon/, `mastodon ${JSON.stringify(bad)}`);
    assert.throws(() => profileLinks({ ...base, mastodon: null, bluesky: bad }), /SITE\.bluesky/, `bluesky ${JSON.stringify(bad)}`);
  }
});

test('atprotoDidBody is null when unset and exactly the DID when valid', () => {
  assert.equal(atprotoDidBody(null), null);
  assert.equal(atprotoDidBody('did:plc:abc123'), 'did:plc:abc123');
  assert.equal(atprotoDidBody('did:web:example.invalid'), 'did:web:example.invalid');
});

test('atprotoDidBody throws for a malformed value, including whitespace and a trailing newline', () => {
  for (const bad of ['plc:abc', 'did:key:abc', 'did:plc:', 'did:plc:abc\n', ' did:plc:abc', 'did:plc:a b', 'did:plc:abc/def', '']) {
    assert.throws(() => atprotoDidBody(bad), /atprotoDid/, JSON.stringify(bad));
  }
});

function postPage() {
  const slug = readdirSync('dist/writing', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()[0];
  assert.ok(slug, 'at least one built /writing/ page');
  return `dist/writing/${slug}/index.html`;
}

for (const file of ['dist/index.html', 'dist/cv/index.html', postPage()]) {
  test(`${file}: footer profile links carry rel="me", the rest do not`, () => {
    const root = parseHtml(readFileSync(file, 'utf8'));
    const [footer] = find(root, (n) => n.tag === 'footer');
    assert.ok(footer, 'footer present');
    const anchors = find(footer, (n) => n.tag === 'a');
    const expected = profileLinks(SITE).map((l) => l.href);
    const profile = anchors.filter((a) => expected.includes(a.attrs.href));
    assert.equal(profile.length, expected.length, 'one footer anchor per profile link');
    assert.deepEqual(
      profile.map((a) => a.attrs.href),
      expected,
      'in order',
    );
    for (const a of profile) assert.ok((a.attrs.rel ?? '').split(/\s+/).includes('me'), `${a.attrs.href} has rel="me"`);
    const source = anchors.filter((a) => a.attrs.href === SITE.repo);
    assert.equal(source.length, 1, 'one Source link');
    assert.ok(!(source[0].attrs.rel ?? '').split(/\s+/).includes('me'), 'Source has no rel="me"');
    for (const a of anchors.filter((x) => !expected.includes(x.attrs.href))) {
      assert.ok(!(a.attrs.rel ?? '').split(/\s+/).includes('me'), `${a.attrs.href} has no rel="me"`);
    }
  });
}

test('dist/.well-known/atproto-did exists only when SITE.atprotoDid is set, with exactly the DID', () => {
  const path = 'dist/.well-known/atproto-did';
  const body = atprotoDidBody(SITE.atprotoDid);
  if (body === null) {
    assert.equal(existsSync(path), false, 'no DID file while unset');
    assert.equal(existsSync('dist/.well-known'), false, 'no .well-known directory while unset');
  } else {
    assert.equal(readFileSync(path, 'utf8'), body);
  }
});
