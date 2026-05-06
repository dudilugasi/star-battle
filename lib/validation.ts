import { CellValue, ConflictSet, Puzzle, cellKey } from "./types";

// Computes the set of cells that participate in a rule violation. Pure.
//
// Rules (1-star Star Battle):
//   1. At most one star per row.
//   2. At most one star per column.
//   3. At most one star per region.
//   4. No two stars may be adjacent (8 directions).
//
// "At most one" rather than "exactly one": the player is allowed to have
// fewer than N stars while building up the solution; only excess is an error.
// The `isSolved` check below enforces "exactly one" for completion.
export function findConflicts(
  board: CellValue[][],
  puzzle: Puzzle,
): ConflictSet {
  const n = puzzle.size;
  const cells = new Set<string>();
  const reason = {
    rows: [] as number[],
    cols: [] as number[],
    regions: [] as number[],
    adjacencies: [] as Array<[string, string]>,
  };

  // Collect star positions, grouped by row/col/region.
  const byRow: number[][][] = Array.from({ length: n }, () => []);
  const byCol: number[][][] = Array.from({ length: n }, () => []);
  const byRegion: number[][][] = Array.from({ length: n }, () => []);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] === "star") {
        byRow[r].push([r, c]);
        byCol[c].push([r, c]);
        byRegion[puzzle.regions[r][c]].push([r, c]);
      }
    }
  }

  const flagAll = (group: number[][]) => {
    for (const [r, c] of group) cells.add(cellKey(r, c));
  };

  for (let i = 0; i < n; i++) {
    if (byRow[i].length > 1) {
      reason.rows.push(i);
      flagAll(byRow[i]);
    }
    if (byCol[i].length > 1) {
      reason.cols.push(i);
      flagAll(byCol[i]);
    }
    if (byRegion[i].length > 1) {
      reason.regions.push(i);
      flagAll(byRegion[i]);
    }
  }

  // Adjacency check.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== "star") continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          if (board[nr][nc] !== "star") continue;
          // Avoid recording each pair twice.
          if (nr < r || (nr === r && nc < c)) continue;
          cells.add(cellKey(r, c));
          cells.add(cellKey(nr, nc));
          reason.adjacencies.push([cellKey(r, c), cellKey(nr, nc)]);
        }
      }
    }
  }

  return { cells, reason };
}

// True iff the board is a complete, valid solution: exactly one star per row,
// per column, and per region, with no adjacency violations.
export function isSolved(board: CellValue[][], puzzle: Puzzle): boolean {
  const n = puzzle.size;
  const rowCounts = new Array(n).fill(0);
  const colCounts = new Array(n).fill(0);
  const regionCounts = new Array(n).fill(0);
  let totalStars = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== "star") continue;
      totalStars++;
      rowCounts[r]++;
      colCounts[c]++;
      regionCounts[puzzle.regions[r][c]]++;
    }
  }

  if (totalStars !== n) return false;
  for (let i = 0; i < n; i++) {
    if (rowCounts[i] !== 1) return false;
    if (colCounts[i] !== 1) return false;
    if (regionCounts[i] !== 1) return false;
  }

  // No conflicts at all (in particular, no adjacency).
  return findConflicts(board, puzzle).cells.size === 0;
}

export function emptyBoard(size: number): CellValue[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "empty" as CellValue),
  );
}

export function emptyAutoX(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

export function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map((row) => row.slice());
}

export function cloneAutoX(autoX: boolean[][]): boolean[][] {
  return autoX.map((row) => row.slice());
}

// Returns every cell that a star at (r, c) forbids: same row, same column,
// same region, and the 8-adjacent cells. Excludes (r, c) itself.
export function forbiddenCells(
  r: number,
  c: number,
  puzzle: Puzzle,
): Array<[number, number]> {
  const n = puzzle.size;
  const region = puzzle.regions[r][c];
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  const add = (rr: number, cc: number) => {
    if (rr === r && cc === c) return;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n) return;
    const key = `${rr},${cc}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([rr, cc]);
  };
  for (let cc = 0; cc < n; cc++) add(r, cc);
  for (let rr = 0; rr < n; rr++) add(rr, c);
  for (let rr = 0; rr < n; rr++) {
    for (let cc = 0; cc < n; cc++) {
      if (puzzle.regions[rr][cc] === region) add(rr, cc);
    }
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      add(r + dr, c + dc);
    }
  }
  return out;
}

// True iff some star (other than at `excludeR/C`, if given) on the board
// forbids the cell at (r, c). Used when removing a star to decide whether
// each auto-X it owned should revert to empty.
export function isForbiddenBySomeStar(
  r: number,
  c: number,
  board: CellValue[][],
  puzzle: Puzzle,
  excludeR = -1,
  excludeC = -1,
): boolean {
  const n = puzzle.size;
  const region = puzzle.regions[r][c];
  for (let rr = 0; rr < n; rr++) {
    for (let cc = 0; cc < n; cc++) {
      if (board[rr][cc] !== "star") continue;
      if (rr === excludeR && cc === excludeC) continue;
      if (rr === r && cc === c) continue;
      if (rr === r) return true;
      if (cc === c) return true;
      if (puzzle.regions[rr][cc] === region) return true;
      if (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1) return true;
    }
  }
  return false;
}
