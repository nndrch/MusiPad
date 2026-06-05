import { useCallback, useMemo, useState } from 'react';
import type { Command } from '../commands/Command';
import { History } from '../commands/History';

/**
 * React bridge to the command layer (PRD §7.3, M3). Owns a `History` for the
 * current document and exposes dispatch/undo/redo plus a `revision` counter
 * that bumps on every applied edit.
 *
 * Why `revision`: commands mutate the MusicXML DOM *in place*, so the `doc`
 * object identity never changes — React/OSMD/the transport wouldn't otherwise
 * know to refresh. Threading `revision` into their dependency lists re-renders
 * the view from the (now-mutated) single source of truth (Invariant #1).
 */
export interface ScoreEditor {
  dispatch: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  revision: number;
}

export function useScoreEditor(doc: Document): ScoreEditor {
  // Fresh history per loaded document.
  const history = useMemo(() => new History(doc), [doc]);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const dispatch = useCallback(
    (cmd: Command) => {
      history.dispatch(cmd);
      bump();
    },
    [history, bump],
  );
  const undo = useCallback(() => {
    if (history.undo()) bump();
  }, [history, bump]);
  const redo = useCallback(() => {
    if (history.redo()) bump();
  }, [history, bump]);

  // canUndo/canRedo are read each render; `bump` re-renders after every edit,
  // so they're always current.
  return {
    dispatch,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    revision,
  };
}
