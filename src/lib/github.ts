/**
 * Build-time GitHub integration for the home page (issue #45).
 *
 * Fetches the public profile, the allowlisted public repositories (REST) and,
 * when a token is present, the last year's contribution calendar (GraphQL), and shapes
 * them into a small view model. A shaped snapshot is committed at src/data/github.json:
 * when the network or the token is unavailable the build uses it and logs a warning, and
 * every successful fetch rewrites it. A live fetch also refreshes the committed avatar at
 * AVATAR_PATH (issue #115). Only `node:` imports plus sharp, no `astro:*`, so node:test
 * loads this file with type stripping (tests/github.test.mjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

export const GITHUB_LOGIN = 'pearsedarcy';
export const REPO_COUNT = 6;
/**
 * The repo cards are an allowlist (issue #109): a public repo owned by GITHUB_LOGIN becomes
 * a card only if its name is on one of these hand-kept lists, so a repo made public later
 * never appears unreviewed. Featured repos come first, in this order; the fork flag does not
 * matter for a listed name (the site's own repo is a fork of a template). Every name here
 * needs an entry in DESCRIPTION_OVERRIDES or DESCRIPTION_FALLBACKS.
 */
export const FEATURED_REPOS: readonly string[] = ['pearse.dev'];
/** Shown after the featured repos, by last-push day newest first; this order breaks ties. */
export const SHOWN_REPOS: readonly string[] = [
  'my-blog',
  'django-store',
  'chatterbox-1',
  'skatehills-flask',
  'forum-migration',
  'django-blog',
];
/**
 * Descriptions for repos that have none on GitHub (issue #72), keyed by lower-case name.
 * GitHub's own description wins whenever it is set.
 */
export const DESCRIPTION_FALLBACKS: Readonly<Record<string, string>> = {
  'django-blog': 'An early Django blog project.',
  'forum-migration': 'A Python tool for migrating data between XenForo forum platforms.',
};
/**
 * Descriptions that replace GitHub's own (issue #78), keyed by lower-case name: the
 * upstream text is ungrammatical or inconsistently capitalised, and the site shows its
 * own copy whatever GitHub says. Overrides win over GitHub, GitHub over the fallbacks.
 */
export const DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  'pearse.dev': 'The source of this site, built with Astro and deployed to GitHub Pages.',
  'my-blog': 'A blog built with Django, styled with Tailwind and DaisyUI.',
  'django-store': 'My first Django e-commerce project.',
  'chatterbox-1': 'My first chatbot, built with Ollama and Django.',
  'skatehills-flask': 'SkateHills, my first Flask application.',
};
/** The profile card's bio, in the site's wording rather than GitHub's (issue #78). */
export const PROFILE_BIO = 'Software engineer in Innsbruck.';
export const SNAPSHOT_PATH = 'src/data/github.json';
/**
 * The self-hosted avatar (issue #115). The committed file is the source of truth and the card
 * renders it through astro:assets; a live build only refreshes it for the next build, because
 * Astro resolves the static import before any page frontmatter calls getGithub().
 */
export const AVATAR_PATH = 'src/assets/github-avatar.jpg';
/** Largest avatar download accepted, in bytes. */
export const AVATAR_MAX_BYTES = 256 * 1024;
/** Edge of the committed square avatar: 80px card at 2x. */
export const AVATAR_SIZE = 160;
/** Fixed so the encode is deterministic; low enough that the 160px variants stay under 6 KB. */
export const AVATAR_JPEG_QUALITY = 60;
/** Under the profile stats: says where the work lives, not what the numbers include. */
export const PROFILE_STATS_CAPTION = 'Most of my work is in private repositories.';

const API = 'https://api.github.com';
const WEB = 'https://github.com';
const AVATAR_HOST = 'avatars.githubusercontent.com';

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface GithubRepo {
  name: string;
  /** Always https://github.com/<owner>/<name>. */
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  /** Last push, YYYY-MM-DD (UTC). */
  pushed: string;
}

