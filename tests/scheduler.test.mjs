// Scheduler (ADR 0004): selection, LinkedIn payloads, the Posting record, and the
// exported n8n workflow. No build and no n8n needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLinkedInPayload,
  callbackData,
  decide,
  findForPosting,
  hourIn,
  LAST_DAILY_HOUR,
  parseCommand,
  parseFeedResponse,
  readConfig,
  recordPostResult,
  routeUpdate,
  selectForDay,
  selectToOffer,
  stateFor,
} from '../automation/n8n/select.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORKFLOW_TEXT = read('automation/n8n/social-scheduler.json');
const workflow = JSON.parse(WORKFLOW_TEXT);
const node = (name) => workflow.nodes.find((n) => n.name === name);

const AUTHOR = 'urn:li:person:abc123';
const CHAT = '1000';
const NOW = new Date('2026-11-03T04:00:00Z'); // 05:00 Vienna: before the daily run, so not the last daily run
const LAST_RUN = new Date('2026-11-03T06:00:00Z'); // 07:00 Vienna: the one daily run
const copy = (s) => ({ linkedin: `${s} long`, short: `${s} short` });

const FEED = [
  { kind: 'article', id: 'old-live', slug: 'old-live', title: 'Old', date: '2026-10-24', pubDate: '2026-10-24', url: 'https://pearse.dev/writing/old-live/', published: true, status: 'approved', tags: [], social: copy('old') },
  { kind: 'article', id: 'today-live', slug: 'today-live', title: 'Today live', date: '2026-11-03', pubDate: '2026-11-03', url: 'https://pearse.dev/writing/today-live/', published: true, status: 'approved', tags: [], social: copy('a') },
  { kind: 'article', id: 'today-unbuilt', slug: 'today-unbuilt', title: 'Not built yet', date: '2026-11-03', pubDate: '2026-11-03', url: 'https://pearse.dev/writing/today-unbuilt/', published: false, status: 'approved', tags: [], social: copy('b') },
  { kind: 'standalone', id: 'p01', title: 'Lesson', date: '2026-11-03', pillar: 'Agentic engineering', published: true, status: 'approved', social: copy('p01') },
  { kind: 'standalone', id: 'p02', title: 'Later', date: '2026-11-10', pillar: 'Platform building', published: true, status: 'approved', social: copy('p02') },
];
const ids = (entries) => entries.map((e) => e.id);
const config = (over = {}) => ({ dryRun: false, chatId: CHAT, authorUrn: AUTHOR, today: '2026-11-03', ...over });

test('selects eligible entries dated that day only', () => {
  assert.deepEqual(ids(selectForDay(FEED, '2026-11-03', [])), ['today-live', 'p01']);
  assert.deepEqual(ids(selectForDay(FEED, '2026-10-24', [])), ['old-live']);
  assert.deepEqual(ids(selectForDay(FEED, '2026-11-04', [])), []);
});

test('skips ids already in the posting record, posted or skipped', () => {
  const record = [
    { id: 'today-live', network: 'linkedin', postedAt: '2026-11-03T06:01:00Z', postUrn: 'urn:li:share:1', status: 'posted' },
    { id: 'p01', network: 'linkedin', postedAt: '2026-11-03T06:02:00Z', postUrn: null, status: 'skipped' },
  ];
  assert.deepEqual(ids(selectForDay(FEED, '2026-11-03', record)), []);
});

test('an unpublished article is never selected, offered or posted', () => {
  assert.ok(!ids(selectForDay(FEED, '2026-11-03', [])).includes('today-unbuilt'));
  assert.match(findForPosting(FEED, 'today-unbuilt', '2026-11-03', []).error, /not published/);
  assert.throws(() => buildLinkedInPayload(FEED[2], AUTHOR), /not published/);
  const out = decide({ request: { mode: 'approve', id: 'today-unbuilt' }, config: config(), feed: FEED, state: stateFor({}, false), now: NOW });
  assert.deepEqual(out.map((o) => o.action), ['notify']);
});

test('a stripped scheduled article (#111) is never selected, offered or posted, and reoffer says not published', () => {
  // Appended, not inserted: FEED[1..3] are used by position elsewhere.
  const feed = [...FEED, { kind: 'article', id: 'today-stripped', date: '2026-11-03', published: false }];
  assert.ok(!ids(selectForDay(feed, '2026-11-03', [])).includes('today-stripped'));
  assert.ok(!ids(selectToOffer(feed, '2026-11-03', stateFor({}, false))).includes('today-stripped'));
  assert.match(findForPosting(feed, 'today-stripped', '2026-11-03', []).error, /not published yet/);
  const out = decide({ request: { mode: 'reoffer', id: 'today-stripped' }, config: config(), feed, state: stateFor({}, false), now: NOW });
  assert.deepEqual(out.map((o) => o.action), ['notify']);
  assert.match(out[0].text, /not published yet/);
  assert.doesNotMatch(out[0].text, /not in the feed/);
});

test('a draft never reaches the feed, and an unapproved standalone is not eligible', () => {
  const feed = [{ kind: 'standalone', id: 'p09', title: 'x', date: '2026-11-03', published: true, status: 'draft', social: copy('x') }];
  assert.deepEqual(selectForDay(feed, '2026-11-03', []), []);
});

