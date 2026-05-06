# Puzzle Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `scripts/generate-puzzles.mjs` so a single run produces many valid Star Battle puzzles — random star placement, randomized region carving, unique-solution enforcement, and per-puzzle solver-effort-based difficulty classification.

**Architecture:** Single-file Node ES-module script. Add a seeded mulberry32 PRNG and use it everywhere randomness is needed. Randomize the existing two-phase carver via shuffled direction / scan / region orderings. Extend the existing brute-force solver to also report `nodes` (recursive call count). Loop per `(size, difficulty)` bucket from a top-of-file `TARGETS` config until each bucket fills or hits a retry cap; classify accepted puzzles by node count via per-size `BINS`. Curated puzzles continue to be defined inline and emitted alongside generated ones.

**Tech Stack:** Node.js (ES modules), no external dependencies. Outputs TypeScript files (`lib/puzzles/<id>.ts`) consumed by Next.js at runtime.

---

## File Structure

| Path | Action | Purpose |
| --- | --- | --- |
| `scripts/generate-puzzles.mjs` | Modify | All generator logic. Single file by design (edit-and-run UX). |
| `lib/puzzles/g*.ts` | Auto-output | Generated puzzles, created/replaced each run. |
| `lib/puzzles/index.ts` | Auto-output | Regenerated to include curated + generated puzzles. |
| `lib/puzzles/{e,m,h}*.ts` | Auto-output (unchanged content) | Curated puzzles, still emitted from inline `PUZZLES` array. |

The generator script grows from ~430 lines to ~700, but stays a single file so the user can reach it with one open and edit the top-of-file knobs without hunting across modules. Sectioned with `// ---------- name ----------` banners as today.

---

## Verification approach

The design opts out of a formal test suite (see `docs/superpowers/specs/2026-05-06-puzzle-generator-design.md` § "Out of scope"). Each task verifies via running the script (or a temporary `--smoke-*` flag block) and inspecting output. Per-puzzle assertions inside the script are the runtime safety net.

For tasks that add a function not yet wired into the integration, a temporary `--smoke-*` flag block at the bottom of the script runs that function in isolation and prints a result. The smoke block is removed in the same task once verified, in a separate step before the commit. This keeps every commit clean and self-contained.

---

## Task 1: Add seeded PRNG

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add new section near top of file, before `// ---------- region carving ----------` (currently line 10).

- [ ] **Step 1: Add SEED constant and mulberry32 implementation**

Insert immediately after the leading file-comment block (before the existing `// ---------- region carving ----------` banner):

```js
// ---------- config ----------

// Top-of-file knobs you'll edit between runs. See the design spec at
// docs/superpowers/specs/2026-05-06-puzzle-generator-design.md.
const SEED = 1;

// ---------- RNG ----------

// Deterministic PRNG: same seed produces the same sequence. Returns a
// function yielding floats in [0, 1) on each call. Algorithm: mulberry32,
// the de-facto standard small PRNG for non-cryptographic seeded use.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
```

- [ ] **Step 2: Add temporary smoke block at end of file**

At the very bottom of `scripts/generate-puzzles.mjs`, append:

```js
// TEMP: removed in same task after verification
if (process.argv.includes("--smoke-rng")) {
  const a = mulberry32(1);
  const b = mulberry32(1);
  const c = mulberry32(2);
  console.log("same seed first call equal:", a() === b()); // expect true
  console.log("different seed first call differ:", mulberry32(1)() !== c()); // expect true
  const r = mulberry32(1);
  console.log("first five from seed 1:", Array.from({ length: 5 }, () => r().toFixed(6)));
  process.exit(0);
}
```

- [ ] **Step 3: Run smoke check**

Run: `node scripts/generate-puzzles.mjs --smoke-rng`

Expected output (exact float values may differ slightly across Node versions but determinism must hold):
```
same seed first call equal: true
different seed first call differ: true
first five from seed 1: [ '0.xxxxxx', '0.xxxxxx', '0.xxxxxx', '0.xxxxxx', '0.xxxxxx' ]
```

If either of the first two booleans is `false`, mulberry32 is wrong — fix before proceeding.

- [ ] **Step 4: Remove the temporary smoke block**

Delete the entire `if (process.argv.includes("--smoke-rng")) { ... }` block added in Step 2.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-puzzles.mjs
git commit -m "feat(generator): add seeded mulberry32 PRNG"
```

---

## Task 2: Add `shuffleInPlace` helper

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — append helper to the new RNG section.

- [ ] **Step 1: Add helper below `mulberry32`**

Right after the `const rng = mulberry32(SEED);` line:

```js
// Fisher-Yates shuffle using the seeded RNG. Mutates and returns `arr`.
function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

- [ ] **Step 2: Add temporary smoke block at end of file**

