"use client";

import type { CheckersState, CheckersPiece } from "@/lib/supabase";
import {
  getValidMovesWithMandatoryCapture,
  type CheckersCell,
} from "@/lib/checkers";

function Piece({ p }: { p: CheckersPiece }) {
  if (!p) return null;
  const isKing = p === "R" || p === "B";
  const isRed = p === "r" || p === "R";
  return (
    <span
      className={`
        inline-block w-[75%] h-[75%] rounded-full
        ${isRed ? "bg-checkers-red" : "bg-checkers-black"}
        ${isKing ? "ring-2 ring-checkers-king" : ""}
      `}
    />
  );
}

export interface CheckersBoardProps {
  state: CheckersState;
  mySlot: 1 | 2;
  selected: [number, number] | null;
  validMoves: { row: number; col: number }[];
  onSelect: (cell: [number, number] | null) => void;
  onMove: (fromR: number, fromC: number, toR: number, toC: number) => void;
  disabled?: boolean;
}

export function CheckersBoard({
  state,
  mySlot,
  selected,
  validMoves,
  onSelect,
  onMove,
  disabled,
}: CheckersBoardProps) {
  const { board, turn } = state;
  const isMyTurn = turn === mySlot;
  // In checkers, 1=red (bottom rows), 2=black (top rows)
  const isMine = (r: number, c: number) => {
    const p = board[r]?.[c]?.piece;
    if (!p) return false;
    if (mySlot === 1) return p === "r" || p === "R";
    return p === "b" || p === "B";
  };

  function handleClick(r: number, c: number) {
    const target = validMoves.find((m) => m.row === r && m.col === c);
    if (selected !== null && target) {
      onMove(selected[0], selected[1], r, c);
      return;
    }
    if (selected !== null) {
      onSelect(null);
      return;
    }
    if (isMine(r, c) && isMyTurn) {
      const moves = getValidMovesWithMandatoryCapture(state, r, c);
      if (moves.length > 0) onSelect([r, c]);
    }
  }

  return (
    <div
      className="inline-grid grid-cols-8 border-2 border-[var(--board-dark)]"
      style={{ width: "min(90vw, 400px)" }}
    >
      {board.map((row, r) =>
        row.map((cell, c) => {
          const light = (r + c) % 2 === 0;
          const playable = !light;
          const isSel = selected && selected[0] === r && selected[1] === c;
          const isTarget = validMoves.some((m) => m.row === r && m.col === c);
          const { lastMove } = state;
          const isLast =
            lastMove &&
            ((lastMove.from[0] === r && lastMove.from[1] === c) ||
             (lastMove.to[0] === r && lastMove.to[1] === c));
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              disabled={disabled || !playable}
              onClick={() => playable && handleClick(r, c)}
              className={`
                aspect-square flex items-center justify-center
                ${light ? "bg-board-light" : "bg-board-dark"}
                ${isLast ? "ring-2 ring-inset ring-board-last" : ""}
                ${isTarget ? "square-valid-move" : ""}
                ${isSel ? "ring-2 ring-inset ring-[var(--accent)]" : ""}
                ${!playable ? "cursor-default" : disabled ? "cursor-default" : "cursor-pointer"}
              `}
            >
              {cell.piece && <Piece p={cell.piece} />}
            </button>
          );
        })
      )}
    </div>
  );
}
