// GitHub integration (issue #45): the pure shaping of API responses into the view model,
// the repo allowlist and its snapshot filter (issue #109),
// the snapshot fallback of loadGithub with an injected fetch, and the rendered home-page
// section. The dist/ assertions rely on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseHtml, find, srcsetCandidates } from './lib/html.mjs';
import {
  AVATAR_MAX_BYTES,
  DESCRIPTION_FALLBACKS,
  DESCRIPTION_OVERRIDES,
  FEATURED_REPOS,
  GITHUB_LOGIN,
  PROFILE_BIO,
  SHOWN_REPOS,
  curlyApostrophes,
  describeRepo,
  filterSnapshot,
  loadGithub,
  normaliseAvatar,
  profileStats,
  shapeAvatar,
  shapeCalendar,
  shapeGithub,
  shapeRepos,
  skippedRepos,
} from '../src/lib/github.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const repo = (name, pushed, extra = {}) => ({
  name,
  private: false,
  fork: false,
  owner: { login: 'pearsedarcy' },
  description: `${name} desc`,
  language: 'Python',
  stargazers_count: 1,
  pushed_at: `${pushed}T10:00:00Z`,
  ...extra,
});

const USER = {
  login: 'pearsedarcy',
  name: "Pearse D'Arcy",
  bio: ' Engineer. ',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  public_repos: 22,
  followers: 2, // GitHub still sends it; the view model drops it (issue #109)
};

const LISTED = [...FEATURED_REPOS, ...SHOWN_REPOS];

const RAW_CAL = {
  totalContributions: 7,
  weeks: [
    { contributionDays: [{ date: '2026-10-25', contributionCount: 0, contributionLevel: 'NONE' }] },
    {
      contributionDays: [
        { date: '2026-10-26', contributionCount: 3, contributionLevel: 'SECOND_QUARTILE' },
        { date: '2026-10-27', contributionCount: 4, contributionLevel: 'FOURTH_QUARTILE' },
      ],
    },
    { contributionDays: [] },
  ],
};

// ---- shaping ---------------------------------------------------------------

test('shapeRepos keeps only listed, public, self-owned repos, whatever the fork flag (issue #109)', () => {
  const raw = [
    repo('pearse.dev', '2026-01-01', { fork: true }),
    repo('unlisted-fork', '2026-10-05', { fork: true }),
    repo('unlisted', '2026-10-06'),
    repo(GITHUB_LOGIN, '2026-10-07'),
    repo('my-blog', '2026-10-01', { private: true }),
    repo('django-store', '2026-10-03', { owner: { login: 'MTS-Wetlabs' } }),
    repo('chatterbox-1', '2026-09-01'),
    repo('skatehills-flask', '2026-09-05'),
    repo('forum-migration', '2026-08-01'),
    repo('django-blog', '2026-07-01'),
  ];
  const out = shapeRepos(raw);
  assert.deepEqual(
    out.map((r) => r.name),
    ['pearse.dev', 'skatehills-flask', 'chatterbox-1', 'forum-migration', 'django-blog'],
  );
  for (const r of out) assert.equal(r.url, `https://github.com/pearsedarcy/${r.name}`);
  assert.deepEqual(out[1], {
    name: 'skatehills-flask',
    url: 'https://github.com/pearsedarcy/skatehills-flask',
    description: DESCRIPTION_OVERRIDES['skatehills-flask'],
    language: 'Python',
    stars: 1,
    pushed: '2026-09-05',
  });
});

test('shapeRepos puts featured first, then the newest push day, at most six (issue #109)', () => {
  const raw = [
    repo('django-blog', '2026-09-10'),
    repo('my-blog', '2026-03-01'),
    repo('forum-migration', '2026-09-20'),
    repo('pearse.dev', '2025-01-01', { fork: true }),
    repo('django-store', '2026-05-01'),
    repo('chatterbox-1', '2026-02-01'),
    repo('skatehills-flask', '2026-07-01'),
  ];
  assert.deepEqual(
    shapeRepos(raw).map((r) => r.name),
    ['pearse.dev', 'forum-migration', 'django-blog', 'skatehills-flask', 'django-store', 'my-blog'],
  );
});

// Every listed repo pushed the same day, in reverse list order through the day, and
// shuffled: the time of day must not count, only featured then shown-list order.
const SAME_DAY_RAW = [
  repo('chatterbox-1', '', { pushed_at: '2026-08-15T22:45:24Z' }),
  repo('django-blog', '', { pushed_at: '2026-08-15T23:59:00Z' }),
  repo('pearse.dev', '', { fork: true, pushed_at: '2026-08-15T00:01:00Z' }),
  repo('skatehills-flask', '', { pushed_at: '2026-08-15T22:45:13Z' }),
  repo('my-blog', '', { pushed_at: '2026-08-15T01:00:00Z' }),
  repo('forum-migration', '', { pushed_at: '2026-08-15T22:46:01Z' }),
  repo('django-store', '', { pushed_at: '2026-08-15T12:00:00Z' }),
];

