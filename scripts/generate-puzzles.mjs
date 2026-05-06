// One-shot puzzle generator + verifier.
//
// Given a hand-picked valid 1-star solution (positions where stars go), this
// carves the grid into N contiguous regions of N cells each, with each region
// containing exactly one star. It then verifies a solution exists by running
// a brute-force solver, and prints the puzzle as a TS module.
//
// Run: node scripts/generate-puzzles.mjs

// ---------- region carving ----------

// Carve the grid into N contiguous regions of N cells each, each containing
// one star.
//
// Two-phase:
//   1. Greedy growth (no cap): every cell ends up assigned to whichever
//      claimed neighbor region is currently smallest. Guarantees all cells
//      get claimed and every region stays connected.
//   2. Rebalance: while any region is too big, transfer a boundary cell to
//      an adjacent too-small region, only if removing the cell doesn't
//      disconnect the donor.
function carveRegions(size, stars) {
  if (stars.length !== size) {
    throw new Error(`expected ${size} stars, got ${stars.length}`);
  }
  const regions = Array.from({ length: size }, () => Array(size).fill(-1));
  for (let i = 0; i < stars.length; i++) {
    const [r, c] = stars[i];
    regions[r][c] = i;
  }
  const sizes = stars.map(() => 1);
  const total = size * size;
  let claimed = stars.length;

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Phase 1: round-robin growth. Each iteration, every under-capacity region
  // claims one of its frontier cells (if any). Keeps sizes within 1 of each
  // other, which makes phase-2 rebalance trivial or unnecessary.
  while (claimed < total) {
    let progressed = false;
    for (let region = 0; region < stars.length; region++) {
      if (sizes[region] >= size) continue;
      // Find any unclaimed cell adjacent to this region.
      let chosen = null;
      for (let r = 0; r < size && !chosen; r++) {
        for (let c = 0; c < size && !chosen; c++) {
          if (regions[r][c] !== region) continue;
          for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            if (regions[nr][nc] !== -1) continue;
            chosen = [nr, nc];
            break;
          }
        }
      }
      if (!chosen) continue;
      regions[chosen[0]][chosen[1]] = region;
      sizes[region]++;
      claimed++;
      progressed = true;
    }
    if (!progressed) {
      // A region cannot reach an unclaimed cell. Fall back to greedy: pick
      // any unclaimed cell adjacent to ANY region (even at capacity) and
      // assign to the smallest such neighbor; phase 2 will rebalance.
      let pickR = -1, pickC = -1, pickRegion = -1, pickRegionSize = Infinity;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] !== -1) continue;
          for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            const reg = regions[nr][nc];
            if (reg === -1) continue;
            if (sizes[reg] < pickRegionSize) {
              pickRegionSize = sizes[reg];
              pickRegion = reg;
              pickR = r;
              pickC = c;
            }
          }
        }
      }
      if (pickRegion === -1) throw new Error("carve phase 1: unreachable cell");
      regions[pickR][pickC] = pickRegion;
      sizes[pickRegion]++;
      claimed++;
    }
  }

  // Phase 2: rebalance.
  const isConnectedWithout = (regionIdx, removeR, removeC) => {
    // BFS through region cells excluding (removeR, removeC), starting from
    // any other cell of the region. Region remains connected iff BFS visits
    // every other cell.
    const cells = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (regions[r][c] === regionIdx && !(r === removeR && c === removeC))
          cells.push([r, c]);
    if (cells.length <= 1) return true;
    const seen = new Set();
    const start = cells[0];
    seen.add(`${start[0]},${start[1]}`);
    const queue = [start];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (nr === removeR && nc === removeC) continue;
        if (regions[nr][nc] !== regionIdx) continue;
        const key = `${nr},${nc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nr, nc]);
      }
    }
    return seen.size === cells.length;
  };

  // Builds an adjacency graph between regions: two regions are adjacent if
  // they share a 4-neighbor edge somewhere on the grid.
  const buildRegionAdjacency = () => {
    const adj = Array.from({ length: stars.length }, () => new Set());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const a = regions[r][c];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          const b = regions[nr][nc];
          if (b !== a) {
            adj[a].add(b);
            adj[b].add(a);
          }
        }
      }
    }
    return adj;
  };

  // Try moving a cell from `from` to `to`, given they share a border. Returns
  // true and applies the move if possible without disconnecting `from`.
  const tryMove = (from, to) => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] !== from) continue;
        if (stars.some(([sr, sc]) => sr === r && sc === c)) continue;
        let touchesTo = false;
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          if (regions[nr][nc] === to) {
            touchesTo = true;
            break;
          }
        }
        if (!touchesTo) continue;
        if (!isConnectedWithout(from, r, c)) continue;
        regions[r][c] = to;
        sizes[from]--;
        sizes[to]++;
        return true;
      }
    }
    return false;
  };

  let safety = 5000;
  while (sizes.some((s) => s !== size) && safety-- > 0) {
    const big = sizes.findIndex((s) => s > size);
    const small = sizes.findIndex((s) => s < size);
    if (big === -1 || small === -1) break;
    // Find a path from `big` to `small` through region adjacency.
    const adj = buildRegionAdjacency();
    const prev = new Map();
    const queue = [big];
    prev.set(big, null);
    while (queue.length) {
      const cur = queue.shift();
      if (cur === small) break;
      for (const n of adj[cur]) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        queue.push(n);
      }
    }
    if (!prev.has(small)) {
      throw new Error(`carve phase 2: regions ${big} and ${small} not connected by adjacency`);
    }
    // Reconstruct path big -> ... -> small.
    const path = [];
    for (let n = small; n !== null; n = prev.get(n)) path.push(n);
    path.reverse(); // big at start, small at end
    // Walk path in reverse: at step i, transfer one cell from path[i-1] to path[i].
    let chainOk = true;
    for (let i = path.length - 1; i >= 1; i--) {
      if (!tryMove(path[i - 1], path[i])) {
        chainOk = false;
        break;
      }
    }
    if (!chainOk) {
      throw new Error(`carve phase 2: chain transfer failed (sizes=${sizes.join(",")})`);
    }
  }
  return regions;
}

function collectNeighbors(regions, r, c, size) {
  const out = [];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    if (regions[nr][nc] === -1) out.push([nr, nc]);
  }
  return out;
}

// ---------- solver ----------

// Counts solutions up to `cap`. Used to verify a puzzle has at least one
// solution (and ideally exactly one).
function countSolutions(regions, size, cap = 2) {
  // For each region, enumerate cells.
  const regionCells = Array.from({ length: size }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      regionCells[regions[r][c]].push([r, c]);
    }
  }

  let count = 0;
  const used = { rows: new Set(), cols: new Set() };
  const placed = [];

  function adjacentToPlaced(r, c) {
    for (const [pr, pc] of placed) {
      if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return true;
    }
    return false;
  }

  function recurse(regionIdx) {
    if (count >= cap) return;
    if (regionIdx === size) {
      count++;
      return;
    }
    for (const [r, c] of regionCells[regionIdx]) {
      if (used.rows.has(r) || used.cols.has(c)) continue;
      if (adjacentToPlaced(r, c)) continue;
      used.rows.add(r);
      used.cols.add(c);
      placed.push([r, c]);
      recurse(regionIdx + 1);
      placed.pop();
      used.rows.delete(r);
      used.cols.delete(c);
      if (count >= cap) return;
    }
  }
  recurse(0);
  return count;
}

// ---------- emit ----------

function toTS(meta, regions, solutionStars) {
  const size = regions.length;
  const solution = Array.from({ length: size }, () => Array(size).fill(false));
  for (const [r, c] of solutionStars) solution[r][c] = true;

  const fmtRow = (row) => `[${row.join(", ")}]`;
  const regionsLit = regions.map(fmtRow).join(",\n    ");
  const solutionLit = solution.map((row) => `[${row.join(", ")}]`).join(",\n    ");

  return `import { Puzzle } from "@/lib/types";

export const ${meta.varName}: Puzzle = {
  id: "${meta.id}",
  name: "${meta.name}",
  size: ${size},
  difficulty: "${meta.difficulty}",
  regions: [
    ${regionsLit},
  ],
  solution: [
    ${solutionLit},
  ],
};
`;
}

// ---------- puzzle definitions ----------

// Each entry is one puzzle: id, name, difficulty, size, and a hand-picked
// 1-star solution. Region carving and uniqueness verification happen below.
const PUZZLES = [
  {
    id: "e1-5x5",
    varName: "puzzleE1_5x5",
    name: "Warm-up",
    difficulty: "easy",
    size: 5,
    stars: [
      [0, 1],
      [1, 3],
      [2, 0],
      [3, 2],
      [4, 4],
    ],
  },
  {
    id: "m1-5x5",
    varName: "puzzleM1_5x5",
    name: "Diagonal",
    difficulty: "medium",
    size: 5,
    stars: [
      [0, 2],
      [1, 4],
      [2, 1],
      [3, 3],
      [4, 0],
    ],
  },
  {
    // Hand-crafted regions: 4-row x 2-col rectangular blocks. Plain but
    // guaranteed to contain exactly one star per block.
    id: "m1-8x8",
    varName: "puzzleM1_8x8",
    name: "Constellation",
    difficulty: "medium",
    size: 8,
    stars: [
      [0, 1], [1, 3], [2, 5], [3, 7],
      [4, 0], [5, 2], [6, 4], [7, 6],
    ],
    regions: [
      [0, 0, 1, 1, 2, 2, 3, 3],
      [0, 0, 1, 1, 2, 2, 3, 3],
      [0, 0, 1, 1, 2, 2, 3, 3],
      [0, 0, 1, 1, 2, 2, 3, 3],
      [4, 4, 5, 5, 6, 6, 7, 7],
      [4, 4, 5, 5, 6, 6, 7, 7],
      [4, 4, 5, 5, 6, 6, 7, 7],
      [4, 4, 5, 5, 6, 6, 7, 7],
    ],
  },
  {
    // Hand-crafted regions: 2-row x 4-col rectangular blocks across a
    // different star pattern. Different feel from m1.
    id: "h1-8x8",
    varName: "puzzleH1_8x8",
    name: "Galaxy",
    difficulty: "hard",
    size: 8,
    stars: [
      [0, 3], [1, 6], [2, 1], [3, 4],
      [4, 7], [5, 2], [6, 5], [7, 0],
    ],
    regions: [
      [0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 1],
      [2, 2, 2, 2, 3, 3, 3, 3],
      [2, 2, 2, 2, 3, 3, 3, 3],
      [4, 4, 4, 4, 5, 5, 5, 5],
      [4, 4, 4, 4, 5, 5, 5, 5],
      [6, 6, 6, 6, 7, 7, 7, 7],
      [6, 6, 6, 6, 7, 7, 7, 7],
    ],
  },
];

// ---------- run ----------

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "lib", "puzzles");
mkdirSync(outDir, { recursive: true });

const exports = [];
for (const p of PUZZLES) {
  // Use hand-crafted regions if provided; otherwise carve them automatically.
  const regions = p.regions ?? carveRegions(p.size, p.stars);
  // Sanity-check each star is in a distinct region and region sizes are right.
  const sizesByRegion = Array(p.size).fill(0);
  for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) sizesByRegion[regions[r][c]]++;
  if (sizesByRegion.some((s) => s !== p.size)) {
    throw new Error(`puzzle ${p.id}: region size mismatch ${sizesByRegion.join(",")}`);
  }
  const starRegions = new Set(p.stars.map(([r, c]) => regions[r][c]));
  if (starRegions.size !== p.size) {
    throw new Error(`puzzle ${p.id}: stars share regions`);
  }
  const count = countSolutions(regions, p.size, 2);
  if (count === 0) {
    throw new Error(`puzzle ${p.id}: no valid solutions! (regions don't admit a 1-star arrangement)`);
  }
  console.log(`${p.id}: ${count === 1 ? "unique" : "multiple"} solutions (>= ${count})`);
  const ts = toTS(p, regions, p.stars);
  const filename = `${p.id}.ts`;
  writeFileSync(join(outDir, filename), ts);
  exports.push({ id: p.id, varName: p.varName, file: p.id });
}

const indexTs = `import { Puzzle } from "@/lib/types";
${exports.map((e) => `import { ${e.varName} } from "./${e.file}";`).join("\n")}

export const PUZZLES: Puzzle[] = [
  ${exports.map((e) => e.varName).join(",\n  ")},
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
`;
writeFileSync(join(outDir, "index.ts"), indexTs);

console.log(`\nWrote ${exports.length} puzzles + index.ts to ${outDir}`);
