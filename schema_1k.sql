-- COACH ISMO — Phase 1J : convocations de match et présences (disponibilités)
-- À coller dans Supabase > SQL Editor > New query > Run. Peut être relancé sans risque.
-- Prérequis : les scripts précédents (dont schema_1j.sql) déjà exécutés.

-- 1) Réglages de la convocation, sur la rencontre
alter table public.events add column if not exists convoc jsonb;

-- 2) Disponibilité de chaque joueur pour un match
create table if not exists public.match_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'present' check (status in ('present','peut_etre','absent')),
  convoked boolean not null default false,
  source text not null default 'coach',          -- 'coach' (saisi par moi) ou 'lien' (réponse du joueur, plus tard)
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_match_availability_updated on public.match_availability;
create trigger trg_match_availability_updated before update on public.match_availability
  for each row execute function public.set_updated_at();
alter table public.match_availability enable row level security;
drop policy if exists "match_availability_owner_all" on public.match_availability;
create policy "match_availability_owner_all" on public.match_availability
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists match_availability_owner_updated_idx on public.match_availability (owner_id, updated_at);
create index if not exists match_availability_event_idx on public.match_availability (event_id);

notify pgrst, 'reload schema';
