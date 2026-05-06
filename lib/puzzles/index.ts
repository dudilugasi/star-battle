import { Puzzle } from "@/lib/types";
import { puzzleE1_5x5 } from "./e1-5x5";
import { puzzleM1_5x5 } from "./m1-5x5";
import { puzzleM1_8x8 } from "./m1-8x8";
import { puzzleH1_8x8 } from "./h1-8x8";

export const PUZZLES: Puzzle[] = [
  puzzleE1_5x5,
  puzzleM1_5x5,
  puzzleM1_8x8,
  puzzleH1_8x8,
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