test('shapeRepos orders a same-day push by featured, then shown-list order, and cuts django-blog (issue #109)', () => {
  assert.deepEqual(
    shapeRepos(SAME_DAY_RAW).map((r) => r.name),
    ['pearse.dev', 'my-blog', 'django-store', 'chatterbox-1', 'skatehills-flask', 'forum-migration'],
  );
});

test('every featured and shown repo has reviewed site copy; the profile README repo is on neither list', () => {
  for (const n of LISTED) {
    const key = n.toLowerCase();
    assert.ok(DESCRIPTION_OVERRIDES[key] ?? DESCRIPTION_FALLBACKS[key], `${n} needs an override or a fallback`);
  }
  assert.ok(!LISTED.some((n) => n.toLowerCase() === GITHUB_LOGIN), 'profile README repo is not a project');
  assert.equal(new Set(LISTED.map((n) => n.toLowerCase())).size, LISTED.length, 'no name on both lists');
});

test('skippedRepos names the public, self-owned repos that are not listed', () => {
  const raw = [
    repo('my-blog', '2026-01-01'),
    repo('unlisted', '2026-01-01'),
    repo('unlisted-fork', '2026-01-01', { fork: true }),
    repo('private-one', '2026-01-01', { private: true }),
    repo('org-one', '2026-01-01', { owner: { login: 'MTS-Wetlabs' } }),
  ];
  assert.deepEqual(skippedRepos(raw), ['unlisted', 'unlisted-fork']);
});

test('shapeRepos normalises empty description and language to null', () => {
  const [r] = shapeRepos([repo('my-blog', '2026-01-01', { language: null, stargazers_count: undefined })]);
  assert.equal(r.language, null);
  assert.equal(r.stars, 0);
  assert.equal(describeRepo('unlisted', '  '), null);
});

test('shapeAvatar only accepts GitHub avatars and sizes them', () => {
  assert.equal(shapeAvatar('https://avatars.githubusercontent.com/u/1?v=4'), 'https://avatars.githubusercontent.com/u/1?v=4&s=160');
  assert.equal(shapeAvatar('https://evil.example/a.png'), null);
  assert.equal(shapeAvatar('http://avatars.githubusercontent.com/u/1'), null);
  assert.equal(shapeAvatar(null), null);
});

test('shapeCalendar maps levels and drops empty weeks', () => {
  const cal = shapeCalendar(RAW_CAL);
  assert.equal(cal.total, 7);
  assert.equal(cal.weeks.length, 2);
  assert.deepEqual(cal.weeks[1], [
    { date: '2026-10-26', count: 3, level: 2 },
    { date: '2026-10-27', count: 4, level: 4 },
  ]);
});

test('shapeGithub builds the view with a github.com profile URL', () => {
  const v = shapeGithub({ user: USER, repos: [repo('my-blog', '2026-01-01')], calendar: null }, new Date('2026-10-28T12:00:00Z'));
  assert.equal(v.url, 'https://github.com/pearsedarcy');
  assert.equal(v.bio, PROFILE_BIO, 'site wording, not the GitHub bio');
  assert.equal(v.name, 'Pearse D’Arcy');
  assert.equal(v.publicRepos, 22);
  assert.ok(!('followers' in v), 'no followers in the view model');
  assert.equal(v.asOf, '2026-10-28');
  assert.equal(v.repos.length, 1);
});

// ---- snapshot filter (issue #109) -----------------------------------------

const viewOf = (raw) => shapeGithub({ user: USER, repos: raw, calendar: shapeCalendar(RAW_CAL) }, new Date('2026-10-28T12:00:00Z'));
const MIXED_DAYS_RAW = [
  repo('pearse.dev', '2026-10-01', { fork: true }),
  repo('django-blog', '2026-09-10'),
  repo('my-blog', '2026-09-10'),
  repo('chatterbox-1', '2026-02-01'),
  repo('forum-migration', '2026-09-20'),
  repo('skatehills-flask', '2026-01-01'),
  repo('django-store', '2026-05-01'),
];

test('filterSnapshot is idempotent and a no-op on a freshly shaped view', () => {
  for (const [label, raw] of [
    ['same day', SAME_DAY_RAW],
    ['mixed days', MIXED_DAYS_RAW],
  ]) {
    const v = viewOf(raw);
    const once = filterSnapshot(v);
    assert.deepEqual(once, v, `${label}: shaped view passes unchanged`);
    assert.deepEqual(filterSnapshot(once), once, `${label}: idempotent`);
  }
});

