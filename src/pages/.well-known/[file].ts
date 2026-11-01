/**
 * /.well-known/atproto-did: the Bluesky handle check for pearse.dev (#157). It is a dynamic route
 * so that it emits only when SITE.atprotoDid is set; a plain endpoint, or a file in public/, would
 * always emit. While the DID is unset the build contains no such file.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE } from '../../lib/site';
import { atprotoDidBody } from '../../lib/profile-links';

export const getStaticPaths = (() =>
  atprotoDidBody(SITE.atprotoDid) === null ? [] : [{ params: { file: 'atproto-did' } }]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
  new Response(atprotoDidBody(SITE.atprotoDid) ?? '', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
