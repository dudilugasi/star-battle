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
  // Drawer state for the mobile picker. Ignored on md+ where the picker is
  // a permanent sidebar.
  const [pickerOpen, setPickerOpen] = useState(false);
  const puzzle = PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0];

  // Mount the game hook with the current puzzle. Switching puzzles is handled
  // by remounting via `key`, so undo/redo and timer reset cleanly.
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <GameSurface
        key={puzzle.id}
        puzzleId={puzzle.id}
        className="md:order-2"
      />

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label="Open puzzles"
        aria-expanded={pickerOpen}
        className="md:hidden fixed top-3 left-3 z-30 p-2 rounded-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <PuzzlePicker
        puzzles={PUZZLES}
        currentId={puzzleId}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(p) => {
          setPuzzleId(p.id);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function GameSurface({
  puzzleId,
  className,
}: {
  puzzleId: string;
  className?: string;
}) {
  const puzzle = PUZZLES.find((p) => p.id === puzzleId)!;
  const game = useGame(puzzle);

  return (
    <main
      className={[
        "flex-1 flex flex-col items-center gap-6 px-6 pb-6 pt-16",
        "justify-start md:justify-center md:pt-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
