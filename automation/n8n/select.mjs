// Scheduler logic (ADR 0004): which social feed entries to offer for Approval,
// what to post to LinkedIn, Bluesky and Mastodon, and how the Posting record
// changes. Pure and dependency-free so node:test can run it without n8n.
//
// This file is the tested reference for the "Decide" and "Record result" Code
// nodes in social-scheduler.json. Both nodes embed it verbatim with the leading
// `export ` keywords removed, followed by a short n8n-specific shim.
// tests/scheduler.test.mjs fails if an embedded copy drifts: edit here first,
// then paste the change into both nodes (see README.md).

const NETWORK = 'linkedin';
const TIME_ZONE = 'Europe/Vienna';
/**
 * The hour (Europe/Vienna) of the last rule of the Daily schedule node in social-scheduler.json.
 * A `daily` request at or after this hour warns about today's unpublished articles. Keep it equal to the
 * largest hour of that cron: tests/scheduler.test.mjs pins the two together.
 */
export const LAST_DAILY_HOUR = 9;
const CALLBACK_MAX_BYTES = 64; // Telegram's limit for inline button callback_data
const TELEGRAM_MAX_CHARS = 4096; // Telegram's limit for one message
const LINKEDIN_MAX_CHARS = 3000; // ugcPosts shareCommentary limit
export const LINKEDIN_UGC_URL = 'https://api.linkedin.com/v2/ugcPosts';
export const LINKEDIN_HEADERS = { 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
// Cross-posting of the short copy. Each network is optional and has its own Posting record rows;
// `ref` is the row field that holds the network's id for the post.
export const NETWORKS = {
  linkedin: { label: 'LinkedIn', ref: 'postUrn' },
  bluesky: { label: 'Bluesky', ref: 'uri' },
  mastodon: { label: 'Mastodon', ref: 'url' },
};
export const BLUESKY_CREDENTIAL = 'bluesky-app-password';
export const MASTODON_CREDENTIAL = 'mastodon-token';
export const BLUESKY_SESSION_URL = 'https://bsky.social/xrpc/com.atproto.server.createSession';
export const BLUESKY_CREATE_URL = 'https://bsky.social/xrpc/com.atproto.repo.createRecord';
const BLUESKY_MAX_GRAPHEMES = 300; // app.bsky.feed.post text limit
const MASTODON_MAX_CHARS = 500; // Mastodon's default status limit

/** Feed entries from before standalone posts carry no `kind`: they are articles keyed by slug and pubDate. */
export function normaliseEntry(entry) {
  const kind = entry.kind ?? 'article';
  return { ...entry, kind, id: entry.id ?? entry.slug, date: entry.date ?? entry.pubDate };
}

/** An article may be posted once its page is live; a standalone post once it is approved. */
export function isEligible(entry) {
  const e = normaliseEntry(entry);
  if (e.kind === 'article') {
    return e.published === true && typeof e.url === 'string' && e.url !== '' && (e.status ?? 'approved') === 'approved';
  }
  if (e.kind === 'standalone') return e.status === 'approved';
  return false;
}

/** Rows written before cross-posting carry no `network`: they are LinkedIn rows. */
export function rowNetwork(row) {
  return row.network ?? NETWORK;
}

/** The item's row for `network`, or, without `network`, its first row on any network. */
export function recordFor(record, id, network) {
  return (record ?? []).find((r) => r.id === id && (network === undefined || rowNetwork(r) === network));
}

function refOf(row) {
  return row[(NETWORKS[rowNetwork(row)] ?? NETWORKS[NETWORK]).ref] ?? null;
}

/** Entries dated `isoDate` that may be posted and have no Posting record row yet. */
export function selectForDay(feed, isoDate, record) {
  const seen = new Set((record ?? []).map((r) => r.id));
  return (feed ?? []).map(normaliseEntry).filter((e) => e.date === isoDate && isEligible(e) && !seen.has(e.id));
}

/** What a run offers: the day's selection minus anything already offered, so a second run is a no-op. */
export function selectToOffer(feed, isoDate, state) {
  const offered = state.offered ?? {};
  return selectForDay(feed, isoDate, state.record).filter((e) => !Object.hasOwn(offered, e.id));
}

/**
 * Re-checks an entry at Approve time against the live feed: it must still be eligible, not skipped, and
 * have at least one of `networks` without a Posting record row. Returns the entry and those networks.
 */
export function findForPosting(feed, id, isoDate, record, networks = [NETWORK]) {
  const entry = (feed ?? []).map(normaliseEntry).find((e) => e.id === id);
  if (!entry) return { error: `${id} is not in the social feed.` };
  const rows = (record ?? []).filter((r) => r.id === id);
  const open = networks.filter((n) => !rows.some((r) => rowNetwork(r) === n));
  const skipped = rows.find((r) => r.status === 'skipped');
  if (skipped || open.length === 0) {
    const row = skipped ?? rows.find((r) => rowNetwork(r) === NETWORK) ?? rows[0];
    return { error: `${id} is already ${row.status} (${row.postedAt}).` };
  }
  if (!isEligible(entry)) {
    return { error: entry.kind === 'article' ? `${id} is not published yet; it cannot be linked.` : `${id} is not approved.` };
  }
  if (entry.date > isoDate) return { error: `${id} is dated ${entry.date}, after ${isoDate}.` };
  return { entry, networks: open };
}

/** The ugcPosts body: an article share with the page URL, or a text-only standalone post. */
export function buildLinkedInPayload(entry, authorUrn) {
  const e = normaliseEntry(entry);
  if (!/^urn:li:person:[A-Za-z0-9_-]+$/.test(authorUrn ?? '')) {
    throw new Error('LINKEDIN_AUTHOR_URN must be set and look like urn:li:person:<id>.');
  }
  const text = (e.social?.linkedin ?? '').trim();
  if (!text) throw new Error(`${e.id} has no LinkedIn copy.`);
  if (text.length > LINKEDIN_MAX_CHARS) {
    throw new Error(`${e.id}: LinkedIn copy is ${text.length} characters, over LinkedIn's ${LINKEDIN_MAX_CHARS}; shorten it in the repository.`);
  }
  let share;
  if (e.kind === 'article') {
    if (e.published !== true || !e.url) throw new Error(`${e.id} is not published; refusing to link it.`);
    share = {
      shareCommentary: { text },
      shareMediaCategory: 'ARTICLE',
      media: [{ status: 'READY', originalUrl: e.url, title: { text: e.title } }],
    };
  } else if (e.kind === 'standalone') {
    share = { shareCommentary: { text }, shareMediaCategory: 'NONE' };
  } else {
    throw new Error(`${e.id} has unknown kind ${e.kind}.`);
  }
  return {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: { 'com.linkedin.ugc.ShareContent': share },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
}

function utf8Bytes(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** User-perceived characters. Without Intl.Segmenter, code points: never fewer than graphemes, so still safe. */
function graphemes(s) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  }
  return Array.from(s);
}

/** `text` cut to `max` graphemes, ending in an ellipsis when cut. */
function clip(text, max) {
  const g = graphemes(text);
  if (g.length <= max) return text;
  if (max < 1) return '';
  return g.slice(0, max - 1).join('').trimEnd() + '…';
}

// After the URL: optional closing punctuation, then whitespace or the end. Anything else (a path, a query,
// a fragment) means the text holds a longer URL that merely starts with this one.
const URL_END = /^[.,;:!?)\]}>'"\u2019\u201d\u2026]*(?:\s|$)/;