```js
// TEMP: removed in same task after verification
if (process.argv.includes("--smoke-shuffle")) {
  const r = mulberry32(1);
  const a = shuffleInPlace([0, 1, 2, 3, 4, 5, 6, 7], r);
  const b = shuffleInPlace([0, 1, 2, 3, 4, 5, 6, 7], mulberry32(1));
  console.log("shuffle a:", a);
  console.log("shuffle b (same seed):", b);
  console.log("deterministic:", JSON.stringify(a) === JSON.stringify(b)); // expect true
  console.log("permutation:", a.slice().sort((x, y) => x - y).join(",") === "0,1,2,3,4,5,6,7"); // expect true
  process.exit(0);
}
```

- [ ] **Step 3: Run smoke check**

Run: `node scripts/generate-puzzles.mjs --smoke-shuffle`

Expected: both booleans print `true`. The two shuffled arrays must be identical (same seed) and contain exactly the digits 0–7 once each.

- [ ] **Step 4: Remove the temporary smoke block**

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-puzzles.mjs
git commit -m "feat(generator): add seeded shuffleInPlace helper"
```

---

## Task 3: Random valid 1-star arrangement

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — new function in a new section.

- [ ] **Step 1: Add new section after the RNG section**

Insert immediately before `// ---------- region carving ----------`:

```js
// ---------- random star placement ----------

// Returns an array of `size` star positions [r, c] with one per row, one per
// column, and no two king-adjacent (8-direction). Uses Latin-permutation
// sampling: random permutation of column indices guarantees the row/col
// constraint by construction; we then reject permutations whose consecutive
// rows have columns differing by exactly 1 (the only way Latin-placed stars
// can become king-adjacent).
function randomValid1StarArrangement(size, rng) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const cols = Array.from({ length: size }, (_, i) => i);
    shuffleInPlace(cols, rng);
    let ok = true;
    for (let r = 0; r < size - 1; r++) {
      if (Math.abs(cols[r] - cols[r + 1]) === 1) {
        ok = false;
        break;
      }
    }
    if (ok) return cols.map((c, r) => [r, c]);
  }
  throw new Error(
    `randomValid1StarArrangement: rejected 1000 permutations for size ${size} — bug suspected`,
  );
}
```

- [ ] **Step 2: Add temporary smoke block at end of file**

```js
// TEMP: removed in same task after verification
if (process.argv.includes("--smoke-stars")) {
  const r = mulberry32(1);
  for (let i = 0; i < 5; i++) {
    const stars = randomValid1StarArrangement(8, r);
    // Validate: distinct rows, distinct cols, no king-adjacency.
    const rows = new Set(stars.map(([r]) => r));
    const cols = new Set(stars.map(([, c]) => c));
    let kingOk = true;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const [r1, c1] = stars[i], [r2, c2] = stars[j];
        if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) kingOk = false;
      }
    }
    console.log(`#${i}:`, stars.map((s) => s.join(",")).join(" | "),
      `rows=${rows.size === 8} cols=${cols.size === 8} kingOk=${kingOk}`);
  }
  process.exit(0);
}
```

- [ ] **Step 3: Run smoke check**

Run: `node scripts/generate-puzzles.mjs --smoke-stars`

Expected: five lines, each with `rows=true cols=true kingOk=true`. The actual star coordinates should differ between the five iterations (using one shared `rng`, the random walk produces distinct arrangements each time).

- [ ] **Step 4: Remove the temporary smoke block**

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-puzzles.mjs
git commit -m "feat(generator): add randomValid1StarArrangement"
```

---

## Task 4: Randomize the existing carver

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — change `carveRegions` (currently line 22) to accept and use the seeded RNG.

- [ ] **Step 1: Change `carveRegions` signature and inject randomness in phase 1**

Replace the function header (currently `function carveRegions(size, stars) {` at line 22) with:

```js
function carveRegions(size, stars, rng) {
```

Inside phase 1's outer `while (claimed < total) { ... }` loop, replace the existing region-iteration block:

```js
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
```

with:

```js
    // Randomize the order regions get to claim, so successive carves of the
    // same star layout produce different region shapes.
    const regionOrder = Array.from({ length: stars.length }, (_, i) => i);
    shuffleInPlace(regionOrder, rng);
    // Pre-compute a shuffled cell-scan order reused per region this iteration.
    const cellOrder = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cellOrder.push([r, c]);
    shuffleInPlace(cellOrder, rng);
    for (const region of regionOrder) {
      if (sizes[region] >= size) continue;
      let chosen = null;
      for (const [r, c] of cellOrder) {
        if (chosen) break;
        if (regions[r][c] !== region) continue;
        const shuffledDirs = shuffleInPlace(dirs.slice(), rng);
        for (const [dr, dc] of shuffledDirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          if (regions[nr][nc] !== -1) continue;
          chosen = [nr, nc];
          break;
        }
      }
      if (!chosen) continue;
      regions[chosen[0]][chosen[1]] = region;
      sizes[region]++;
      claimed++;
      progressed = true;
    }
```

