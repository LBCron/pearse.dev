// Asserts the case studies render their accessible architecture diagrams (one under the
// facts, plus one per feature section that names a diagram), that diagrams carry nothing
// confidential-looking, that the two client diagrams draw what their prose says (#114),
// and that case studies without a `diagram:` key have none.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pendingSlugs } from './lib/projects.mjs';
import { HOSTNAME, diagramSvgs, pageCss, textOf } from './lib/diagrams.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

// Pending client case studies, derived from the source files (none today).
const HIDDEN = pendingSlugs();
// Case study -> diagram ids on its page, in page order: the main one, then feature sections'.
const DIAGRAMS = {
  'mts-hub': ['diagram-mts-hub', 'diagram-knowledge'],
  'wetlabs-app': ['diagram-wetlabs-app', 'diagram-observability'],
  'east-coast-blinds': ['diagram-east-coast-blinds'],
  'dublin-plein-air': ['diagram-dublin-plein-air'],
  'pearse-dev': ['diagram-pearse-dev'],
};
// Case studies with no `diagram:` key.
const WITHOUT = ['agentic-workflow', 'mx-creative-keypad'];

const page = (slug) => readFileSync(`dist/work/${slug}/index.html`, 'utf8');
const imgSvgs = (html) => html.match(/<svg\b[^>]*\brole="img"[^>]*>/g) ?? [];

for (const [slug, ids] of Object.entries(DIAGRAMS)) {
  test(`${slug}: renders exactly its diagrams, in order`, () => {
    const svgs = diagramSvgs(page(slug));
    assert.equal(imgSvgs(page(slug)).length, ids.length);
    assert.deepEqual(
      svgs.map((svg) => svg.match(/aria-labelledby="([^"]+)-title"/)?.[1]),
      ids,
    );
  });

  for (const [n, svg] of diagramSvgs(page(slug)).entries()) checkDiagram(`${slug} #${n + 1}`, svg);
}

function checkDiagram(name, svg) {
  test(`${name}: diagram svg has a title and a description`, () => {
    const title = svg.match(/<title\b[^>]*>([^<]*)<\/title>/)?.[1].trim();
    const desc = svg.match(/<desc\b[^>]*>([^<]*)<\/desc>/)?.[1].trim();
    assert.ok(title, 'empty <title>');
    assert.ok(desc && desc.length > 40, 'missing or thin <desc>');
    const labelId = svg.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(labelId, 'no aria-labelledby');
    assert.match(svg, new RegExp(`<title id="${labelId}"`));
    const descId = svg.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(descId, 'no aria-describedby');
    assert.match(svg, new RegExp(`<desc id="${descId}"`));
  });

  test(`${name}: diagram text has no IP address, hostname or hidden client`, () => {
    const text = textOf(svg);
    assert.ok(text.length > 100, 'diagram has no text');
    assert.doesNotMatch(text, /\b\d{1,3}(?:\.\d{1,3}){3}\b/, 'IPv4-like address');
    assert.doesNotMatch(text, HOSTNAME, 'hostname-like text');
    for (const hidden of HIDDEN) assert.equal(text.toLowerCase().includes(hidden), false, hidden);
  });
}

test('diagram flow animation is limited to no-preference motion', () => {
  const css = pageCss(page('mts-hub')).replace(/\s+/g, ' ');
  // The animation must sit inside the no-preference query, so reduced motion gets static edges.
  const block = css.match(/@media \(prefers-reduced-motion: ?no-preference\) ?\{[^@]*?\.edge-flow[^}]*animation:[^}]*\}/);
  assert.ok(block, 'no reduced-motion guard around the flow animation');
  const outside = css.replace(block[0], '');
  assert.doesNotMatch(outside, /\.edge-flow[^{]*\{[^}]*animation:/, 'flow animation outside the guard');
});

test('case studies without a diagram key render no diagram', () => {
  for (const slug of WITHOUT) {
    const html = page(slug);
    assert.equal(imgSvgs(html).length, 0, slug);
    assert.equal(html.includes('class="case-diagram"'), false, slug);
  }
});

test('hostname check catches .ie domains', () => {
  assert.match('dublinpleinair.ie', HOSTNAME);
  assert.match('see www.dublinpleinair.ie today', HOSTNAME);
});

