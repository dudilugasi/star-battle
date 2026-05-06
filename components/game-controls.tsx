"use client";

import { useEffect, useState } from "react";
import { loadBestTime } from "@/lib/storage";

interface GameControlsProps {
  puzzleId: string;
  elapsedMs: number;
  status: "playing" | "solved";
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GameControls({
  puzzleId,
  elapsedMs,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
}: GameControlsProps) {
  // Best time lives in localStorage; read it client-side after mount to avoid
  // hydration mismatches.
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    setBest(loadBestTime(puzzleId));
    // Re-read on solve so the display refreshes if we just set a new record.
  }, [puzzleId, status]);

  const btn =
    "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors " +
    "border-zinc-300 dark:border-zinc-700 " +
    "bg-white dark:bg-zinc-900 " +
    "hover:bg-zinc-100 dark:hover:bg-zinc-800 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-3 w-full max-w-[min(90vw,560px)] justify-between">
      <div className="flex items-center gap-3 font-mono text-sm">
        <span aria-label="Elapsed time">⏱ {formatTime(elapsedMs)}</span>
        {best !== null && (
          <span className="text-zinc-500 dark:text-zinc-400">
            best {formatTime(best)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={!canUndo}
          onClick={onUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className={btn}
          disabled={!canRedo}
          onClick={onRedo}
        >
          Redo
        </button>
        <button type="button" className={btn} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
