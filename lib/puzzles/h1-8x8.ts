import { Puzzle } from "@/lib/types";

export const puzzleH1_8x8: Puzzle = {
  id: "h1-8x8",
  name: "Galaxy",
  size: 8,
  difficulty: "hard",
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
  solution: [
    [false, false, false, true, false, false, false, false],
    [false, false, false, false, false, false, true, false],
    [false, true, false, false, false, false, false, false],
    [false, false, false, false, true, false, false, false],
    [false, false, false, false, false, false, false, true],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, true, false, false],
    [true, false, false, false, false, false, false, false],
  ],
};