test('filterSnapshot drops unlisted and foreign repos, re-orders, caps, and re-checks the avatar of a stale snapshot', () => {
  const fresh = viewOf(MIXED_DAYS_RAW);
  const card = (name, pushed, owner = 'pearsedarcy') => ({
    name,
    url: `https://github.com/${owner}/${name}`,
    description: DESCRIPTION_OVERRIDES[name] ?? DESCRIPTION_FALLBACKS[name],
    language: 'Python',
    stars: 0,
    pushed,
  });
  const stale = {
    ...fresh,
    followers: 2,
    avatarUrl: 'https://evil.example/a.png',
    repos: [
      card('unlisted', '2026-10-30'),
      card('my-blog', '2026-03-01'),
      card('django-store', '2026-10-29', 'someone-else'),
      card('django-blog', '2026-09-10'),
      card('chatterbox-1', '2026-02-01'),
      card('forum-migration', '2026-09-20'),
      card('skatehills-flask', '2026-07-01'),
      card('pearse.dev', '2025-01-01'),
      card('django-store', '2026-05-01'),
    ],
  };
  const out = filterSnapshot(stale);
  assert.deepEqual(
    out.repos.map((r) => r.name),
    ['pearse.dev', 'forum-migration', 'django-blog', 'skatehills-flask', 'django-store', 'my-blog'],
  );
  assert.ok(out.repos.every((r) => r.url === `https://github.com/pearsedarcy/${r.name}`));
  assert.equal(out.avatarUrl, null, 'avatar not on the GitHub avatar host');
  assert.ok(!('followers' in out), 'followers ignored');
  assert.deepEqual(filterSnapshot(out), out, 'idempotent');
});

// ---- profile stats (issue #109) -------------------------------------------

test('profileStats shows contributions only with a calendar, formatted like the heatmap caption', () => {
  const withCal = profileStats({ publicRepos: 22, calendar: { total: 1234, weeks: [] } });
  assert.deepEqual(withCal.stats, [
    { label: 'Public repos', value: '22' },
    { label: 'Contributions (last year)', value: (1234).toLocaleString('en-GB') },
  ]);
  assert.equal(withCal.stats[1].value, '1,234');
  assert.match(withCal.caption, /private repositories/);
  assert.doesNotMatch(withCal.caption, /includ/i, 'never claims the total includes private work');

  const noCal = profileStats({ publicRepos: 22, calendar: null });
  assert.deepEqual(noCal.stats, [{ label: 'Public repos', value: '22' }]);
  assert.equal(noCal.caption, withCal.caption);
});

// ---- fetch and fallback ----------------------------------------------------

function tmpSnapshot(view) {
  const dir = mkdtempSync(join(tmpdir(), 'gh-'));
  const path = join(dir, 'github.json');
  if (view) writeFileSync(path, JSON.stringify(view));
  return { dir, path };
}

const SNAP = shapeGithub(
  { user: USER, repos: [repo('django-blog', '2025-01-01')], calendar: shapeCalendar(RAW_CAL) },
  new Date('2026-01-01T00:00:00Z'),
);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A PNG avatar carrying EXIF and an ICC profile, as GitHub may serve one (issue #115).
async function pngAvatar(color = { r: 200, g: 60, b: 60, alpha: 1 }) {
  return sharp({ create: { width: 300, height: 220, channels: 4, background: color } })
    .withExif({ IFD0: { Copyright: 'Someone Else', Artist: 'Not Pearse' } })
    .withIccProfile('p3')
    .png()
    .toBuffer();
}
const PNG_A = await pngAvatar();
const PNG_B = await pngAvatar({ r: 20, g: 90, b: 200, alpha: 1 });

/**
 * `avatar` shapes the response for the avatar host: bytes (default PNG_A), a { body, type, status }
 * object, or 'throw'. `user` overrides fields of the profile response.
 */
function fakeFetch({ rest = true, graphql = true, extraRepos = [], avatar = PNG_A, user = {} } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, auth: init.headers?.Authorization });
    if (new URL(url).hostname === 'avatars.githubusercontent.com') {
      if (avatar === 'throw') throw new TypeError('avatar fetch failed');
      const a = avatar instanceof Uint8Array ? { body: avatar } : avatar;
      return new Response(a.body, { status: a.status ?? 200, headers: { 'content-type': a.type ?? 'image/png' } });
    }
    if (!rest) throw new TypeError('fetch failed');
    if (url.endsWith('/graphql')) {
      if (!graphql) return json({ message: 'Bad credentials' }, 401);
      return json({ data: { user: { contributionsCollection: { contributionCalendar: { ...RAW_CAL, totalContributions: 99 } } } } });
    }
    if (url.includes('/repos')) {
      return json([repo('my-blog', '2026-10-01'), repo('django-store', '2026-10-02', { private: true }), ...extraRepos]);
    }
    return json({ ...USER, ...user });
  };
  return { f, calls };
}

