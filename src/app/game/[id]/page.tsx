"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  type GameRow,
  type ChessState,
  type CheckersState,
  type GameStatus,
} from "@/lib/supabase";
import { getStoredCouple, type StoredCouple } from "@/lib/couple";
import {
  getValidSquares,
  applyChessMove,
  getChessStatus,
  resolveChessOutcome,
} from "@/lib/chess";
import {
  getValidMovesWithMandatoryCapture,
  applyMove as applyCheckersMove,
  getCheckersWinner,
} from "@/lib/checkers";
import { ChessBoard } from "@/components/ChessBoard";
import { CheckersBoard } from "@/components/CheckersBoard";
import {
  getStoredSessionScores,
  updateSessionScores,
  persistSessionScores,
  markGameCounted,
  wasGameCounted,
} from "@/lib/session-scores";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [couple, setCouple] = useState<StoredCouple | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Chess-specific
  const [chessSrc, setChessSrc] = useState<string | null>(null);
  const [chessValid, setChessValid] = useState<string[]>([]);

  // Checkers-specific
  const [checkersSrc, setCheckersSrc] = useState<[number, number] | null>(null);
  const [checkersValid, setCheckersValid] = useState<{ row: number; col: number }[]>([]);

  // Notifications permission requested
  const [notifRequested, setNotifRequested] = useState(false);

  // Auto-redirect countdown
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  useEffect(() => {
    const s = getStoredCouple();
    if (!s) {
      router.replace("/");
      return;
    }
    setCouple(s);
  }, [router]);

  // Fetch game initially
  useEffect(() => {
    if (!couple) return;
    async function load() {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (error || !data) {
        router.replace("/lobby");
        return;
      }
      setGame(data as GameRow);
      setLoading(false);
    }
    load();
  }, [couple, gameId, router]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          setGame(payload.new as GameRow);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, gameId]);

  const mySlot = couple?.playerSlot ?? 1;
  const gameType = game?.game_type as "chess" | "checkers" | undefined;
  const rawState = game?.state;

  // Extract typed state
  const chessState: ChessState | null =
    gameType === "chess" && rawState
      ? (rawState as unknown as ChessState)
      : null;
  const checkersState: CheckersState | null =
    gameType === "checkers" && rawState
      ? (rawState as unknown as CheckersState)
      : null;

  // Determine terminal status
  const isTerminal =
    game?.status !== "active" && game?.status !== undefined;

  // isMyTurn calculation
  const isMyTurn = (() => {
    if (isTerminal) return false;
    if (gameType === "chess" && chessState) {
      const st = chessState as ChessState;
      return (st.turn === 1 && st.whitePlayer === mySlot) ||
             (st.turn === 2 && st.blackPlayer === mySlot);
    }
    if (gameType === "checkers" && checkersState) {
      return (checkersState as CheckersState).turn === mySlot;
    }
    return false;
  })();

  // Request notification permission
  useEffect(() => {
    if (!notifRequested && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
      setNotifRequested(true);
    }
  }, [notifRequested]);

  // Tab title updates
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isTerminal) {
      document.title = "Game Over - Sriya & Namh";
    } else if (isMyTurn) {
      document.title = "🔴 Your turn! - Sriya & Namh";
    } else {
      document.title = "Waiting... - Sriya & Namh";
    }
    return () => {
      document.title = "Sriya & Namh Game Hub";
    };
  }, [isMyTurn, isTerminal]);

  // Browser notification when it becomes my turn
  const prevIsMyTurn = usePrevious(isMyTurn);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      isMyTurn &&
      prevIsMyTurn === false &&
      document.hidden
    ) {
      new Notification("Your turn!", {
        body: `It's your move in ${gameType}`,
        icon: "/favicon.ico",
      });
    }
  }, [isMyTurn, prevIsMyTurn, gameType]);

  // Count game result in session scores
  useEffect(() => {
    if (!game || !gameType || game.status === "active") return;
    if (wasGameCounted(game.id)) return;
    const isDraw =
      game.status === "draw" || game.status === "stalemate" || game.status === "draw_accepted";
    const winner = isDraw ? null : (game.winner as 1 | 2 | null);
    const current = getStoredSessionScores();
    const next = updateSessionScores(current, gameType, winner);
    persistSessionScores(next);
    markGameCounted(game.id);
  }, [game, gameType]);

  // Auto-redirect to lobby when game ends
  useEffect(() => {
    if (isTerminal && redirectCountdown === null) {
      setRedirectCountdown(3);
    }
  }, [isTerminal, redirectCountdown]);

  useEffect(() => {
    if (redirectCountdown === null || redirectCountdown < 0) {
      return;
    }
    if (redirectCountdown === 0) {
      router.push("/lobby");
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown(redirectCountdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, router]);

  // Chess handlers
  function handleChessSelect(sq: string | null) {
    if (!chessState || isTerminal) {
      setChessSrc(null);
      setChessValid([]);
      return;
    }
    if (!sq) {
      setChessSrc(null);
      setChessValid([]);
      return;
    }
    const moves = getValidSquares(chessState, sq);
    setChessSrc(sq);
    setChessValid(moves);
  }

  async function handleChessMove(from: string, to: string) {
    if (!chessState || !game) return;
    const next = applyChessMove(chessState, from, to);
    if (!next) return;

    // Optimistic update
    setGame((prev) => (prev ? { ...prev, state: next } : null));
    setChessSrc(null);
    setChessValid([]);

    // Check for game end
    const status = getChessStatus(next);
    let dbStatus: GameStatus = "active";
    let winner: number | null = null;

    if (status !== "active") {
      const outcome = resolveChessOutcome(status, next);
      dbStatus = outcome.status;
      winner = outcome.winner;
    }

    await supabase
      .from("games")
      .update({ state: next, status: dbStatus, winner })
      .eq("id", game.id);
  }

  // Checkers handlers
  function handleCheckersSelect(cell: [number, number] | null) {
    if (!checkersState || isTerminal) {
      setCheckersSrc(null);
      setCheckersValid([]);
      return;
    }
    if (!cell) {
      setCheckersSrc(null);
      setCheckersValid([]);
      return;
    }
    const moves = getValidMovesWithMandatoryCapture(checkersState, cell[0], cell[1]);
    setCheckersSrc(cell);
    setCheckersValid(moves);
  }

  async function handleCheckersMove(fromR: number, fromC: number, toR: number, toC: number) {
    if (!checkersState || !game) return;
    const result = applyCheckersMove(checkersState, fromR, fromC, toR, toC);
    if (!result) return;

    // Optimistic update
    setGame((prev) => (prev ? { ...prev, state: result.state } : null));

    if (result.continuedJump) {
      setCheckersSrc(result.continuedJump);
      const moves = getValidMovesWithMandatoryCapture(
        result.state,
        result.continuedJump[0],
        result.continuedJump[1]
      );
      setCheckersValid(moves);
    } else {
      setCheckersSrc(null);
      setCheckersValid([]);
    }

    // Check winner
    const w = getCheckersWinner(result.state);
    let dbStatus: GameStatus = "active";
    let winner: number | null = null;
    if (w === 1) {
      dbStatus = "white_wins";
      winner = 1;
    } else if (w === 2) {
      dbStatus = "black_wins";
      winner = 2;
    } else if (w === "draw") {
      dbStatus = "draw";
    }

    await supabase
      .from("games")
      .update({ state: result.state, status: dbStatus, winner })
      .eq("id", game.id);
  }

  // Draw / Resign handlers
  async function offerDraw() {
    if (!game || !chessState) return;
    const next = { ...chessState, drawOfferedBy: mySlot as 1 | 2 };
    await supabase.from("games").update({ state: next }).eq("id", game.id);
  }

  async function acceptDraw() {
    if (!game) return;
    await supabase
      .from("games")
      .update({ status: "draw_accepted", winner: null })
      .eq("id", game.id);
  }

  async function resign() {
    if (!game) return;
    const status: GameStatus = mySlot === 1 ? "white_resigned" : "black_resigned";
    const winner = mySlot === 1 ? 2 : 1;
    await supabase.from("games").update({ status, winner }).eq("id", game.id);
  }

  if (loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--accent)]">Loading...</p>
      </div>
    );
  }

  const drawOffered = chessState?.drawOfferedBy;
  const drawOfferedByMe = drawOffered === mySlot;
  const drawOfferedByOpponent = drawOffered && drawOffered !== mySlot;

  return (
    <div className="min-h-screen p-4 bg-[var(--background)]">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/lobby" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to lobby
          </Link>
          <h1 className="font-serif text-xl font-bold text-[var(--foreground)] capitalize">
            {gameType}
          </h1>
        </div>

        {/* Turn indicator */}
        {!isTerminal && (
          <div
            className={`text-center py-2 px-4 rounded-lg font-medium ${
              isMyTurn
                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            {isMyTurn ? "🔴 Your turn!" : "Waiting for opponent..."}
          </div>
        )}

        {/* Board */}
        <div className="flex justify-center">
          {gameType === "chess" && chessState && (
            <ChessBoard
              state={chessState}
              mySlot={mySlot}
              selected={chessSrc}
              validMoves={chessValid}
              onSelect={handleChessSelect}
              onMove={handleChessMove}
              disabled={!isMyTurn || isTerminal}
            />
          )}
          {gameType === "checkers" && checkersState && (
            <CheckersBoard
              state={checkersState}
              mySlot={mySlot}
              selected={checkersSrc}
              validMoves={checkersValid}
              onSelect={handleCheckersSelect}
              onMove={handleCheckersMove}
              disabled={!isMyTurn || isTerminal}
            />
          )}
        </div>

        {/* Game status */}
        {isTerminal && (
          <div className="text-center p-4 rounded-xl bg-[var(--accent-soft)] space-y-3">
            <p className="font-semibold text-[var(--foreground)]">
              {game.status === "draw" || game.status === "stalemate" || game.status === "draw_accepted"
                ? "Game ended in a draw"
                : game.winner === mySlot
                ? "You won!"
                : "You lost"}
            </p>
            <p className="text-sm text-[var(--accent)] capitalize">
              {game.status.replace(/_/g, " ")}
            </p>
            <div className="pt-2 border-t border-[var(--accent)]/20">
              {redirectCountdown !== null && redirectCountdown > 0 ? (
                <p className="text-sm text-[var(--foreground)]">
                  Returning to lobby in {redirectCountdown}...
                </p>
              ) : (
                <p className="text-sm text-[var(--foreground)]">Redirecting...</p>
              )}
              <button
                onClick={() => router.push("/lobby")}
                className="mt-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition"
              >
                Return now
              </button>
            </div>
          </div>
        )}

        {/* Draw offer (chess only) */}
        {gameType === "chess" && !isTerminal && (
          <div className="space-y-2">
            {drawOfferedByOpponent && (
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-center">
                <p className="text-yellow-800 dark:text-yellow-100 mb-2">
                  Opponent offered a draw
                </p>
                <button
                  onClick={acceptDraw}
                  className="px-4 py-2 rounded bg-yellow-600 text-white font-medium mr-2"
                >
                  Accept
                </button>
                <span className="text-sm text-yellow-700 dark:text-yellow-200">
                  or keep playing
                </span>
              </div>
            )}
            <div className="flex gap-2 justify-center">
              {!drawOffered && (
                <button
                  onClick={offerDraw}
                  className="px-4 py-2 rounded border border-[var(--accent)] text-[var(--accent)] text-sm"
                >
                  Offer draw
                </button>
              )}
              {drawOfferedByMe && (
                <span className="px-4 py-2 text-sm text-[var(--accent)]">
                  Draw offered, waiting...
                </span>
              )}
              <button
                onClick={resign}
                className="px-4 py-2 rounded border border-red-500 text-red-500 text-sm"
              >
                Resign
              </button>
            </div>
          </div>
        )}

        {/* Move history */}
        {(chessState?.moveHistory?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-[var(--foreground)]">Moves</h2>
            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 text-sm font-mono text-[var(--foreground)] max-h-32 overflow-y-auto">
              {chessState?.moveHistory.join(" ")}
            </div>
          </div>
        )}
        {(checkersState?.moveHistory?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-[var(--foreground)]">Moves</h2>
            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 text-sm font-mono text-[var(--foreground)] max-h-32 overflow-y-auto">
              {checkersState?.moveHistory.join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to get previous value
function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  useEffect(() => {
    setPrev(value);
  }, [value]);
  return prev;
}
