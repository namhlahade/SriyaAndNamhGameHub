-- Run this in your Supabase SQL Editor to set up the database.

-- Couples: one row per "game space". Invite code pairs two players.
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz default now()
);

-- Games: one game per row. state holds board, turn, moveHistory, etc.
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  game_type text not null check (game_type in ('chess','checkers')),
  state jsonb not null,
  status text not null default 'active'
    check (status in (
      'active',
      'white_wins','black_wins','draw',
      'white_resigned','black_resigned','draw_accepted','stalemate'
    )),
  winner int check (winner in (1, 2)),  -- null = draw
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists games_couple_id_idx on games(couple_id);
create index if not exists games_couple_type_created_idx on games(couple_id, game_type, created_at desc);

-- Enable Realtime for games so both players see moves instantly
alter publication supabase_realtime add table games;

-- Optional: trigger to keep updated_at in sync
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists games_updated_at on games;
create trigger games_updated_at
  before update on games
  for each row execute function set_updated_at();
