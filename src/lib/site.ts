export const SITE = {
  name: 'Pearse D’Arcy',
  url: 'https://pearse.dev',
  title: 'Pearse D’Arcy — software engineer, Innsbruck',
  description:
    'Software engineer in Innsbruck building Django platforms, self-hosted AI with guardrails, and agent-assisted engineering workflows.',
  email: 'pearse@pearse.dev',
  github: 'https://github.com/pearsedarcy',
  linkedin: 'https://www.linkedin.com/in/pearsedarcy',
  repo: 'https://github.com/pearsedarcy/pearse.dev',
  // Optional profile links, shipped unset (#157). Typed `string | null`: under `as const` a bare
  // `null` would be the literal type `null`, so the "set" branch of every check would be `never`.
  /** Full https profile URL on Mastodon. Rendered in the footer with rel="me" when set. */
  mastodon: null as string | null,
  /** Full https profile URL on bsky.app. Rendered in the footer with rel="me" when set. */
  bluesky: null as string | null,
  /** Bluesky DID (`did:plc:…`), served at /.well-known/atproto-did when set. */
  atprotoDid: null as string | null,
  location: 'Innsbruck, Austria',
  ogImage: '/og-default.png',
} as const;

/**
 * The Impressum block (#155). Kept out of `SITE` on purpose: under `as const` an absent key would make
 * `SITE.legal` a type error. Every heading and paragraph on the page comes from here; the page has no
 * wording of its own. There is no email field: the page shows `SITE.email`, like the footer and the
 * home contact block. `legalState()` in `src/lib/legal.ts` classifies it, and only a complete block
 * builds `/impressum/` and its footer link. An incomplete one fails the build. Ships unset; the values
 * arrive only through the human-only follow-up issue.
 */
export interface LegalBlock {
  /** The page <h1>. */
  heading: string;
  /** The name as it should appear on the page. */
  name: string;
  /** Postal address lines, non-empty. */
  address: string[];
  /** Headed paragraphs, non-empty. A blank line in `body` starts a new paragraph. */
  sections: { heading: string; body: string }[];
  /** Optional label/value lines. */
  details?: { label: string; value: string }[];
}

export const LEGAL: LegalBlock | undefined = undefined;

export const NAV = [
  { href: '/work/', label: 'Work' },
  { href: '/writing/', label: 'Writing' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
] as const;

/** Words for the marquee under the hero: the real stack, nothing aspirational. */
export const MARQUEE = [
  'Django',
  'PostgreSQL',
  'Celery',
  'HTMX',
  'Tailwind',
  'Three.js',
  'FFmpeg',
  'OpenTelemetry',
  'Ollama',
  'LangGraph',
  'Claude Code',
  'Hetzner',
  'Docker Compose',
  'Wagtail',
  'WebSockets',
];

/** Life outside work, as one list for the home About section and the CV (issue #42). */
export const INTERESTS = [
  'Downhill mountain biking',
  'Snowboarding',
  'Road biking',
  'Table tennis',
  'Billiards',
  'Gardening',
  'Film and TV',
];

export const CATEGORY_LABEL: Record<string, string> = {
  mts: 'MTS platform',
  client: 'Client work',
  tool: 'Tooling',
  learning: 'Learning',
};

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(d);
}

export function readingTime(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`\[\]()!-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}