const quiet = () => {
  const lines = [];
  return { lines, log: (m) => lines.push(`log ${m}`), warn: (m) => lines.push(`warn ${m}`) };
};

test('loadGithub: no network falls back to the snapshot and warns', async () => {
  const { dir, path } = tmpSnapshot(SNAP);
  const q = quiet();
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), token: 't', fetch: fakeFetch({ rest: false }).f, ...q });
    assert.equal(r.source, 'snapshot');
    assert.deepEqual(r.view, SNAP);
    assert.match(q.lines.join('\n'), /^warn using snapshot from 2026-01-01: network: fetch failed$/m);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), SNAP, 'snapshot untouched');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub: offline skips the network entirely', async () => {
  const { dir, path } = tmpSnapshot(SNAP);
  const { f, calls } = fakeFetch();
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), offline: true, fetch: f, ...quiet() });
    assert.equal(r.source, 'snapshot');
    assert.equal(calls.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub: live fetch with a token shapes everything and writes the snapshot', async () => {
  const { dir, path } = tmpSnapshot(SNAP);
  const { f, calls } = fakeFetch();
  const q = quiet();
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), token: 'tok', fetch: f, now: new Date('2026-10-28T00:00:00Z'), ...q });
    assert.equal(r.source, 'live');
    assert.deepEqual(
      r.view.repos.map((x) => x.name),
      ['my-blog'],
    );
    assert.equal(r.view.calendar.total, 99);
    const api = calls.filter((c) => c.url.startsWith('https://api.github.com/'));
    assert.ok(api.length >= 3 && api.every((c) => c.auth === 'Bearer tok'));
    assert.ok(calls.filter((c) => !api.includes(c)).every((c) => c.auth === undefined), 'the token never goes to the avatar host');
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), r.view);
    assert.match(q.lines.join('\n'), /^log live: 1 repos, 99 contributions$/m);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub: without a token the calendar comes from the snapshot', async () => {
  const { dir, path } = tmpSnapshot(SNAP);
  const { f, calls } = fakeFetch();
  const q = quiet();
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), fetch: f, ...q });
    assert.equal(r.source, 'partial');
    assert.equal(r.view.repos[0].name, 'my-blog');
    assert.deepEqual(r.view.calendar, SNAP.calendar);
    assert.ok(!calls.some((c) => c.url.endsWith('/graphql')), 'no GraphQL call without a token');
    assert.ok(calls.every((c) => c.auth === undefined));
    assert.match(q.lines.join('\n'), /^warn contribution calendar from snapshot of 2026-01-01: no GITHUB_TOKEN/m);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub: a failing GraphQL call keeps the snapshot calendar', async () => {
  const { dir, path } = tmpSnapshot(SNAP);
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), token: 'bad', fetch: fakeFetch({ graphql: false }).f, ...quiet() });
    assert.equal(r.source, 'partial');
    assert.match(r.reason, /HTTP 401/);
    assert.deepEqual(r.view.calendar, SNAP.calendar);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub: no network and no snapshot is a hard error', async () => {
  const { dir, path } = tmpSnapshot(null);
  try {
    await assert.rejects(loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), fetch: fakeFetch({ rest: false }).f, ...quiet() }), /no snapshot/);
    assert.equal(existsSync(path), false);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub logs skipped repos by name locally and only the count in CI (issue #109)', async () => {
  const saved = process.env.CI;
  const run = async () => {
    const { dir, path } = tmpSnapshot(SNAP);
    const q = quiet();
    try {
      const f = fakeFetch({ extraRepos: [repo('unlisted-thing', '2026-10-03')] }).f;
      const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), token: 't', fetch: f, ...q });
      assert.deepEqual(
        r.view.repos.map((x) => x.name),
        ['my-blog'],
      );
      return q.lines.join('\n');
    } finally {
      rmSync(dir, { recursive: true });
    }
  };
  try {
    delete process.env.CI;
    const local = await run();
    assert.match(local, /^log skipped 1 repos not on the allowlist: unlisted-thing$/m);

    process.env.CI = 'true';
    const ci = await run();
    assert.match(ci, /^log skipped 1 repos not on the allowlist$/m);
    assert.doesNotMatch(ci, /unlisted-thing/);
  } finally {
    if (saved === undefined) delete process.env.CI;
    else process.env.CI = saved;
  }
});

