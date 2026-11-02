/**
 * The fail-closed rule for the Impressum page (#155), as a pure function of the `LEGAL` block in
 * `src/lib/site.ts`. It has no imports, so `node --test` loads it under type stripping, and it
 * takes the block as an argument, so a test can classify fixtures that the shipped config never
 * holds. The route (`src/pages/[legal].astro`) and the footer both call it: the page exists and is
 * linked only when the block is complete, and an incomplete block fails the build.
 *
 * This module holds no headings, wording or legal claims. Every string on the page comes from the block.
 */

/**
 * What the classifier accepts: any value the config might hold, typed loosely on purpose, because
 * a block that is missing a field (and so would not type-check as `LegalBlock`) must still be
 * classified at build time and reported by name.
 */
export type LegalInput =
  | {
      heading?: unknown;
      name?: unknown;
      address?: unknown;
      sections?: unknown;
      details?: unknown;
    }
  | null
  | undefined;

export type LegalState =
  | { state: 'unset' }
  | { state: 'incomplete'; missing: string[] }
  | { state: 'complete' };

const filled = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/**
 * `unset` when there is no block; `incomplete` when any required field is missing, blank or an
 * empty array, with every missing field named (`heading`, `name`, `address`, `sections`, or a
 * nested path such as `sections[1].body`); otherwise `complete`. `details` is optional, but a
 * details line that is present must have both a label and a value.
 */
export function legalState(block: LegalInput): LegalState {
  if (block === undefined || block === null) return { state: 'unset' };
  const missing: string[] = [];

  if (!filled(block.heading)) missing.push('heading');
  if (!filled(block.name)) missing.push('name');

  const address = block.address;
  if (!Array.isArray(address) || address.length === 0) missing.push('address');
  else address.forEach((line, i) => !filled(line) && missing.push(`address[${i}]`));

  const sections = block.sections;
  if (!Array.isArray(sections) || sections.length === 0) missing.push('sections');
  else
    sections.forEach((s, i) => {
      if (!filled(s?.heading)) missing.push(`sections[${i}].heading`);
      if (!filled(s?.body)) missing.push(`sections[${i}].body`);
    });

  const details = block.details;
  if (details !== undefined) {
    if (!Array.isArray(details)) missing.push('details');
    else
      details.forEach((d, i) => {
        if (!filled(d?.label)) missing.push(`details[${i}].label`);
        if (!filled(d?.value)) missing.push(`details[${i}].value`);
      });
  }

  return missing.length > 0 ? { state: 'incomplete', missing } : { state: 'complete' };
}

/** The error an incomplete block fails the build with. Field names only: no values are echoed. */
export function legalError(missing: readonly string[]): Error {
  return new Error(`LEGAL in src/lib/site.ts is incomplete. Missing or blank: ${missing.join(', ')}`);
}
