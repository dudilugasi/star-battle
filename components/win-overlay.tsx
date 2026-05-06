"use client";

interface WinOverlayProps {
  show: boolean;
  elapsedMs: number;
  puzzleName: string;
  onPlayAgain: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WinOverlay({
  show,
  elapsedMs,
  puzzleName,
  onPlayAgain,
}: WinOverlayProps) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-title"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-[90%] text-center border border-zinc-200 dark:border-zinc-800">
        <div className="text-6xl mb-2">🌟</div>
        <h2
          id="win-title"
          className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1"
        >
          Solved!
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-1">{puzzleName}</p>
        <p className="font-mono text-lg text-amber-600 dark:text-amber-400 mb-6">
          {formatTime(elapsedMs)}
        </p>
        <button
          type="button"
          onClick={onPlayAgain}
          className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
