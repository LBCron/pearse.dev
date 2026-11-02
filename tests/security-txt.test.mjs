// Issue #140: /.well-known/security.txt (RFC 9116). The dist half reads dist/ (npm test's pretest
// builds it); the date rules are pure functions of an explicit "now", so fixed dates cover them.
// A past Expires fails the check job and so halts the daily deploy (ADR 0003): renew in time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/lib/site.ts';
import { checkExpires, parseFields } from './lib/security-txt.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PATH = '/.well-known/security.txt';
const file = `${ROOT}dist${PATH}`;
const NOW = new Date('2026-11-02T00:00:00Z');
const at = (days) => new Date(NOW.getTime() + days * 86400000).toISOString().replace('.000Z', 'Z');

test('dist has /.well-known/security.txt', () => {
  assert.ok(existsSync(file), 'dist/.well-known/security.txt');
});

test('contacts: the site email from config, and the repo advisory form', () => {
  const f = parseFields(readFileSync(file, 'utf8'));
  assert.ok(f.Contact.includes(`mailto:${SITE.email}`), 'Contact: mailto:<SITE.email>');
  assert.ok(f.Contact.includes(`${SITE.repo}/security/advisories/new`), 'advisory Contact');
  assert.equal(f.Contact.length, 2);
});

test('canonical is the site origin plus the path; policy points at the repo security policy', () => {
  const f = parseFields(readFileSync(file, 'utf8'));
  assert.deepEqual(f.Canonical, [`${SITE.url}${PATH}`]);
  assert.deepEqual(f.Policy, [`${SITE.repo}/security/policy`]);
  assert.deepEqual(f['Preferred-Languages'], ['en']);
});

test('Expires on the real file parses, is not past and is at most 366 days out', () => {
  const f = parseFields(readFileSync(file, 'utf8'));
  assert.equal(f.Expires.length, 1, 'one Expires field');
  const { errors, warnings } = checkExpires(f.Expires[0], new Date());
  for (const w of warnings) console.log(`::warning::${w}`);
  assert.deepEqual(errors, []);
});

test('checkExpires: a past date fails', () => {
  const { errors } = checkExpires(at(-1), NOW);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /in the past/);
});

test('checkExpires: fewer than 60 days left warns and does not fail', () => {
  for (const days of [0, 1, 59]) {
    const { errors, warnings } = checkExpires(at(days), NOW);
    assert.deepEqual(errors, [], `${days} days`);
    assert.equal(warnings.length, 1, `${days} days`);
  }
});

test('checkExpires: 60 to 366 days out is clean', () => {
  for (const days of [60, 200, 330, 366]) {
    assert.deepEqual(checkExpires(at(days), NOW), { errors: [], warnings: [], daysLeft: days }, `${days} days`);
  }
});

test('checkExpires: more than 366 days out fails', () => {
  const { errors } = checkExpires(at(367), NOW);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /more than 366 days/);
});

test('checkExpires: a value that is not an ISO 8601 date-time fails', () => {
  for (const bad of [undefined, '', 'soon', '2027-10-01', '2027-13-45T00:00:00Z']) {
    assert.equal(checkExpires(bad, NOW).errors.length, 1, String(bad));
  }
});

test('parseFields: collects repeated fields in order and skips comments', () => {
  assert.deepEqual(parseFields('# c\nContact: a\n\nContact: b:c\nExpires: x\n'), { Contact: ['a', 'b:c'], Expires: ['x'] });
});
