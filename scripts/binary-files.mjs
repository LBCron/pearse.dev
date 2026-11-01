// Which files are not read as text. Shared by the confidentiality gate (scripts/gate.mjs) and the
// verify-marker dist test (tests/verify-marker.test.mjs) so both skip exactly the same files.
// It lives here rather than in gate.mjs because gate.mjs runs its scan, and exits, on import.

/** Extensions skipped without reading the file. */
export const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.mp4', '.webm', '.zip', '.gz',
]);

/** A NUL byte in the first 8 KiB marks any other file as binary. */
export function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}
