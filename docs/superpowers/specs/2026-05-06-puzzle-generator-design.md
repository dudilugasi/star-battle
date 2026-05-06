# Puzzle Generator — Design

**Date:** 2026-05-06
**Status:** Approved, pending implementation plan
**Scope:** `scripts/generate-puzzles.mjs` and the contents of `lib/puzzles/`. No runtime / UI changes.

## Goal

Upgrade the existing one-shot generator so it can produce many valid Star Battle puzzles per run — randomly placed stars, randomly carved regions, unique solutions enforced, and with each puzzle automatically classified into easy / medium / hard. The four hand-curated puzzles stay; generated puzzles are added alongside them.

## Non-goals

- No changes to the runtime app, types, or UI components.
- No CLI flag parsing — config is edited in-script.
- No logical-deduction solver. We start with a solver-effort heuristic for difficulty and revisit if needed.
- No automated test suite for the generator. Deterministic seeding plus the existing per-puzzle assertions are sufficient.

## Architecture

A single Node script (`scripts/generate-puzzles.mjs`) runs to completion and writes:

- `lib/puzzles/<id>.ts` — one file per puzzle (curated + generated).
- `lib/puzzles/index.ts` — fully rewritten on every run, importing every emitted puzzle and exposing `PUZZLES` and `findPuzzle`.

Curated puzzles remain defined inline in the script's `PUZZLES` array, exactly as today. Generated puzzles are produced by a new pipeline that runs after the curated ones are emitted. The runtime continues to consume `lib/puzzles/index.ts` unchanged.

### File layout

| Path | Curated | Generated |
| --- | --- | --- |
| `scripts/generate-puzzles.mjs` | edited inline | unchanged after first authoring |
| `lib/puzzles/<curated-id>.ts` | overwritten each run | n/a |
| `lib/puzzles/g{difficulty[0]}{seq}-{size}x{size}.ts` | n/a | overwritten each run |
| `lib/puzzles/index.ts` | regenerated | regenerated |

Before writing, the script deletes any existing `lib/puzzles/g*.ts` so stale generated puzzles from a previous run with different config don't linger. Curated files are left untouched.

### ID & naming

- ID format: `g{difficulty[0]}{seq}-{size}x{size}` — e.g. `ge1-5x5`, `gm3-8x8`, `gh7-8x8`. The `g` prefix namespaces them against curated IDs (`e1-5x5`, `m1-8x8`, `h1-8x8`).
- Sequence numbers are scoped per `(size, difficulty)` and count from 1.
- Display name: `"Generated 5×5 #3"` style — predictable and stable under reseeding.

### Git

Generated `.ts` files **are** committed. The Next runtime statically imports them via `lib/puzzles/index.ts`; gitignoring would break a fresh clone. Determinism via `SEED` makes regeneration produce identical output, so diffs only appear when config changes.

## Configuration (top of script)

```js
const SEED = 1;

const TARGETS = [
  { size: 5, difficulty: "easy",   count: 6 },
  { size: 5, difficulty: "medium", count: 4 },
  { size: 8, difficulty: "medium", count: 4 },
  { size: 8, difficulty: "hard",   count: 6 },
];

const MAX_ATTEMPTS_PER_BUCKET = 2000;

const CALIBRATE = false; // see "Difficulty bin calibration" below
```

The user edits these constants and reruns the script. Omitting a `(size, difficulty)` row from `TARGETS` means that pair won't be generated (e.g., omit `{ size: 5, difficulty: "hard" }` if 5×5 hards aren't desired).

## Generation pipeline

### Seeded RNG

A single deterministic PRNG (mulberry32, ~8 lines) is constructed from `SEED` at script start. All randomness — star placement, carver direction shuffles, anything else — pulls from this single instance, in a fixed call order. Same `SEED` reproduces the catalog byte-for-byte; changing `SEED` reshuffles everything.

### Per-bucket loop

For each row in `TARGETS`:

```
remaining = bucket.count
attempts  = 0
while remaining > 0 and attempts < MAX_ATTEMPTS_PER_BUCKET:
    attempts += 1
    stars   = randomValid1StarArrangement(size, rng)
    try:
        regions = randomCarve(size, stars, rng)
    catch CarveFailure:
        continue
    { count, nodes } = countSolutions(regions, size, cap = 2)
    if count != 1: continue
    bin = classifyByEffort(nodes, size)
    if bin != bucket.difficulty: continue
    stage(stars, regions, bucket)                  // assigns g-id, name, queues for emit
    remaining -= 1
```

### `randomValid1StarArrangement`

