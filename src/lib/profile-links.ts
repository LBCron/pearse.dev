/**
 * The "what renders" rules for the verified profile links (#157), as pure functions so a test
 * can run them with placeholder values: the shipped build has every optional field unset and
 * cannot exercise the set state.
 */

/** The part of `SITE` these rules read. Optional fields are `string | null` by design. */
export interface ProfileSite {
  github: string;
  linkedin: string;
  mastodon: string | null;
  bluesky: string | null;
}

export interface ProfileLink {
  label: string;
  href: string;
}

function assertHttps(name: string, value: string): string {
  let ok = false;
  try {
    ok = value.startsWith('https://') && new URL(value).protocol === 'https:';
  } catch {
    ok = false;
  }
  // The value is not echoed: a config mistake should not print a handle into a build log.
  if (!ok) throw new Error(`SITE.${name} must be a full https:// URL`);
  return value;
}

/** GitHub, LinkedIn, then Mastodon and Bluesky when set. A set value that is not https throws. */
export function profileLinks(site: ProfileSite): ProfileLink[] {
  const links: ProfileLink[] = [
    { label: 'GitHub', href: site.github },
    { label: 'LinkedIn', href: site.linkedin },
  ];
  if (site.mastodon !== null) links.push({ label: 'Mastodon', href: assertHttps('mastodon', site.mastodon) });
  if (site.bluesky !== null) links.push({ label: 'Bluesky', href: assertHttps('bluesky', site.bluesky) });
  return links;
}

const DID = /^did:(plc|web):[A-Za-z0-9._:%-]+$/;

/** The body of /.well-known/atproto-did: `null` while unset, else exactly the DID (no newline). */
export function atprotoDidBody(did: string | null): string | null {
  if (did === null) return null;
  if (!DID.test(did)) throw new Error('SITE.atprotoDid must match did:plc:… or did:web:…');
  return did;
}
