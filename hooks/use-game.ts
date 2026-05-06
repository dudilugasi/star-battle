"use client";

import { useEffect, useReducer } from "react";
import { CellValue, GameSnapshot, GameState, Puzzle } from "@/lib/types";
import {
  cloneAutoX,
  cloneBoard,
  emptyAutoX,
  emptyBoard,
  findConflicts,
  forbiddenCells,
  isForbiddenBySomeStar,
  isSolved,
} from "@/lib/validation";
import {
  clearInProgress,
  loadInProgress,
  saveBestTime,
  saveInProgress,
} from "@/lib/storage";

type Action =
  | { type: "HYDRATE" }
  | { type: "LOAD_PUZZLE"; puzzle: Puzzle; resume?: boolean }
  | { type: "CYCLE_CELL"; r: number; c: number }
  // Single-cell user-X placement used by drag-paint. `commit: true` snapshots
  // the pre-paint state into history (start of a drag); `commit: false`
  // mutates without snapshotting (continuation of the same drag), so the
  // entire drag collapses into one undo step. No-op on non-empty cells —
  // paint never overwrites X's or stars.
  | { type: "PAINT_X"; r: number; c: number; commit: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" }
  | { type: "TICK"; now: number };

function snapshot(state: GameState): GameSnapshot {
  return { board: cloneBoard(state.board), autoX: cloneAutoX(state.autoX) };
}

// Deterministic initial state used for SSR and the first client render. No
// `Date.now()`, no `localStorage` — everything that varies between server
// and client is deferred to the HYDRATE action that fires post-mount.
//
// Sentinel: `startedAt === 0` means "not hydrated yet". The timer effect and
// persistence effect both no-op while in that state to avoid writing garbage
// to localStorage or starting the clock at epoch zero.
function bareState(puzzle: Puzzle): GameState {
  return {
    puzzle,
    board: emptyBoard(puzzle.size),
    autoX: emptyAutoX(puzzle.size),
    history: [],
    future: [],
    startedAt: 0,
    elapsedMs: 0,
    status: "playing",
  };
}

// Client-only state factory. Restores from localStorage if a saved session
// exists for this puzzle, otherwise starts a fresh clock.
function clientState(puzzle: Puzzle, resume: boolean): GameState {
  if (resume) {
    const saved = loadInProgress(puzzle.id);
    if (saved) {
      const elapsed = Date.now() - saved.startedAt;
      return {
        puzzle,
        board: saved.board,
        autoX: saved.autoX ?? emptyAutoX(puzzle.size),
        history: [],
        future: [],
        startedAt: saved.startedAt,
        elapsedMs: elapsed,
        status: isSolved(saved.board, puzzle) ? "solved" : "playing",
      };
    }
  }
  return {
    puzzle,
    board: emptyBoard(puzzle.size),
    autoX: emptyAutoX(puzzle.size),
    history: [],
    future: [],
    startedAt: Date.now(),
    elapsedMs: 0,
    status: "playing",
  };
}

// Cycle on click: empty → ✕ → ⭐ → empty.
//   • empty → x  : user-placed ✕. autoX[r][c] = false.
//   • x → star   : place the star, then auto-✕ every empty cell it forbids.
//                  Cells that are already x or star are left alone — we never
//                  upgrade a user-x to auto-x.
//   • star → empty: remove the star. Each cell it forbade that's currently
//                  an auto-x AND is not still forbidden by another star
//                  reverts to empty. User-placed x's are never touched.
function applyClick(
  state: GameState,
  r: number,
  c: number,
): { board: CellValue[][]; autoX: boolean[][] } {
  const board = cloneBoard(state.board);
  const autoX = cloneAutoX(state.autoX);
  const current = state.board[r][c];

  if (current === "empty") {
    board[r][c] = "x";
    autoX[r][c] = false;
    return { board, autoX };
  }

  if (current === "x") {
    board[r][c] = "star";
    autoX[r][c] = false;
    for (const [fr, fc] of forbiddenCells(r, c, state.puzzle)) {
      if (board[fr][fc] === "empty") {
        board[fr][fc] = "x";
        autoX[fr][fc] = true;
      }
    }
    return { board, autoX };
  }

  // current === "star"
  board[r][c] = "empty";
  autoX[r][c] = false;
  for (const [fr, fc] of forbiddenCells(r, c, state.puzzle)) {
    if (board[fr][fc] !== "x") continue;
    if (!autoX[fr][fc]) continue;
    if (isForbiddenBySomeStar(fr, fc, board, state.puzzle, r, c)) continue;
    board[fr][fc] = "empty";
    autoX[fr][fc] = false;
  }
  return { board, autoX };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "HYDRATE":
      return clientState(state.puzzle, true);

    case "LOAD_PUZZLE":
      return clientState(action.puzzle, action.resume ?? true);

    case "RESET":
      return clientState(state.puzzle, false);

    case "CYCLE_CELL": {
      if (state.status === "solved") return state;
      if (state.startedAt === 0) return state; // pre-hydration; ignore clicks
      const prev = snapshot(state);
      const { board, autoX } = applyClick(state, action.r, action.c);
      const solved = isSolved(board, state.puzzle);
      return {
        ...state,
        board,
        autoX,
        history: [...state.history, prev],
        future: [],
        elapsedMs: solved ? Date.now() - state.startedAt : state.elapsedMs,
        status: solved ? "solved" : "playing",
      };
    }

    case "PAINT_X": {
      if (state.status === "solved") return state;
      if (state.startedAt === 0) return state;
      // Paint is empty-only: never overwrites a user-X or a star.
      if (state.board[action.r][action.c] !== "empty") return state;

      const board = cloneBoard(state.board);
      const autoX = cloneAutoX(state.autoX);
      board[action.r][action.c] = "x";
      autoX[action.r][action.c] = false;

      // Painting can never solve the puzzle (no star is added), so we skip
      // the isSolved check entirely. `commit` controls whether this is the
      // first paint of a drag (snapshot history, clear redo) or a
      // continuation (no history change).
      return {
        ...state,
        board,
        autoX,
        history: action.commit
          ? [...state.history, snapshot(state)]
          : state.history,
        future: action.commit ? [] : state.future,
      };
    }

    case "UNDO": {
      if (state.history.length === 0 || state.status === "solved") return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        board: prev.board,
        autoX: prev.autoX,
        history: state.history.slice(0, -1),
        future: [...state.future, snapshot(state)],
      };
    }

    case "REDO": {
      if (state.future.length === 0 || state.status === "solved") return state;
      const next = state.future[state.future.length - 1];
      const solved = isSolved(next.board, state.puzzle);
      return {
        ...state,
        board: next.board,
        autoX: next.autoX,
        history: [...state.history, snapshot(state)],
        future: state.future.slice(0, -1),
        elapsedMs: solved ? Date.now() - state.startedAt : state.elapsedMs,
        status: solved ? "solved" : "playing",
      };
    }

    case "TICK":
      if (state.status !== "playing") return state;
      if (state.startedAt === 0) return state;
      return { ...state, elapsedMs: action.now - state.startedAt };

    default:
      return state;
  }
}

