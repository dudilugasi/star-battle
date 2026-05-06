import { Puzzle } from "./types";

// Per-cell border flags. `true` means "the neighbor on this side belongs to
// a different region (or is outside the grid), so draw a thick edge here".
export interface CellBorders {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export function computeBorders(puzzle: Puzzle): CellBorders[][] {
  const n = puzzle.size;
  const out: CellBorders[][] = [];
  for (let r = 0; r < n; r++) {
    const row: CellBorders[] = [];
    for (let c = 0; c < n; c++) {
      const region = puzzle.regions[r][c];
      const differs = (nr: number, nc: number) =>
        nr < 0 ||
        nr >= n ||
        nc < 0 ||
        nc >= n ||
        puzzle.regions[nr][nc] !== region;
      row.push({
        top: differs(r - 1, c),
        right: differs(r, c + 1),
        bottom: differs(r + 1, c),
        left: differs(r, c - 1),
      });
    }
    out.push(row);
  }
  return out;
}

// Pastel palette, indexed by region number. Long enough for any puzzle size
// we might add later. Pairs with `dark:` variants in <Cell> for dark mode.
export const REGION_TINTS: string[] = [
  "bg-rose-100 dark:bg-rose-950/40",
  "bg-amber-100 dark:bg-amber-950/40",
  "bg-lime-100 dark:bg-lime-950/40",
  "bg-emerald-100 dark:bg-emerald-950/40",
  "bg-cyan-100 dark:bg-cyan-950/40",
  "bg-sky-100 dark:bg-sky-950/40",
  "bg-violet-100 dark:bg-violet-950/40",
  "bg-fuchsia-100 dark:bg-fuchsia-950/40",
  "bg-orange-100 dark:bg-orange-950/40",
  "bg-teal-100 dark:bg-teal-950/40",
];

export function regionTint(regionIndex: number): string {
  return REGION_TINTS[regionIndex % REGION_TINTS.length];
}