(Phase 2's rebalance logic stays unchanged — its loop is rare, deterministic-by-design, and changing it risks breaking the connectivity invariants.)

- [ ] **Step 2: Update the carve call site**

In the run loop near the bottom of the file (currently line 399):

```js
  const regions = p.regions ?? carveRegions(p.size, p.stars);
```

becomes:

```js
  const regions = p.regions ?? carveRegions(p.size, p.stars, rng);
```

- [ ] **Step 3: Add temporary smoke block at end of file**

```js
// TEMP: removed in same task after verification
if (process.argv.includes("--smoke-carve")) {
  const r = mulberry32(1);
  const stars = randomValid1StarArrangement(8, r);
  for (let i = 0; i < 3; i++) {
    const regions = carveRegions(8, stars, r);
    // Validate: each region has 8 cells, each star sits in a distinct region.
    const sizes = Array(8).fill(0);
    for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) sizes[regions[rr][cc]]++;
    const sizesOk = sizes.every((s) => s === 8);
    const starRegions = new Set(stars.map(([rr, cc]) => regions[rr][cc]));
    const distinctOk = starRegions.size === 8;
    console.log(`#${i}: sizesOk=${sizesOk} distinctOk=${distinctOk}`);
  }
  process.exit(0);
}
```

- [ ] **Step 4: Run smoke check**

Run: `node scripts/generate-puzzles.mjs --smoke-carve`

Expected: three lines, all with `sizesOk=true distinctOk=true`.

- [ ] **Step 5: Run the full generator and confirm curated puzzles still emit cleanly**

Run: `node scripts/generate-puzzles.mjs`

Expected: existing curated puzzles still print their `unique solutions / multiple solutions` lines and write files without error. The carved puzzles (`e1-5x5`, `m1-5x5`) will produce *different* region shapes than before because the carver is now randomized — that's expected. `m1-8x8` and `h1-8x8` are unchanged because they supply hand-crafted regions.

- [ ] **Step 6: Remove the temporary smoke block**

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): randomize carver via seeded RNG"
```

---

## Task 5: Extend `countSolutions` to return node count

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — change `countSolutions` (currently line 234) and its caller (currently line 410).

- [ ] **Step 1: Change `countSolutions` to return an object**

Replace the entire `countSolutions` function (currently lines 234–275) with:

```js
// Counts solutions up to `cap` and reports `nodes` — the number of times the
// recursive solver entered `recurse()`. `nodes` is monotonic with puzzle
// hardness for our solver shape: branches that get pruned by row/col/
// adjacency conflicts still count their entry, so the metric reflects both
// candidate density and dead-end work.
function countSolutions(regions, size, cap = 2) {
  const regionCells = Array.from({ length: size }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      regionCells[regions[r][c]].push([r, c]);
    }
  }

  let count = 0;
  let nodes = 0;
  const used = { rows: new Set(), cols: new Set() };
  const placed = [];

  function adjacentToPlaced(r, c) {
    for (const [pr, pc] of placed) {
      if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return true;
    }
    return false;
  }

  function recurse(regionIdx) {
    nodes++;
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
  return { count, nodes };
}
```

- [ ] **Step 2: Update the existing caller**

The current call site (currently line 410):

```js
  const count = countSolutions(regions, p.size, 2);
  if (count === 0) {
    throw new Error(`puzzle ${p.id}: no valid solutions! (regions don't admit a 1-star arrangement)`);
  }
  console.log(`${p.id}: ${count === 1 ? "unique" : "multiple"} solutions (>= ${count})`);
```

becomes:

```js
  const { count, nodes } = countSolutions(regions, p.size, 2);
  if (count === 0) {
    throw new Error(`puzzle ${p.id}: no valid solutions! (regions don't admit a 1-star arrangement)`);
  }
  console.log(`${p.id}: ${count === 1 ? "unique" : "multiple"} solutions (>= ${count}), nodes=${nodes}`);
```

- [ ] **Step 3: Run the full generator**

Run: `node scripts/generate-puzzles.mjs`

Expected: each curated puzzle line now ends with `nodes=<some integer>`. Numbers will be small for 5×5 puzzles (single digits typically) and larger for 8×8 puzzles (tens to low hundreds). The script otherwise behaves the same.

Capture the values for your own reference — they'll inform Task 7's `BINS` placeholders.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): countSolutions reports node count"
```

---

## Task 6: Tighten curated puzzle uniqueness; retry auto-carve

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — strengthen the curated assertion to require `count === 1`, and add a retry loop for puzzles whose regions are auto-carved (since the randomized carver may now produce non-unique-solution carvings for any given seed).

- [ ] **Step 1: Replace the curated emit block with a retry-aware version**

