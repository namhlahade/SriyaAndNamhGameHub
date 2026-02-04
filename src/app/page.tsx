"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  generateInviteCode,
  getStoredCouple,
  setStoredCouple,
  type StoredCouple,
} from "@/lib/couple";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stored, setStored] = useState<StoredCouple | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    setStored(getStoredCouple());
    const code = searchParams.get("code");
    if (code) setJoinCode(String(code).trim().toUpperCase());
  }, [searchParams]);

  async function handleCreate() {
    setCreateLoading(true);
    setJoinError("");
    try {
      let code = generateInviteCode();
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase
          .from("couples")
          .insert({ invite_code: code })
          .select("id")
          .single();
        if (!error) {
          setStoredCouple({
            coupleId: data.id,
            inviteCode: code,
            playerSlot: 1,
          });
          setStored(getStoredCouple());
          router.push("/lobby");
          return;
        }
        if ((error as any)?.code !== "23505") throw error;
        code = generateInviteCode();
      }
      throw new Error("Could not generate unique code. Try again.");
    } catch (e: any) {
      setJoinError(e?.message || "Failed to create space.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinLoading(true);
    setJoinError("");
    const c = joinCode.trim().toUpperCase();
    if (!c) {
      setJoinError("Enter an invite code.");
      setJoinLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("couples")
        .select("id")
        .eq("invite_code", c)
        .single();
      if (error || !data) {
        setJoinError("Invalid or expired code. Check and try again.");
        setJoinLoading(false);
        return;
      }
      setStoredCouple({
        coupleId: data.id,
        inviteCode: c,
        playerSlot: 2,
      });
      setStored(getStoredCouple());
      router.push("/lobby");
    } catch (e: any) {
      setJoinError(e?.message || "Failed to join.");
    } finally {
      setJoinLoading(false);
    }
  }

  if (stored) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--background)]">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-[var(--foreground)] mb-2">
            Sriya & Namh
          </h1>
          <p className="text-[var(--accent)] mb-6">You&apos;re in your game space.</p>
          <Link
            href="/lobby"
            className="inline-block px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition"
          >
            Go to lobby
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold text-[var(--foreground)]">
            Sriya & Namh
          </h1>
          <p className="mt-2 text-[var(--accent)]">Game Hub</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleCreate}
            disabled={createLoading}
            className="w-full py-4 px-4 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 disabled:opacity-60 transition"
          >
            {createLoading ? "Creating…" : "Create a space"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--accent-soft)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--background)] text-[var(--accent)]">or</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Invite code"
              maxLength={8}
              className="w-full py-3 px-4 rounded-xl border border-[var(--accent-soft)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--accent)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={joinLoading}
              className="w-full py-3 rounded-xl border-2 border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)] disabled:opacity-60 transition"
            >
              {joinLoading ? "Joining…" : "Join with code"}
            </button>
          </form>

          {joinError && (
            <p className="text-sm text-red-500 text-center">{joinError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