/** String offsets of each occurrence of `url` in `text` that ends on a URL boundary. */
function indexesOf(text, url) {
  const at = [];
  for (let i = text.indexOf(url); i !== -1; i = text.indexOf(url, i + url.length)) {
    if (URL_END.test(text.slice(i + url.length))) at.push(i);
  }
  return at;
}

/** `text` with the URL removed at the offsets `at`, the remaining pieces joined by single spaces. */
function withoutAt(text, at, len) {
  const pieces = [];
  let from = 0;
  for (const i of at) {
    pieces.push(text.slice(from, i));
    from = i + len;
  }
  pieces.push(text.slice(from));
  return pieces.map((s) => s.trim()).filter(Boolean).join(' ');
}

/**
 * The short copy with the article URL, within `max` graphemes. Short copy that already contains the URL
 * is posted as written when it fits; otherwise the URL goes on its own line after the copy. When over the
 * limit the copy is cut with an ellipsis, never the URL. `at` holds the URL's string offsets in `text`.
 */
export function composeShort(short, url, max) {
  const copy = String(short ?? '').trim();
  if (!url) return { text: clip(copy, max), at: [] };
  let body = copy;
  const found = indexesOf(body, url);
  if (found.length) {
    if (graphemes(body).length <= max) return { text: body, at: found };
    body = withoutAt(body, found, url.length);
  }
  const tail = `\n\n${url}`;
  const room = max - graphemes(tail).length;
  if (graphemes(url).length > max) throw new Error(`the URL alone is over the ${max}-character limit.`);
  const head = room >= 1 ? clip(body, room) : '';
  const text = head ? head + tail : url;
  return { text, at: [text.length - url.length] };
}