The current emit loop (after Task 5's edit) looks like:

```js
for (const p of PUZZLES) {
  const regions = p.regions ?? carveRegions(p.size, p.stars, rng);
  const sizesByRegion = Array(p.size).fill(0);
  for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) sizesByRegion[regions[r][c]]++;
  if (sizesByRegion.some((s) => s !== p.size)) {
    throw new Error(`puzzle ${p.id}: region size mismatch ${sizesByRegion.join(",")}`);
  }
  const starRegions = new Set(p.stars.map(([r, c]) => regions[r][c]));
  if (starRegions.size !== p.size) {
    throw new Error(`puzzle ${p.id}: stars share regions`);
  }
  const { count, nodes } = countSolutions(regions, p.size, 2);
  if (count === 0) {
    throw new Error(`puzzle ${p.id}: no valid solutions! (regions don't admit a 1-star arrangement)`);
  }
  console.log(`${p.id}: ${count === 1 ? "unique" : "multiple"} solutions (>= ${count}), nodes=${nodes}`);
  // ...emit...
}
```

Replace the **per-puzzle prelude** (everything from `const regions = ...` down through the `console.log(...)` line) with:

```js
// Hand-crafted regions: must be unique-solution as authored. Auto-carve:
// the randomized carver may produce non-unique-solution regions, so retry
// up to MAX_CURATED_CARVE_ATTEMPTS until we find one that is.
let regions, count, nodes;
if (p.regions) {
  regions = p.regions;
  ({ count, nodes } = countSolutions(regions, p.size, 2));
  if (count !== 1) {
    throw new Error(
      `curated ${p.id}: hand-crafted regions yield ${count >= 2 ? "≥2" : "0"} solutions; fix the puzzle definition`,
    );
  }
} else {
  let carveAttempt = 0;
  while (carveAttempt < MAX_CURATED_CARVE_ATTEMPTS) {
    carveAttempt++;
    try {
      regions = carveRegions(p.size, p.stars, rng);
    } catch {
      continue;
    }
    ({ count, nodes } = countSolutions(regions, p.size, 2));
    if (count === 1) break;
  }
  if (count !== 1) {
    throw new Error(
      `curated ${p.id}: could not find a unique-solution carving in ${MAX_CURATED_CARVE_ATTEMPTS} attempts; ` +
        `consider hand-crafting regions or changing the star layout`,
    );
  }
}
const sizesByRegion = Array(p.size).fill(0);
for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) sizesByRegion[regions[r][c]]++;
if (sizesByRegion.some((s) => s !== p.size)) {
  throw new Error(`puzzle ${p.id}: region size mismatch ${sizesByRegion.join(",")}`);
}
const starRegions = new Set(p.stars.map(([r, c]) => regions[r][c]));
if (starRegions.size !== p.size) {
  throw new Error(`puzzle ${p.id}: stars share regions`);
}
console.log(`${p.id}: unique solution, nodes=${nodes}`);
```

- [ ] **Step 2: Add `MAX_CURATED_CARVE_ATTEMPTS` to the config section**

In the `// ---------- config ----------` section, alongside `SEED`:

```js
// How many random carves to try before giving up on a curated puzzle that
// supplies stars but no hand-crafted regions. 200 is overkill at the sizes
// we use; the loop typically succeeds on the first or second attempt.
const MAX_CURATED_CARVE_ATTEMPTS = 200;
```

- [ ] **Step 3: Run the full generator**

Run: `node scripts/generate-puzzles.mjs`

Expected: all four curated puzzles print `unique solution, nodes=<n>` and the script exits cleanly.

If the script throws on `m1-8x8` or `h1-8x8` (hand-crafted regions), those puzzles have multiple solutions as defined — a real authoring bug. **Stop and surface this to the user before proceeding.**

If the script throws on `e1-5x5` or `m1-5x5` after 200 carve attempts, the star layout is structurally too constrained to admit a unique-solution carving. Surface that too — it's a curated-puzzle design issue, not a generator bug.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): require unique solutions; retry auto-carve"
```

---

## Task 7: Difficulty bins and classifier

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add `BINS` constant and `classifyByEffort` function in a new section.

- [ ] **Step 1: Add new section after `// ---------- random star placement ----------`**

Insert before `// ---------- region carving ----------`:

```js
// ---------- difficulty classification ----------

// Per-size node-count thresholds. Inclusive ranges. Calibrate via Task 8's
// CALIBRATE mode after running it once and inspecting the histogram.
//
// Numbers below are placeholders, intentionally wide so initial generation
// runs produce *something* in every bucket. Tighten them after calibration.
const BINS = {
  5: { easy: [0, 12], medium: [13, 30], hard: [31, Infinity] },
  8: { easy: [0, 60], medium: [61, 200], hard: [201, Infinity] },
};

function classifyByEffort(nodes, size) {
  const sizeBins = BINS[size];
  if (!sizeBins) {
    throw new Error(`classifyByEffort: no bins configured for size ${size}`);
  }
  for (const [name, [lo, hi]] of Object.entries(sizeBins)) {
    if (nodes >= lo && nodes <= hi) return name;
  }
  throw new Error(`classifyByEffort: nodes=${nodes} fell outside all bins for size ${size}`);
}
```

- [ ] **Step 2: Add temporary smoke block at end of file**

```js
// TEMP: removed in same task after verification
if (process.argv.includes("--smoke-classify")) {
  console.log("5/5 ->", classifyByEffort(5, 5));     // expect easy
  console.log("5/20 ->", classifyByEffort(20, 5));   // expect medium
  console.log("5/100 ->", classifyByEffort(100, 5)); // expect hard
  console.log("8/40 ->", classifyByEffort(40, 8));   // expect easy
  console.log("8/120 ->", classifyByEffort(120, 8)); // expect medium
  console.log("8/500 ->", classifyByEffort(500, 8)); // expect hard
  process.exit(0);
}
```

