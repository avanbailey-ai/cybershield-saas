import 'server-only';

import { createRequire } from 'node:module';

/**
 * PDFKit's default build resolves Helvetica.afm relative to the webpack bundle path,
 * which breaks on Vercel (`ENOENT .../api/enterprise/export/pdf/data/Helvetica.afm`).
 * The standalone build embeds font metrics and avoids filesystem lookups.
 */
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit/js/pdfkit.standalone.js') as new (
  options?: PDFKit.PDFDocumentOptions,
) => PDFKit.PDFDocument;

export default PDFDocument;
