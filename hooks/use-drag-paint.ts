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

// Drag-paint: press on an empty cell and drag across other empty cells to
// mark them all with X's. X's and stars are never overwritten — the gesture
// only ever flips empty → x. The whole drag is one undo step because we send
// PAINT_X with `commit: true` for the first cell and `commit: false` for
// every cell after.
//
// A pointerdown on an empty cell only *arms* the gesture; the first paint
// fires on pointermove. A no-move release falls through to the cell's normal
// onClick → cycleCell, which handles empty → x there. Painting on
// pointerdown was tempting but the synthetic click still fires on a
// `<button>` after `e.preventDefault()`, so a single click would land x
// (paint) and then immediately star (click → cycle on now-x cell).
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

  // Pointerdown landed on an empty cell but no movement yet. On the first
  // move that exits this cell, we promote to active paint and commit the
  // start cell as the first stroke of the drag.
  const armedRef = useRef<{ r: number; c: number } | null>(null);
  // True once paint has been promoted from armed → active. While true,
  // pointermove paints any empty cells the pointer crosses.
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

    function paintIfEmpty(r: number, c: number, commit: boolean) {
      const key = cellKey(r, c);
      if (paintedRef.current.has(key)) return;
      if (boardRef.current[r]?.[c] !== "empty") return;
      paintedRef.current.add(key);
      paintCellRef.current(r, c, { commit });
    }

    function handleMove(e: PointerEvent) {
      const armed = armedRef.current;
      if (armed) {
        const hit = cellAt(e.clientX, e.clientY);
        if (!hit) return;
        const [r, c] = hit;
        // Stay armed until the pointer actually leaves the start cell.
        // Tiny jitter inside the same cell shouldn't kick off paint mode.
        if (r === armed.r && c === armed.c) return;
        armedRef.current = null;
        isPaintingRef.current = true;
        paintedRef.current = new Set();
        // Commit the start cell as the head of this drag's undo entry,
        // then continue the same entry with the cell we just crossed into.
        paintIfEmpty(armed.r, armed.c, true);
        paintIfEmpty(r, c, false);
        return;
      }

      if (!isPaintingRef.current) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (!hit) return;
      paintIfEmpty(hit[0], hit[1], false);
    }

    function handleEnd() {
      armedRef.current = null;
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
    // Only empty cells can start a paint drag. X / star fall through to
    // the cell's onClick → cycleCell, which still handles x → star → empty.
    if (value !== "empty") return;

    // Arm the gesture but don't paint yet — first pointermove past this
    // cell promotes it to a real drag. A no-move release will fire the
    // button's synthetic click and cycleCell takes care of empty → x.
    armedRef.current = { r, c };
  }

  return { onPointerDown };
}
