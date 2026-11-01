// Issue #42: the person behind the work. The home About section, /cv/ and /now/ tell the same
// arc (first website at 14, the skating record, Skatedownhills) and list the same hobbies, and the
// CV presents MTS as exactly two products.
// Issue #118 adds the written copy: docs/profile (bio and LinkedIn) is read at the source and checked
// against the built home timeline and /cv/, so the three tell one history.
// Relies on `npm test`'s pretest build; run `npm run build` first when running this file alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projects as sourceProjects } from './lib/projects.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const read = (path) => readFileSync(path, 'utf8');

/** Visible text: tags dropped, the entities Astro emits decoded, whitespace collapsed. */
const text = (html) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const about = () => read('dist/index.html').match(/<section id="about"[\s\S]*?<\/section>/)?.[0] ?? '';
const cv = () => read('dist/cv/index.html');
const now = () => read('dist/now/index.html');

const PAGES = {
  'home About section': about,
  '/cv/': cv,
  '/now/': now,
};

// Hard-coded on purpose: this is the list from the issue, not a copy of src/lib/site.ts.
const HOBBIES = ['Downhill mountain biking', 'Snowboarding', 'Road biking', 'Table tennis', 'Billiards', 'Gardening', 'Film and TV'];

const ARC = [
  ['Legion Airsoft', /Legion Airsoft/],
  ['the 2019 European 2nd place', /2nd overall in the 2019 (IDF )?European rankings/],
  ['the BDSL title', /BDSL[^.]*champion/],
  ['Skatedownhills', /Skatedownhills/],
];

for (const [name, page] of Object.entries(PAGES)) {
  test(`${name} tells the arc: Legion Airsoft, the skating record and Skatedownhills`, () => {
    const t = text(page());
    assert.ok(t.length > 0, `${name} is empty`);
    for (const [label, re] of ARC) assert.match(t, re, `${name}: ${label}`);
  });

  test(`${name} lists every hobby`, () => {
    const t = text(page()).toLowerCase();
    for (const h of HOBBIES) assert.ok(t.includes(h.toLowerCase()), `${name}: ${h}`);
  });

  test(`${name} links the Skatedownhills case study`, () => {
    assert.match(page(), /href="\/work\/skatedownhills\/"/, name);
  });
}

// Tools folded into the two MTS products, and the old product name: never named on these pages.
const NOT_PRODUCTS = /WetPack|Opthalyze|\bAtlas\b|\bCortex\b|Ophthix|Observability stack/i;