// ---- avatar refresh (issue #115) -------------------------------------------

const AVATAR_URL = 'https://avatars.githubusercontent.com/u/1?v=4&s=160';
const avatarSetup = (view = SNAP) => {
  const t = tmpSnapshot(view);
  return { ...t, avatarPath: join(t.dir, 'avatar.jpg') };
};
const avatarWarnings = (q) => q.lines.filter((l) => l.startsWith('warn') && /avatar/.test(l));

test('normaliseAvatar turns a PNG with EXIF and an ICC profile into a bare 160x160 JPEG', async () => {
  const before = await sharp(PNG_A).metadata();
  assert.ok(before.exif && before.icc, 'the fixture really carries metadata');
  assert.equal(before.format, 'png');
  const out = await normaliseAvatar(PNG_A);
  assert.deepEqual([...out.subarray(0, 3)], [0xff, 0xd8, 0xff], 'JPEG SOI marker');
  const m = await sharp(out).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(m.width, 160);
  assert.equal(m.height, 160);
  assert.equal(m.exif, undefined);
  assert.equal(m.icc, undefined);
  assert.equal(m.xmp, undefined);
  assert.ok(!out.includes('Someone Else') && !out.includes('Not Pearse'), 'no EXIF text in the bytes');
  assert.deepEqual(await normaliseAvatar(PNG_A), out, 'deterministic');
});

test('loadGithub writes a normalised JPEG avatar from a live fetch', async () => {
  const { dir, path, avatarPath } = avatarSetup();
  const q = quiet();
  try {
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch().f, ...q });
    const bytes = readFileSync(avatarPath);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    const m = await sharp(bytes).metadata();
    assert.deepEqual([m.format, m.width, m.height, m.exif, m.icc], ['jpeg', 160, 160, undefined, undefined]);
    assert.ok(bytes.length <= 6144, `${bytes.length} bytes`);
    assert.deepEqual(avatarWarnings(q), []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadGithub rewrites the avatar only when the normalised bytes change', async () => {
  const { dir, path, avatarPath } = avatarSetup();
  try {
    const run = (avatar) => loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar }).f, ...quiet() });
    await run(PNG_A);
    const first = readFileSync(avatarPath);
    const past = new Date('2020-01-01T00:00:00Z');
    utimesSync(avatarPath, past, past);

    await run(PNG_A);
    assert.equal(statSync(avatarPath).mtimeMs, past.getTime(), 'identical upstream bytes: not rewritten');
    assert.deepEqual(readFileSync(avatarPath), first);

    // The same picture re-encoded differently upstream normalises to the same bytes: still no rewrite.
    const asWebp = await sharp(PNG_A).webp({ lossless: true }).toBuffer();
    await run({ body: asWebp, type: 'image/webp' });
    assert.equal(statSync(avatarPath).mtimeMs, past.getTime(), 'compare runs on normalised bytes');

    await run(PNG_B);
    assert.notEqual(statSync(avatarPath).mtimeMs, past.getTime(), 'different upstream bytes: rewritten');
    assert.notDeepEqual(readFileSync(avatarPath), first);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the committed avatar is the source of truth: offline and failed fetches leave it alone', async () => {
  const { dir, path, avatarPath } = avatarSetup();
  try {
    writeFileSync(avatarPath, await normaliseAvatar(PNG_A));
    const committed = readFileSync(avatarPath);

    // offline: no network request at all, one warning
    const calls = [];
    const noNetwork = async (url) => {
      calls.push(url);
      throw new Error('no network call expected');
    };
    const off = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, offline: true, fetch: noNetwork, ...off });
    assert.deepEqual(calls, []);
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.equal(off.lines.filter((l) => l.startsWith('warn')).length, 1);

    // the avatar request throws
    const thrown = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar: 'throw' }).f, ...thrown });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.equal(avatarWarnings(thrown).length, 1);
    assert.match(avatarWarnings(thrown)[0], /^warn avatar kept as committed: avatar fetch failed$/);

    // the REST calls fail too: snapshot fallback, no avatar request, file untouched
    const down = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ rest: false, avatar: 'throw' }).f, ...down });
    assert.deepEqual(readFileSync(avatarPath), committed);

    // an undecodable image body
    const garbage = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar: new TextEncoder().encode('not an image') }).f, ...garbage });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.equal(avatarWarnings(garbage).length, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('avatar guards: wrong host, wrong content type and an oversized body leave the file untouched', async () => {
  const { dir, path, avatarPath } = avatarSetup();
  try {
    writeFileSync(avatarPath, await normaliseAvatar(PNG_A));
    const committed = readFileSync(avatarPath);

    // a profile whose avatar is not on the avatar host never triggers a request to it
    const host = fakeFetch({ user: { avatar_url: 'https://evil.example/u/1.png' } });
    const q1 = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: host.f, ...q1 });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.ok(!host.calls.some((c) => !c.url.startsWith('https://api.github.com/')), 'no request beyond the API');
    assert.equal(avatarWarnings(q1).length, 1);

    // http on the right host is refused as well
    const plain = fakeFetch({ user: { avatar_url: 'http://avatars.githubusercontent.com/u/1' } });
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: plain.f, ...quiet() });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.ok(!plain.calls.some((c) => c.url.includes('avatars.githubusercontent.com')));

    // content type
    const q2 = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar: { body: PNG_B, type: 'text/html' } }).f, ...q2 });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.match(avatarWarnings(q2).join('\n'), /not image\/\*/);

    // size cap (a real, decodable image padded past the cap; the stream is cut off at the cap)
    const big = Buffer.concat([PNG_B, Buffer.alloc(AVATAR_MAX_BYTES)]);
    const q3 = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar: big }).f, ...q3 });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.match(avatarWarnings(q3).join('\n'), /exceeds/);

    // HTTP error
    const q4 = quiet();
    await loadGithub({ snapshotPath: path, avatarPath, token: 't', fetch: fakeFetch({ avatar: { body: 'nope', status: 404 } }).f, ...q4 });
    assert.deepEqual(readFileSync(avatarPath), committed);
    assert.equal(avatarWarnings(q4).length, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the committed avatar is a bare 160x160 JPEG within the size budget', async () => {
  const bytes = readFileSync('src/assets/github-avatar.jpg');
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  const m = await sharp(bytes).metadata();
  assert.deepEqual([m.format, m.width, m.height, m.exif, m.icc, m.xmp], ['jpeg', 160, 160, undefined, undefined, undefined]);
  assert.ok(bytes.length <= 6144, `${bytes.length} bytes`);
});