- [ ] **Step 3: Run smoke check**

Run: `node scripts/generate-puzzles.mjs --smoke-classify`

Expected output:
```
5/5 -> easy
5/20 -> medium
5/100 -> hard
8/40 -> easy
8/120 -> medium
8/500 -> hard
```

- [ ] **Step 4: Remove the temporary smoke block**

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-puzzles.mjs
git commit -m "feat(generator): add difficulty BINS and classifier"
```

---

## Task 8: Calibration mode

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add a `CALIBRATE` constant and a calibration branch in the run section.

This task adds the calibration code path but does **not** yet calibrate the bins (Task 12 does that, after the rest of the pipeline is in place). The point of doing it now is to have an observation tool ready before we depend on the bins.

- [ ] **Step 1: Add `CALIBRATE` knob to the config section**

In the `// ---------- config ----------` section added in Task 1, append below the `SEED` line:

```js
// When true, the script generates ~200 random unique-solution puzzles per
// size with no difficulty filtering and prints a histogram of node counts.
// Use it to pick BINS thresholds. Writes nothing to lib/puzzles/.
const CALIBRATE = false;

// Sizes to consider during calibration and during normal generation.
const CALIBRATION_SIZES = [5, 8];
const CALIBRATION_SAMPLES_PER_SIZE = 200;
```

- [ ] **Step 2: Add calibration runner function**

Insert at the end of the file's function definitions (just before the `// ---------- run ----------` banner — currently line 386):

```js
// ---------- calibration ----------

// Generates `samples` unique-solution puzzles at the given size, prints a
// histogram of node counts, and suggests 33rd / 66th percentile thresholds.
// Returns nothing; runs purely for observation.
function runCalibration(size, samples, rng) {
  const observations = [];
  let attempts = 0;
  const maxAttempts = samples * 50;
  while (observations.length < samples && attempts < maxAttempts) {
    attempts++;
    const stars = randomValid1StarArrangement(size, rng);
    let regions;
    try {
      regions = carveRegions(size, stars, rng);
    } catch {
      continue;
    }
    const { count, nodes } = countSolutions(regions, size, 2);
    if (count !== 1) continue;
    observations.push(nodes);
  }
  observations.sort((a, b) => a - b);
  const min = observations[0];
  const max = observations[observations.length - 1];
  const median = observations[Math.floor(observations.length / 2)];
  const p33 = observations[Math.floor(observations.length * 0.33)];
  const p66 = observations[Math.floor(observations.length * 0.66)];
  // Bucket histogram: 10 equal-width bins from min to max.
  const bucketCount = 10;
  const width = Math.max(1, Math.ceil((max - min + 1) / bucketCount));
  const buckets = Array(bucketCount).fill(0);
  for (const n of observations) {
    const idx = Math.min(bucketCount - 1, Math.floor((n - min) / width));
    buckets[idx]++;
  }
  console.log(`\nsize=${size}: ${observations.length}/${samples} samples in ${attempts} attempts`);
  console.log(`  range: ${min}..${max}  median: ${median}`);
  console.log(`  suggested thresholds: easy ≤ ${p33}, medium ≤ ${p66}, hard > ${p66}`);
  console.log(`  histogram (10 buckets, width=${width}):`);
  for (let i = 0; i < bucketCount; i++) {
    const lo = min + i * width;
    const hi = Math.min(max, lo + width - 1);
    const bar = "#".repeat(Math.round((buckets[i] / observations.length) * 40));
    console.log(`    ${String(lo).padStart(4)}..${String(hi).padStart(4)}  ${String(buckets[i]).padStart(3)}  ${bar}`);
  }
}
```

- [ ] **Step 3: Wire calibration into the run section**

The current `// ---------- run ----------` section starts (currently line 386–393):

```js
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "lib", "puzzles");
mkdirSync(outDir, { recursive: true });
```

Right after the `mkdirSync(...)` line, insert:

```js
if (CALIBRATE) {
  console.log(`Calibration mode (no files will be written). SEED=${SEED}`);
  for (const size of CALIBRATION_SIZES) {
    runCalibration(size, CALIBRATION_SAMPLES_PER_SIZE, rng);
  }
  process.exit(0);
}
```

This guards every subsequent file-writing line behind the calibration flag.

- [ ] **Step 4: Smoke-run calibration mode**

Temporarily flip `CALIBRATE = true` at the top of the file (do **not** commit this change — revert in step 6).

Run: `node scripts/generate-puzzles.mjs`

Expected: no files written; for each size in `CALIBRATION_SIZES`, prints a section like:

```
size=5: 200/200 samples in ~210 attempts
  range: 4..47  median: 8
  suggested thresholds: easy ≤ 7, medium ≤ 14, hard > 14
  histogram (10 buckets, width=5):
       4..   8  118  ################################################
       9..  13   42  ################
      ...
```

(Exact numbers will vary; the shape — most samples in the easy band, a tail extending toward harder — is what to verify.)