test('an approved future-dated standalone post is offered on its date only', () => {
  assert.ok(!ids(selectForDay(FEED, '2026-11-03', [])).includes('p02'));
  assert.ok(!ids(selectForDay(FEED, '2026-11-09', [])).includes('p02'));
  assert.deepEqual(ids(selectForDay(FEED, '2026-11-10', [])), ['p02']);
  assert.match(findForPosting(FEED, 'p02', '2026-11-03', []).error, /after 2026-11-03/);
});

test('legacy feed entries without kind are treated as articles', () => {
  const legacy = [{ slug: 'x', title: 'X', url: 'https://pearse.dev/writing/x/', pubDate: '2026-11-03', published: true, tags: [], social: copy('x') }];
  assert.deepEqual(ids(selectForDay(legacy, '2026-11-03', [])), ['x']);
});

test('article payload is an ARTICLE share with the URL and title', () => {
  assert.deepEqual(buildLinkedInPayload(FEED[1], AUTHOR), {
    author: AUTHOR,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: 'a long' },
        shareMediaCategory: 'ARTICLE',
        media: [{ status: 'READY', originalUrl: 'https://pearse.dev/writing/today-live/', title: { text: 'Today live' } }],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  });
});

test('standalone payload is text only', () => {
  const p = buildLinkedInPayload(FEED[3], AUTHOR);
  assert.deepEqual(p.specificContent['com.linkedin.ugc.ShareContent'], { shareCommentary: { text: 'p01 long' }, shareMediaCategory: 'NONE' });
  assert.equal(p.visibility['com.linkedin.ugc.MemberNetworkVisibility'], 'PUBLIC');
  assert.throws(() => buildLinkedInPayload(FEED[3], ''), /LINKEDIN_AUTHOR_URN/);
});

test('callback data fits Telegram and only the configured chat is heard', () => {
  assert.equal(callbackData('approve', 'p01'), 'approve:p01');
  assert.throws(() => callbackData('approve', 'x'.repeat(60)), /64 bytes/);
  const cb = (chat, data) => ({ callback_query: { id: 'q1', data, message: { chat: { id: Number(chat) } } } });
  assert.deepEqual(routeUpdate(cb(CHAT, 'skip:p01'), CHAT), { mode: 'skip', id: 'p01', queryId: 'q1' });
  assert.equal(routeUpdate(cb('2000', 'approve:p01'), CHAT), null);
  assert.deepEqual(routeUpdate({ message: { chat: { id: 1000 }, text: '/reoffer p01' } }, CHAT), { mode: 'reoffer', id: 'p01' });
  assert.equal(routeUpdate({ message: { chat: { id: 1000 }, text: 'hello' } }, CHAT), null);
  assert.deepEqual(parseCommand('/run@somebot'), { mode: 'run' });
  const group = { callback_query: { id: 'q', data: 'approve:p01', from: { id: 5 }, message: { chat: { id: 1000, type: 'group' } } } };
  assert.equal(routeUpdate(group, CHAT), null, 'group chats are never heard');
  const tapBy = (user) => ({ callback_query: { id: 'q', data: 'approve:p01', from: { id: user }, message: { chat: { id: 1000, type: 'private' } } } });
  assert.equal(routeUpdate(tapBy(6), CHAT, '5'), null, 'wrong user');
  assert.equal(routeUpdate(tapBy(5), CHAT, '5').mode, 'approve');
});

test('config defaults to dry run; the date override works in dry runs only', () => {
  const get = (vals) => (k) => vals[k];
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT }), NOW).dryRun, true);
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT, DRY_RUN: 'False' }), NOW).dryRun, false);
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT, SCHEDULER_TODAY: '2026-11-10' }), NOW).today, '2026-11-10');
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT, DRY_RUN: 'false', SCHEDULER_TODAY: '2026-11-10' }), NOW).today, '2026-11-03');
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT }), new Date('2026-11-02T23:30:00Z')).today, '2026-11-03'); // Vienna
  assert.throws(() => readConfig(get({}), NOW), /TELEGRAM_CHAT_ID/);
  assert.throws(() => readConfig(get({ TELEGRAM_CHAT_ID: '-100123' }), NOW), /private chat/);
  assert.equal(readConfig(get({ TELEGRAM_CHAT_ID: CHAT, TELEGRAM_USER_ID: '5' }), NOW).userId, '5');
});

test('a second run the same day offers nothing; skip records and is never re-offered', () => {
  const state = stateFor({}, false);
  const first = decide({ request: { mode: 'daily' }, config: config(), feed: FEED, state, now: NOW });
  assert.deepEqual(first.map((o) => [o.action, o.id]), [['offer', 'today-live'], ['offer', 'p01']]);
  assert.equal(first[0].approveData, 'approve:today-live');
  assert.match(first[0].text, /a long/);
  assert.deepEqual(decide({ request: { mode: 'daily' }, config: config(), feed: FEED, state, now: NOW }), []);
  decide({ request: { mode: 'skip', id: 'p01', queryId: 'q' }, config: config(), feed: FEED, state, now: NOW });
  assert.deepEqual(state.record.map((r) => [r.id, r.status, r.network]), [['p01', 'skipped', 'linkedin']]);
  state.offered = {};
  assert.deepEqual(ids(selectToOffer(FEED, '2026-11-03', state)), ['today-live']);
  const again = decide({ request: { mode: 'reoffer', id: 'p01' }, config: config(), feed: FEED, state, now: NOW });
  assert.deepEqual(again.map((o) => [o.action, o.id]), [['offer', 'p01']]);
  assert.equal(state.record.length, 0);
});

