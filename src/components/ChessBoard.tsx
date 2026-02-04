"use client";

import type { ChessState } from "@/lib/supabase";
import { getValidSquares } from "@/lib/chess";

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function fenToBoard(fen: string): (string | null)[][] {
  const rows = fen.split(" ")[0].split("/");
  return rows.map((row) => {
    const out: (string | null)[] = [];
    for (const c of row) {
      if (/\d/.test(c)) {
        for (let i = 0; i < parseInt(c, 10); i++) out.push(null);
      } else {
        out.push(c);
      }
    }
    return out;
  });
}

export interface ChessBoardProps {
  state: ChessState;
  mySlot: 1 | 2;
  selected: string | null;
  validMoves: string[];
  onSelect: (sq: string | null) => void;
  onMove: (from: string, to: string) => void;
  disabled?: boolean;
}

export function ChessBoard({
  state,
  mySlot,
  selected,
  validMoves,
  onSelect,
  onMove,
  disabled,
}: ChessBoardProps) {
  const board = fenToBoard(state.fen);
  const files = "abcdefgh";

  // Correct isMyTurn: check if current turn matches my assigned color
  const isMyTurn = (state.turn === 1 && state.whitePlayer === mySlot) ||
                   (state.turn === 2 && state.blackPlayer === mySlot);

  const isMine = (piece: string | null) => {
    if (!piece) return false;
    const isWhitePiece = piece === piece.toUpperCase();
    if (mySlot === state.whitePlayer) return isWhitePiece;
    return !isWhitePiece;
  };

  function handleClick(sq: string, piece: string | null) {
    if (disabled) return;

    // If we have a selection, check if this is a valid move
    if (selected && validMoves.includes(sq)) {
      onMove(selected, sq);
      return;
    }

    // If clicking our own piece and it's our turn, select it
    if (isMine(piece) && isMyTurn) {
      const moves = getValidSquares(state, sq);
      if (moves.length > 0) {
        onSelect(sq);
        return;
      }
    }

    // Otherwise deselect
    onSelect(null);
  }

  return (
    <div
      className="inline-grid grid-cols-8 border-2 border-[var(--board-dark)]"
      style={{ width: "min(90vw, 400px)" }}
    >
      {board.map((row, r) =>
        row.map((piece, c) => {
          const light = (r + c) % 2 === 0;
          const sq = `${files[c]}${8 - r}`;
          const isSel = selected === sq;
          const isTarget = validMoves.includes(sq);
          const { lastMove } = state;
          const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);

          return (
            <button
              key={sq}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(sq, piece)}
              className={`
                aspect-square flex items-center justify-center text-2xl sm:text-3xl
                ${light ? "bg-board-light" : "bg-board-dark"}
                ${isLast ? "ring-2 ring-inset ring-board-last" : ""}
                ${isTarget ? "square-valid-move" : ""}
                ${isSel ? "ring-2 ring-inset ring-[var(--accent)]" : ""}
                ${disabled ? "cursor-default" : "cursor-pointer"}
              `}
            >
              {piece && (
                <span className={piece === piece.toUpperCase() ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : "text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]"}>
                  {PIECE_SYMBOLS[piece]}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
