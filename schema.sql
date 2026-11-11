-- COACH ISMO — Phase 0 : schéma de base + sécurité (Row Level Security)
-- À coller dans Supabase > SQL Editor > New query > Run.
-- Chaque ligne appartient à un utilisateur (owner_id) : personne d'autre ne peut la lire.

create extension if not exists pgcrypto;

-- Mise à jour automatique de updated_at (sert à la synchronisation)
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Équipes, saisons ----------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,
  club text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,                       -- ex. 2026-2027
  starts_on date, ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.team_seasons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  role text check (role in ('principal','assistant','joueur')) default 'principal',
  priority int check (priority between 1 and 6) default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- Joueurs ----------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  birth_year int,                            -- année seulement (minimisation des données)
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (            -- joueur dans une équipe pour une saison
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  jersey_number int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.player_private_notes ( -- jamais exportées par défaut
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.player_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  title text not null,
  status text check (status in ('en_cours','atteint','abandonne')) default 'en_cours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.player_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  observed_on date not null default current_date,
  category text check (category in ('entrainement','match','comportement','autre')) default 'autre',
  body text not null,
  share_in_pdf boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- Lieux, événements, matchs ----------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, address text, travel_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  kind text not null check (kind in ('entrainement','match','reunion','formation','autre')),
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  opponent text not null,
  home boolean default true,
  score_for int, score_against int,
  duration_seconds int default 2400,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- Triggers + sécurité sur toutes les tables ----------
do $$
declare t text;
begin
  foreach t in array array['teams','seasons','team_seasons','players','memberships',
    'player_private_notes','player_goals','player_observations','venues','events','matches']
  loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('create policy "%1$s_owner_all" on public.%1$s
                    for all to authenticated
                    using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create index on public.%1$s (owner_id, updated_at)', t);
  end loop;
end $$;
