import { Chess } from "chess.js";
import type { ChessState } from "./supabase";

const defaultFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function createInitialChessState(whitePlayer: 1 | 2, blackPlayer: 1 | 2): ChessState {
  return {
    fen: defaultFen,
    turn: 1,
    whitePlayer,
    blackPlayer,
    moveHistory: [],
  };
}

export function getChessFromState(state: ChessState): Chess {
  return new Chess(state.fen);
}

export function getValidSquares(state: ChessState, from: string): string[] {
  const chess = getChessFromState(state);
  const moves = chess.moves({ square: from as any, verbose: true });
  return moves.map((m) => m.to);
}

export function applyChessMove(
  state: ChessState,
  from: string,
  to: string,
  promotion?: "q" | "r" | "b" | "n"
): ChessState | null {
  const chess = getChessFromState(state);
  const move = chess.move({
    from: from as any,
    to: to as any,
    promotion: promotion || "q",
  });
  if (!move) return null;

  const nextTurn = (state.turn === 1 ? 2 : 1) as 1 | 2;
  return {
    ...state,
    fen: chess.fen(),
    turn: nextTurn,
    moveHistory: [...state.moveHistory, move.san],
    lastMove: { from, to },
    drawOfferedBy: undefined,
  };
}

export function getChessStatus(
  state: ChessState
): "checkmate" | "stalemate" | "draw" | "active" {
  const chess = getChessFromState(state);
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isDraw()) return "draw"; // 50-move, 3-fold, insufficient, etc.
  return "active";
}

/** Map chess.js result to our status and winner. */
export function resolveChessOutcome(
  status: "checkmate" | "stalemate" | "draw",
  state: ChessState
): { status: "white_wins" | "black_wins" | "draw" | "stalemate"; winner: 1 | 2 | null } {
  if (status === "draw" || status === "stalemate") {
    return { status: status === "stalemate" ? "stalemate" : "draw", winner: null };
  }
  // Checkmate: the side that was just mated (the one to move) lost
  const loser = state.turn;
  const winner = (loser === 1 ? 2 : 1) as 1 | 2;
  const winStatus = state.whitePlayer === winner ? "white_wins" : "black_wins";
  return { status: winStatus, winner };
}
