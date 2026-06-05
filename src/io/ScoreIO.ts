/**
 * Load/Save adapter — the future-backend seam (PRD §7.5).
 *
 * PoC impl is `LocalFileIO` (upload/unzip + browser download). A future
 * `BackendIO` (`GET /scores/:id` / `PUT /scores/:id`) is a one-line provider
 * swap. Upload/download logic must NOT leak into components — it lives behind
 * this interface.
 */
export interface ScoreIO {
  /** Returns MusicXML text (already unzipped if the source was `.mxl`). */
  load(): Promise<string>;
  /** Persist corrected MusicXML. */
  save(xml: string): Promise<void>;
}
