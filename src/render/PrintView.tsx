import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ScoreInfo } from '../model/scoreInfo';
import { feelWordsDirection } from '../model/directions';
import { applySlashGrid } from '../model/slashGrid';
import { ScoreHeader } from './ScoreHeader';
import './PrintView.css';

/** Imperative handle: App awaits `prepare()` before `window.print()` (P4). */
export interface PrintHandle {
  /** Re-render the live doc into paginated A4 page SVGs, ready to print. */
  prepare(): Promise<void>;
}

interface PrintViewProps {
  doc: Document;
  info: ScoreInfo;
}

/**
 * Print clone (M10, post-mvp P4 recipe). Unlike the screen render clone
 * (`buildRenderDoc`), the print pages carry **no HTML overlay**, so OSMD must
 * ink everything itself:
 *   • slashes stay (the slash grid), drawn by OSMD (not our `SlashLayer`);
 *   • section rehearsal marks, annotations, and the section-start double
 *     barlines are **kept** (the screen draws these as overlays — here OSMD
 *     draws them natively);
 *   • only the feel/style words are stripped (they're the header subline).
 *
 * Chord symbols are inked by OSMD in its own house style (e.g. `Dm7`, `Cmaj7`),
 * which is close to but not exactly the on-screen Berklee pills (`Dmi7`,
 * `CMaj7`). OSMD ignores the MusicXML `<kind text>` override, so exact parity
 * needs OSMD's `setChordSymbolLabelText` map — deferred to post-mvp (P4 note).
 */
function buildPrintDoc(doc: Document): Document {
  const clone = doc.cloneNode(true) as Document;
  feelWordsDirection(clone)?.remove();
  applySlashGrid(clone, { force: true });
  return clone;
}

/** Layout width (px) the hidden A4 render lays out at; print CSS scales to A4. */
const PRINT_WIDTH = 1100;

/**
 * Off-screen second OSMD (M10, PRD §6.6) that renders the chart paginated onto
 * A4 sheets (`pageFormat: 'A4_P'`) — the clean, clip-free print the M7 single-SVG
 * `@media print` couldn't produce. Lives off-screen (NOT `display:none`, so
 * VexFlow can measure text), portaled to `<body>` so `print.css` can isolate it.
 * Each rendered page `<svg>` is captured and re-mounted as its own `.print-sheet`
 * (one physical page each, `break-after: page`), with the document header on
 * sheet 1 and a page number on later sheets. Reused later for the P4 A4 PDF.
 */
export const PrintView = forwardRef<PrintHandle, PrintViewProps>(
  function PrintView({ doc, info }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    // Captured page SVGs (outerHTML), re-mounted as print sheets.
    const [pages, setPages] = useState<string[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        async prepare() {
          const host = hostRef.current;
          if (!host) return;
          let osmd = osmdRef.current;
          if (!osmd) {
            osmd = new OpenSheetMusicDisplay(host, {
              autoResize: false,
              backend: 'svg',
              drawTitle: false,
              drawPartNames: false,
              drawComposer: false,
              drawSubtitle: false,
              drawMetronomeMarks: false,
            });
            const rules = osmd.EngravingRules;
            // Match the screen's lead-sheet density + simplified look, but leave
            // chords/slashes inked (no transparency) since there's no overlay.
            rules.RenderXMeasuresPerLineAkaSystem = 4;
            rules.NewSystemAtXMLNewSystemAttribute = true;
            rules.RenderClefsAtBeginningOfStaffline = false;
            rules.RenderKeySignatures = false;
            rules.MinimumDistanceBetweenSystems = 15;
            rules.MinSkyBottomDistBetweenSystems = 14;
            rules.ChordSymbolYPadding = 1.2;
            rules.PageTopMargin = 16; // headroom for the page-1 header band
            osmd.setPageFormat('A4_P');
            osmdRef.current = osmd;
          }
          await osmd.load(buildPrintDoc(doc));
          osmd.render();
          const svgs = [...host.querySelectorAll('svg')] as SVGElement[];
          setPages(
            svgs.map((s) => {
              const c = s.cloneNode(true) as SVGElement;
              c.removeAttribute('id'); // avoid duplicate ids vs the live host
              return c.outerHTML;
            }),
          );
        },
      }),
      [doc],
    );

    return createPortal(
      <div className="print-root" aria-hidden="true">
        {/* Off-screen measurement host: where the print OSMD instance renders.
            Hidden in @media print — the captured sheets below are what prints. */}
        <div
          ref={hostRef}
          className="print-measure"
          style={{ width: PRINT_WIDTH }}
        />
        {pages.map((html, i) => (
          <div className="print-sheet" key={i}>
            <div
              className="print-sheet__svg"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {i === 0 ? (
              <div className="print-sheet__header">
                <ScoreHeader info={info} />
              </div>
            ) : (
              <div className="print-sheet__number">Page {i + 1}</div>
            )}
          </div>
        ))}
      </div>,
      document.body,
    );
  },
);
