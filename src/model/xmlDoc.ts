/**
 * MusicXML <-> DOM (PRD Invariant #1: the model IS the MusicXML DOM).
 * Parse once with DOMParser; serialize with XMLSerializer. No MusicXML
 * writer dependency, no regeneration — see CONTRIBUTING.md §4.
 *
 * Two W3C-compliance details a naive round-trip gets wrong (PRD §11):
 *   1. `XMLSerializer` emits neither the `<?xml …?>` declaration nor the
 *      `<!DOCTYPE …>` — real pipeline files have both — so we capture them
 *      from the source on parse and re-emit them on serialize.
 *   2. A parse→serialize cycle is NOT byte-identical to the source (it
 *      normalizes self-closing tags, attribute quoting, whitespace, entities).
 *      So fidelity is measured against a normalized-on-load *baseline*
 *      (`baselineXml`), not the raw input (Invariant #2).
 */

interface Prolog {
  /** The `<?xml …?>` declaration line, verbatim from source. */
  declaration: string;
  /** The `<!DOCTYPE …>` line, verbatim from source (empty if none). */
  doctype: string;
}

// Associate the captured prolog with its Document without mutating the DOM.
const prologs = new WeakMap<Document, Prolog>();

/** Parse MusicXML text into a Document. Throws on malformed XML. */
export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  // DOMParser reports failures as a <parsererror> node rather than throwing.
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(
      `Invalid XML: ${parserError.textContent?.trim() ?? 'parse error'}`,
    );
  }

  // Sanity-check it actually looks like MusicXML.
  const root = doc.documentElement?.nodeName;
  if (root !== 'score-partwise' && root !== 'score-timewise') {
    throw new Error(
      `Not a MusicXML score (root element <${root ?? 'empty'}>).`,
    );
  }

  prologs.set(doc, capturePrologFromText(text, doc));
  return doc;
}

/**
 * Serialize a Document back to MusicXML text (used for render + download),
 * re-emitting the captured XML declaration and DOCTYPE that `XMLSerializer`
 * would otherwise drop.
 */
export function serializeXml(doc: Document): string {
  const prolog = prologs.get(doc) ?? capturePrologFromText('', doc);
  const body = new XMLSerializer().serializeToString(doc.documentElement);
  return (
    [prolog.declaration, prolog.doctype, body].filter(Boolean).join('\n') + '\n'
  );
}

/**
 * The normalized-on-load baseline for Invariant #2: what the *pristine* parsed
 * document serializes to. Unedited regions must continue to serialize
 * identically to this (not to the raw source bytes). Capture once right after
 * load, before any command runs.
 */
export function baselineXml(doc: Document): string {
  return serializeXml(doc);
}

function capturePrologFromText(text: string, doc: Document): Prolog {
  const declaration =
    text.match(/<\?xml[^>]*\?>/i)?.[0] ??
    '<?xml version="1.0" encoding="UTF-8"?>';
  // Standard external-DTD form (no internal subset): stops at the first '>'.
  const doctype =
    text.match(/<!DOCTYPE[^>]*>/i)?.[0] ??
    (doc.doctype ? serializeDoctype(doc.doctype) : '');
  return { declaration, doctype };
}

function serializeDoctype(dt: DocumentType): string {
  if (dt.publicId) {
    return `<!DOCTYPE ${dt.name} PUBLIC "${dt.publicId}" "${dt.systemId}">`;
  }
  if (dt.systemId) {
    return `<!DOCTYPE ${dt.name} SYSTEM "${dt.systemId}">`;
  }
  return `<!DOCTYPE ${dt.name}>`;
}
