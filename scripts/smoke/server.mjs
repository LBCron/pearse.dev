/**
 * A static file server over a built site for the smoke run: node:http only, bound to
 * 127.0.0.1 on an ephemeral port. A path ending in `/` serves its `index.html`; anything
 * that is not a file under the root serves the root's `404.html` (or a plain body) with 404,
 * like GitHub Pages does for this site.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/** Resolve a request path to a file under `root`, or null. Never escapes `root`. */
export function resolvePath(root, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = resolve(join(root, rel));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

/**
 * Start serving `dir`. Resolves to `{ origin, close }` once listening. `overrides` maps an exact
 * request path to an HTML body served in place of the file (scripts/cv-pdf.mjs serves a rewritten
 * copy of /cv/ this way, so dist/ itself is never touched).
 */
export function serve(dir, overrides = {}) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (Object.hasOwn(overrides, pathname)) {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(req.method === 'HEAD' ? undefined : overrides[pathname]);
      return;
    }
    const file = resolvePath(root, pathname);
    if (file) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      return;
    }
    const notFound = join(root, '404.html');
    const body = existsSync(notFound) ? readFileSync(notFound) : 'Not found';
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
      ok({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((done) => {
          server.close(() => done());
          server.closeAllConnections();
        }) });
    });
  });
}
