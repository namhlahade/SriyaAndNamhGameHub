const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;

export function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

export const COUPLE_STORAGE_KEY = "sriya-namh-couple";

export interface StoredCouple {
  coupleId: string;
  inviteCode: string;
  playerSlot: 1 | 2;
}

export function getStoredCouple(): StoredCouple | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COUPLE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCouple;
  } catch {
    return null;
  }
}

export function setStoredCouple(c: StoredCouple): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(COUPLE_STORAGE_KEY, JSON.stringify(c));
}

export function clearStoredCouple(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(COUPLE_STORAGE_KEY);
}