- [ ] **Step 5: Confirm normal mode still works**

Flip `CALIBRATE = false` again. Run: `node scripts/generate-puzzles.mjs`

Expected: same output as before Task 8 (curated puzzles emit, no calibration noise).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-puzzles.mjs
git commit -m "feat(generator): add CALIBRATE mode for tuning BINS"
```

---

## Task 9: TARGETS, ID/name scheme, and per-bucket loop

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add `TARGETS` knob, ID/name helpers, and the per-bucket generation loop. Wire its output into the existing emit step.

This is the largest task. Subdivided into focused steps.

- [ ] **Step 1: Add `TARGETS` and `MAX_ATTEMPTS_PER_BUCKET` to the config section**

In the `// ---------- config ----------` section, append below `CALIBRATION_SAMPLES_PER_SIZE`:

```js
// Generation targets. Each row is one bucket. Omit a (size, difficulty) pair
// from the list if you don't want any of that combination.
const TARGETS = [
  { size: 5, difficulty: "easy",   count: 6 },
  { size: 5, difficulty: "medium", count: 4 },
  { size: 8, difficulty: "medium", count: 4 },
  { size: 8, difficulty: "hard",   count: 6 },
];

// Per-bucket safety cap. If a bucket can't fill within this many attempts,
// the run logs a warning and moves on with whatever it produced.
const MAX_ATTEMPTS_PER_BUCKET = 2000;
```

- [ ] **Step 2: Add ID/name helpers in a new section**

Insert immediately before `// ---------- run ----------`:

```js
// ---------- generated puzzle metadata ----------

const DIFFICULTY_LETTER = { easy: "e", medium: "m", hard: "h" };

function generatedId(size, difficulty, seq) {
  return `g${DIFFICULTY_LETTER[difficulty]}${seq}-${size}x${size}`;
}

function generatedVarName(size, difficulty, seq) {
  // Matches the curated naming pattern: puzzle<ID-camelcase>.
  const letter = DIFFICULTY_LETTER[difficulty].toUpperCase();
  return `puzzleG${letter}${seq}_${size}x${size}`;
}

function generatedDisplayName(size, difficulty, seq) {
  const cap = difficulty[0].toUpperCase() + difficulty.slice(1);
  return `Generated ${cap} ${size}×${size} #${seq}`;
}
```

- [ ] **Step 3: Add the per-bucket generation function**

In the same section (immediately after the helpers from Step 2):

```js
// Generates puzzles for one TARGETS bucket. Returns an array of accepted
// puzzle objects in the same shape as entries in the curated PUZZLES array
// (`{ id, varName, name, difficulty, size, stars, regions }`), plus a
// `nodes` field used later by the run summary. Logs a warning if the bucket
// can't fill within MAX_ATTEMPTS_PER_BUCKET attempts.
function generateBucket(bucket, rng) {
  const accepted = [];
  let attempts = 0;
  while (accepted.length < bucket.count && attempts < MAX_ATTEMPTS_PER_BUCKET) {
    attempts++;
    const stars = randomValid1StarArrangement(bucket.size, rng);
    let regions;
    try {
      regions = carveRegions(bucket.size, stars, rng);
    } catch {
      continue; // pathological carve, discard.
    }
    const { count, nodes } = countSolutions(regions, bucket.size, 2);
    if (count !== 1) continue;
    const bin = classifyByEffort(nodes, bucket.size);
    if (bin !== bucket.difficulty) continue;
    const seq = accepted.length + 1;
    accepted.push({
      id: generatedId(bucket.size, bucket.difficulty, seq),
      varName: generatedVarName(bucket.size, bucket.difficulty, seq),
      name: generatedDisplayName(bucket.size, bucket.difficulty, seq),
      difficulty: bucket.difficulty,
      size: bucket.size,
      stars,
      regions,
      nodes,
    });
  }
  if (accepted.length < bucket.count) {
    console.warn(
      `WARN: bucket {size: ${bucket.size}, difficulty: "${bucket.difficulty}"}` +
        ` only filled ${accepted.length}/${bucket.count} after ${attempts} attempts`,
    );
  }
  return { accepted, attempts };
}
```

- [ ] **Step 4: Run the per-bucket loop in the run section**

In the run section, after the existing `for (const p of PUZZLES) { ... }` block (currently ends around line 419 with `exports.push(...)`), and before the `const indexTs = ...` block, insert:

```js
const generatedExports = [];
const generatedStats = [];
for (const bucket of TARGETS) {
  const { accepted, attempts } = generateBucket(bucket, rng);
  generatedStats.push({ bucket, accepted, attempts });
  for (const g of accepted) {
    // Reuse the existing per-puzzle assertions for safety, even though
    // generateBucket already verified count===1 and region shape.
    const sizesByRegion = Array(g.size).fill(0);
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) sizesByRegion[g.regions[r][c]]++;
    if (sizesByRegion.some((s) => s !== g.size)) {
      throw new Error(`generated ${g.id}: region size mismatch ${sizesByRegion.join(",")}`);
    }
    const ts = toTS(g, g.regions, g.stars);
    writeFileSync(join(outDir, `${g.id}.ts`), ts);
    generatedExports.push({ id: g.id, varName: g.varName, file: g.id });
    console.log(`${g.id}: unique solution, nodes=${g.nodes}, difficulty=${g.difficulty}`);
  }
}
```

- [ ] **Step 5: Update `index.ts` regeneration to include generated puzzles**

The current index-rebuild block (currently lines 421–432):

```js
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
```

Becomes:

```js
const allExports = [...exports, ...generatedExports];
const indexTs = `import { Puzzle } from "@/lib/types";
${allExports.map((e) => `import { ${e.varName} } from "./${e.file}";`).join("\n")}

export const PUZZLES: Puzzle[] = [
  ${allExports.map((e) => e.varName).join(",\n  ")},
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
`;
writeFileSync(join(outDir, "index.ts"), indexTs);
```

(`generatedExports` is already in the order easy → medium → hard because that's the order rows appear in `TARGETS` plus the inner sequence numbering. Task 10 will enforce this ordering explicitly when cleanup is added.)

- [ ] **Step 6: Run the full generator**

Run: `node scripts/generate-puzzles.mjs`

Expected:
- All four curated puzzles emit as before.
- For each `TARGETS` bucket, lines like `ge1-5x5: unique solution, nodes=7, difficulty=easy` are printed (one per accepted puzzle).
- `lib/puzzles/g*.ts` files appear (`ls lib/puzzles/g*.ts | wc -l` should equal the sum of all `count` fields in `TARGETS`, assuming no bucket exhaustion warnings).
- `lib/puzzles/index.ts` imports both curated and generated puzzles.
- If any bucket prints a `WARN:` line, the BINS placeholders are too narrow for that bucket; do not panic — Task 12 calibrates them. For now, lower the bucket's `count` temporarily if you want a warning-free run.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): per-bucket generation loop with TARGETS"
```