/** The URL a post links to: the article page, or none for a standalone post. */
function linkFor(e) {
  if (e.kind === 'article') {
    if (e.published !== true || !e.url) throw new Error(`${e.id} is not published; refusing to link it.`);
    return e.url;
  }
  if (e.kind === 'standalone') return null;
  throw new Error(`${e.id} has unknown kind ${e.kind}.`);
}

function shortCopy(e) {
  const text = String(e.social?.short ?? '').trim();
  if (!text) throw new Error(`${e.id} has no short copy.`);
  return text;
}

/**
 * The app.bsky.feed.post record for createRecord. An article gets a link facet over every occurrence
 * of its URL, on UTF-8 byte offsets as the AT Protocol requires; a standalone post is text only.
 */
export function buildBlueskyRecord(entry, now) {
  const e = normaliseEntry(entry);
  const url = linkFor(e);
  const { text, at } = composeShort(shortCopy(e), url, BLUESKY_MAX_GRAPHEMES);
  const record = { $type: 'app.bsky.feed.post', text, createdAt: now.toISOString() };
  if (url) {
    record.facets = at.map((i) => {
      const byteStart = utf8Bytes(text.slice(0, i));
      return {
        index: { byteStart, byteEnd: byteStart + utf8Bytes(url) },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      };
    });
  }
  return record;
}

/** The POST /api/v1/statuses body: the short copy (with the article URL), public. */
export function buildMastodonStatus(entry) {
  const e = normaliseEntry(entry);
  return { status: composeShort(shortCopy(e), linkFor(e), MASTODON_MAX_CHARS).text, visibility: 'public' };
}

/** Stable per item and network, so a retried request is answered with the first post, not a second one. */
export function idempotencyKey(id, network) {
  return `pearse.dev:${network}:${id}`;
}

/** Inline button data `approve:<id>` / `skip:<id>`; throws past Telegram's 64-byte limit. */
export function callbackData(action, id) {
  const data = `${action}:${id}`;
  if (utf8Bytes(data) > CALLBACK_MAX_BYTES) throw new Error(`callback data for ${id} exceeds ${CALLBACK_MAX_BYTES} bytes; shorten the id.`);
  return data;
}

export function parseCallback(data) {
  const m = /^(approve|skip):(.+)$/.exec(String(data ?? ''));
  return m ? { mode: m[1], id: m[2] } : null;
}

/** `/run`, `/reoffer <id>`, `/help`; `@botname` suffixes allowed. Plain text is ignored. */
export function parseCommand(text) {
  const m = /^\/([a-z]+)(?:@\S+)?(?:\s+(\S+))?\s*$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  if (cmd === 'run') return { mode: 'run' };
  if (cmd === 'reoffer' && m[2]) return { mode: 'reoffer', id: m[2] };
  return { mode: 'help' };
}

/**
 * A Telegram update from the configured private chat (and, when `userId` is set, from that user)
 * as a request; anything else is null (ignored). Group chats are never heard.
 */
export function routeUpdate(update, chatId, userId) {
  const q = update.callback_query;
  const msg = q ? q.message : update.message;
  const from = q ? q.from : update.message?.from;
  if (!msg || String(msg.chat?.id) !== String(chatId)) return null;
  if (msg.chat?.type !== undefined && msg.chat.type !== 'private') return null;
  if (userId && String(from?.id) !== String(userId)) return null;
  if (q) {
    const cb = parseCallback(q.data);
    return cb ? { ...cb, queryId: q.id } : null;
  }
  return parseCommand(msg.text);
}

