"use client";

import { useMemo } from "react";
import { Cell } from "./cell";
import { CellValue, Puzzle, cellKey } from "@/lib/types";
import { computeBorders } from "@/lib/regions";

interface GameBoardProps {
  puzzle: Puzzle;
  board: CellValue[][];
  conflicts: Set<string>;
  disabled: boolean;
  onCellClick: (r: number, c: number) => void;
}

export function GameBoard({
  puzzle,
  board,
  conflicts,
  disabled,
  onCellClick,
}: GameBoardProps) {
  // Borders only depend on the region map, not the play state — memoize.
  const borders = useMemo(() => computeBorders(puzzle), [puzzle]);

  return (
    <div
      className="grid w-full max-w-[min(90vw,560px)] aspect-square shadow-lg rounded-md overflow-hidden bg-white dark:bg-zinc-900"
      style={{
        gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${puzzle.size}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label={`Star Battle board, ${puzzle.size} by ${puzzle.size}`}
    >
      {board.map((row, r) =>
        row.map((value, c) => (
          <Cell
            key={cellKey(r, c)}
            r={r}
            c={c}
            value={value}
            region={puzzle.regions[r][c]}
            borders={borders[r][c]}
            conflict={conflicts.has(cellKey(r, c))}
            disabled={disabled}
            onClick={onCellClick}
          />
        )),
      )}
    </div>
  );
}
