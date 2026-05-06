import { Puzzle } from "@/lib/types";
import { puzzles as puzzles1x1 } from "./1_1";

export const PUZZLES: Puzzle[] = [
    ...puzzles1x1
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