/** The two nested layouts of one diagram: { name, tag, body }. */
function views(svg) {
  return [...svg.matchAll(/(<svg\b[^>]*\bclass="view view-(\w+)"[^>]*>)([\s\S]*?)<\/svg>/g)].map((m) => ({
    name: m[2],
    tag: m[1],
    body: m[3],
  }));
}
const diagramOf = (slug) => diagramSvgs(page(slug))[0];
const descOf = (svg) => svg.match(/<desc\b[^>]*>([^<]*)<\/desc>/)?.[1] ?? '';
/** Every edge <path> in a view, with its classes and end point. */
function edges(body) {
  return [...body.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\bclass="([^"]*\bedge\b[^"]*)"[^>]*>/g)].map((m) => {
    const nums = m[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    return { classes: m[2].split(/\s+/), end: nums.slice(-2) };
  });
}
/** The box of the node whose name line reads `label`. */
function nodeBox(body, label) {
  for (const g of body.match(/<g\b[^>]*class="node\b[\s\S]*?<\/g>/g) ?? []) {
    if (!new RegExp(`class="name"[^>]*>\\s*${label}\\s*<`).test(g)) continue;
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((a) => Number(g.match(new RegExp(`<rect\\b[^>]*\\b${a}="([\\d.]+)"`))[1]));
    return { x, y, w, h };
  }
  assert.fail(`no node named ${label}`);
}
const touches = ([px, py], b) => px >= b.x - 0.5 && px <= b.x + b.w + 0.5 && py >= b.y - 0.5 && py <= b.y + b.h + 0.5;

test('east-coast-blinds: one rollback edge to WordPress, and no flow edge reaches it', () => {
  const svg = diagramOf('east-coast-blinds');
  assert.match(textOf(svg), /\brollback\b/);
  const vs = views(svg);
  assert.deepEqual(vs.map((v) => v.name), ['wide', 'narrow']);
  for (const v of vs) {
    const all = edges(v.body);
    const rollback = all.filter((e) => e.classes.includes('edge-rollback'));
    assert.equal(rollback.length, 1, `${v.name}: exactly one rollback edge`);
    assert.equal(rollback[0].classes.includes('edge-flow'), false, `${v.name}: rollback is not flow`);
    const wordpress = nodeBox(v.body, 'WordPress');
    assert.ok(touches(rollback[0].end, wordpress), `${v.name}: rollback edge ends at WordPress`);
    const flow = all.filter((e) => e.classes.includes('edge-flow'));
    assert.ok(flow.length >= 1, `${v.name}: has a live flow path`);
    for (const e of flow) assert.equal(touches(e.end, wordpress), false, `${v.name}: flow edge ends at WordPress`);
  }
});

test('client diagram descriptions say what the drawing claims', () => {
  const ecb = descOf(diagramOf('east-coast-blinds'));
  assert.match(ecb, /rollback/);
  assert.match(ecb, /WordPress/);
  const dpa = descOf(diagramOf('dublin-plein-air'));
  assert.match(dpa, /one way/);
  assert.match(dpa, /source of payment truth/);
});

test('dublin-plein-air: one edge into the CRM from the shop, none back', () => {
  for (const v of views(diagramOf('dublin-plein-air'))) {
    const shop = nodeBox(v.body, 'WooCommerce shop');
    const into = edges(v.body).filter((e) => touches(e.end, shop));
    assert.equal(into.length, 0, `${v.name}: no edge ends at the shop`);
    assert.doesNotMatch(v.body, /marker-start/, `${v.name}: no two-way edge`);
  }
});

test('client diagrams: the narrow layout is 360 wide and scales with the column', () => {
  for (const slug of ['east-coast-blinds', 'dublin-plein-air']) {
    const narrow = views(diagramOf(slug)).find((v) => v.name === 'narrow');
    assert.ok(narrow, `${slug}: narrow view`);
    assert.match(narrow.tag, /\bviewBox="0 0 360 \d+(?:\.\d+)?"/, slug);
    assert.match(narrow.tag, /\bwidth="100%"/, slug);
  }
});

test('rollback edges are static and dashed unlike optional and flow edges', () => {
  const css = pageCss(page('east-coast-blinds')).replace(/\s+/g, ' ');
  const rules = (sel) => [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => m[1].includes(sel)).map((m) => m[2]);
  const dash = (body) => body.match(/stroke-dasharray: ?([^;}]+)/)?.[1].trim();

  const rollback = rules('.edge-rollback');
  assert.ok(rollback.length >= 1, 'a .edge-rollback rule');
  for (const body of rollback) assert.doesNotMatch(body, /animation/, '.edge-rollback animates');
  const rollbackDash = rollback.map(dash).find(Boolean);
  const optionalDash = rules('.edge-optional').map(dash).find(Boolean);
  const flowDash = rules('.edge-flow').map(dash).find(Boolean);
  assert.ok(rollbackDash && optionalDash && flowDash, 'all three edge styles set a dash');
  assert.notEqual(rollbackDash, optionalDash);
  assert.notEqual(rollbackDash, flowDash);
});