export type Level = 0 | 1 | 2 | 3 | 4;

export interface GithubDay {
  /** YYYY-MM-DD (UTC). */
  date: string;
  count: number;
  level: Level;
}

export interface GithubCalendar {
  total: number;
  /** Sunday-first weeks, oldest first; the first and last week may be partial. */
  weeks: GithubDay[][];
}

export interface GithubView {
  login: string;
  name: string;
  /** Always https://github.com/<login>. */
  url: string;
  /** avatars.githubusercontent.com URL: the refresh source for the committed avatar, never rendered. */
  avatarUrl: string | null;
  bio: string | null;
  publicRepos: number;
  repos: GithubRepo[];
  calendar: GithubCalendar | null;
  /** Day the data was fetched, YYYY-MM-DD (UTC). */
  asOf: string;
}

// ---------------------------------------------------------------------------
// Raw API shapes (only the fields used)
// ---------------------------------------------------------------------------

export interface RawUser {
  login: string;
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  public_repos?: number;
}

export interface RawRepo {
  name: string;
  private: boolean;
  fork: boolean;
  owner: { login: string };
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  pushed_at?: string | null;
}

export interface RawCalendar {
  totalContributions: number;
  weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] }[];
}

// ---------------------------------------------------------------------------
// Shaping (pure)
// ---------------------------------------------------------------------------

const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const clean = (s: string | null | undefined) => (s ?? '').trim() || null;

/** Straight apostrophes inside a word become typographic ones: D'Arcy -> D’Arcy. */
export const curlyApostrophes = (s: string) => s.replace(/(\p{L})'(\p{L})/gu, '$1’$2');

/** The description a repo card shows: override, else GitHub's, else the fallback, else null. */
export function describeRepo(name: string, upstream: string | null | undefined): string | null {
  const key = name.toLowerCase();
  return DESCRIPTION_OVERRIDES[key] ?? clean(upstream) ?? DESCRIPTION_FALLBACKS[key] ?? null;
}

/**
 * Applies the site's copy (repo descriptions, bio, typographic name) to a view. Idempotent,
 * so it runs on fresh data and on the committed snapshot alike.
 */
export function applySiteCopy(view: GithubView): GithubView {
  return {
    ...view,
    name: curlyApostrophes(view.name),
    bio: PROFILE_BIO,
    repos: view.repos.map((r) => ({ ...r, description: describeRepo(r.name, r.description) })),
  };
}

/** Only avatars served by GitHub, resized for an 80px card at 2x. */
export function shapeAvatar(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.hostname !== AVATAR_HOST) return null;
    u.searchParams.set('s', '160');
    return u.toString();
  } catch {
    return null;
  }
}

const FEATURED_RANK = new Map(FEATURED_REPOS.map((n, i) => [n.toLowerCase(), i]));
const SHOWN_RANK = new Map(SHOWN_REPOS.map((n, i) => [n.toLowerCase(), i]));

/** Whether a repo name is on the featured or the shown list (case-insensitive, like GitHub). */
export const isListedRepo = (name: string) => FEATURED_RANK.has(name.toLowerCase()) || SHOWN_RANK.has(name.toLowerCase());

/**
 * Drops unlisted names and orders the rest: featured repos in featured-list order, then
 * shown repos by last-push day (YYYY-MM-DD) newest first, equal days in shown-list order;
 * at most `limit`. Sorting by day, not timestamp, because the snapshot stores only the day
 * and live and snapshot must agree. Idempotent.
 */
export function orderRepos<T extends { name: string; pushed: string }>(repos: T[], limit = REPO_COUNT): T[] {
  const rank = (r: T): [number, string, number] => {
    const key = r.name.toLowerCase();
    const f = FEATURED_RANK.get(key);
    return f !== undefined ? [0, '', f] : [1, r.pushed, SHOWN_RANK.get(key)!];
  };
  return repos
    .filter((r) => isListedRepo(r.name))
    .map((r) => ({ r, k: rank(r) }))
    .sort((a, b) => a.k[0] - b.k[0] || (a.k[1] === b.k[1] ? 0 : a.k[1] < b.k[1] ? 1 : -1) || a.k[2] - b.k[2])
    .slice(0, limit)
    .map(({ r }) => r);
}

