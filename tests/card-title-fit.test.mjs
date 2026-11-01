// Card titles fit their card at every column width (#187). The browser measurement is the smoke
// run's `cards` check (scripts/smoke/smoke.mjs, 390-1440 px); these tests pin what produces it:
// each card title carries its widest-word estimate, the card is a size container, the title's
// font size is capped by that estimate, and the text column cannot grow past the card.
// Relies on `npm test`'s pretest build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { find, hasClass, parseHtml, text } from './lib/html.mjs';
import { pageCss } from './lib/diagrams.mjs';
import { titleEm, wordEm } from '../src/lib/title-fit.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const PAGES = ['dist/index.html', 'dist/work/index.html'];
const read = (f) => readFileSync(f, 'utf8');
// Case-study cards only: the home page's GitHub repo cards are `a.card` too (the smoke check covers them).
const cardsOf = (html) => find(parseHtml(html), (el) => el.tag === 'a' && hasClass(el, 'card') && el.attrs.href?.startsWith('/work/'));
/** Bodies of the rules whose selector contains every one of `parts` (Astro scopes as `.x[data-astro-cid-…]`). */
const rules = (css, ...parts) =>
  [...css.replace(/\s+/g, ' ').matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => parts.every((p) => m[1].includes(p))).map((m) => m[2]);

test('the estimate errs wide of the measured widths, and is the widest word', () => {
  // Measured in Chrome in the card face (#187): wetlabs.app 6.45 em, Skatedownhills 8.03 em,
  // engineering 6.21 em, MTS 2.46 em.
  for (const [word, measured] of [['wetlabs.app', 6.45], ['Skatedownhills', 8.03], ['engineering', 6.21], ['MTS', 2.46]])
    assert.ok(wordEm(word) > measured, `${word}: estimate ${wordEm(word)} <= measured ${measured}`);
  assert.equal(titleEm('Agentic engineering workflow'), Math.ceil(wordEm('engineering') * 100) / 100);
  assert.equal(titleEm('  '), 1);
});

test('every card title on / and /work/ carries its widest-word estimate', () => {
  for (const f of PAGES) {
    const cards = cardsOf(read(f));
    assert.ok(cards.length >= 6, `${f}: cards`);
    for (const card of cards) {
      const [h3] = find(card, (el) => el.tag === 'h3');
      assert.ok(h3 && hasClass(h3, 'card-title'), `${f} ${card.attrs.href}: h3.card-title`);
      const title = text(h3).trim();
      assert.match(h3.attrs.style ?? '', new RegExp(`--title-em: ?${titleEm(title)}(?![\\d.])`), `${f}: ${title}`);
    }
  }
});

test('the card is a size container whose title is capped by its widest word', () => {
  const css = pageCss(read('dist/index.html'));
  const card = rules(css, '.card[').join(';');
  assert.match(card, /container-type: ?inline-size/, '.card container-type');
  assert.match(card, /min-width: ?0/, '.card min-width');
  assert.match(rules(css, '.card-body[').join(';'), /grid-template-columns: ?minmax\(0, ?1fr\)/, '.card-body column');
  for (const [size, max] of [['card-lg', '--text-3xl'], ['card-md', '--text-2xl']]) {
    const body = rules(css, `.${size}[`, ' .card-title[').join(';');
    assert.match(body, new RegExp(`font-size: ?clamp\\(1\\.25rem, ?100cqi ?/ ?var\\(--title-em\\), ?var\\(${max}\\)\\)`), size);
  }
  assert.match(rules(css, '.card-title[').join(';'), /overflow-wrap: ?break-word/, '.card-title wraps as a last resort');
});
