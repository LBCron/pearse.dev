// The retired MTS product name and the folded tool names (ADR 0006), shared by the tests that
// keep them out of published copy and out of CLAUDE.md. Not a test file itself: `npm test`
// only runs tests/**/*.test.mjs. Pure constants: importing this reads and changes nothing.

// The old product name, in any letter case. Its slug survives only as the path of its redirect page.
export const OLD_NAME = /ophthix/i;

// The old product name plus the tool names folded into MTS Hub and wetlabs.app.
export const OLD_NAMES = /ophthix|WetPack|Opthalyze|\bAtlas\b|\bCortex\b/i;