---

## Task 10: Cleanup of stale generated files; explicit index ordering

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add cleanup before emit and stable ordering of generated entries.

- [ ] **Step 1: Import `readdirSync` and `unlinkSync`**

Update the existing import line (currently line 388):

```js
import { writeFileSync, mkdirSync } from "node:fs";
```

becomes:

```js
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
```

- [ ] **Step 2: Add cleanup right after `mkdirSync(outDir, { recursive: true })`**

Insert immediately after the existing `mkdirSync(...)` line:

```js
// Wipe stale generated puzzles (anything starting with "g") so previous-run
// leftovers don't survive a TARGETS or SEED change. Curated files (e*, m*,
// h*) and the index are left to be overwritten in place.
for (const file of readdirSync(outDir)) {
  if (file.startsWith("g") && file.endsWith(".ts")) {
    unlinkSync(join(outDir, file));
  }
}
```

This must run **before** the `if (CALIBRATE)` exit added in Task 8 — calibration shouldn't touch files. Re-check the order: in Task 8's wiring, `if (CALIBRATE) { ...; process.exit(0); }` came after `mkdirSync`. The cleanup should sit between `mkdirSync` and the calibration guard. If your file currently has them out of order, fix it now.

- [ ] **Step 3: Sort `generatedExports` before writing the index**

Generated puzzles are accumulated in `TARGETS` order. To make the index ordering deterministic and independent of `TARGETS` row order, sort right before building the index. Insert immediately before the `const allExports = ...` line:

```js
const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };
generatedExports.sort((a, b) => {
  // Parse "g<letter><seq>-<n>x<n>" → letter, seq, size.
  const parse = (id) => {
    const m = id.match(/^g([emh])(\d+)-(\d+)x\d+$/);
    if (!m) throw new Error(`bad generated id: ${id}`);
    const letter = m[1];
    const diff = letter === "e" ? "easy" : letter === "m" ? "medium" : "hard";
    return { diff, seq: Number(m[2]), size: Number(m[3]) };
  };
  const pa = parse(a.id), pb = parse(b.id);
  return (
    DIFFICULTY_RANK[pa.diff] - DIFFICULTY_RANK[pb.diff] ||
    pa.size - pb.size ||
    pa.seq - pb.seq
  );
});
```

- [ ] **Step 4: Run the full generator twice and confirm no orphans**

Run: `node scripts/generate-puzzles.mjs && ls lib/puzzles/g*.ts | wc -l`

Note the count.

Now temporarily reduce one bucket's `count` (e.g. drop hard 8×8 from 6 to 2). Run again:

`node scripts/generate-puzzles.mjs && ls lib/puzzles/g*.ts | wc -l`

Expected: the new count is exactly the sum of `count` fields in the (reduced) `TARGETS`. No `gh3-8x8`..`gh6-8x8` files lingering from the first run.

Restore the bucket count to its previous value before committing.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): wipe stale generated puzzles + stable index order"
```

---

## Task 11: Run summary

**Files:**
- Modify: `scripts/generate-puzzles.mjs` — add summary printing at the end of the run section.

- [ ] **Step 1: Add summary block at the end of the run section**

After the `writeFileSync(join(outDir, "index.ts"), indexTs);` line and the existing `console.log(`\nWrote ${exports.length} puzzles + index.ts to ${outDir}`);` line, append:

```js
// ---------- run summary ----------

