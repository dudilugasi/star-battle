"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CellValue, cellKey } from "@/lib/types";

interface UseDragPaintOptions {
  /** Live board. Read via ref so window-scoped listeners see the latest. */
  board: CellValue[][];
  /** Dispatcher for placing a user-X. */
  paintCell: (r: number, c: number, opts: { commit: boolean }) => void;
  /** True when the puzzle is solved or pre-hydrated; gestures are ignored. */
  disabled: boolean;
}

interface DragPaintHandlers {
  /**
   * Wire onto each cell. Starts a paint drag if the cell is empty;
   * otherwise yields to the cell's normal click → cycle behavior.
   */
  onPointerDown: (
    r: number,
    c: number,
    value: CellValue,
    e: ReactPointerEvent<HTMLElement>,
  ) => void;
}

// Drag-paint: press on an empty cell to start painting X's, drag across
// other empty cells to mark them too. X's and stars are never overwritten —
// the gesture only ever flips empty → x. The whole drag is one undo step
// because we send PAINT_X with `commit: true` for the first cell and
// `commit: false` for every cell after.
//
// We listen for pointermove/pointerup on `window` and hit-test cells via
// `document.elementFromPoint`. This avoids relying on `pointerenter` (which
// doesn't fire reliably on touch) and works the same for mouse and touch.
// The board container sets `touch-action: none` so the browser doesn't
// intercept the drag for scrolling.
export function useDragPaint({
  board,
  paintCell,
  disabled,
}: UseDragPaintOptions): DragPaintHandlers {
  // Refs so window-scoped handlers always read the latest values without
  // having to rebind on every state change.
  const boardRef = useRef(board);
  boardRef.current = board;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const paintCellRef = useRef(paintCell);
  paintCellRef.current = paintCell;

  // True between pointerdown-on-empty and pointerup. Outside that window,
  // pointermove is a no-op.
  const isPaintingRef = useRef(false);
  // Cells already painted in the current drag — both to avoid duplicate
  // dispatches and to skip re-entries onto the start cell.
  const paintedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function cellAt(x: number, y: number): [number, number] | null {
      const el = document.elementFromPoint(x, y);
      if (!(el instanceof HTMLElement)) return null;
      const node = el.closest<HTMLElement>("[data-cell]");
      if (!node || !node.dataset.cell) return null;
      const [r, c] = node.dataset.cell.split(",").map(Number);
      if (Number.isNaN(r) || Number.isNaN(c)) return null;
      return [r, c];
    }

    function handleMove(e: PointerEvent) {
      if (!isPaintingRef.current) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (!hit) return;
      const [r, c] = hit;
      const key = cellKey(r, c);
      if (paintedRef.current.has(key)) return;
      // Re-check liveness against the current board: we don't want to
      // dispatch a PAINT_X that the reducer will reject anyway.
      if (boardRef.current[r]?.[c] !== "empty") return;
      paintedRef.current.add(key);
      paintCellRef.current(r, c, { commit: false });
    }

    function handleEnd() {
      if (!isPaintingRef.current) return;
      isPaintingRef.current = false;
      paintedRef.current.clear();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    // If the pointer leaves the document entirely (e.g. dragged out of the
    // window with the mouse button still held), end the drag conservatively
    // so we don't get stuck in paint mode.
    window.addEventListener("blur", handleEnd);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      window.removeEventListener("blur", handleEnd);
    };
  }, []);

  function onPointerDown(
    r: number,
    c: number,
    value: CellValue,
    e: ReactPointerEvent<HTMLElement>,
  ) {
    if (disabledRef.current) return;
    // Primary button only on mouse. Touch and pen always pass through.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Only empty cells start a paint drag. X / star fall through to the
    // cell's onClick → cycleCell, which still handles x → star → empty.
    if (value !== "empty") return;

    // Suppress the synthetic click that would otherwise fire on pointerup
    // if the user releases without moving. Without this, an empty cell
    // would become x (paint) and then immediately star (click → cycle).
    e.preventDefault();

    isPaintingRef.current = true;
    paintedRef.current = new Set([cellKey(r, c)]);
    paintCellRef.current(r, c, { commit: true });
  }

  return { onPointerDown };
}
