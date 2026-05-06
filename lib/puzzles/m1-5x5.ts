import { Puzzle } from "@/lib/types";

export const puzzleM1_5x5: Puzzle = {
  id: "m1-5x5",
  name: "Diagonal",
  size: 5,
  difficulty: "medium",
  regions: [
    [0, 0, 0, 0, 1],
    [2, 2, 0, 3, 1],
    [4, 2, 3, 3, 1],
    [4, 2, 2, 3, 1],
    [4, 4, 4, 3, 1],
  ],
  solution: [
    [false, false, true, false, false],
    [false, false, false, false, true],
    [false, true, false, false, false],
    [false, false, false, true, false],
    [true, false, false, false, false],
  ],
};