test('approve writes a pending row first, so a second tap is refused, then posts once', () => {
  const state = stateFor({}, false);
  const out = decide({ request: { mode: 'approve', id: 'p01', queryId: 'q' }, config: config(), feed: FEED, state, now: NOW });
  assert.deepEqual(out.map((o) => o.action), ['ack', 'post', 'notify']);
  assert.match(out[2].text, /skipped: no Bluesky credential.*\nskipped: no Mastodon credential/s);
  assert.deepEqual(state.record.map((r) => [r.id, r.status]), [['p01', 'pending']]);
  const doubleTap = decide({ request: { mode: 'approve', id: 'p01', queryId: 'q2' }, config: config(), feed: FEED, state, now: NOW });
  assert.deepEqual(doubleTap.map((o) => o.action), ['ack', 'notify']);
  assert.match(doubleTap[1].text, /already pending/);
  const ok = recordPostResult({ state, id: 'p01', chatId: CHAT, response: { statusCode: 201, body: { id: 'urn:li:share:9' }, headers: {} }, now: NOW });
  assert.match(ok.text, /urn:li:share:9/);
  assert.deepEqual(state.record, [{ id: 'p01', network: 'linkedin', postedAt: NOW.toISOString(), postUrn: 'urn:li:share:9', status: 'posted' }]);
  assert.match(decide({ request: { mode: 'approve', id: 'p01' }, config: config(), feed: FEED, state, now: NOW })[0].text, /already posted/);
  assert.deepEqual(decide({ request: { mode: 'reoffer', id: 'p01' }, config: config(), feed: FEED, state, now: NOW }).map((o) => o.action), ['notify']);
});

test('a 4xx from LinkedIn drops the pending row and allows a retry', () => {
  const state = stateFor({}, false);
  decide({ request: { mode: 'approve', id: 'p01' }, config: config(), feed: FEED, state, now: NOW });
  const fail = recordPostResult({ state, id: 'p01', chatId: CHAT, response: { statusCode: 422, body: '{"message":"duplicate"}' }, now: NOW });
  assert.match(fail.text, /refused p01 with HTTP 422.*tap Approve again\.\n.*duplicate/s);
  assert.equal(state.record.length, 0);
  assert.equal(decide({ request: { mode: 'approve', id: 'p01' }, config: config(), feed: FEED, state, now: NOW })[0].action, 'post');
});

test('a timeout or 5xx records unknown and never invites a blind retry', () => {
  for (const response of [{ error: { message: 'ETIMEDOUT' } }, { statusCode: 0 }, { statusCode: 504, body: 'gateway' }]) {
    const state = stateFor({}, false);
    decide({ request: { mode: 'approve', id: 'p01' }, config: config(), feed: FEED, state, now: NOW });
    const res = recordPostResult({ state, id: 'p01', chatId: CHAT, response, now: NOW });
    assert.match(res.text, /may have been posted.*check LinkedIn/s);
    assert.doesNotMatch(res.text, /tap Approve/);
    assert.deepEqual(state.record.map((r) => [r.id, r.status]), [['p01', 'unknown']]);
    assert.equal(decide({ request: { mode: 'approve', id: 'p01' }, config: config(), feed: FEED, state, now: NOW })[0].action, 'notify');
    assert.deepEqual(selectForDay(FEED, '2026-11-03', state.record).map((e) => e.id), ['today-live']);
  }
});

test('an id too long for callback data is reported, not marked offered, and does not block siblings', () => {
  const slug = 'a'.repeat(70);
  const feed = [{ ...FEED[1], id: slug, slug }, FEED[3]];
  const state = stateFor({}, false);
  const out = decide({ request: { mode: 'daily' }, config: config(), feed, state, now: NOW });
  assert.deepEqual(out.map((o) => o.action), ['notify', 'offer']);
  assert.match(out[0].text, /Cannot offer a{70}: .*64 bytes/);
  assert.equal(out[1].id, 'p01');
  assert.deepEqual(Object.keys(state.offered), ['p01']);
});