export interface UseGameApi {
  state: GameState;
  conflicts: Set<string>;
  hydrated: boolean;
  cycleCell: (r: number, c: number) => void;
  /**
   * Place a user-X at (r, c). `commit: true` opens a new undo entry (start
   * of a drag-paint); `commit: false` continues the current entry.
   * No-op on cells that are already X or star.
   */
  paintCell: (r: number, c: number, opts: { commit: boolean }) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  loadPuzzle: (puzzle: Puzzle, resume?: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useGame(initial: Puzzle): UseGameApi {
  // Initial state is deterministic: same on server and on client's first
  // render. Real values land via the HYDRATE effect below.
  const [state, dispatch] = useReducer(reducer, initial, bareState);

  // Hydrate once on mount. The puzzle id never changes for a given hook
  // instance (the page remounts via `key` on puzzle switch), but we depend
  // on it anyway so a future restructure stays correct.
  useEffect(() => {
    dispatch({ type: "HYDRATE" });
  }, [initial.id]);

  // Tick the timer once per second while playing AND hydrated.
  useEffect(() => {
    if (state.status !== "playing") return;
    if (state.startedAt === 0) return;
    const id = window.setInterval(
      () => dispatch({ type: "TICK", now: Date.now() }),
      1000,
    );
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt, state.puzzle.id]);

  // Persist on every change. Skip until hydrated so we don't overwrite a
  // valid saved game with a bare/empty board.
  useEffect(() => {
    if (state.startedAt === 0) return;
    if (state.status === "solved") {
      saveBestTime(state.puzzle.id, state.elapsedMs);
      clearInProgress(state.puzzle.id);
      return;
    }
    saveInProgress(state.puzzle.id, {
      board: state.board,
      autoX: state.autoX,
      startedAt: state.startedAt,
    });
  }, [
    state.board,
    state.autoX,
    state.status,
    state.puzzle.id,
    state.startedAt,
    state.elapsedMs,
  ]);

  const conflicts = findConflicts(state.board, state.puzzle).cells;

  return {
    state,
    conflicts,
    hydrated: state.startedAt !== 0,
    cycleCell: (r, c) => dispatch({ type: "CYCLE_CELL", r, c }),
    paintCell: (r, c, opts) =>
      dispatch({ type: "PAINT_X", r, c, commit: opts.commit }),
    undo: () => dispatch({ type: "UNDO" }),
    redo: () => dispatch({ type: "REDO" }),
    reset: () => dispatch({ type: "RESET" }),
    loadPuzzle: (puzzle, resume) =>
      dispatch({ type: "LOAD_PUZZLE", puzzle, resume }),
    canUndo: state.history.length > 0 && state.status === "playing",
    canRedo: state.future.length > 0 && state.status === "playing",
  };
}
