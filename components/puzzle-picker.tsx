"use client";

import { useCallback, useEffect, useState } from "react";
import { Difficulty, Puzzle } from "@/lib/types";
import { BEST_TIME_SAVED_EVENT, loadBestTime } from "@/lib/storage";

interface PuzzlePickerProps {
  puzzles: Puzzle[];
  currentId: string;
  onPick: (puzzle: Puzzle) => void;
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PuzzlePicker({
  puzzles,
  currentId,
  onPick,
}: PuzzlePickerProps) {
  // Best times come from localStorage. Re-read whenever the active puzzle
  // changes, or when storage signals a fresh save (e.g. the player just
  // solved the active puzzle without switching to a different one).
  const [bestTimes, setBestTimes] = useState<Record<string, number | null>>({});
  const refreshBestTimes = useCallback(() => {
    const next: Record<string, number | null> = {};
    for (const p of puzzles) next[p.id] = loadBestTime(p.id);
    setBestTimes(next);
  }, [puzzles]);
  useEffect(() => {
    refreshBestTimes();
  }, [refreshBestTimes, currentId]);
  useEffect(() => {
    const handler = () => refreshBestTimes();
    window.addEventListener(BEST_TIME_SAVED_EVENT, handler);
    return () => window.removeEventListener(BEST_TIME_SAVED_EVENT, handler);
  }, [refreshBestTimes]);

  // Group by grid size first, then by difficulty.
  const sizes = Array.from(new Set(puzzles.map((p) => p.size))).sort(
    (a, b) => a - b,
  );

  return (
    <aside className="w-full md:w-72 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 md:h-screen md:overflow-y-auto p-4 bg-zinc-50/50 dark:bg-zinc-950/40">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
        Puzzles
      </h2>
      <div className="flex flex-col gap-5">
        {sizes.map((size) => (
          <section key={size}>
            <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              {size} × {size}
            </h3>
            <ul className="flex flex-col gap-1">
              {puzzles
                .filter((p) => p.size === size)
                .sort(
                  (a, b) =>
                    DIFFICULTY_ORDER.indexOf(a.difficulty) -
                      DIFFICULTY_ORDER.indexOf(b.difficulty) ||
                    a.id.localeCompare(b.id),
                )
                .map((p) => {
                  const isActive = p.id === currentId;
                  const best = bestTimes[p.id];
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onPick(p)}
                        className={[
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                          "flex items-center justify-between gap-2",
                          isActive
                            ? "bg-amber-200/70 dark:bg-amber-500/20 ring-1 ring-amber-500"
                            : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60",
                        ].join(" ")}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className="flex flex-col">
                          <span className="font-medium flex items-center gap-1.5">
                            {p.name}
                            {best != null && (
                              <span
                                aria-label="Solved"
                                title="Solved"
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none"
                              >
                                ✓
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {DIFFICULTY_LABELS[p.difficulty]}
                          </span>
                        </span>
                        {best != null && (
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {formatTime(best)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
