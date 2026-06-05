import { unzipMxl } from '../model/mxlUnzip';
import type { ScoreIO } from './ScoreIO';

/**
 * PoC `ScoreIO`: load from a user-picked `File` (unzipping `.mxl`), save by
 * triggering a browser download of plain `.musicxml` (PRD §3 — no `.mxl`
 * writing). The component only captures the `File`; all reading/unzipping
 * lives here so IO concerns stay out of the UI (PRD §7.5).
 */
export class LocalFileIO implements ScoreIO {
  private readonly file: File;

  constructor(file: File) {
    this.file = file;
  }

  async load(): Promise<string> {
    if (/\.mxl$/i.test(this.file.name)) {
      const buffer = new Uint8Array(await this.file.arrayBuffer());
      return unzipMxl(buffer);
    }
    return this.file.text();
  }

  async save(xml: string): Promise<void> {
    const blob = new Blob([xml], {
      type: 'application/vnd.recordare.musicxml+xml',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /** Source name with any extension replaced by `.musicxml`. */
  private downloadName(): string {
    const base = this.file.name.replace(/\.(musicxml|xml|mxl)$/i, '');
    return `${base || 'score'}.musicxml`;
  }
}
