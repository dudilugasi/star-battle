// Core domain types for the Star Battle game.
//
// This is a 1-star variant: every row, every column, and every region
// must contain exactly one star, and no two stars may touch (8-direction).

export type GridSize = 5 | 8;
export type Difficulty = "easy" | "medium" | "hard";
export type CellValue = "empty" | "star" | "x";

export interface Puzzle {
  /** Stable id, e.g. `"e1-5x5"`. Used as the React key and the storage key. */
  id: string;
  /** Human-readable name shown in the picker. */
  name: string;
  size: GridSize;
  difficulty: Difficulty;
  /**
   * `regions[row][col]` returns the region index (0..size-1) for that cell.
   * Each region must contain exactly `size` cells.
   */
  regions: number[][];
  /** Optional canonical solution: `solution[r][c] === true` means a star goes there. */
  solution?: boolean[][];
  volume: number;
  book: number;
  puzzleNumber: number;
}

export interface GameSnapshot {
  board: CellValue[][];
  /**
   * Parallel `size × size` grid of booleans. `true` at (r,c) means the X at
   * that cell was placed automatically (because some star forbids the cell),
   * not by the user. Auto-X's are cleared when the responsible star(s) are
   * removed; user-placed X's persist.
   */
  autoX: boolean[][];
}

export interface GameState extends GameSnapshot {
  puzzle: Puzzle;
  /** Past snapshots for undo. Most recent at the end. */
  history: GameSnapshot[];
  /** Future snapshots for redo. Most recent at the end. */
  future: GameSnapshot[];
  /** Epoch ms when the puzzle was loaded (or reset). */
  startedAt: number;
  /** Frozen at solve time; kept in sync by TICK actions while playing. */
  elapsedMs: number;
  status: "playing" | "solved";
}

export interface ConflictReason {
  rows: number[];
  cols: number[];
  regions: number[];
  adjacencies: Array<[string, string]>;
}

export interface ConflictSet {
  /** "r,c" keys for every cell that participates in any rule violation. */
  cells: Set<string>;
  reason: ConflictReason;
}

export const cellKey = (r: number, c: number): string => `${r},${c}`;