Random permutation of column indices over rows (Latin-square-like — guarantees one star per row and column). Reject permutations where any two stars are king-adjacent (`|Δr| ≤ 1 ∧ |Δc| ≤ 1`). For sizes 5 and 8 this rejection-samples in well under 50 tries on average.

Inner safety: if 1000 permutations are rejected in a row (shouldn't happen at our sizes), the function throws and the whole script aborts. This represents a bug, not a tunable failure.

### `randomCarve`

Same two-phase carver currently in `scripts/generate-puzzles.mjs:22` (greedy growth + rebalance), with two changes:

1. The seed-cell scan order is shuffled before each phase-1 expansion sweep.
2. The direction list `dirs` is shuffled per region per iteration.

Shuffles use the seeded RNG so behavior is reproducible. Pathological carve states still throw the existing errors (`carve phase 1: unreachable cell`, `carve phase 2: chain transfer failed`); the outer loop catches these and treats them as "discard this attempt".

### `countSolutions` + solver-effort metric

The existing `countSolutions` is extended to also return `nodes`: every recursive call to `recurse(regionIdx)` increments a counter. The function returns `{ count, nodes }`. Pruned branches still count their entry, so `nodes` reflects both candidate density and dead-end work — monotonic with puzzle hardness for our solver shape.

### `classifyByEffort`

Pure function: `(nodes, size) → "easy" | "medium" | "hard"`. Per-size thresholds:

```js
const BINS = {
  5: { easy: [0,  12], medium: [13,  30], hard: [31, Infinity] },
  8: { easy: [0,  60], medium: [61, 200], hard: [201, Infinity] },
};
```

Numbers above are placeholders, calibrated on first use (see below).

### Difficulty bin calibration

When `CALIBRATE = true`, the script runs in calibration mode instead of normal generation:

1. For each size in `TARGETS`, generate ~200 unique-solution puzzles using random valid stars + random carves, **with no difficulty filtering**.
2. Print the histogram of `nodes` values per size, plus suggested 33rd / 66th percentile thresholds.
3. Write nothing to `lib/puzzles/`.

The user eyeballs the histogram, updates the `BINS` constant, sets `CALIBRATE = false`, and reruns. This is a one-time tuning step per material change to the solver or carver.

## Failure handling

| Condition | Response |
| --- | --- |
| `randomValid1StarArrangement` rejects 1000 in a row | Throw. Aborts the script. Indicates a bug. |
| `randomCarve` throws | Caught by the loop; counts as one attempt; continue. |
| `countSolutions` returns ≠ 1 | Discard candidate; continue. |
| `classifyByEffort` returns wrong bin | Discard candidate; continue. |
| Bucket hits `MAX_ATTEMPTS_PER_BUCKET` before filling | Warn (`WARN: bucket {size: 5, difficulty: "hard"} only filled 2/6 after 2000 attempts`); move to next bucket. |
| Curated puzzle has multiple solutions or none | **Throw.** Tightens today's soft check at `scripts/generate-puzzles.mjs:414` to require exactly one solution. Curated assertions run before generation begins, so a broken curated puzzle aborts the run before any generated work happens. |

## Output

After generation, the script:

1. Deletes `lib/puzzles/g*.ts`.
2. Writes one `.ts` file per curated puzzle (as today) and per generated puzzle.
3. Rewrites `lib/puzzles/index.ts` listing curated puzzles first (preserved order), then generated puzzles grouped by difficulty (`easy → medium → hard`) and ordered by sequence number within each group.
4. Prints a run summary:

   ```
   Curated:    4 puzzles  (e1-5x5, m1-5x5, m1-8x8, h1-8x8)
   Generated: 20/20 puzzles
     5×5  easy:    6/6   (nodes: 4–11, median 7)
     5×5  medium:  4/4   (nodes: 14–28, median 19)
     8×8  medium:  4/4   (nodes: 78–187, median 121)
     8×8  hard:    6/6   (nodes: 215–1042, median 410)
   Wrote 24 files to lib/puzzles/
   ```

The summary lets the user spot bin drift over time (e.g., median nodes climbing into the next bin's range) and recalibrate.

## Verification

Two layers:

1. **Per-puzzle assertions** at emit time (curated and generated alike): region sizes correct, stars live in distinct regions, `countSolutions` returns exactly 1.
2. **Determinism**: rerunning with the same `SEED` produces identical output. This is the regression check; no formal test suite is added.

## Out of scope (for this design)

- Logical-deduction solver and the harder "easy puzzles are guaranteed logic-only" property.
- CLI flags (we may promote to flags later if config edits become annoying).
- Generated puzzle metadata beyond what `Puzzle` already carries (no per-puzzle stored difficulty score, hint counts, etc.).
- Changes to runtime, UI, or the `Puzzle` type.