/** Public repos owned by `login` itself (never org repos), whatever the fork flag. */
const ownPublic = (raw: RawRepo[], login: string) => {
  const me = login.toLowerCase();
  return raw.filter((r) => !r.private && r.owner?.login?.toLowerCase() === me);
};

/** Public, self-owned repos left out because they are on neither list (logged by loadGithub). */
export function skippedRepos(raw: RawRepo[], login = GITHUB_LOGIN): string[] {
  return ownPublic(raw, login)
    .filter((r) => !isListedRepo(r.name))
    .map((r) => r.name);
}

/** The repo cards: listed, public repos owned by `login`, ordered by orderRepos. */
export function shapeRepos(raw: RawRepo[], login = GITHUB_LOGIN, limit = REPO_COUNT): GithubRepo[] {
  const shaped = ownPublic(raw, login)
    .filter((r) => r.pushed_at && isListedRepo(r.name))
    .map((r) => ({
      name: r.name,
      url: `${WEB}/${login}/${r.name}`,
      description: describeRepo(r.name, r.description),
      language: clean(r.language),
      stars: r.stargazers_count ?? 0,
      pushed: day(r.pushed_at!),
    }));
  return orderRepos(shaped, limit);
}

/**
 * The repo rule applied to a stored view (the committed snapshot): drops repos that are
 * unlisted or not at github.com/<login>/<name>, re-orders and caps them, re-checks the avatar
 * host, and drops keys the view model no longer has (`followers`). Idempotent.
 */
export function filterSnapshot(view: GithubView): GithubView {
  const rest: GithubView & { followers?: unknown } = { ...view };
  delete rest.followers;
  const own = (r: GithubRepo) => r.url?.toLowerCase() === `${WEB}/${view.login}/${r.name}`.toLowerCase();
  return {
    ...rest,
    avatarUrl: shapeAvatar(view.avatarUrl),
    repos: orderRepos(view.repos.filter(own)),
  };
}

export interface ProfileStat {
  label: string;
  value: string;
}

/**
 * The profile card's stats: public repos and, only when the calendar exists, last year's
 * contributions, formatted like the heatmap caption. Never a 0 or a placeholder.
 */
export function profileStats(view: Pick<GithubView, 'publicRepos' | 'calendar'>): { stats: ProfileStat[]; caption: string } {
  const stats: ProfileStat[] = [{ label: 'Public repos', value: view.publicRepos.toLocaleString('en-GB') }];
  if (view.calendar) stats.push({ label: 'Contributions (last year)', value: view.calendar.total.toLocaleString('en-GB') });
  return { stats, caption: PROFILE_STATS_CAPTION };
}

const LEVELS: Record<string, Level> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export function shapeCalendar(raw: RawCalendar): GithubCalendar {
  return {
    total: raw.totalContributions,
    weeks: raw.weeks
      .map((w) =>
        w.contributionDays.map((d) => ({
          date: d.date,
          count: d.contributionCount,
          level: LEVELS[d.contributionLevel] ?? (d.contributionCount > 0 ? 1 : 0),
        })),
      )
      .filter((w) => w.length > 0),
  };
}

export function shapeGithub(
  input: { user: RawUser; repos: RawRepo[]; calendar: GithubCalendar | null },
  now = new Date(),
): GithubView {
  const login = input.user.login || GITHUB_LOGIN;
  return applySiteCopy({
    login,
    name: clean(input.user.name) ?? login,
    url: `${WEB}/${login}`,
    avatarUrl: shapeAvatar(input.user.avatar_url),
    bio: clean(input.user.bio),
    publicRepos: input.user.public_repos ?? 0,
    repos: shapeRepos(input.repos, login),
    calendar: input.calendar,
    asOf: now.toISOString().slice(0, 10),
  });
}

