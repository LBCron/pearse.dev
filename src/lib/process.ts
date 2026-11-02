/**
 * "How the job ran": the method the client case studies share, as five canonical steps.
 * Each case study lists the steps its own page backs (`process` in frontmatter) and adds one
 * sentence of proof per step; the promise text is shared and never overridden per entry.
 *
 * No imports at all, not even a type: the schema (src/content.config.ts) and the tests
 * (loaded through Node type stripping) both read this file, and an extensionless import
 * would break the latter.
 */

/** The ids, in canonical order, as a tuple for `z.enum`. */
export const PROCESS_STEP_IDS = ['audit', 'staging', 'gated', 'cutover', 'written-down'] as const;

export type ProcessStepId = (typeof PROCESS_STEP_IDS)[number];

/**
 * The canonical steps, in order. Each promise is written at the level every page that lists
 * the step actually states: stronger detail (a guard plugin, an off-server backup) belongs in
 * that page's proof, never here.
 */
export const PROCESS_STEPS: readonly { id: ProcessStepId; title: string; promise: string }[] = [
  { id: 'audit', title: 'Audit first', promise: 'An audit of the site as it stands, with the findings written down.' },
  { id: 'staging', title: 'Rehearse on staging', promise: 'Changes rehearsed on a staging copy before they reach the live site.' },
  { id: 'gated', title: 'Steps that can be undone', promise: 'The work done in steps that can each be undone, after a fresh backup.' },
  { id: 'cutover', title: 'Cutover with a way back', promise: 'A cutover planned so it can be rolled back.' },
  { id: 'written-down', title: 'Written down', promise: 'Written down, so the next change starts from a record rather than memory.' },
];

/**
 * Problems with one case study's `process` list, each with the index of the entry at fault:
 * an unknown id, a duplicate id, an id out of canonical order, or a non-empty list with
 * fewer than two steps (one step is not a process). An empty list has no issues.
 */
export function processIssues(steps: readonly { step: string }[]): { index: number; message: string }[] {
  const issues: { index: number; message: string }[] = [];
  const rank = (id: string) => (PROCESS_STEP_IDS as readonly string[]).indexOf(id);
  const seen = new Set<string>();
  let last = -1;
  steps.forEach(({ step }, index) => {
    const r = rank(step);
    if (r < 0) {
      issues.push({ index, message: `unknown process step "${step}"` });
      return;
    }
    if (seen.has(step)) {
      issues.push({ index, message: `duplicate process step "${step}"` });
      return;
    }
    seen.add(step);
    if (r < last) {
      issues.push({ index, message: `process step "${step}" is out of order: the order is ${PROCESS_STEP_IDS.join(', ')}` });
    }
    last = Math.max(last, r);
  });
  if (steps.length === 1) {
    issues.push({ index: 0, message: 'a process needs at least two steps, or none' });
  }
  return issues;
}
