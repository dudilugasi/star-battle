import { Puzzle } from "@/lib/types";

export const puzzleM1_8x8: Puzzle = {
  id: "m1-8x8",
  name: "Constellation",
  size: 8,
  difficulty: "medium",
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
  solution: [
    [false, true, false, false, false, false, false, false],
    [false, false, false, true, false, false, false, false],
    [false, false, false, false, false, true, false, false],
    [false, false, false, false, false, false, false, true],
    [true, false, false, false, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, true, false, false, false],
    [false, false, false, false, false, false, true, false],
  ],
};
