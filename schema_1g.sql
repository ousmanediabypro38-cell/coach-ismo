-- COACH ISMO — Phase 1F : matchs, résultats et temps de jeu
-- À coller dans Supabase > SQL Editor > New query > Run. Peut être relancé sans risque.
-- Prérequis : les scripts précédents (dont schema_1f.sql) déjà exécutés.

-- 1) Résultat et réglages du match, sur la rencontre
alter table public.events
  add column if not exists score_us int,
  add column if not exists score_them int,
  add column if not exists game_min int,        -- durée d'un quart-temps (minutes)
  add column if not exists nb_periods int,      -- 4 quart-temps (ou 2 mi-temps)
  add column if not exists periods jsonb,       -- [{game_s, us, them}] par période
  add column if not exists squad jsonb,         -- joueurs présents au match (liste d'id)
  add column if not exists live jsonb,          -- état du suivi en direct (null une fois le match fini)
  add column if not exists match_notes text;

-- 2) Passages sur le terrain : un joueur, une période, entrée et sortie (en secondes de jeu)
create table if not exists public.match_stints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  period int not null default 1,
  in_s double precision not null default 0,
  out_s double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_match_stints_updated on public.match_stints;
create trigger trg_match_stints_updated before update on public.match_stints
  for each row execute function public.set_updated_at();
alter table public.match_stints enable row level security;
drop policy if exists "match_stints_owner_all" on public.match_stints;
create policy "match_stints_owner_all" on public.match_stints
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists match_stints_owner_updated_idx on public.match_stints (owner_id, updated_at);
create index if not exists match_stints_event_idx on public.match_stints (event_id);

notify pgrst, 'reload schema';
