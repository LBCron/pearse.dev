// Every mailto link on the site comes from this module (#153): the address is always
// `SITE.email`, never a literal in a page, and the subjects are a closed set. Keep it pure
// and erasable TypeScript (no `astro:` imports, aliases, enums or namespaces) with `./site.ts`
// as its only import, so `node --test` loads it under type stripping and the contact form's
// client script can import it without pulling in anything else.
import { SITE } from './site.ts';

export type MailtoContext = 'home' | 'cv' | 'now' | 'brief';

/** One constant subject per context. No user-supplied text ever goes into a subject. */
export const SUBJECTS: Record<MailtoContext, string> = {
  home: 'Hello from pearse.dev',
  cv: 'Re: your CV',
  now: 'Re: your /now/ page',
  brief: 'Brief from pearse.dev',
};

/** Body cap in UTF-16 code units, the unit a textarea's `maxlength` counts. */
export const MAX_BODY = 1000;

/** Longest href the builder emits. Some mail clients cut or refuse longer mailto URLs. */
export const MAX_HREF = 1900;

/** The bare address as a URI, for the form `action` and JSON-LD `email`. */
export const ADDRESS_URI = `mailto:${SITE.email}`;

export interface Mailto {
  /** `mailto:<address>?subject=…[&body=…]`, every component RFC 6068 encoded. */
  href: string;
  subject: string;
  /** The body the href carries, after any truncation (line breaks as `\n`). */
  body: string;
  /** True when the input did not fit and `body` is a prefix of it. */
  truncated: boolean;
  /** Address, subject and the whole input body as plain text, for the clipboard. */
  text: string;
}

/** A surrogate pair, or a lone surrogate (which makes encodeURIComponent throw). */
const REPLACEMENT = String.fromCharCode(0xfffd);
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/** Line breaks to `\n` and lone surrogates to U+FFFD. No lookbehind, for older Safari. */
function normalise(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(SURROGATES, (m) => (m.length === 2 ? m : REPLACEMENT));
}

/**
 * Percent-encodes one header or body value (RFC 6068): line breaks become `%0D%0A`, and
 * space, `+`, `#`, `&`, `?`, `%` and every non-ASCII character are percent-encoded.
 */
export function encodeMailtoValue(value: string): string {
  // After normalise() the only line break is LF, and a literal `%` encodes as %25, so every
  // `%0A` in the output is a line break.
  return encodeURIComponent(normalise(value)).replaceAll('%0A', '%0D%0A');
}

/** Encoded length of one code point of a normalised string. */
const encodedLength = (point: string) => (point === '\n' ? 6 : encodeURIComponent(point).length);

/**
 * Builds the mailto for a context. The body is capped at MAX_BODY code units and the href at
 * MAX_HREF characters, cut on a code point boundary; `truncated` says when that happened so
 * the UI can point to copying the plain `text`, which always carries the whole body.
 */
export function buildMailto(context: MailtoContext, body = ''): Mailto {
  const subject = SUBJECTS[context];
  const full = normalise(body);
  const base = `${ADDRESS_URI}?subject=${encodeMailtoValue(subject)}`;
  const withBody = `${base}&body=`;

  let kept = '';
  let units = 0;
  let length = withBody.length;
  let truncated = false;
  for (const point of full) {
    const extra = encodedLength(point);
    if (units + point.length > MAX_BODY || length + extra > MAX_HREF) {
      truncated = true;
      break;
    }
    kept += point;
    units += point.length;
    length += extra;
  }

  const href = kept ? withBody + encodeMailtoValue(kept) : base;
  const text = [`To: ${SITE.email}`, `Subject: ${subject}`, ...(full ? ['', full] : [])].join('\n');
  return { href, subject, body: kept, truncated, text };
}

/** The case-study contact link (#103): subject "About <project title>", title from content. */
export function aboutProjectHref(title: string): string {
  return `${ADDRESS_URI}?subject=${encodeMailtoValue(`About ${title}`)}`;
}
