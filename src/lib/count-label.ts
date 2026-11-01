/** Count and noun for a mono eyebrow label: no zero-padding, singular for exactly one (#204). */
export function countNoun(count: number, singular: string, plural = `${singular}s`): { n: string; noun: string } {
  return { n: String(count), noun: count === 1 ? singular : plural };
}
