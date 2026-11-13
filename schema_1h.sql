-- COACH ISMO — Phase 1G : suivi individuel des joueurs
-- À coller dans Supabase > SQL Editor > New query > Run. Peut être relancé sans risque.
-- Prérequis : les scripts précédents (dont schema_1g.sql) déjà exécutés.

-- 1) Profil du joueur : trois champs libres en plus du poste déjà présent
alter table public.players
  add column if not exists role_note text,     -- rôle dans l'équipe
  add column if not exists strengths text,     -- points forts
  add column if not exists to_improve text;    -- axes de progrès

-- 2) Observations (+ / −), entretiens et bilans, datés
create table if not exists public.player_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null default 'observation' check (kind in ('observation','entretien','bilan')),
  tone text check (tone is null or tone in ('plus','moins','neutre')),
  entry_date date not null default current_date,
  title text,
  body text,
  session_id uuid references public.sessions(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3) Objectifs individuels par cycle
create table if not exists public.player_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  cycle text,
  body text not null,
  status text not null default 'en_cours' check (status in ('en_cours','atteint','abandonne')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['player_entries','player_goals']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$s', t);
    execute format('create policy "%1$s_owner_all" on public.%1$s
                    for all to authenticated
                    using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create index if not exists %1$s_owner_updated_idx on public.%1$s (owner_id, updated_at)', t);
    execute format('create index if not exists %1$s_player_idx on public.%1$s (player_id)', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
