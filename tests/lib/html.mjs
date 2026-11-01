// A small HTML tokenizer and tree builder for the dist/ tests (issue #115). It is not a full
// HTML5 parser (no implied end tags, no foster parenting), but it reads attributes the way a
// browser does: quoted and unquoted values, entities left as-is, comments and doctype skipped,
// and <script>/<style> bodies kept as raw text. That is enough to walk Astro's output without
// a regex over minified markup, and it adds no dependency.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

/** @typedef {{ tag: string, attrs: Record<string, string>, children: Node[], parent: Element | null }} Element */
/** @typedef {Element | string} Node */

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;

function parseAttrs(src) {
  const attrs = {};
  ATTR.lastIndex = 0;
  const skip = () => {
    while (/[\s/]/.test(src[ATTR.lastIndex] ?? '')) ATTR.lastIndex++;
  };
  skip();
  let m;
  while (ATTR.lastIndex < src.length && (m = ATTR.exec(src))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
    skip();
  }
  return attrs;
}

/** Index of the `>` that closes the tag opening at `i`, honouring quoted attribute values. */
function tagEnd(html, i) {
  let quote = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return j;
  }
  return html.length;
}

/** @returns {Element} a synthetic root whose children are the document's top-level nodes. */
export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      cur.children.push(html.slice(i));
      break;
    }
    if (lt > i) cur.children.push(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      i = tagEnd(html, lt) + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = tagEnd(html, lt);
      const name = html.slice(lt + 2, end).trim().toLowerCase();
      // close the nearest open element of that name; ignore a stray end tag
      for (let e = cur; e.parent; e = e.parent) {
        if (e.tag === name) {
          cur = e.parent;
          break;
        }
      }
      i = end + 1;
      continue;
    }
    const name = /^[A-Za-z][^\s/>]*/.exec(html.slice(lt + 1, lt + 64))?.[0];
    if (!name) {
      cur.children.push('<');
      i = lt + 1;
      continue;
    }
    const end = tagEnd(html, lt);
    const tag = name.toLowerCase();
    const el = { tag, attrs: parseAttrs(html.slice(lt + 1 + name.length, end)), children: [], parent: cur };
    cur.children.push(el);
    i = end + 1;
    if (RAW_TEXT.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const stop = close === -1 ? html.length : close;
      el.children.push(html.slice(i, stop));
      i = close === -1 ? html.length : tagEnd(html, close) + 1;
    } else if (!VOID.has(tag) && html[end - 1] !== '/') {
      cur = el;
    }
  }
  return root;
}

/** Depth-first list of the elements under `node` (not `node` itself) accepted by `pred`. */
export function find(node, pred) {
  const out = [];
  const walk = (n) => {
    for (const c of n.children) {
      if (typeof c === 'string') continue;
      if (pred(c)) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

/** Concatenated text under `node`. */
export function text(node) {
  return node.children.map((c) => (typeof c === 'string' ? c : text(c))).join('');
}

export const hasClass = (el, name) => (el.attrs.class ?? '').split(/\s+/).includes(name);

/** The URLs of a srcset value, one per candidate. */
export function srcsetCandidates(value) {
  const out = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    let j = i;
    while (j < value.length && !/\s/.test(value[j])) j++;
    let url = value.slice(i, j);
    i = j;
    if (!url) break;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      // skip the descriptor up to the next comma
      const comma = value.indexOf(',', i);
      const descriptor = value.slice(i, comma === -1 ? value.length : comma).trim();
      out.push({ url, descriptor });
      i = comma === -1 ? value.length : comma + 1;
      continue;
    }
    out.push({ url, descriptor: '' });
  }
  return out;
}
