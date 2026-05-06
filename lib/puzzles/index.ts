import { Puzzle } from "@/lib/types";
import { puzzles as puzzlesV1B1 } from "./v1b1";

export const PUZZLES: Puzzle[] = [
  ...puzzlesV1B1,
].sort(
  (a, b) =>
    a.volume - b.volume ||
    a.book - b.book ||
    a.puzzleNumber - b.puzzleNumber,
);

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}