export function dateIn(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The hour (0 to 23) of `date` in `timeZone`. `hourCycle: 'h23'` never yields 24 at midnight, unlike `hour12: false`. */
export function hourIn(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour').value);
}

/**
 * Settings from n8n variables or environment variables, through `get(name)`.
 * DRY_RUN defaults to true: only the exact value `false` posts for real.
 * SCHEDULER_TODAY (YYYY-MM-DD) pretends today is another date, in dry runs only.
 */
export function readConfig(get, now = new Date()) {
  const val = (name) => String(get(name) ?? '').trim();
  const dryRun = val('DRY_RUN').toLowerCase() !== 'false';
  const chatId = val('TELEGRAM_CHAT_ID');
  if (!/^\d+$/.test(chatId)) {
    throw new Error('TELEGRAM_CHAT_ID must be set to the private chat id (digits only): add it as an n8n variable or environment variable.');
  }
  const userId = val('TELEGRAM_USER_ID');
  if (userId && !/^\d+$/.test(userId)) throw new Error('TELEGRAM_USER_ID must be digits only when set.');
  const override = val('SCHEDULER_TODAY');
  const today = dryRun && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : dateIn(TIME_ZONE, now);
  return {
    dryRun,
    chatId,
    userId,
    authorUrn: val('LINKEDIN_AUTHOR_URN'),
    today,
    bluesky: crosspostSetting(val, 'Bluesky', 'BLUESKY_CREDENTIAL', BLUESKY_CREDENTIAL),
    mastodon: crosspostSetting(val, 'Mastodon', 'MASTODON_CREDENTIAL', MASTODON_CREDENTIAL, 'MASTODON_INSTANCE_URL'),
  };
}

/**
 * A cross-post network is on when its variable names the credential the workflow's node uses (and, for
 * Mastodon, the instance is set). Anything else turns it off with a reason; it never fails the run,
 * so a cross-post setting can never block LinkedIn.
 */
function crosspostSetting(val, label, variable, credential, instanceVariable) {
  const name = val(variable);
  if (!name) return { enabled: false, reason: `no ${label} credential (${variable} is unset)` };
  if (name !== credential) {
    return { enabled: false, reason: `${variable} must be ${credential}, the credential name the ${label} node uses` };
  }
  if (!instanceVariable) return { enabled: true };
  const instance = val(instanceVariable).replace(/\/+$/, '');
  if (!instance) return { enabled: false, reason: `no ${label} instance (${instanceVariable} is unset)` };
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(instance)) {
    return { enabled: false, reason: `${instanceVariable} must look like https://<host>, with no path` };
  }
  return { enabled: true, instance };
}

/** LinkedIn always, plus each cross-post network that is on; the others with the reason they are off. */
export function networksFor(config) {
  const networks = [NETWORK];
  const skipped = [];
  for (const network of ['bluesky', 'mastodon']) {
    const setting = config[network];
    if (setting?.enabled) networks.push(network);
    else skipped.push({ network, reason: setting?.reason ?? `no ${NETWORKS[network].label} credential` });
  }
  return { networks, skipped };
}

/** Dry runs keep their own record and offers, so they never block or fake a live post. */
export function stateFor(staticData, dryRun) {
  const key = dryRun ? 'dryRun' : 'live';
  if (!staticData[key] || typeof staticData[key] !== 'object') staticData[key] = {};
  const s = staticData[key];
  if (!Array.isArray(s.record)) s.record = [];
  if (!s.offered || typeof s.offered !== 'object') s.offered = {};
  return s;
}

/** One Posting record row. The id of the post sits under the network's field: postUrn, uri or url. */
export function recordEntry(id, status, ref, now, network = NETWORK) {
  return { id, network, postedAt: now.toISOString(), [NETWORKS[network].ref]: ref ?? null, status };
}

function truncate(text, max) {
  const note = '\n… (truncated here; the full copy is what gets posted)';
  return text.length <= max ? text : text.slice(0, max - note.length) + note;
}

