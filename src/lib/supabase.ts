import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url || "", anon || "");

export type GameType = "chess" | "checkers";
export type GameStatus =
  | "active"
  | "white_wins"
  | "black_wins"
  | "draw"
  | "white_resigned"
  | "black_resigned"
  | "draw_accepted"
  | "stalemate";

export interface ChessState {
  fen: string;
  turn: 1 | 2; // 1=white, 2=black
  whitePlayer: 1 | 2;
  blackPlayer: 1 | 2;
  moveHistory: string[];
  drawOfferedBy?: 1 | 2;
  lastMove?: { from: string; to: string };
}

export interface CheckersState {
  board: CheckersCell[][]; // 8x8, [row][col]
  turn: 1 | 2; // 1=red (top), 2=black (bottom)
  moveHistory: string[];
  lastMove?: { from: [number, number]; to: [number, number] };
  mustCaptureFrom?: [number, number]; // if a multi-jump is in progress
}

export type CheckersPiece = "r" | "R" | "b" | "B" | null; // r=red, R=red king, b=black, B=black king

export interface CheckersCell {
  piece: CheckersPiece;
}

export type GameState = ChessState | CheckersState;

export interface GameRow {
  id: string;
  couple_id: string;
  game_type: GameType;
  state: GameState;
  status: GameStatus;
  winner: number | null;
  created_at: string;
  updated_at: string;
}

export interface CoupleRow {
  id: string;
  invite_code: string;
  created_at: string;
}