test('LinkedIn copy over 3000 characters is caught at offer time', () => {
  const long = { ...FEED[3], social: { linkedin: 'x'.repeat(3001), short: 's' } };
  assert.throws(() => buildLinkedInPayload(long, AUTHOR), /3001 characters/);
  const out = decide({ request: { mode: 'daily' }, config: config(), feed: [long], state: stateFor({}, false), now: NOW });
  assert.match(out[0].text, /Cannot offer p01: .*over LinkedIn's 3000/);
});

test('skip only accepts ids in the feed', () => {
  const state = stateFor({}, false);
  const out = decide({ request: { mode: 'skip', id: 'nope' }, config: config(), feed: FEED, state, now: NOW });
  assert.match(out[0].text, /not in the social feed/);
  assert.equal(state.record.length, 0);
});

test('feed response is read from body, as text or nested', () => {
  assert.deepEqual(parseFeedResponse({ statusCode: 200, body: '[{"id":"a"}]' }), { feed: [{ id: 'a' }] });
  assert.deepEqual(parseFeedResponse({ statusCode: 200, body: { feed: '[]' } }), { feed: [] });
  assert.deepEqual(parseFeedResponse({ statusCode: 503, body: '' }), { feedError: 'HTTP 503' });
  assert.match(parseFeedResponse({ statusCode: 200, body: '{}' }).feedError, /not a JSON array/);
});

test('dry run reports the exact payload with a DRY RUN prefix and never posts', () => {
  const data = {};
  const state = stateFor(data, true);
  const out = decide({ request: { mode: 'approve', id: 'today-live' }, config: config({ dryRun: true }), feed: FEED, state, now: NOW });
  assert.deepEqual(out.map((o) => o.action), ['dryrun', 'notify'], 'one payload, plus the note that the other networks were skipped');
  assert.match(out[0].text, /^DRY RUN: would POST https:\/\/api\.linkedin\.com\/v2\/ugcPosts\nX-Restli-Protocol-Version: 2\.0\.0/);
  assert.deepEqual(JSON.parse(out[0].text.slice(out[0].text.indexOf('{'))), buildLinkedInPayload(FEED[1], AUTHOR));
  assert.equal(data.live, undefined);
  const feedDown = decide({ request: { mode: 'run' }, config: config({ dryRun: true }), feed: null, feedError: 'HTTP 503', state, now: NOW });
  assert.match(feedDown[0].text, /^DRY RUN: Could not read the social feed: HTTP 503/);
});

// ---- last-run warning: an article dated today that is still unpublished ----

const UNBUILT = 'today-unbuilt';
const daily = (over = {}) => ({ request: { mode: 'daily' }, config: config(), feed: FEED, state: stateFor({}, false), now: LAST_RUN, ...over });
const warnings = (out) => out.filter((o) => o.action === 'notify');

test('the last daily run warns about an unpublished article dated today, after the offers', () => {
  const out = decide(daily());
  assert.deepEqual(out.map((o) => o.action), ['offer', 'offer', 'notify']);
  assert.deepEqual(ids(out.slice(0, 2)), ['today-live', 'p01']);
  assert.equal(warnings(out).length, 1);
  assert.match(out[2].text, new RegExp(UNBUILT));
  assert.match(out[2].text, /2026-11-03/);
  assert.match(out[2].text, /Deploy to GitHub Pages/);
  assert.match(out[2].text, new RegExp(`/reoffer ${UNBUILT}`));
  assert.deepEqual(Object.keys(out[2]).sort(), ['action', 'chatId', 'text'], 'a plain notify: no buttons');
});

test('the warning offers nothing, marks nothing offered and records nothing', () => {
  const feed = [FEED[2]];
  const state = stateFor({}, false);
  const out = decide(daily({ feed, state }));
  assert.deepEqual(out.map((o) => o.action), ['notify']);
  assert.deepEqual(state.offered, {});
  assert.deepEqual(state.record, []);
});

test('a run before the daily run (05:00 Vienna) does not warn', () => {
  const out = decide(daily({ now: NOW }));
  assert.deepEqual(out.map((o) => o.action), ['offer', 'offer']);
});

test('a late last run still warns (hour >= the last hour, not ===)', () => {
  const out = decide(daily({ now: new Date('2026-11-03T10:30:00Z') }));
  assert.equal(warnings(out).length, 1);
});

test('the hour is Vienna wall-clock time across daylight saving', () => {
  assert.equal(hourIn('Europe/Vienna', new Date('2026-07-01T07:00:00Z')), 9);
  assert.equal(hourIn('Europe/Vienna', new Date('2026-07-01T05:00:00Z')), 7);
  assert.equal(hourIn('Europe/Vienna', new Date('2026-11-03T06:00:00Z')), 7);
  assert.equal(hourIn('Europe/Vienna', new Date('2026-06-30T22:00:00Z')), 0, 'midnight is 0, never 24');
  const summer = { config: config({ today: '2026-07-01' }), feed: [{ kind: 'article', id: 'summer', date: '2026-07-01', published: false }] };
  assert.equal(warnings(decide(daily({ ...summer, now: new Date('2026-07-01T07:00:00Z') }))).length, 1);
  assert.equal(warnings(decide(daily({ ...summer, now: new Date('2026-07-01T03:00:00Z') }))).length, 0);
});

test('two unpublished articles dated today give two warnings, one per id, in feed order', () => {
  const feed = [
    { kind: 'article', id: 'second-b', date: '2026-11-03', published: false },
    FEED[1],
    { kind: 'article', id: 'first-a', date: '2026-11-03', published: false },
  ];
  const out = decide(daily({ feed }));
  assert.deepEqual(out.map((o) => o.action), ['offer', 'notify', 'notify']);
  assert.match(out[1].text, /second-b/);
  assert.match(out[2].text, /first-a/);
});

test('the warning works on the #111 stub shape without title, url, slug or status', () => {
  const feed = [{ kind: 'article', id: 'stub-today', date: '2026-11-03', published: false }];
  const out = decide(daily({ feed }));
  assert.deepEqual(out.map((o) => o.action), ['notify']);
  assert.match(out[0].text, /stub-today/);
  assert.match(out[0].text, /2026-11-03/);
});

test('only articles dated today warn: not an unapproved standalone post, not another day', () => {
  const standalone = { kind: 'standalone', id: 'p-draft', title: 'x', date: '2026-11-03', published: false, status: 'draft', social: copy('x') };
  const otherDay = { kind: 'article', id: 'tomorrow', date: '2026-11-04', published: false };
  const yesterday = { kind: 'article', id: 'yesterday', date: '2026-11-02', published: false };
  assert.deepEqual(decide(daily({ feed: [standalone, otherDay, yesterday] })), []);
});

test('/run, /reoffer, buttons and help do not warn, even at the last run', () => {
  const feed = [FEED[2]];
  const run = decide(daily({ feed, request: { mode: 'run' } }));
  assert.deepEqual(run.map((o) => o.text), ['Nothing new to offer for 2026-11-03.']);
  const reoffer = decide(daily({ feed, request: { mode: 'reoffer', id: UNBUILT } }));
  assert.deepEqual(reoffer.map((o) => o.action), ['notify']);
  assert.match(reoffer[0].text, /not published/);
  assert.doesNotMatch(reoffer[0].text, /Deploy to GitHub Pages/);
  const skip = decide(daily({ feed: FEED, request: { mode: 'skip', id: 'p01', queryId: 'q' } }));
  assert.ok(!skip.some((o) => /Deploy to GitHub Pages/.test(o.text ?? '')));
  const approve = decide(daily({ feed: FEED, request: { mode: 'approve', id: 'p01', queryId: 'q' } }));
  assert.ok(!approve.some((o) => /Deploy to GitHub Pages/.test(o.text ?? '')));
  const help = decide(daily({ request: { mode: 'help' } }));
  assert.deepEqual(help.map((o) => o.action), ['notify']);
  assert.doesNotMatch(help[0].text, /Deploy to GitHub Pages/);
});

test('a feed read failure at the last run gives only the feed error, no warning', () => {
  const out = decide(daily({ feed: null, feedError: 'HTTP 503' }));
  assert.deepEqual(out.map((o) => o.text), ['Could not read the social feed: HTTP 503']);
});

test('in dry run the warning carries the DRY RUN prefix', () => {
  const out = decide(daily({ config: config({ dryRun: true }) }));
  assert.match(warnings(out)[0].text, /^DRY RUN: /);
});

test('the date comes from config.today and the hour from now', () => {
  // A dry run rehearsing another date: today's feed entry is dated 2026-11-10, the clock says 07:00.
  const feed = [{ kind: 'article', id: 'rehearsal', date: '2026-11-10', published: false }];
  const out = decide(daily({ feed, config: config({ dryRun: true, today: '2026-11-10' }) }));
  assert.match(out[0].text, /rehearsal/);
});

test('the Daily schedule cron rules are daily on the hour, and the last hour matches the constant', () => {
  const rules = node('Daily schedule').parameters.rule.interval.map((r) => r.expression);
  assert.ok(rules.length > 0);
  const hours = rules.map((expression) => {
    const m = /^(\d+) (\d+) \* \* \*$/.exec(expression);
    assert.ok(m, `"${expression}" must be "M H * * *": a different shape needs a conscious change to the last-run rule`);
    assert.equal(Number(m[1]), 0, `"${expression}" must fire on the hour: a non-zero minute makes "hour >= LAST_DAILY_HOUR" fire before the run it identifies`);
    return Number(m[2]);
  });
  assert.equal(Math.max(...hours), LAST_DAILY_HOUR);
});

test('the deploy workflow has exactly one scheduled rebuild, at 04:23 UTC, ahead of the 07:00 Vienna run in both seasons', () => {
  const yml = read('.github/workflows/deploy.yml');
  const block = /^ {2}schedule:\n((?: {4}.*\n|\s*#.*\n)+)/m.exec(yml);
  assert.ok(block, 'deploy.yml has a schedule: block');
  const crons = [...block[1].matchAll(/^\s*- cron:\s*['"]?([^'"\n]+?)['"]?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(crons, ['23 4 * * *']);
});

// ---- the exported workflow ----

test('workflow is valid n8n JSON with credentials referenced by name only', () => {
  assert.ok(Array.isArray(workflow.nodes) && workflow.connections);
  assert.equal(workflow.settings.timezone, 'Europe/Vienna');
  const schedule = node('Daily schedule').parameters.rule.interval.map((r) => r.expression);
  assert.deepEqual(schedule, ['0 7 * * *']);
  for (const n of workflow.nodes) {
    for (const [type, ref] of Object.entries(n.credentials ?? {})) {
      assert.deepEqual(Object.keys(ref), ['name'], `${n.name} ${type}`);
      assert.ok(['linkedin-member', 'telegram-pearse-dev', 'bluesky-app-password', 'mastodon-token'].includes(ref.name), `${n.name} uses ${ref.name}`);
    }
  }
  for (const [from, c] of Object.entries(workflow.connections)) {
    assert.ok(node(from), from);
    for (const out of c.main) for (const link of out) assert.ok(node(link.node), `${from} -> ${link.node}`);
  }
  assert.equal(node('Answer button').onError, 'continueRegularOutput', 'a stale button must not halt the post');
  assert.equal(node('Fetch social feed').parameters.options.response.response.outputPropertyName, undefined);
  const li = node('Post to LinkedIn').parameters;
  assert.equal(li.url, 'https://api.linkedin.com/v2/ugcPosts');
  assert.deepEqual(li.headerParameters.parameters, [{ name: 'X-Restli-Protocol-Version', value: '2.0.0' }]);
});

test('workflow holds no credential values or chat ids', () => {
  assert.doesNotMatch(WORKFLOW_TEXT, /bot\d+:/i, 'telegram bot url');
  assert.doesNotMatch(WORKFLOW_TEXT, /\d{6,}:[A-Za-z0-9_-]{20,}/, 'telegram bot token');
  assert.doesNotMatch(WORKFLOW_TEXT, /\bAQ[A-Za-z0-9_-]{20,}/, 'linkedin token');
  assert.doesNotMatch(WORKFLOW_TEXT, /Bearer\s+[A-Za-z0-9]/, 'bearer value');
  assert.doesNotMatch(WORKFLOW_TEXT, /"-?\d{5,}"/, 'digits-only string, like a chat id');
  assert.doesNotMatch(WORKFLOW_TEXT, /chat_?id\W{1,4}-?\d{5,}/i, 'chat id literal');
});

test('Code nodes embed select.mjs verbatim', () => {
  const lib = read('automation/n8n/select.mjs').replace(/^export /gm, '');
  for (const name of ['Decide', 'Record result']) {
    assert.ok(node(name).parameters.jsCode.startsWith(lib), `${name} has drifted from select.mjs: re-paste it`);
  }
});

// Runs the Decide and Record result node code with n8n's globals stubbed.
// `now` pins the clock: a zero-argument `new Date()` and `Date.now()` return it; dates built from arguments are untouched.
function runNode(name, { input, upstream = {}, staticData, vars = {}, now = NOW }) {
  const pinned = now.getTime();
  class PinnedDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(pinned);
      else super(...args);
    }
    static now() {
      return pinned;
    }
  }
  const $ = (n) => {
    if (n === 'Decide' && upstream.Decide) return { isExecuted: true, first: () => ({ json: upstream.Decide[0] }), all: () => upstream.Decide.map((json) => ({ json })) };
    if (!(n in upstream)) throw new Error(`Referenced node is unexecuted: ${n}`);
    return { isExecuted: true, first: () => ({ json: upstream[n] }), all: () => [{ json: upstream[n] }] };
  };
  const fn = new Function('$input', '$', '$getWorkflowStaticData', '$vars', '$env', 'Date', node(name).parameters.jsCode);
  const env = new Proxy({}, { get: () => { throw new Error('access to env vars denied'); } });
  return fn({ first: () => ({ json: input }), all: () => [{ json: input }] }, $, () => staticData, vars, env, PinnedDate).map((i) => i.json);
}

test('embedded Decide node: daily offer, Approve in dry run, then a no-op rerun', () => {
  const staticData = {};
  const vars = { TELEGRAM_CHAT_ID: CHAT, LINKEDIN_AUTHOR_URN: AUTHOR, SCHEDULER_TODAY: '2026-11-03' };
  const feedRes = { statusCode: 200, body: JSON.stringify(FEED) };
  const daily = runNode('Decide', { input: feedRes, upstream: { 'Daily schedule': {} }, staticData, vars });
  assert.deepEqual(daily.map((o) => [o.action, o.id]), [['offer', 'today-live'], ['offer', 'p01']]);
  assert.match(daily[0].text, /^DRY RUN: /);
  const tap = { callback_query: { id: 'q1', data: 'approve:p01', message: { chat: { id: 1000 } } } };
  const approved = runNode('Decide', { input: feedRes, upstream: { 'Telegram update': tap }, staticData, vars });
  assert.deepEqual(approved.map((o) => o.action), ['ack', 'dryrun', 'notify']);
  assert.equal(approved[1].payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory, 'NONE');
  assert.deepEqual(runNode('Decide', { input: feedRes, upstream: { 'Daily schedule': {} }, staticData, vars }), []);
  assert.equal(staticData.live, undefined);
  const stranger = { callback_query: { id: 'q2', data: 'approve:p01', message: { chat: { id: 2000 } } } };
  assert.deepEqual(runNode('Decide', { input: feedRes, upstream: { 'Telegram update': stranger }, staticData, vars }), []);
  const bad = runNode('Decide', { input: feedRes, upstream: { 'Daily schedule': {} }, staticData, vars: { ...vars, TELEGRAM_USER_ID: 'me' } });
  assert.deepEqual(bad.map((o) => [o.action, o.chatId]), [['notify', CHAT]]);
  assert.match(bad[0].text, /configuration error/);
});

test('embedded Decide node: the warning appears at 07:00 Vienna and not at 05:00, whatever the real time', () => {
  const vars = { TELEGRAM_CHAT_ID: CHAT, LINKEDIN_AUTHOR_URN: AUTHOR, SCHEDULER_TODAY: '2026-11-03' };
  const feedRes = { statusCode: 200, body: JSON.stringify(FEED) };
  const at = (now) => runNode('Decide', { input: feedRes, upstream: { 'Daily schedule': {} }, staticData: {}, vars, now });
  const last = at(LAST_RUN);
  assert.deepEqual(last.map((o) => o.action), ['offer', 'offer', 'notify']);
  assert.match(last[2].text, /^DRY RUN: .*today-unbuilt.*Deploy to GitHub Pages/s);
  assert.deepEqual(at(NOW).map((o) => o.action), ['offer', 'offer']);
});

test('embedded Decide node: the date and the hour come from one clock reading', () => {
  // Without SCHEDULER_TODAY the date comes from the same pinned instant: 07:00 Vienna on 2026-11-03.
  const vars = { TELEGRAM_CHAT_ID: CHAT, LINKEDIN_AUTHOR_URN: AUTHOR };
  const feedRes = { statusCode: 200, body: JSON.stringify(FEED) };
  const out = runNode('Decide', { input: feedRes, upstream: { 'Daily schedule': {} }, staticData: {}, vars, now: LAST_RUN });
  assert.deepEqual(out.map((o) => o.action), ['offer', 'offer', 'notify']);
  const decideCode = node('Decide').parameters.jsCode;
  const shim = decideCode.slice(decideCode.indexOf('// ---- n8n shim'));
  assert.equal(shim.split('new Date()').length - 1, 1, 'the shim reads the clock once');
  assert.match(shim, /readConfig\(setting, now\)/);
  assert.match(shim, /decide\(\{[^}]*\bnow\b[^}]*\}\)/);
});

test('embedded Record result node records a live post', () => {
  const staticData = {};
  const post = { action: 'post', chatId: CHAT, id: 'p01', payload: {} };
  // Decide wrote the pending row in the same execution
  stateFor(staticData, false).record.push({ id: 'p01', network: 'linkedin', postedAt: NOW.toISOString(), postUrn: null, status: 'pending' });
  const out = runNode('Record result', {
    input: { statusCode: 201, body: { id: 'urn:li:share:7' }, headers: {} },
    upstream: { Decide: [{ action: 'ack', queryId: 'q' }, post] },
    staticData,
    vars: { TELEGRAM_CHAT_ID: CHAT },
  });
  assert.equal(out[0].chatId, CHAT);
  assert.deepEqual(staticData.live.record.map((r) => [r.status, r.postUrn]), [['posted', 'urn:li:share:7']]);
});

// ---- cross-posting branches (issue #23) ----

test('Route action sends each action to its node, Bluesky and Mastodon included', () => {
  const rules = node('Route action').parameters.rules.values;
  const target = Object.fromEntries(rules.map((r, i) => [r.conditions.conditions[0].rightValue, workflow.connections['Route action'].main[i][0].node]));
  assert.deepEqual(target, {
    ack: 'Answer button',
    offer: 'Send offer',
    notify: 'Send message',
    dryrun: 'Log dry-run payload',
    post: 'Post to LinkedIn',
    post_bluesky: 'Bluesky session',
    post_mastodon: 'Post to Mastodon',
  });
  const next = (n) => workflow.connections[n].main[0].map((l) => l.node);
  assert.deepEqual(next('Bluesky session'), ['Post to Bluesky']);
  // deleteSession runs first, so a failure further down cannot leave the session's refresh token live.
  assert.deepEqual(next('Post to Bluesky'), ['End Bluesky session']);
  assert.deepEqual(next('End Bluesky session'), ['Mark Bluesky result']);
  assert.deepEqual(next('Mark Bluesky result'), ['Record result']);
  assert.deepEqual(next('Post to Mastodon'), ['Mark Mastodon result']);
  assert.deepEqual(next('Mark Mastodon result'), ['Record result']);
});

test('Bluesky and Mastodon nodes use the named credentials and never stop the run', () => {
  const session = node('Bluesky session');
  assert.equal(session.parameters.url, 'https://bsky.social/xrpc/com.atproto.server.createSession');
  assert.equal(session.parameters.genericAuthType, 'httpCustomAuth');
  assert.deepEqual(session.credentials, { httpCustomAuth: { name: 'bluesky-app-password' } });
  const post = node('Post to Bluesky').parameters;
  assert.equal(post.url, 'https://bsky.social/xrpc/com.atproto.repo.createRecord');
  assert.equal(node('Post to Bluesky').credentials, undefined, 'authorised by the session token, not a stored credential');
  assert.match(post.headerParameters.parameters[0].value, /accessJwt/);
  assert.match(post.jsonBody, /collection: 'app\.bsky\.feed\.post'.*j\.action === 'post_bluesky'\)\.record/);
  assert.equal(node('End Bluesky session').parameters.url, 'https://bsky.social/xrpc/com.atproto.server.deleteSession');
  const masto = node('Post to Mastodon');
  assert.equal(masto.parameters.url, '={{ $json.url }}', 'the instance comes from MASTODON_INSTANCE_URL, not the export');
  assert.deepEqual(masto.credentials, { httpHeaderAuth: { name: 'mastodon-token' } });
  assert.deepEqual(masto.parameters.headerParameters.parameters, [{ name: 'Idempotency-Key', value: '={{ $json.idempotencyKey }}' }]);
  for (const name of ['Post to LinkedIn', 'Bluesky session', 'Post to Bluesky', 'End Bluesky session', 'Post to Mastodon']) {
    assert.equal(node(name).onError, 'continueRegularOutput', name);
    assert.equal(node(name).parameters.options.response.response.neverError, true, name);
  }
  // A failed reply must not halt the run either (the record is already written by then).
  assert.equal(node('Send message').onError, 'continueRegularOutput');
});

