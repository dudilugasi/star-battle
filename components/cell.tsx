"use client";

import { memo, useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CellValue, cellKey } from "@/lib/types";
import { CellBorders, regionTint } from "@/lib/regions";

// Match `--animate-fade-out` duration in globals.css. The ghost stays
// mounted exactly this long before it gets cleared.
const EXIT_DURATION_MS = 220;

interface CellProps {
  r: number;
  c: number;
  value: CellValue;
  region: number;
  borders: CellBorders;
  conflict: boolean;
  disabled: boolean;
  onClick: (r: number, c: number) => void;
  /**
   * Pointer-down hook from `useDragPaint`. Starts a paint drag on empty
   * cells; on x / star it's a no-op so the normal click → cycle still
   * runs on pointerup.
   */
  onPointerDown: (
    r: number,
    c: number,
    value: CellValue,
    e: ReactPointerEvent<HTMLElement>,
  ) => void;
}

// One cell of the board. Borders are conditional Tailwind classes — thick
// on edges that separate two regions, thin elsewhere. Region tint is the
// background color, conflict overlays it with a translucent red.
function CellImpl({
  r,
  c,
  value,
  region,
  borders,
  conflict,
  disabled,
  onClick,
  onPointerDown,
}: CellProps) {
  const tint = regionTint(region);

  // Animate the outgoing symbol when value→empty. We adjust state during
  // render (React's recommended pattern for prop-driven derived state):
  // when `trackedValue` doesn't match the new `value` prop, queue
  // `setExiting`/`setTrackedValue`, and React discards this render and
  // re-renders synchronously before commit — so the DOM goes directly
  // from <star> to <ghost fading> with no blank-frame flash. Doing this
  // in useEffect would commit the empty state first, then a second render
  // would mount the ghost at full opacity → visible blink.
  const [exiting, setExiting] = useState<Exclude<CellValue, "empty"> | null>(
    null,
  );
  const [trackedValue, setTrackedValue] = useState<CellValue>(value);

  if (trackedValue !== value) {
    setTrackedValue(value);
    if (value === "empty" && (trackedValue === "star" || trackedValue === "x")) {
      setExiting(trackedValue);
    } else if (value !== "empty" && exiting !== null) {
      // New symbol arrived while a ghost was mid-fade (undo/redo). Drop
      // the ghost so we don't render two symbols stacked on top.
      setExiting(null);
    }
  }

  // Clear the ghost after the fade completes. Re-running on `exiting`
  // change means an undo→ghost-cancel path also clears any pending timer
  // via the cleanup function.
  useEffect(() => {
    if (exiting === null) return;
    const id = window.setTimeout(() => setExiting(null), EXIT_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [exiting]);
  const borderClasses = [
    borders.top ? "border-t-4 border-t-zinc-900 dark:border-t-zinc-100" : "border-t border-t-zinc-300 dark:border-t-zinc-700",
    borders.right ? "border-r-4 border-r-zinc-900 dark:border-r-zinc-100" : "border-r border-r-zinc-300 dark:border-r-zinc-700",
    borders.bottom ? "border-b-4 border-b-zinc-900 dark:border-b-zinc-100" : "border-b border-b-zinc-300 dark:border-b-zinc-700",
    borders.left ? "border-l-4 border-l-zinc-900 dark:border-l-zinc-100" : "border-l border-l-zinc-300 dark:border-l-zinc-700",
  ].join(" ");

  return (
    <button
      type="button"
      onClick={() => onClick(r, c)}
      onPointerDown={(e) => onPointerDown(r, c, value, e)}
      disabled={disabled}
      aria-label={`Cell ${r + 1}, ${c + 1}: ${value}`}
      data-cell={cellKey(r, c)}
      // `touch-none` (touch-action: none) keeps the browser from claiming
      // touch drags as page scrolls, so our paint gesture gets the events.
      className={[
        "relative aspect-square w-full select-none touch-none transition-colors overflow-hidden",
        "flex items-center justify-center",
        "text-2xl sm:text-3xl font-bold",
        tint,
        borderClasses,
        conflict
          ? "ring-2 ring-inset ring-red-500/80 bg-red-200/70 dark:bg-red-900/40"
          : "",
        disabled ? "cursor-default" : "cursor-pointer hover:brightness-110 active:brightness-95",
      ].join(" ")}
    >
      {/* Outgoing ghost: rendered briefly after value→empty so the symbol
       * fades out instead of vanishing. Cleared when the timer fires. */}
      {exiting === "star" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-amber-500 drop-shadow-sm animate-fade-out"
        >
          ★
        </span>
      )}
      {exiting === "x" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400 animate-fade-out"
        >
          ✕
        </span>
      )}
      {/* The ripple + symbol spans only mount while value is non-empty, so
       * the CSS animations fire exactly on appearance — no effect plumbing.
       * Conflict / disabled re-renders keep these spans mounted, so the
       * animation does not replay on unrelated state changes. */}
      {value === "star" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-amber-300 animate-ripple"
          />
          <span className="relative text-amber-500 drop-shadow-sm animate-pop" aria-hidden>
            ★
          </span>
        </>
      )}
      {value === "x" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-zinc-400/80 dark:bg-zinc-300/70 animate-ripple"
          />
          <span className="relative text-zinc-500 dark:text-zinc-400 animate-pop" aria-hidden>
            ✕
          </span>
        </>
      )}
    </button>
  );
}

// `memo` so a single cell click doesn't rerender all 64 cells of an 8x8 board.
export const Cell = memo(CellImpl);
