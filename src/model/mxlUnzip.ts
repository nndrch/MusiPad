import { unzipSync, strFromU8 } from 'fflate';

/**
 * Extract the root MusicXML document from a compressed `.mxl` archive.
 *
 * Per the MusicXML spec, `.mxl` is a ZIP whose `META-INF/container.xml`
 * points at the primary score via a `<rootfile full-path="...">`. We honor
 * that, then fall back to the first `.xml`/`.musicxml` entry outside
 * `META-INF/` if the container is missing or unreadable.
 *
 * Read-only: PoC never *writes* `.mxl` (PRD §3, §11).
 */
export function unzipMxl(data: Uint8Array): string {
  const files = unzipSync(data);

  const rootPath = readContainerRootPath(files);
  if (rootPath && files[rootPath]) {
    return strFromU8(files[rootPath]);
  }

  const fallback = Object.keys(files).find(
    (name) => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name),
  );
  if (fallback) {
    return strFromU8(files[fallback]);
  }

  throw new Error('No MusicXML document found inside the .mxl archive.');
}

function readContainerRootPath(
  files: Record<string, Uint8Array>,
): string | null {
  const container = files['META-INF/container.xml'];
  if (!container) return null;

  const doc = new DOMParser().parseFromString(
    strFromU8(container),
    'application/xml',
  );
  return doc.querySelector('rootfile')?.getAttribute('full-path') ?? null;
}
