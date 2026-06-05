/**
 * MusicXML <-> DOM (PRD Invariant #1: the model IS the MusicXML DOM).
 * Parse once with DOMParser; serialize with XMLSerializer. No MusicXML
 * writer dependency, no regeneration — see CONTRIBUTING.md §4.
 */

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

  return doc;
}

/** Serialize a Document back to MusicXML text (used for render + download). */
export function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}
