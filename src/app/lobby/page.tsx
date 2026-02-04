"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, type GameRow, type ChessState, type CheckersState } from "@/lib/supabase";
import { getStoredCouple, clearStoredCouple, type StoredCouple } from "@/lib/couple";
import { createInitialChessState } from "@/lib/chess";
import { createInitialCheckersState } from "@/lib/checkers";
import {
  getStoredSessionScores,
  updateSessionScores,
  persistSessionScores,
  resetSessionScores,
  markGameCounted,
  wasGameCounted,
  type SessionScores,
} from "@/lib/session-scores";
import { usePresence, type GameStartedPayload } from "@/lib/presence";

export default function LobbyPage() {
  const router = useRouter();
  const [couple, setCouple] = useState<StoredCouple | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [sessionScores, setSessionScores] = useState<SessionScores | null>(null);
  const [lifetimeScores, setLifetimeScores] = useState<SessionScores | null>(null);
  const [gameInvite, setGameInvite] = useState<GameStartedPayload | null>(null);

  useEffect(() => {
    const s = getStoredCouple();
    if (!s) {
      router.replace("/");
      return;
    }
    setCouple(s);
    setSessionScores(getStoredSessionScores());
  }, [router]);

  // Presence tracking
  const { partnerOnline, broadcastGameStarted, channel, isSubscribed } = usePresence(
    couple?.coupleId ?? null,
    couple?.playerSlot ?? 1
  );

  // Listen for game started broadcasts from partner - only when channel is SUBSCRIBED
  useEffect(() => {
    // Only attach listener when channel is confirmed SUBSCRIBED
    if (!channel || !couple || !isSubscribed) return;

    const handleGameStarted = ({ payload }: { payload: GameStartedPayload }) => {
      // Only respond if the other player started the game
      if (payload.startedBy !== couple.playerSlot) {
        setGameInvite(payload);
      }
    };

    channel.on("broadcast", { event: "game_started" }, handleGameStarted);

    return () => {
      // Cleanup is handled when channel unsubscribes
    };
  }, [channel, couple, isSubscribed]);

  // Fetch games
  useEffect(() => {
    if (!couple) return;
    async function load() {
      const { data } = await supabase
        .from("games")
        .select("*")
        .eq("couple_id", couple!.coupleId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setGames(data as GameRow[]);
    }
    load();
  }, [couple]);

  // Lifetime scores from finished games
  useEffect(() => {
    if (!games.length) return;
    const lt: SessionScores = {
      chess: { p1: 0, p2: 0, draws: 0 },
      checkers: { p1: 0, p2: 0, draws: 0 },
      total: { p1: 0, p2: 0, draws: 0 },
    };
    for (const g of games) {
      if (g.status === "active") continue;
      const isDraw =
        g.status === "draw" || g.status === "stalemate" || g.status === "draw_accepted";
      const gt = g.game_type as "chess" | "checkers";
      if (isDraw) {
        lt[gt].draws++;
        lt.total.draws++;
      } else if (g.winner === 1) {
        lt[gt].p1++;
        lt.total.p1++;
      } else if (g.winner === 2) {
        lt[gt].p2++;
        lt.total.p2++;
      }
    }
    setLifetimeScores(lt);
  }, [games]);

  async function createGame(type: "chess" | "checkers") {
    if (!couple) return;
    // Randomize who is white/red
    const coinFlip = Math.random() < 0.5;
    let state: ChessState | CheckersState;
    if (type === "chess") {
      const white = coinFlip ? 1 : 2;
      const black = (white === 1 ? 2 : 1) as 1 | 2;
      state = createInitialChessState(white as 1 | 2, black);
    } else {
      state = createInitialCheckersState();
    }

    const { data, error } = await supabase
      .from("games")
      .insert({ couple_id: couple.coupleId, game_type: type, state, status: "active" })
      .select("id")
      .single();
    if (error || !data) {
      console.error(error);
      return;
    }

    // Broadcast to partner that game started
    await broadcastGameStarted(data.id, type);

    router.push(`/game/${data.id}`);
  }

  function leaveSpace() {
    clearStoredCouple();
    resetSessionScores();
    router.replace("/");
  }

  if (!couple) return null;

  const url = typeof window !== "undefined" ? `${window.location.origin}/?code=${couple.inviteCode}` : "";

  return (
    <div className="min-h-screen p-4 bg-[var(--background)]">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold text-[var(--foreground)]">Lobby</h1>
          <button
            onClick={leaveSpace}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Leave space
          </button>
        </div>

        {/* Invite code + partner status */}
        <div className="p-4 rounded-xl bg-[var(--accent-soft)] space-y-2">
          <p className="text-sm text-[var(--accent)]">Your invite link:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-white/50 dark:bg-black/20 text-[var(--foreground)] font-mono text-sm truncate">
              {url}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              className="px-3 py-2 rounded bg-[var(--accent)] text-white text-sm font-medium"
            >
              Copy
            </button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span
              className={`w-3 h-3 rounded-full ${
                partnerOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-sm text-[var(--foreground)]">
              {partnerOnline ? "Partner is online" : "Partner is offline"}
            </span>
          </div>
        </div>

        {/* Game invite popup */}
        {gameInvite && (
          <div className="p-4 rounded-xl bg-green-100 dark:bg-green-900 border-2 border-green-500 space-y-3">
            <p className="text-green-800 dark:text-green-100 font-medium">
              Your partner started a {gameInvite.gameType} game!
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  router.push(`/game/${gameInvite.gameId}`);
                  setGameInvite(null);
                }}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
              >
                Join now
              </button>
              <button
                onClick={() => setGameInvite(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* New game */}
        <div className="space-y-3">
          <h2 className="font-semibold text-[var(--foreground)]">Start a new game</h2>
          <div className="flex gap-3">
            <button
              onClick={() => createGame("chess")}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition"
            >
              Chess
            </button>
            <button
              onClick={() => createGame("checkers")}
              className="flex-1 py-3 rounded-xl border-2 border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)] transition"
            >
              Checkers
            </button>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreCard title="Session" scores={sessionScores} />
          <ScoreCard title="Lifetime" scores={lifetimeScores} />
        </div>

        {/* Match history */}
        <div className="space-y-3">
          <h2 className="font-semibold text-[var(--foreground)]">Match history</h2>
          {games.length === 0 ? (
            <p className="text-sm text-[var(--accent)]">No games yet. Start one above!</p>
          ) : (
            <ul className="space-y-2">
              {games.slice(0, 10).map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/game/${g.id}`}
                    className="block p-3 rounded-lg bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--foreground)] capitalize">
                        {g.game_type}
                      </span>
                      <span className="text-xs text-[var(--accent)]">
                        {new Date(g.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--accent)] mt-1">
                      {g.status === "active"
                        ? "In progress"
                        : g.winner
                        ? `Player ${g.winner} won`
                        : "Draw"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  title,
  scores,
}: {
  title: string;
  scores: SessionScores | null;
}) {
  if (!scores) return null;
  return (
    <div className="p-4 rounded-xl bg-white/50 dark:bg-black/20 space-y-2">
      <h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
      <div className="text-sm space-y-1 text-[var(--foreground)]">
        <p>
          <span className="text-[var(--accent)]">Total:</span> P1 {scores.total.p1} – P2{" "}
          {scores.total.p2} ({scores.total.draws} draws)
        </p>
        <p>
          <span className="text-[var(--accent)]">Chess:</span> {scores.chess.p1}–
          {scores.chess.p2} ({scores.chess.draws})
        </p>
        <p>
          <span className="text-[var(--accent)]">Checkers:</span> {scores.checkers.p1}–
          {scores.checkers.p2} ({scores.checkers.draws})
        </p>
      </div>
    </div>
  );
}