test('/cv/ names exactly two MTS products: MTS Hub and wetlabs.app', () => {
  const page = cv();
  const products = [...page.matchAll(/class="cv-product-name"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  assert.deepEqual(products, ['MTS Hub', 'wetlabs.app']);
  assert.doesNotMatch(text(page), NOT_PRODUCTS);
});

test('/cv/ case studies include both MTS products', () => {
  const work = cv().slice(cv().indexOf('id="cv-work"'), cv().indexOf('id="cv-skills"'));
  for (const slug of ['mts-hub', 'wetlabs-app']) assert.match(work, new RegExp(`href="/work/${slug}/"`), slug);
});

test('/cv/ has a Before software section and an Interests line', () => {
  const page = cv();
  const before = page.match(/<section[^>]*aria-labelledby="cv-before"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(text(before), /Before software/);
  assert.match(text(before), /downhill skateboarder/i);
  const interests = page.match(/<section[^>]*aria-labelledby="cv-interests"[\s\S]*?<\/section>/)?.[0] ?? '';
  const items = [...interests.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1].trim());
  assert.deepEqual(items, HOBBIES);
});

test('home timeline runs from age 14 to MTS, and its MTS row names the two products', () => {
  const timeline = about().match(/<ol class="timeline[\s\S]*?<\/ol>/)?.[0] ?? '';
  const rows = [...timeline.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
  assert.ok(rows.length >= 6, `only ${rows.length} rows`);
  const order = [/Age 14.*Legion Airsoft/, /downhill skateboarder/i, /Skatedownhills/, /diploma/i, /Freelance/, /MTS/];
  let at = -1;
  for (const re of order) {
    const i = rows.findIndex((r, n) => n > at && re.test(r));
    assert.ok(i > at, `timeline row ${re} missing or out of order`);
    at = i;
  }
  const mts = rows.slice(at).join(' ');
  assert.match(mts, /MTS Hub/);
  assert.match(mts, /wetlabs\.app/);
  assert.doesNotMatch(timeline, NOT_PRODUCTS);
});

test('no two timeline rows share the same title', () => {
  const timeline = about().match(/<ol class="timeline[\s\S]*?<\/ol>/)?.[0] ?? '';
  const titles = [...timeline.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => {
    const spans = [...m[0].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((s) => text(s[1]));
    return spans[1];
  });
  assert.equal(new Set(titles).size, titles.length, `duplicate titles: ${titles.join(' | ')}`);
});

// ---- Issue #118: docs/profile (bio.md, linkedin.md) agrees with the site ----

const bio = () => read('docs/profile/bio.md');
const linkedin = () => read('docs/profile/linkedin.md');
const words = (block) => block.split(/\s+/).filter(Boolean).length;
const num = (str) => Number(str.replace(/,/g, ''));
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Every `## N words` section: its heading N, its "N words." line and the fenced block after it. */
function bioBlocks() {
  return [...bio().matchAll(/^## (\d+) words\n\n(\d+) words\.\n\n```\n([\s\S]*?)\n```/gm)].map((m) => ({
    heading: Number(m[1]),
    line: Number(m[2]),
    block: m[3],
  }));
}

/** Every fenced block in linkedin.md with the stated count nearest above it (commas stripped). */
function linkedinBlocks() {
  const found = [];
  let stated = null;
  let block = null;
  for (const line of linkedin().split('\n')) {
    if (line.startsWith('```')) {
      if (block === null) block = [];
      else {
        found.push({ stated, text: block.join('\n') });
        block = null;
      }
    } else if (block !== null) block.push(line);
    else {
      // Four formats occur; a fifth makes the block count below fail instead of being skipped.
      const m = line.match(/\(([\d,]+) characters\)|Description:\*\* ([\d,]+) characters|This one is ([\d,]+)\./);
      if (m) stated = num(m[1] ?? m[2] ?? m[3]);
    }
  }
  return found;
}

const linkedinAbout = () => linkedinBlocks().find((b) => /^I build the systems/.test(b.text) && b.text.length > 1000);

test('bio.md: exactly three blocks, and each has the word count its heading and "N words." line state', () => {
  const blocks = bioBlocks();
  assert.deepEqual(blocks.map((b) => b.heading), [50, 100, 300]);
  for (const b of blocks) {
    assert.equal(b.line, b.heading, `"${b.heading} words." line`);
    assert.equal(words(b.block), b.heading, `${b.heading}-word block has ${words(b.block)} words`);
  }
});

test('linkedin.md: exactly ten fenced blocks, each as long as its stated character count, and the About fits 2,600', () => {
  const blocks = linkedinBlocks();
  assert.equal(blocks.length, 10, 'headlines (3), About, five descriptions, Open to');
  for (const b of blocks) {
    assert.ok(b.stated !== null, `no stated count above: ${b.text.slice(0, 40)}`);
    assert.equal(b.text.length, b.stated, `"${b.text.slice(0, 40)}…" is ${b.text.length}, stated ${b.stated}`);
  }
  const about = linkedinAbout();
  assert.ok(about, 'About block not found');
  assert.ok(about.text.length <= 2600, `About is ${about.text.length} characters`);
});

test('the 300-word bio and the LinkedIn About say two earlier tools, never three', () => {
  assert.doesNotMatch(bio() + linkedin(), /three earlier tools/i);
  assert.doesNotMatch(bio() + linkedin(), /seven rows/i);
  assert.match(bioBlocks().find((b) => b.heading === 300).block, /two earlier tools/);
  assert.match(linkedinAbout().text, /two earlier tools/);
});

test('the 100- and 300-word bios and the LinkedIn About tell the skating arc', () => {
  const [, b100, b300] = bioBlocks().map((b) => b.block);
  const about = linkedinAbout().text;
  for (const [name, t] of [['100-word bio', b100], ['300-word bio', b300], ['LinkedIn About', about]]) {
    assert.match(t, /downhill skateboard/i, name);
  }
  for (const [name, t] of [['100-word bio', b100], ['300-word bio', b300], ['LinkedIn About', about]]) {
    assert.match(t, /Skatedownhills/, name);
  }
  for (const [name, t] of [['300-word bio', b300], ['LinkedIn About', about]]) {
    assert.match(t, /2nd overall in the 2019 IDF European rankings/, name);
    assert.match(t, /BDSL/, name);
  }
});

/** The built home timeline's rows, oldest first, as [period, context]. */
function timelineRows() {
  const html = read('dist/index.html');
  const ol = html.match(/<ol class="timeline[^"]*"[\s\S]*?<\/ol>/)?.[0] ?? '';
  const lis = [...ol.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  return lis.map((li) => [...li.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].slice(0, 2).map((s) => text(s[1]).trim()));
}

/** linkedin.md's mapping table under `## Experience`, as rows of trimmed cells (header and rule dropped). */
function mappingTable() {
  const section = linkedin().split(/^## Experience$/m)[1]?.split(/^## /m)[0] ?? '';
  return section
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .slice(2);
}

test('the mapping table, the "timeline has N rows" sentence and the built timeline agree on the row count', () => {
  const section = linkedin().split(/^## Experience$/m)[1] ?? '';
  const said = section.match(/The timeline has (\w+) rows/)?.[1];
  assert.ok(said, 'no "The timeline has N rows" sentence');
  const inDist = (read('dist/index.html').match(/<ol class="timeline[^"]*"[\s\S]*?<\/ol>/)?.[0].match(/<li\b/g) ?? []).length;
  assert.ok(inDist > 0, 'no <li> inside <ol class="timeline"> on dist/index.html');
  assert.equal(NUMBER_WORDS.indexOf(said), inDist, `sentence says ${said}, timeline has ${inDist}`);
  assert.equal(mappingTable().length, inDist, 'mapping table rows');
});

test('the mapping table lists the timeline periods and contexts, newest first', () => {
  const rows = timelineRows().reverse();
  const table = mappingTable();
  assert.deepEqual(table.map((r) => r[0]), rows.map((r) => r[0]));
  assert.deepEqual(table.map((r) => r[1]), rows.map((r) => r[1]));
  // The three rows before software map to no LinkedIn position.
  assert.deepEqual(table.slice(-3).map((r) => r[2]), Array(3).fill('— (before software)'));
});

test('the "map to N positions" sentence matches the numbered positions under Experience', () => {
  const section = linkedin().split(/^## Experience$/m)[1]?.split(/^## /m)[0] ?? '';
  const said = section.match(/map to (\w+) positions/)?.[1];
  assert.ok(said, 'no "map to N positions" sentence');
  const headings = [...section.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(headings, headings.map((_, i) => i + 1), 'positions are numbered 1..N');
  assert.equal(NUMBER_WORDS.indexOf(said), headings.length);
});

/** Text between two ids on the built CV, and the cv-period values inside it. */
const cvSlice = (from, to) => {
  const page = cv();
  const a = page.indexOf(`id="${from}"`);
  const b = to ? page.indexOf(to, a) : -1;
  assert.ok(a >= 0, `id="${from}" missing`);
  return page.slice(a, b < 0 ? undefined : b);
};
const periods = (html) => [...html.matchAll(/class="cv-period[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1].trim());

test('/cv/ experience periods are Aug 2026, Aug 2025, May 2024, in that order (case studies not counted)', () => {
  assert.deepEqual(periods(cvSlice('cv-experience', 'id="cv-work"')), ['Aug 2026 – Present', 'Aug 2025 – Present', 'May 2024 – 2025']);
});

test('/cv/ education period is exactly Nov 2023 – Apr 2024', () => {
  assert.deepEqual(periods(cvSlice('cv-education', '</section>')), ['Nov 2023 – Apr 2024']);
});

test('/cv/ experience has the festival CRM and names no client case study', () => {
  const t = text(cvSlice('cv-experience', 'id="cv-work"'));
  assert.match(t, /festival CRM/);
  const clients = sourceProjects().filter((p) => p.clientPermission !== undefined);
  assert.ok(clients.length > 0, 'no case study carries clientPermission');
  for (const p of clients) assert.equal(t.includes(p.title), false, `experience names client case study "${p.title}"`);
});
