/**
 * Undo/redo history for the command layer (PRD §7.3). Holds two stacks of
 * inverse commands; `dispatch`/`undo`/`redo` all funnel through the same
 * capture-inverse → apply → push pattern, so any well-formed `Command` works
 * uniformly. Framework-agnostic and unit-testable; React wiring lives in
 * `store/useScoreEditor.ts`.
 */

import type { Command } from './Command';

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly doc: Document;

  constructor(doc: Document) {
    this.doc = doc;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Apply a new edit: capture its inverse, run it, and clear the redo stack. */
  dispatch(cmd: Command): void {
    const inverse = cmd.invert(this.doc);
    cmd.apply(this.doc);
    this.undoStack.push(inverse);
    this.redoStack = [];
  }

  /** Reverse the most recent edit. Returns false if nothing to undo. */
  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    const redoCmd = cmd.invert(this.doc);
    cmd.apply(this.doc);
    this.redoStack.push(redoCmd);
    return true;
  }

  /** Re-apply the most recently undone edit. Returns false if nothing to redo. */
  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    const undoCmd = cmd.invert(this.doc);
    cmd.apply(this.doc);
    this.undoStack.push(undoCmd);
    return true;
  }
}