console.log(`\nCurated:    ${exports.length} puzzles  (${exports.map((e) => e.id).join(", ")})`);
const totalGenerated = generatedExports.length;
const totalRequested = TARGETS.reduce((s, b) => s + b.count, 0);
console.log(`Generated: ${totalGenerated}/${totalRequested} puzzles`);
for (const { bucket, accepted } of generatedStats) {
  if (accepted.length === 0) {
    console.log(`  ${bucket.size}×${bucket.size}  ${bucket.difficulty}: 0/${bucket.count}`);
    continue;
  }
  const ns = accepted.map((a) => a.nodes).sort((x, y) => x - y);
  const min = ns[0];
  const max = ns[ns.length - 1];
  const median = ns[Math.floor(ns.length / 2)];
  const pad = bucket.difficulty.padEnd(6);
  console.log(
    `  ${bucket.size}×${bucket.size}  ${pad}: ${accepted.length}/${bucket.count}` +
      `   (nodes: ${min}–${max}, median ${median})`,
  );
}
console.log(`\nWrote ${exports.length + totalGenerated} files to ${outDir}`);
```

- [ ] **Step 2: Remove the now-redundant earlier "Wrote N puzzles" line**

The previous summary line:

```js
console.log(`\nWrote ${exports.length} puzzles + index.ts to ${outDir}`);
```

is now superseded — delete it.

- [ ] **Step 3: Run the full generator**

Run: `node scripts/generate-puzzles.mjs`

Expected: at the bottom of the output, a summary like:

```
Curated:    4 puzzles  (e1-5x5, m1-5x5, m1-8x8, h1-8x8)
Generated: 20/20 puzzles
  5×5  easy  : 6/6   (nodes: 4–11, median 7)
  5×5  medium: 4/4   (nodes: 14–28, median 19)
  8×8  medium: 4/4   (nodes: 78–187, median 121)
  8×8  hard  : 6/6   (nodes: 215–1042, median 410)

Wrote 24 files to /Users/.../lib/puzzles
```

(Exact numbers depend on `SEED` and the placeholder `BINS`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): run summary with per-bucket stats"
```

---

## Task 12: Calibrate `BINS` and produce the first real catalog

This task does no code work beyond editing the `BINS` numbers; it's the one-time tuning pass the spec describes.

- [ ] **Step 1: Run calibration**

Edit `scripts/generate-puzzles.mjs`: set `CALIBRATE = true`.

Run: `node scripts/generate-puzzles.mjs`

Expected: the script prints histograms for sizes 5 and 8 (per `CALIBRATION_SIZES`) and exits without writing files.

- [ ] **Step 2: Update `BINS` from the suggested thresholds**

For each size, copy the `easy ≤ X, medium ≤ Y, hard > Y` line from the calibration output and edit `BINS` accordingly:

```js
const BINS = {
  5: { easy: [0, X5], medium: [X5 + 1, Y5], hard: [Y5 + 1, Infinity] },
  8: { easy: [0, X8], medium: [X8 + 1, Y8], hard: [Y8 + 1, Infinity] },
};
```

If a size has very few puzzles in the "hard" tail (e.g. less than 5% of samples), consider adjusting the medium ceiling down so "hard" is more achievable; conversely if the easy bucket dominates 90% of samples, raise its ceiling so the remaining bins aren't squeezed.

- [ ] **Step 3: Switch off calibration and run normal generation**

Set `CALIBRATE = false`.

Run: `node scripts/generate-puzzles.mjs`

Expected: the run summary shows every bucket filled (`X/X`) without `WARN:` lines. If any bucket warns, either widen its bin in `BINS` or reduce that bucket's `count` in `TARGETS`.

- [ ] **Step 4: Verify the runtime app still loads**

Run: `npm run build`

Expected: build completes without TypeScript errors. The newly generated puzzles are statically imported via `lib/puzzles/index.ts`; a build error here means the emitted TS shape is wrong (likely a code issue in `toTS`, which we did not modify, but worth catching).

If the build fails because of types in the newly generated files, fix the bug in `scripts/generate-puzzles.mjs` and rerun.

- [ ] **Step 5: Commit calibrated bins and the generated catalog**

```bash
git add scripts/generate-puzzles.mjs lib/puzzles/
git commit -m "feat(generator): calibrate BINS and produce first generated catalog"
```

---

## Closing checks

After Task 12 the script does what the spec describes. To confirm:

- [ ] Re-run `node scripts/generate-puzzles.mjs` with no changes — `git status` should show no diffs (deterministic regeneration).
- [ ] Bump `SEED` by 1, re-run — `git status` should show changed `lib/puzzles/g*.ts` files and a changed `lib/puzzles/index.ts`. Revert with `git checkout lib/puzzles/`.
- [ ] Open the running Next dev server (`npm run dev`) and confirm generated puzzles appear in the picker.

If all three pass, the feature is complete.
