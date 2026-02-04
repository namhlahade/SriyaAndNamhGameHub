"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresencePayload {
  playerSlot: 1 | 2;
  joinedAt: number;
}

export interface GameStartedPayload {
  gameId: string;
  gameType: "chess" | "checkers";
  startedBy: 1 | 2;
}

export function usePresence(coupleId: string | null, mySlot: 1 | 2) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!coupleId) {
      setIsSubscribed(false);
      return;
    }

    const ch = supabase.channel(`lobby:${coupleId}`, {
      config: { presence: { key: String(mySlot) } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PresencePayload>();
      // Check if the other player slot is present
      const partnerSlot = mySlot === 1 ? "2" : "1";
      const partnerPresent = Object.keys(state).includes(partnerSlot);
      setPartnerOnline(partnerPresent);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsSubscribed(true);
        await ch.track({ playerSlot: mySlot, joinedAt: Date.now() });
      } else if (status === "TIMED_OUT" || status === "CLOSED" || status === "CHANNEL_ERROR") {
        setIsSubscribed(false);
      }
    });

    setChannel(ch);

    return () => {
      ch.unsubscribe();
      setChannel(null);
      setIsSubscribed(false);
    };
  }, [coupleId, mySlot]);

  const broadcastGameStarted = useCallback(
    async (gameId: string, gameType: "chess" | "checkers") => {
      if (!channel || !isSubscribed) return;
      await channel.send({
        type: "broadcast",
        event: "game_started",
        payload: { gameId, gameType, startedBy: mySlot } as GameStartedPayload,
      });
    },
    [channel, mySlot, isSubscribed]
  );

  const onGameStarted = useCallback(
    (callback: (payload: GameStartedPayload) => void) => {
      if (!channel) return () => {};
      channel.on("broadcast", { event: "game_started" }, ({ payload }) => {
        callback(payload as GameStartedPayload);
      });
      return () => {};
    },
    [channel]
  );

  return { partnerOnline, broadcastGameStarted, onGameStarted, channel, isSubscribed };
}
