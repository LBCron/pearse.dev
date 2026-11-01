// A granted client case study that is titled by its own domain must link to that site (#107).
// The set is chosen by rule (client, permission granted, domain-shaped title), not by slug, so
// the next domain-titled client is covered automatically and wetlabs.app (category `mts`) is not.
// Offline: reads source frontmatter and dist/ only. Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projects } from './lib/projects.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const domainTitled = projects().filter(
  (p) => p.category === 'client' && p.clientPermission === 'granted' && DOMAIN.test(p.title),
);

test('the filter picks exactly the domain-titled granted client case studies', () => {
  const slugs = domainTitled.map((p) => p.slug).sort();
  console.log(`domain-titled granted client case studies: ${slugs.join(', ')}`);
  assert.ok(slugs.length > 0);
  assert.ok(slugs.includes('m-buildz'), 'm-buildz');
  assert.ok(slugs.includes('pauldarcy-ie'), 'pauldarcy-ie');
  assert.ok(!slugs.includes('east-coast-blinds'), 'east-coast-blinds is not domain-titled');
  assert.ok(!slugs.includes('wetlabs-app'), 'wetlabs-app is category mts');
  assert.ok(!slugs.includes('dublin-plein-air'), 'dublin-plein-air is not domain-titled');
});

for (const p of domainTitled) {
  test(`${p.slug}: live is an https URL on its title's host`, () => {
    assert.ok(p.live, `${p.slug}: live is set`);
    const url = new URL(p.live);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname.replace(/^www\./, ''), p.title);
  });

  test(`${p.slug}: the built page renders the Live link`, () => {
    const html = readFileSync(`dist/work/${p.slug}/index.html`, 'utf8');
    assert.match(html, new RegExp(`<a[^>]*href="${escapeRe(p.live)}"[^>]*>Live</a>`));
  });
}
