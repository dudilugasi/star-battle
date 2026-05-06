"use client";

import { useState } from "react";
import { GameBoard } from "@/components/game-board";
import { GameControls } from "@/components/game-controls";
import { PuzzlePicker } from "@/components/puzzle-picker";
import { WinOverlay } from "@/components/win-overlay";
import { useGame } from "@/hooks/use-game";
import { PUZZLES } from "@/lib/puzzles";

export default function Home() {
  // Pick the first puzzle as the default; the picker can change it.
  const [puzzleId, setPuzzleId] = useState<string>(PUZZLES[0].id);
  const puzzle = PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0];

  // Mount the game hook with the current puzzle. Switching puzzles is handled
  // by remounting via `key`, so undo/redo and timer reset cleanly.
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <PuzzlePicker
        puzzles={PUZZLES}
        currentId={puzzleId}
        onPick={(p) => setPuzzleId(p.id)}
      />
      <GameSurface key={puzzle.id} puzzleId={puzzle.id} />
    </div>
  );
}

function GameSurface({ puzzleId }: { puzzleId: string }) {
  const puzzle = PUZZLES.find((p) => p.id === puzzleId)!;
  const game = useGame(puzzle);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <header className="w-full max-w-[min(90vw,560px)] flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {puzzle.name}
        </h1>
      </header>
      <GameControls
        puzzleId={puzzle.id}
        elapsedMs={game.state.elapsedMs}
        status={game.state.status}
        canUndo={game.canUndo}
        canRedo={game.canRedo}
        onUndo={game.undo}
        onRedo={game.redo}
        onReset={game.reset}
      />
      <GameBoard
        puzzle={puzzle}
        board={game.state.board}
        conflicts={game.conflicts}
        disabled={game.state.status === "solved"}
        onCellClick={game.cycleCell}
        paintCell={game.paintCell}
      />
      <WinOverlay
        show={game.state.status === "solved"}
        elapsedMs={game.state.elapsedMs}
        puzzleName={puzzle.name}
        onPlayAgain={game.reset}
      />
    </main>
  );
}
