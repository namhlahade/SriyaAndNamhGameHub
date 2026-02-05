const SESSION_KEY = "sriya-namh-session-scores";
const COUNTED_KEY = "sriya-namh-counted";

export interface GameScores {
  p1: number;
  p2: number;
  draws: number;
}

export interface SessionScores {
  chess: GameScores;
  checkers: GameScores;
  total: GameScores;
}

const empty: GameScores = { p1: 0, p2: 0, draws: 0 };

export function getEmptySession(): SessionScores {
  return {
    chess: { ...empty },
    checkers: { ...empty },
    total: { ...empty },
  };
}

export function getStoredSessionScores(): SessionScores {
  if (typeof window === "undefined") return getEmptySession();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return getEmptySession();
    const parsed = JSON.parse(raw) as SessionScores;
    return {
      chess: { ...empty, ...parsed.chess },
      checkers: { ...empty, ...parsed.checkers },
      total: { ...empty, ...parsed.total },
    };
  } catch {
    return getEmptySession();
  }
}

export function updateSessionScores(
  current: SessionScores,
  gameType: "chess" | "checkers",
  winner: 1 | 2 | null
): SessionScores {
  const next = JSON.parse(JSON.stringify(current)) as SessionScores;
  const g = next[gameType];
  const t = next.total;
  if (winner === 1) {
    g.p1++;
    t.p1++;
  } else if (winner === 2) {
    g.p2++;
    t.p2++;
  } else {
    g.draws++;
    t.draws++;
  }
  return next;
}

export function persistSessionScores(s: SessionScores): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function resetSessionScores(): SessionScores {
  const emptySession = getEmptySession();
  persistSessionScores(emptySession);
  return emptySession;
}

export function markGameCounted(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(COUNTED_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(gameId);
    sessionStorage.setItem(COUNTED_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function wasGameCounted(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(COUNTED_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    return set.has(gameId);
  } catch {
    return false;
  }
}