test('workflow names no account: only public API hosts, no DID, no handle', () => {
  const hosts = new Set([...WORKFLOW_TEXT.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()));
  for (const h of hosts) assert.ok(['pearse.dev', 'api.linkedin.com', 'www.linkedin.com', 'bsky.social', 'bsky.app'].includes(h), `unexpected host ${h}`);
  assert.doesNotMatch(WORKFLOW_TEXT, /did:(plc|web):/i, 'DID');
  assert.doesNotMatch(WORKFLOW_TEXT, /[a-z0-9-]+\.bsky\.social/i, 'Bluesky handle');
  assert.doesNotMatch(WORKFLOW_TEXT, /@[a-z0-9_]+@[a-z0-9.-]+/i, 'Mastodon handle');
});

const CROSS_VARS = { BLUESKY_CREDENTIAL: 'bluesky-app-password', MASTODON_CREDENTIAL: 'mastodon-token', MASTODON_INSTANCE_URL: 'https://social.example' };

test('embedded Decide node: with both credentials named, Approve in dry run gives three payloads', () => {
  const vars = { TELEGRAM_CHAT_ID: CHAT, LINKEDIN_AUTHOR_URN: AUTHOR, SCHEDULER_TODAY: '2026-11-03', ...CROSS_VARS };
  const feedRes = { statusCode: 200, body: JSON.stringify(FEED) };
  const tap = { callback_query: { id: 'q1', data: 'approve:today-live', message: { chat: { id: 1000 } } } };
  const out = runNode('Decide', { input: feedRes, upstream: { 'Telegram update': tap }, staticData: {}, vars });
  assert.deepEqual(out.map((o) => [o.action, o.network]), [['ack', undefined], ['dryrun', 'linkedin'], ['dryrun', 'bluesky'], ['dryrun', 'mastodon']]);
  assert.equal(out[2].payload.record.facets[0].features[0].uri, 'https://pearse.dev/writing/today-live/');
});

