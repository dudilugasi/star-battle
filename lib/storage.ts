import { CellValue } from "./types";

// Tiny localStorage wrapper. All access goes through try/catch because:
//   - Server-side rendering has no `window`.
//   - Private browsing / quota-exceeded can throw on read or write.
//   - The game must remain playable even if persistence fails.

const KEY_PREFIX = "star-battle:v1:";
const bestTimeKey = (puzzleId: string) => `${KEY_PREFIX}best:${puzzleId}`;
const inProgressKey = (puzzleId: string) =>
  `${KEY_PREFIX}progress:${puzzleId}`;

export interface InProgress {
  board: CellValue[][];
  /** Parallel grid: true = the x at this cell was placed automatically. */
  autoX: boolean[][];
  startedAt: number;
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: persistence is best-effort.
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function loadBestTime(puzzleId: string): number | null {
  const raw = safeGet(bestTimeKey(puzzleId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Event name dispatched on `window` whenever a puzzle is marked solved
// (best time written for the first time, or improved). The sidebar listens
// for this so the "solved" checkmark appears immediately on win, even when
// the active puzzle id hasn't changed.
export const BEST_TIME_SAVED_EVENT = "star-battle:best-time-saved";

export function saveBestTime(puzzleId: string, ms: number): void {
  const current = loadBestTime(puzzleId);
  if (current === null || ms < current) {
    safeSet(bestTimeKey(puzzleId), String(ms));
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(BEST_TIME_SAVED_EVENT, { detail: { puzzleId } }),
      );
    } catch {
      // Older browsers / SSR shims may not support CustomEvent. The UI will
      // simply refresh the next time the user picks another puzzle.
    }
  }
}

export function loadInProgress(puzzleId: string): InProgress | null {
  const raw = safeGet(inProgressKey(puzzleId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InProgress;
    if (!Array.isArray(parsed.board)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveInProgress(puzzleId: string, data: InProgress): void {
  safeSet(inProgressKey(puzzleId), JSON.stringify(data));
}

export function clearInProgress(puzzleId: string): void {
  safeRemove(inProgressKey(puzzleId));
}