// ---- committed snapshot and build ------------------------------------------

test('committed snapshot is complete enough to render the section offline', () => {
  const v = JSON.parse(readFileSync('src/data/github.json', 'utf8'));
  assert.equal(v.login, 'pearsedarcy');
  assert.equal(v.repos.length, 6);
  assert.equal(v.repos[0].name, 'pearse.dev', 'featured repo first');
  for (const r of v.repos) assert.ok(LISTED.includes(r.name), `${r.name} is listed`);
  assert.ok(!('followers' in v), 'no followers key');
  assert.deepEqual(filterSnapshot(v), v, 'already passes the snapshot filter');
  assert.ok(v.calendar?.weeks.length >= 52, 'calendar present');
});

test('home page has the GitHub section: profile, heatmap and six repos, all linking to github.com', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const start = html.indexOf('<section id="github"');
  assert.ok(start > -1, 'section#github missing');
  const section = html.slice(start, html.indexOf('</section>', start));

  assert.match(section, /<svg[^>]*class="heatmap"[^>]*role="img"/);
  assert.match(section, /<title id="gh-heatmap-title">[\d,]+ GitHub contributions in the year to /);
  assert.ok((section.match(/<rect /g) ?? []).length >= 360, 'heatmap cells');
  assert.doesNotMatch(section, /<script/);

  const repos = section.slice(section.indexOf('class="gh-repos"'));
  assert.equal((repos.match(/<li/g) ?? []).length, 6, 'six repos');
  const repoHrefs = [...repos.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(repoHrefs.length, 6);
  assert.equal(repoHrefs[0], 'https://github.com/pearsedarcy/pearse.dev', 'featured repo first');
  for (const h of repoHrefs) {
    const name = h.replace('https://github.com/pearsedarcy/', '');
    assert.ok(LISTED.includes(name), `${h} is listed`);
    assert.notEqual(name.toLowerCase(), GITHUB_LOGIN, 'never the profile README repo');
  }

  const hrefs = [...section.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 8, 'profile links plus six repos');
  for (const h of hrefs) assert.match(h, /^https:\/\/github\.com\/pearsedarcy(\/[\w.-]+)?$/, h);
  assert.ok(hrefs.includes('https://github.com/pearsedarcy'), 'profile link');
});

test('profile card shows contributions, not followers, matching the heatmap caption (issue #109)', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const start = html.indexOf('<section id="github"');
  const section = html.slice(start, html.indexOf('</section>', start));
  const card = section.slice(section.indexOf('class="gh-profile"'), section.indexOf('class="gh-heat"'));
  assert.doesNotMatch(card, /Followers/);
  const stat = card.match(/<dt[^>]*>Contributions \(last year\)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/)?.[1];
  const caption = section.match(/<span[^>]*>([\d,]+) contributions in the last year<\/span>/)?.[1];
  assert.ok(caption, 'heatmap figcaption');
  assert.equal(stat, caption);
  assert.match(card, /Most of my work is in private repositories\./);
});

