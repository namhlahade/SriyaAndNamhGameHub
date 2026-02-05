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

    let cancelled = false;
    let ch: RealtimeChannel | null = null;

    // Async function to set up the channel with a small delay
    const setupChannel = async () => {
      // Remove ALL existing channels to ensure fresh state
      const existingChannels = supabase.getChannels();
      for (const existing of existingChannels) {
        supabase.removeChannel(existing);
      }

      // Small delay to allow any cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (cancelled) return;

      const channelName = `lobby:${coupleId}`;
      ch = supabase.channel(channelName, {
        config: { presence: { key: String(mySlot) } },
      });

      ch.on("presence", { event: "sync" }, () => {
        if (cancelled || !ch) return;
        const state = ch.presenceState<PresencePayload>();
        const partnerSlot = mySlot === 1 ? "2" : "1";
        const partnerPresent = Object.keys(state).includes(partnerSlot);
        setPartnerOnline(partnerPresent);
      });

      ch.on("presence", { event: "join" }, ({ newPresences }) => {
        if (cancelled) return;
        const partnerSlot = mySlot === 1 ? 2 : 1;
        if (newPresences.some((p: any) => p.playerSlot === partnerSlot)) {
          setPartnerOnline(true);
        }
      });

      ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
        if (cancelled) return;
        const partnerSlot = mySlot === 1 ? 2 : 1;
        if (leftPresences.some((p: any) => p.playerSlot === partnerSlot)) {
          setPartnerOnline(false);
        }
      });

      ch.subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
          await ch!.track({ playerSlot: mySlot, joinedAt: Date.now() });
          
          // Re-check presence state after a short delay to catch race conditions
          setTimeout(() => {
            if (cancelled || !ch) return;
            const state = ch.presenceState<PresencePayload>();
            const partnerSlot = mySlot === 1 ? "2" : "1";
            const partnerPresent = Object.keys(state).includes(partnerSlot);
            setPartnerOnline(partnerPresent);
          }, 500);
        } else if (status === "TIMED_OUT" || status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsSubscribed(false);
        }
      });

      setChannel(ch);
    };

    setupChannel();

    return () => {
      cancelled = true;
      if (ch) {
        supabase.removeChannel(ch);
      }
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