export function offerText(entry, dryRun, networks = [NETWORK]) {
  const e = normaliseEntry(entry);
  const lines = [
    `${dryRun ? 'DRY RUN: ' : ''}Approve this post for ${e.date}?`,
    `${e.kind === 'article' ? 'Article' : 'Standalone post'} ${e.id}: ${e.title}`,
    `Posts to: ${networks.map((n) => NETWORKS[n].label).join(', ')}`,
  ];
  if (e.url) lines.push(e.url);
  if (e.pillar) lines.push(`Pillar: ${e.pillar}`);
  lines.push('', e.social?.linkedin ?? '', '', `Short copy: ${e.social?.short ?? ''}`);
  return truncate(lines.join('\n'), TELEGRAM_MAX_CHARS);
}

const HELP = 'Commands: /run offers today\'s posts that were not offered yet. /reoffer <id> offers one item again (skipped, unknown, or offered and not answered).';

/**
 * One run of the Scheduler. `request.mode` is daily | run | reoffer | approve | skip | help.
 * Mutates `state` ({ record, offered }) and returns the actions for the workflow to carry out:
 * ack (answer the button), offer (prompt with Approve / Skip), notify (plain message),
 * dryrun (log the payload and report it, one per network), post (call LinkedIn), post_bluesky
 * (createSession, then createRecord), post_mastodon (POST /api/v1/statuses).
 */
export function decide({ request, config, feed, feedError, state, now }) {
  const out = [];
  const chatId = config.chatId;
  const say = (text) => truncate(`${config.dryRun ? 'DRY RUN: ' : ''}${text}`, TELEGRAM_MAX_CHARS);
  const notify = (text) => out.push({ action: 'notify', chatId, text: say(text) });
  // Everything that can throw runs before the item is marked offered; a failure is reported, not thrown,
  // so one bad entry never blocks its siblings.
  const offer = (e) => {
    try {
      // Only the networks without a row: after /reoffer, a network that already posted is not offered again.
      const networks = networksFor(config).networks.filter((n) => !recordFor(state.record, e.id, n));
      if (networks.includes(NETWORK)) buildLinkedInPayload(e, config.authorUrn);
      const item = {
        action: 'offer',
        chatId,
        id: e.id,
        text: offerText(e, config.dryRun, networks),
        approveData: callbackData('approve', e.id),
        skipData: callbackData('skip', e.id),
      };
      out.push(item);
      state.offered[e.id] = now.toISOString();
    } catch (err) {
      notify(`Cannot offer ${e.id}: ${err.message}`);
    }
  };
  if (request.queryId) {
    const ack = request.mode === 'skip' ? 'Skipping' : config.dryRun ? 'Dry run' : 'Posting';
    out.push({ action: 'ack', queryId: request.queryId, text: ack });
  }
  if (request.mode === 'help') {
    notify(HELP);
    return out;
  }
  if (feedError) {
    notify(`Could not read the social feed: ${feedError}`);
    return out;
  }
  try {
    run({ request, config, feed, state, now, notify, offer, say, out });
  } catch (err) {
    notify(`Scheduler error: ${err.message}`);
  }
  return out;
}

