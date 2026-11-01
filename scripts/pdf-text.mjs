/**
 * What a PDF says, as plain strings: shared by the confidentiality gate (scripts/gate.mjs)
 * and the tests, so both read a PDF the same way. pdfjs-dist (a devDependency) is imported
 * on first use, never at load time, so a tree without PDFs needs no dependencies.
 *
 * readPdf(bytes) resolves to:
 * - `text`: page text, items joined with a space, `\n` at each end of line, pages joined with `\n`
 * - `collapsed`: the same text with every run of whitespace collapsed to one space, so a phrase
 *   that wraps across a line or page break still reads as one
 * - `squeezed`: the text with all whitespace removed. Letter-spaced type (the CV's section labels)
 *   comes out of Chrome one glyph per item, so a word set that way only reads whole here
 * - `title`: the Info dictionary's Title, or ''
 * - `info`: every string in the Info dictionary (Title, Author, Producer, dates, ...)
 * - `xmp`: the raw XMP metadata string, or ''
 * - `links`: every link annotation target (`url` and `unsafeUrl`) on every page
 * - `pages`: `{ width, height }` of each page's MediaBox, in points
 * It rejects when the bytes are not a readable PDF or pdfjs-dist cannot be loaded.
 */

let pdfjs;

/** Every string value in a plain object or array, depth first. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

export async function readPdf(bytes) {
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    const doc = await task.promise;
    const pageTexts = [];
    const links = [];
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      // view is the CropBox clipped to the MediaBox; Chrome writes no CropBox, so it is the MediaBox.
      const [x0, y0, x1, y1] = page.view;
      pages.push({ width: x1 - x0, height: y1 - y0 });
      let text = '';
      for (const item of (await page.getTextContent()).items) {
        if (typeof item.str !== 'string') continue;
        text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pageTexts.push(text);
      for (const a of await page.getAnnotations()) {
        for (const url of [a.url, a.unsafeUrl]) if (typeof url === 'string' && url) links.push(url);
      }
      page.cleanup();
    }
    const { info, metadata } = await doc.getMetadata();
    const text = pageTexts.join('\n');
    return {
      text,
      collapsed: text.replace(/\s+/g, ' ').trim(),
      squeezed: text.replace(/\s+/g, ''),
      title: typeof info?.Title === 'string' ? info.Title : '',
      info: strings(info),
      xmp: metadata?.getRaw?.() ?? '',
      links: [...new Set(links)],
      pages,
    };
  } finally {
    await task.destroy();
  }
}

/** Every string a confidentiality pattern is tested against, one entry per scanned field. */
export function scanStrings(pdf) {
  return [pdf.text, pdf.collapsed, pdf.squeezed, ...pdf.info, pdf.xmp, ...pdf.links];
}