test('embedded Record result node records Bluesky and Mastodon through the Mark nodes', () => {
  const staticData = {};
  const state = stateFor(staticData, false);
  for (const network of ['bluesky', 'mastodon']) state.record.push({ id: 'p01', network, postedAt: NOW.toISOString(), uri: null, status: 'pending' });
  const decided = [
    { action: 'post_bluesky', network: 'bluesky', chatId: CHAT, id: 'p01', record: {} },
    { action: 'post_mastodon', network: 'mastodon', chatId: CHAT, id: 'p01', url: 'https://social.example/api/v1/statuses', payload: {} },
  ];
  const vars = { TELEGRAM_CHAT_ID: CHAT };
  const tagged = (name, res) => runNode(name, { input: res, staticData, vars })[0];
  // Mark Bluesky result reads Post to Bluesky, not its input (the deleteSession response).
  const created = { statusCode: 200, body: { uri: 'at://did:example:x/app.bsky.feed.post/1' }, headers: {} };
  const bsky = runNode('Mark Bluesky result', { input: { statusCode: 200, body: '' }, upstream: { 'Post to Bluesky': created }, staticData, vars })[0];
  assert.equal(bsky.body.uri, created.body.uri);
  assert.equal(bsky.network, 'bluesky');
  const session = { statusCode: 200, body: {} };
  const b = runNode('Record result', { input: bsky, upstream: { Decide: decided, 'Bluesky session': session }, staticData, vars });
  assert.match(b[0].text, /^Posted p01 to Bluesky/);
  const masto = tagged('Mark Mastodon result', { statusCode: 504, body: 'timeout' });
  const m = runNode('Record result', { input: masto, upstream: { Decide: decided }, staticData, vars });
  assert.match(m[0].text, /Mastodon gave no clear answer/);
  assert.deepEqual(staticData.live.record.map((r) => [r.network, r.status]), [['bluesky', 'posted'], ['mastodon', 'unknown']]);
});

test('embedded Record result node: no Bluesky session output counts as a failed login', () => {
  const staticData = {};
  stateFor(staticData, false).record.push({ id: 'p01', network: 'bluesky', postedAt: NOW.toISOString(), uri: null, status: 'pending' });
  const out = runNode('Record result', {
    input: { statusCode: 401, body: {}, network: 'bluesky' },
    upstream: { Decide: [{ action: 'post_bluesky', network: 'bluesky', chatId: CHAT, id: 'p01', record: {} }] },
    staticData,
    vars: { TELEGRAM_CHAT_ID: CHAT },
  });
  assert.match(out[0].text, /Bluesky login failed for p01 \(no response\)/);
  assert.deepEqual(staticData.live.record, []);
});