function run({ request, config, feed, state, now, notify, offer, say, out }) {
  const chatId = config.chatId;
  const id = request.id;
  if (request.mode === 'daily' || request.mode === 'run') {
    const entries = selectToOffer(feed, config.today, state);
    entries.forEach(offer);
    if (entries.length === 0 && request.mode === 'run') notify(`Nothing new to offer for ${config.today}.`);
    if (request.mode === 'daily' && hourIn(TIME_ZONE, now) >= LAST_DAILY_HOUR) unpublishedToday(feed, config.today).forEach((e) => notify(unpublishedWarning(e)));
  } else if (request.mode === 'reoffer') {
    // Live: `posted` rows stay, so only the networks that did not post are offered again; an item
    // posted on every network is refused. A dry run starts the item over.
    const { networks } = networksFor(config);
    const posted = config.dryRun ? [] : state.record.filter((r) => r.id === id && r.status === 'posted');
    if (posted.length && networks.every((n) => posted.some((r) => rowNetwork(r) === n))) {
      const row = posted.find((r) => rowNetwork(r) === NETWORK) ?? posted[0];
      notify(`${id} was posted ${row.postedAt} (${refOf(row)}); it is not offered again.`);
      return;
    }
    const found = findForPosting(feed, id, config.today, state.record.filter((r) => r.id !== id));
    if (found.error) {
      notify(found.error);
      return;
    }
    state.record = state.record.filter((r) => r.id !== id).concat(posted);
    delete state.offered[id];
    offer(found.entry);
  } else if (request.mode === 'skip') {
    if (!(feed ?? []).some((e) => normaliseEntry(e).id === id)) {
      notify(`${id} is not in the social feed; nothing recorded.`);
      return;
    }
    const row = recordFor(state.record, id);
    if (row) {
      notify(`${id} is already ${row.status}.`);
      return;
    }
    state.record.push(recordEntry(id, 'skipped', null, now));
    notify(`Skipped ${id}. It will not be offered again; /reoffer ${id} brings it back.`);
  } else if (request.mode === 'approve') {
    const { networks, skipped } = networksFor(config);
    const found = findForPosting(feed, id, config.today, state.record, networks);
    if (found.error) {
      notify(found.error);
      return;
    }
    // Each network on its own: one that cannot be built is reported and the others still post.
    const failed = [];
    for (const network of found.networks) {
      let post;
      try {
        post = postFor(network, found.entry, config, now);
      } catch (err) {
        failed.push(network === NETWORK ? err.message : `${NETWORKS[network].label} not posted: ${err.message}`);
        continue;
      }
      if (config.dryRun) {
        state.record.push(recordEntry(id, 'posted', null, now, network));
        out.push({ action: 'dryrun', network, chatId, id, payload: post.payload, text: say(dryRunText(post)) });
      } else {
        // A pending row before the call: a second tap is refused by findForPosting, and a call that
        // never answers leaves a visible row instead of an invitation to post again.
        state.record.push(recordEntry(id, 'pending', null, now, network));
        out.push({ action: post.action, network, chatId, id, ...post.fields, payload: post.payload });
      }
    }
    const notes = failed.concat(skipped.map((s) => `skipped: ${s.reason}`));
    if (notes.length) notify(`${id}: ${notes.join('\n')}`);
  }
}

/** The action that posts `entry` to one network: the Route action output it takes and its request. */
function postFor(network, entry, config, now) {
  if (network === NETWORK) {
    return { action: 'post', url: LINKEDIN_UGC_URL, headers: LINKEDIN_HEADERS, payload: buildLinkedInPayload(entry, config.authorUrn), fields: {} };
  }
  if (network === 'bluesky') {
    const record = buildBlueskyRecord(entry, now);
    return {
      action: 'post_bluesky',
      url: BLUESKY_CREATE_URL,
      before: `POST ${BLUESKY_SESSION_URL} with the ${BLUESKY_CREDENTIAL} credential, then`,
      headers: { Authorization: 'Bearer <accessJwt of that session>', 'Content-Type': 'application/json' },
      payload: { repo: '<did of that session>', collection: 'app.bsky.feed.post', record },
      fields: { record },
    };
  }
  if (network === 'mastodon') {
    const url = `${config.mastodon.instance}/api/v1/statuses`;
    const key = idempotencyKey(normaliseEntry(entry).id, network);
    return {
      action: 'post_mastodon',
      url,
      headers: { Authorization: `<${MASTODON_CREDENTIAL} credential>`, 'Idempotency-Key': key, 'Content-Type': 'application/json' },
      payload: buildMastodonStatus(entry),
      fields: { url, idempotencyKey: key },
    };
  }
  throw new Error(`unknown network ${network}`);
}

