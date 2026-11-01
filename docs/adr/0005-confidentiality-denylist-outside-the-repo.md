---
status: accepted
date: 2026-10-24
---

# Confidential material is gated in CI with a denylist kept outside the repository

Content about MTS work must not name customers, congresses, infrastructure addresses, credentials or business figures. The repository is public, so the list of forbidden strings cannot live in it: the list would itself be the leak. The check runs in CI against the built site, reading its patterns from a repository secret, and fails the build on any hit. We rejected a committed denylist for that reason, and rejected "just be careful" because ghost-written content from multiple agents has already needed this filter once.

## Amendment (2026-11-01): fail closed, scan every tracked file

The gate as first built passed with a warning when it had no patterns, so with no secret set the scheduled rebuild deployed unchecked while the run showed green. It also scanned only `dist/`, `src/` and `docs/`, although every tracked file in a public repository ships, and it never looked at file names.

- In required mode (`GATE_REQUIRED=1`: push, schedule, manual runs and same-repo pull requests not opened by Dependabot) the gate fails when it has no patterns, fewer than a minimum (default 10, repository variable `CONFIDENTIAL_PATTERNS_MIN`), or no git repository. An optional repository variable `CONFIDENTIAL_PATTERNS_SHA256` pins the normalised list; a mismatch fails without printing either hash. Fork and Dependabot pull requests receive no secret and keep the warning.
- The gate scans every tracked file plus `dist/`, and matches each pattern against relative paths as well as content. A path hit prints the path, which is already public; a content hit still never prints the matched text.
- Deliberate mentions are listed in the committed `.gate-allow` by pattern number, scope and exact path, with a reason that does not quote the match. Stale entries fail the gate.
- Pattern numbers are positions, so the denylist is append-only. Removing or reordering lines requires reviewing `.gate-allow`, and once the fingerprint variable is set, any change to the list fails the build until the variable is updated.
