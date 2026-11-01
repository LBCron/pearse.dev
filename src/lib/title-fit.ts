/**
 * Card titles are set in a large display face, and a single long word ("wetlabs.app",
 * "Skatedownhills") can be wider than a narrow card (#187). The card is a size container, and
 * its title's font size is capped at `100cqi / --title-em`, so the longest word fits the card's
 * content box at any column width while short titles keep the full size.
 *
 * The width is estimated from the letters, not measured, and errs wide: measured in the card
 * face (Archivo, wdth 112, weight 760), lowercase runs 0.53-0.59 em a letter and capitals up to
 * 0.82 em, so these weights sit above both.
 */
const WIDE = /[A-Z0-9mwMW@%&]/;
const WIDE_EM = 0.9;
const NARROW_EM = 0.62;

/** Estimated width of one word, in em of the card title face. */
export function wordEm(word: string): number {
  let em = 0;
  for (const ch of word) em += WIDE.test(ch) ? WIDE_EM : NARROW_EM;
  return em;
}

/** Estimated width of the title's widest word (the narrowest it can wrap to), in em, to two decimals. */
export function titleEm(title: string): number {
  const widest = Math.max(1, ...title.split(/\s+/).filter(Boolean).map(wordEm));
  return Math.ceil(widest * 100) / 100;
}