function dryRunText(post) {
  const headers = Object.entries(post.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `would ${post.before ? `${post.before}\n` : ''}POST ${post.url}\n${headers}\n\n${JSON.stringify(post.payload, null, 2)}`;
}

/**
 * Articles dated `isoDate` that are not live: the daily rebuild did not publish them. Reads only kind, id,
 * date and published, so it works on the stub a scheduled article becomes (#111). Standalone posts are not
 * a pipeline failure and never count.
 */
function unpublishedToday(feed, isoDate) {
  return (feed ?? []).map(normaliseEntry).filter((e) => e.kind === 'article' && e.date === isoDate && e.published !== true);
}

/** A notify only (ADR 0004): nothing is offered, marked offered, recorded or posted. */
function unpublishedWarning(e) {
  return `Article ${e.id} (${e.date}) is still unpublished at the last daily run. Check the Deploy to GitHub Pages workflow. Once it is live, /reoffer ${e.id} offers it.`;
}

/** The Fetch social feed node's output (full response, text format) as { feed } or { feedError }. */
export function parseFeedResponse(res) {
  if (res.error) return { feedError: String(res.error.message ?? res.error) };
  const code = Number(res.statusCode ?? 200);
  if (code < 200 || code >= 300) return { feedError: `HTTP ${code}` };
  let raw = res.body ?? res.data ?? res.feed;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'feed' in raw) raw = raw.feed;
  try {
    const feed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(feed)) throw new Error('the feed is not a JSON array');
    return { feed };
  } catch (err) {
    return { feedError: err.message };
  }
}

function parseBody(body) {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * After one network's call; only that network's row for `id` changes. 2xx: the pending row becomes
 * `posted`. 4xx: the network refused it, so the pending row is dropped and Approve may be tapped again
 * (it posts only to networks without a row). No status, a network error or 5xx: the post may have gone
 * out, so the row becomes `unknown` and nothing invites a blind retry. For Bluesky, `session` is the
 * createSession response: if the login failed, createRecord cannot have posted.
 */
export function recordPostResult({ state, id, chatId, response, now, network = NETWORK, session }) {
  const label = NETWORKS[network].label;
  const status = Number(response.statusCode ?? 0);
  const body = parseBody(response.body);
  const others = state.record.filter((r) => !(r.id === id && r.status === 'pending' && rowNetwork(r) === network));
  const detail = (res, parsed) => (res.error ? String(res.error.message ?? res.error) : typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? null)).slice(0, 500);
  const notify = (text) => ({ action: 'notify', chatId, network, text });
  const sessionStatus = session ? Number(session.statusCode ?? 0) : 200;
  if (sessionStatus < 200 || sessionStatus >= 300) {
    state.record = others;
    return notify(
      `${label} login failed for ${id} (${sessionStatus ? `HTTP ${sessionStatus}` : 'no response'}); nothing was posted to ${label} or recorded. Check the ${BLUESKY_CREDENTIAL} credential, then tap Approve again.\n${detail(session, parseBody(session.body))}`,
    );
  }
  if (status >= 200 && status < 300) {
    const ref = postRef(network, body, response.headers ?? {});
    state.record = others;
    if (!recordFor(state.record, id, network)) state.record.push(recordEntry(id, 'posted', ref, now, network));
    const link = postLink(network, ref);
    return notify(`Posted ${id} to ${label}: ${ref ?? '(no id returned)'}${link ? `\n${link}` : ''}`);
  }
  if (status >= 400 && status < 500) {
    state.record = others;
    return notify(`${label} refused ${id} with HTTP ${status}; nothing was posted or recorded. Fix the cause, then tap Approve again.\n${detail(response, body)}`);
  }
  state.record = others;
  state.record.push(recordEntry(id, 'unknown', null, now, network));
  return notify(
    `${label} gave no clear answer for ${id} (${status ? `HTTP ${status}` : 'no response'}); it may have been posted. Recorded as unknown: check ${label} before doing anything. Only if it is not there, /reoffer ${id}.\n${detail(response, body)}`,
  );
}

/** The post's id in a 2xx response: LinkedIn's URN, Bluesky's at:// URI, Mastodon's status URL. */
function postRef(network, body, headers) {
  const b = body && typeof body === 'object' ? body : {};
  if (network === 'bluesky') return b.uri || null;
  if (network === 'mastodon') return b.url || b.uri || null;
  return b.id || headers['x-restli-id'] || null;
}

function postLink(network, ref) {
  if (!ref) return '';
  if (network === 'bluesky') {
    const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(ref);
    return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : '';
  }
  if (network === 'mastodon') return '';
  return `https://www.linkedin.com/feed/update/${ref}/`;
}
