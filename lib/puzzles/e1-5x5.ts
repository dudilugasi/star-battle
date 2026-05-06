import { Puzzle } from "@/lib/types";

export const puzzleE1_5x5: Puzzle = {
  id: "e1-5x5",
  name: "Warm-up",
  size: 5,
  difficulty: "easy",
  regions: [
    [0, 0, 1, 1, 1],
    [2, 0, 1, 1, 4],
    [2, 0, 3, 3, 4],
    [2, 0, 3, 3, 4],
    [2, 2, 3, 4, 4],
  ],
  solution: [
    [false, true, false, false, false],
    [false, false, false, true, false],
    [true, false, false, false, false],
    [false, false, true, false, false],
    [false, false, false, false, true],
  ],
};