// ---------------------------------------------------------------------------
// Fetch with snapshot fallback
// ---------------------------------------------------------------------------

export type Source = 'live' | 'partial' | 'snapshot';

export interface LoadResult {
  view: GithubView;
  /** live: everything fetched; partial: profile and repos fetched, calendar from the snapshot; snapshot: nothing fetched. */
  source: Source;
  /** Why something came from the snapshot, when it did. */
  reason?: string;
}

export interface LoadOptions {
  login?: string;
  /** Enables the contribution calendar (GraphQL needs auth). */
  token?: string;
  /** Skip the network entirely. */
  offline?: boolean;
  snapshotPath?: string;
  /** Where the refreshed avatar is written; tests inject a temp path. */
  avatarPath?: string;
  fetch?: typeof fetch;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
  now?: Date;
  timeoutMs?: number;
}

export function readSnapshot(path: string): GithubView | null {
  try {
    if (!existsSync(path)) return null;
    const v = JSON.parse(readFileSync(path, 'utf8')) as GithubView;
    return v && typeof v.login === 'string' && Array.isArray(v.repos) ? applySiteCopy(filterSnapshot(v)) : null;
  } catch {
    return null;
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Avatar refresh (issue #115)
// ---------------------------------------------------------------------------

/**
 * Decode, apply EXIF orientation, resize to a 160x160 cover square and encode as a
 * non-progressive JPEG at a fixed quality. sharp drops all metadata (EXIF, ICC, XMP) unless
 * asked to keep it, so none of GitHub's metadata reaches the repo. Alpha is flattened onto
 * white because JPEG has none. Deterministic for a given sharp version.
 */
export async function normaliseAvatar(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes, { limitInputPixels: 16_000_000 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .jpeg({ quality: AVATAR_JPEG_QUALITY, progressive: false, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

/** Reads a body up to `max` bytes; throws once it would exceed that. */
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw new Error(`body of ${declared} bytes exceeds ${max}`);
  if (!res.body) throw new Error('no response body');
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error(`body exceeds ${max} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Downloads `avatarUrl`, normalises it and writes `path` only when the normalised bytes differ
 * from what is there. Guards: https on the avatar host, an image/* content type and a size cap.
 * Any failure leaves the file untouched and logs one warning; it never throws.
 */
export async function refreshAvatar(
  avatarUrl: string | null,
  path: string,
  doFetch: typeof fetch,
  io: { log: (m: string) => void; warn: (m: string) => void; timeoutMs: number },
): Promise<'written' | 'unchanged' | 'kept'> {
  try {
    const u = avatarUrl ? new URL(avatarUrl) : null;
    if (!u || u.protocol !== 'https:' || u.hostname !== AVATAR_HOST) throw new Error('not an https URL on the avatar host');
    const res = await doFetch(u.toString(), { redirect: 'error', signal: AbortSignal.timeout(io.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.url && new URL(res.url).hostname !== AVATAR_HOST) throw new Error('response came from another host');
    const type = res.headers.get('content-type') ?? '';
    if (!/^image\//i.test(type)) throw new Error(`content-type ${type || '(none)'} is not image/*`);
    const next = await normaliseAvatar(await readCapped(res, AVATAR_MAX_BYTES));
    if (existsSync(path) && readFileSync(path).equals(next)) return 'unchanged';
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next);
    io.log(`avatar written to ${path} (renders from the next build)`);
    return 'written';
  } catch (e) {
    io.warn(`avatar kept as committed: ${errText(e)}`);
    return 'kept';
  }
}

export async function loadGithub(opts: LoadOptions = {}): Promise<LoadResult> {
  const login = opts.login ?? GITHUB_LOGIN;
  const path = resolve(opts.snapshotPath ?? SNAPSHOT_PATH);
  const doFetch = opts.fetch ?? fetch;
  const log = opts.log ?? ((m: string) => console.log(`[github] ${m}`));
  const warn = opts.warn ?? ((m: string) => console.warn(`[github] ${m}`));
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const snapshot = readSnapshot(path);

  const fromSnapshot = (reason: string): LoadResult => {
    if (!snapshot) throw new Error(`GitHub data unavailable (${reason}) and no snapshot at ${path}`);
    warn(`using snapshot from ${snapshot.asOf}: ${reason}`);
    return { view: snapshot, source: 'snapshot', reason };
  };

  if (opts.offline) return fromSnapshot('fetch disabled');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pearse.dev-build',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const getJson = async (url: string, init: RequestInit = {}) => {
    const res = await doFetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url}: HTTP ${res.status}`);
    return res.json();
  };

  let user: RawUser;
  let repos: RawRepo[];
  try {
    [user, repos] = await Promise.all([
      getJson(`${API}/users/${login}`) as Promise<RawUser>,
      getJson(`${API}/users/${login}/repos?type=owner&sort=pushed&per_page=100`) as Promise<RawRepo[]>,
    ]);
    if (!user?.login || !Array.isArray(repos)) throw new Error('unexpected REST response');
  } catch (e) {
    return fromSnapshot(`network: ${errText(e)}`);
  }

  let calendar: GithubCalendar | null = null;
  let reason: string | undefined;
  if (!opts.token) {
    reason = 'no GITHUB_TOKEN for the contribution calendar';
  } else {
    try {
      const body = await getJson(`${API}/graphql`, {
        method: 'POST',
        body: JSON.stringify({
          query:
            'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}',
          variables: { login },
        }),
      });
      const raw = body?.data?.user?.contributionsCollection?.contributionCalendar as RawCalendar | undefined;
      if (body?.errors?.length || !raw) throw new Error(body?.errors?.[0]?.message ?? 'no calendar in GraphQL response');
      calendar = shapeCalendar(raw);
    } catch (e) {
      reason = `calendar: ${errText(e)}`;
    }
  }

  let source: Source = 'live';
  if (!calendar) {
    source = 'partial';
    calendar = snapshot?.calendar ?? null;
    warn(`contribution calendar from snapshot${snapshot ? ` of ${snapshot.asOf}` : ' (none)'}: ${reason}`);
  }

  const view = shapeGithub({ user, repos, calendar }, opts.now);
  // Names stay out of CI logs: Actions logs on a public repo are public, and an unlisted
  // repo's name can be a client's or a person's.
  const skipped = skippedRepos(repos, login);
  if (skipped.length) {
    log(`skipped ${skipped.length} repos not on the allowlist${process.env.CI === undefined ? `: ${skipped.join(', ')}` : ''}`);
  }
  log(`${source === 'live' ? 'live' : 'live profile and repos'}: ${view.repos.length} repos${source === 'live' ? `, ${view.calendar?.total ?? 0} contributions` : ''}`);

  try {
    const json = `${JSON.stringify(view, null, 2)}\n`;
    if (!existsSync(path) || readFileSync(path, 'utf8') !== json) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, json);
      log(`snapshot written to ${opts.snapshotPath ?? SNAPSHOT_PATH}`);
    }
  } catch (e) {
    warn(`could not write snapshot: ${errText(e)}`);
  }

  await refreshAvatar(view.avatarUrl, resolve(opts.avatarPath ?? AVATAR_PATH), doFetch, { log, warn, timeoutMs });

  return { view, source, reason };
}

let cached: Promise<LoadResult> | undefined;

/**
 * The build's GitHub data, fetched once per build. GITHUB_TOKEN enables the calendar;
 * GITHUB_FETCH=0 forces the snapshot.
 */
export function getGithub(): Promise<LoadResult> {
  cached ??= loadGithub({ token: process.env.GITHUB_TOKEN || undefined, offline: process.env.GITHUB_FETCH === '0' });
  return cached;
}
