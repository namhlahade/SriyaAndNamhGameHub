# Sriya & Namh Game Hub

A two-player game hub for chess and checkers. No accounts — create or join a space with an invite code and play in real time.

## Features

- **Couple space** — Create a space or join with an invite code/link. No sign-up.
- **Chess** — Full rules (legal moves, checkmate, stalemate, draws). Offer draw, resign. Move history.
- **Checkers** — American rules. Mandatory jumps. Kings. Move history.
- **Real-time** — Moves and draw/resign updates sync instantly via Supabase Realtime.
- **Scores** — Session tally (wins/losses/draws per game and total) and lifetime tally.
- **Match history** — List of completed games by type with results and dates.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the contents of `supabase/schema.sql`.
3. In **Database → Replication**, ensure the `games` table is in the `supabase_realtime` publication (the schema script does this; if it errors, add it in the dashboard).
4. In **Project Settings → API**, copy the Project URL and the `anon` public key.

### 2. Env

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to play

1. **Create a space** — One person clicks “Create a space” and gets an invite code.
2. **Share** — Use “Copy” in the lobby to copy a link (or share the code).
3. **Join** — The other person opens the link or enters the code on the home page and joins.
4. **Play** — In the lobby, pick Chess or Checkers. Moves and game end (checkmate, resign, draw, etc.) sync in real time.
5. **Scores** — Session and lifetime tallies update when a game ends. Use “New session” to reset the session tally.

## Tech

- Next.js 14 (App Router), React, TypeScript, Tailwind
- Supabase (Postgres + Realtime)
- [chess.js](https://github.com/jhlywa/chess.js) for chess rules
- Custom American checkers rules (8×8, mandatory capture, king moves)