test('heatmap labels stay >= 8px at phone width: the calendar scrolls instead of shrinking (issue #58)', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const start = html.indexOf('<section id="github"');
  const section = html.slice(start, html.indexOf('</section>', start));

  // Keyboard-reachable, labelled scroll region around the SVG.
  assert.match(section, /<div class="gh-scroll" tabindex="0" role="region" aria-label="[^"]+"[^>]*>\s*<svg[^>]*class="heatmap"/);

  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.match(css, /\.gh-scroll[^{]*\{[^}]*overflow-x:\s*auto/, 'scroll container');
  const minRem = Number(css.match(/\.heatmap\{[^}]*min-width:\s*([\d.]+)rem/)?.[1]);
  const fontPx = Number(css.match(/\.hm-text\{[^}]*font-size:\s*([\d.]+)px/)?.[1]);
  assert.ok(minRem > 0 && fontPx > 0, `min-width ${minRem}rem, label ${fontPx}px`);

  // A 390px viewport leaves ~343px, well under the floor, so the floor sets the scale.
  const floorPx = minRem * 16;
  assert.ok(floorPx > 343);
  const viewBoxW = Number(section.match(/class="heatmap" viewBox="0 0 ([\d.]+) /)?.[1]);
  const worstW = 30 + 54 * 13 - 3; // a 54-week calendar
  for (const w of [viewBoxW, worstW]) {
    const rendered = (fontPx * floorPx) / w;
    assert.ok(rendered >= 8, `labels render at ${rendered.toFixed(2)}px for viewBox width ${w}`);
  }
});

// ---- issue #72 -------------------------------------------------------------

test('shapeRepos fills a missing description from the fallbacks; GitHub wins when set', () => {
  const out = shapeRepos([
    repo('django-blog', '2026-02-01', { description: null }),
    repo('forum-migration', '2026-01-01', { description: 'from github' }),
  ]);
  assert.equal(out[0].description, 'An early Django blog project.');
  assert.equal(out[1].description, 'from github');
  assert.equal(describeRepo('forum-migration', null), DESCRIPTION_FALLBACKS['forum-migration']);
});

test('home page repo cards all have descriptions and the heading does not claim recency (issue #72)', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const start = html.indexOf('<section id="github"');
  const section = html.slice(start, html.indexOf('</section>', start));
  const repos = section.slice(section.indexOf('class="gh-repos"'));
  assert.equal((repos.match(/gh-repo-desc/g) ?? []).length, 6, 'every card has a description');
  assert.doesNotMatch(section, /Recently pushed/);
  const dates = [...repos.matchAll(/Pushed ([^<]+)</g)].map((m) => m[1]);
  assert.ok(dates.length === 0 || new Set(dates).size > 1, 'no run of identical push dates');
});

// ---- issue #78 -------------------------------------------------------------

test('shapeRepos replaces weak non-empty GitHub descriptions with the overrides', () => {
  const out = shapeRepos([
    repo('skatehills-flask', '2026-04-01', { description: 'SkateHills is a my first Flask Application.' }),
    repo('django-store', '2026-03-01', { description: 'My first django ecommerce solution' }),
    repo('chatterbox-1', '2026-02-01', { description: 'My First Chatbot using Ollama and Django' }),
    repo('Chatterbox-1', '2026-01-01', { description: null }),
  ]);
  assert.deepEqual(
    out.map((r) => r.description),
    [
      DESCRIPTION_OVERRIDES['skatehills-flask'],
      DESCRIPTION_OVERRIDES['django-store'],
      DESCRIPTION_OVERRIDES['chatterbox-1'],
      DESCRIPTION_OVERRIDES['chatterbox-1'],
    ],
  );
  assert.equal(describeRepo('other', 'Kept as is.'), 'Kept as is.');
  assert.equal(shapeRepos([repo('other', '2026-01-01', { description: 'Kept as is.' })]).length, 0, 'unlisted: no card');
});

test('every override is a sentence: capital first letter, full stop last', () => {
  for (const [name, d] of Object.entries(DESCRIPTION_OVERRIDES)) {
    assert.equal(name, name.toLowerCase(), `${name} key is lower-case`);
    assert.match(d, /^[A-Z].*\.$/, d);
  }
});

test('curlyApostrophes only touches apostrophes inside words', () => {
  assert.equal(curlyApostrophes("Pearse D'Arcy"), 'Pearse D’Arcy');
  assert.equal(curlyApostrophes('Pearse D’Arcy'), 'Pearse D’Arcy');
  assert.equal(curlyApostrophes("'quoted'"), "'quoted'");
});

test('loadGithub applies the site copy to an older snapshot as well', async () => {
  const stale = {
    ...SNAP,
    name: "Pearse D'Arcy",
    bio: 'Full Stack Developer.',
    repos: [
      {
        ...SNAP.repos[0],
        name: 'django-store',
        url: 'https://github.com/pearsedarcy/django-store',
        description: 'My first django ecommerce solution',
      },
    ],
  };
  const { dir, path } = tmpSnapshot(stale);
  try {
    const r = await loadGithub({ snapshotPath: path, avatarPath: join(dir, 'avatar.jpg'), offline: true, ...quiet() });
    assert.equal(r.view.name, 'Pearse D’Arcy');
    assert.equal(r.view.bio, PROFILE_BIO);
    assert.equal(r.view.repos[0].description, DESCRIPTION_OVERRIDES['django-store']);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('home page GitHub card uses the site wording and edited descriptions (issue #78)', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const start = html.indexOf('<section id="github"');
  const section = html.slice(start, html.indexOf('</section>', start));
  assert.match(section, /Pearse D’Arcy/);
  assert.doesNotMatch(section, /D(&#39;|&#x27;|')Arcy/);
  assert.match(section, /Software engineer/);
  assert.doesNotMatch(section, /Full Stack Developer|a my first|django ecommerce|My First Chatbot/);
  const descs = [...section.matchAll(/class="gh-repo-desc"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.equal(descs.length, 6);
  for (const d of descs) assert.match(d, /^[A-Z].*\.$/, d);
});

// ---- self-hosted avatar markup (issue #115) --------------------------------

function avatarMarkup() {
  const root = parseHtml(readFileSync('dist/index.html', 'utf8'));
  const [card] = find(root, (e) => (e.attrs.class ?? '').split(/\s+/).includes('gh-profile'));
  assert.ok(card, 'GitHub profile card');
  const pictures = find(card, (e) => e.tag === 'picture');
  assert.equal(pictures.length, 1, 'one <picture> in the card');
  return pictures[0];
}
const widths = (srcset) => srcsetCandidates(srcset).map((c) => c.descriptor).sort();

test('the GitHub card renders the avatar as a <picture> with AVIF and WebP sources and a JPEG fallback', () => {
  const picture = avatarMarkup();
  const sources = find(picture, (e) => e.tag === 'source');
  const byType = Object.fromEntries(sources.map((s) => [s.attrs.type, s]));
  assert.deepEqual(Object.keys(byType).sort(), ['image/avif', 'image/webp']);
  for (const s of sources) {
    assert.deepEqual(widths(s.attrs.srcset), ['160w', '80w'], s.attrs.type);
    assert.equal(s.attrs.sizes, '80px');
  }
  const [img] = find(picture, (e) => e.tag === 'img');
  assert.match(img.attrs.src, /^\/_astro\/[^/]+\.jpe?g$/);
  assert.deepEqual(widths(img.attrs.srcset), ['160w', '80w']);
  assert.equal(img.attrs.width, '80');
  assert.equal(img.attrs.height, '80');
  assert.equal(img.attrs.alt, '', 'decorative');
  assert.equal(img.attrs.loading, 'lazy');
  assert.equal(img.attrs.decoding, 'async');
  assert.match(img.attrs.class, /\bgh-avatar\b/);
  for (const u of srcsetCandidates(img.attrs.srcset)) assert.match(u.url, /^\/_astro\/[^/]+\.jpe?g$/);
});

test('every avatar variant the card references is a file in dist/ of at most 6144 bytes', () => {
  const picture = avatarMarkup();
  const urls = new Set();
  for (const e of find(picture, (x) => x.tag === 'source' || x.tag === 'img')) {
    if (e.attrs.src) urls.add(e.attrs.src);
    for (const c of srcsetCandidates(e.attrs.srcset ?? '')) urls.add(c.url);
  }
  assert.equal(urls.size, 6, '2 widths x 3 formats');
  for (const u of urls) {
    assert.ok(u.startsWith('/'), u);
    const file = join('dist', u);
    assert.ok(existsSync(file), `${u} exists in dist/`);
    assert.ok(statSync(file).size <= 6144, `${u} is ${statSync(file).size} bytes`);
  }
});

test('the snapshot keeps avatarUrl as the refresh source, but no page renders it', () => {
  const v = JSON.parse(readFileSync('src/data/github.json', 'utf8'));
  assert.match(v.avatarUrl, /^https:\/\/avatars\.githubusercontent\.com\//);
  assert.ok(!readFileSync('dist/index.html', 'utf8').includes(v.avatarUrl));
});
