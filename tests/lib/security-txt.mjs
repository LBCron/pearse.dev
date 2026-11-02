// Pure helpers for the security.txt contract (#140, RFC 9116). No clock, no files: "now" is an
// argument, so the suite's behaviour does not change as days pass.

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_DAYS_OUT = 366;
export const WARN_DAYS = 60;

/** Field name -> list of values, in file order. Comments and blank lines are skipped. */
export function parseFields(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    const name = line.slice(0, at).trim();
    (fields[name] ??= []).push(line.slice(at + 1).trim());
  }
  return fields;
}

/**
 * Judges an `Expires` value against `now` (a Date). Returns `{ errors, warnings, daysLeft }`:
 * an unparseable or past date, or one more than 366 days out, is an error; fewer than 60 days
 * left is a warning only.
 */
export function checkExpires(value, now) {
  const errors = [];
  const warnings = [];
  const when = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(value) ? new Date(value) : null;
  if (!when || Number.isNaN(when.getTime())) {
    return { errors: [`Expires is not an ISO 8601 date-time: ${JSON.stringify(value)}`], warnings, daysLeft: null };
  }
  const daysLeft = (when.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft < 0) errors.push(`Expires ${value} is in the past; renew security.txt (a failing check halts the daily deploy)`);
  else if (daysLeft > MAX_DAYS_OUT) errors.push(`Expires ${value} is more than ${MAX_DAYS_OUT} days out (RFC 9116 advises under a year)`);
  else if (daysLeft < WARN_DAYS) warnings.push(`security.txt Expires ${value} is ${Math.floor(daysLeft)} days away; land a renewal PR before it passes`);
  return { errors, warnings, daysLeft };
}
