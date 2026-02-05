import type { CheckersState, CheckersPiece, CheckersCell } from "./supabase";

// Re-export types for convenience
export type { CheckersCell };

const ROWS = 8;
const COLS = 8;

export function createInitialCheckersBoard(): CheckersCell[][] {
  const board: CheckersCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < COLS; c++) {
      const isPlayable = (r + c) % 2 === 1;
      let piece: CheckersPiece = null;
      if (isPlayable) {
        if (r < 3) piece = "b"; // black (player 2) at top
        else if (r > 4) piece = "r"; // red (player 1) at bottom
      }
      board[r][c] = { piece };
    }
  }
  return board;
}

export function createInitialCheckersState(): CheckersState {
  return {
    board: createInitialCheckersBoard(),
    turn: 1,
    moveHistory: [],
  };
}

function isRed(p: CheckersPiece): boolean {
  return p === "r" || p === "R";
}
function isBlack(p: CheckersPiece): boolean {
  return p === "b" || p === "B";
}
function isKing(p: CheckersPiece): boolean {
  return p === "R" || p === "B";
}
function isOwnPiece(p: CheckersPiece, turn: 1 | 2): boolean {
  if (!p) return false;
  return turn === 1 ? isRed(p) : isBlack(p);
}
function isOpponent(p: CheckersPiece, turn: 1 | 2): boolean {
  if (!p) return false;
  return turn === 1 ? isBlack(p) : isRed(p);
}

export function getValidMoves(
  state: CheckersState,
  fromRow: number,
  fromCol: number
): { row: number; col: number; capture?: [number, number] }[] {
  const { board, turn, mustCaptureFrom } = state;
  const cell = board[fromRow]?.[fromCol];
  if (!cell?.piece || !isOwnPiece(cell.piece, turn)) return [];

  // If we're in a multi-jump, must continue from that square
  if (mustCaptureFrom && (mustCaptureFrom[0] !== fromRow || mustCaptureFrom[1] !== fromCol)) return [];

  const piece = cell.piece;
  const isK = isKing(piece);
  const moveDirs: [number, number][] = isK
    ? [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : turn === 1
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];

  const out: { row: number; col: number; capture?: [number, number] }[] = [];

  // Check for captures first (mandatory in American checkers when possible)
  for (const [dr, dc] of moveDirs) {
    const midR = fromRow + dr;
    const midC = fromCol + dc;
    const toR = fromRow + 2 * dr;
    const toC = fromCol + 2 * dc;
    if (toR >= 0 && toR < ROWS && toC >= 0 && toC < COLS) {
      const mid = board[midR]?.[midC]?.piece;
      const to = board[toR]?.[toC]?.piece;
      if (isOpponent(mid!, turn) && !to) {
        out.push({ row: toR, col: toC, capture: [midR, midC] });
      }
    }
  }

  // If any capture exists, only captures are valid
  if (out.length > 0) return out;

  // If we were in a multi-jump and no more captures, that's it
  if (mustCaptureFrom) return [];

  // Non-capture moves
  for (const [dr, dc] of moveDirs) {
    const toR = fromRow + dr;
    const toC = fromCol + dc;
    if (toR >= 0 && toR < ROWS && toC >= 0 && toC < COLS && !board[toR][toC].piece) {
      out.push({ row: toR, col: toC });
    }
  }
  return out;
}

/** Returns all squares that have a capture available (to enforce mandatory capture). */
function hasAnyCapture(state: CheckersState): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const moves = getValidMoves(state, r, c);
      if (moves.some((m) => m.capture)) return true;
    }
  }
  return false;
}

/** Enforce: if any piece can capture, only captures are allowed. */
export function getValidMovesWithMandatoryCapture(
  state: CheckersState,
  fromRow: number,
  fromCol: number
): { row: number; col: number; capture?: [number, number] }[] {
  const moves = getValidMoves(state, fromRow, fromCol);
  const anyCapture = hasAnyCapture(state);
  if (anyCapture) return moves.filter((m) => m.capture);
  return moves;
}

export function applyMove(
  state: CheckersState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): { state: CheckersState; continuedJump?: [number, number] } | null {
  const moves = getValidMovesWithMandatoryCapture(state, fromRow, fromCol);
  const m = moves.find((x) => x.row === toRow && x.col === toCol);
  if (!m) return null;

  const newBoard = state.board.map((row) =>
    row.map((c) => ({ piece: c.piece }))
  ) as CheckersCell[][];

  const piece = newBoard[fromRow][fromCol].piece!;
  newBoard[fromRow][fromCol] = { piece: null };
  newBoard[toRow][toCol] = { piece };

  // Promote to king
  if (piece === "r" && toRow === 0) newBoard[toRow][toCol] = { piece: "R" };
  if (piece === "b" && toRow === ROWS - 1) newBoard[toRow][toCol] = { piece: "B" };

  if (m.capture) {
    newBoard[m.capture[0]][m.capture[1]] = { piece: null };
    const not = getValidMoves(
      { ...state, board: newBoard, turn: state.turn },
      toRow,
      toCol
    ).filter((x) => x.capture);
    if (not.length > 0) {
      return {
        state: {
          ...state,
          board: newBoard,
          moveHistory: [
            ...state.moveHistory,
            `${fromRow},${fromCol}-${toRow},${toCol}`,
          ],
          lastMove: { from: [fromRow, fromCol], to: [toRow, toCol] },
          mustCaptureFrom: [toRow, toCol],
        },
        continuedJump: [toRow, toCol],
      };
    }
  }

  return {
    state: {
      ...state,
      board: newBoard,
      turn: (state.turn === 1 ? 2 : 1) as 1 | 2,
      moveHistory: [
        ...state.moveHistory,
        `${fromRow},${fromCol}-${toRow},${toCol}`,
      ],
      lastMove: { from: [fromRow, fromCol], to: [toRow, toCol] },
      mustCaptureFrom: undefined,
    },
  };
}

export function getCheckersWinner(state: CheckersState): 1 | 2 | "draw" | null {
  let red = 0,
    black = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = state.board[r][c].piece;
      if (isRed(p)) red++;
      else if (isBlack(p)) black++;
    }
  }
  if (red === 0) return 2;
  if (black === 0) return 1;

  // Stalemate: current player has no moves
  const turn = state.turn;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (getValidMovesWithMandatoryCapture(state, r, c).length > 0) return null;
    }
  }
  return "draw";
}
