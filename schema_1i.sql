-- COACH ISMO — Phase 1H : playbook (systèmes offensifs, défensifs, touches, lexique) par équipe
-- À coller dans Supabase > SQL Editor > New query > Run. Peut être relancé sans risque.
-- Prérequis : les scripts précédents (dont schema_1h.sql) déjà exécutés.

create table if not exists public.playbook_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_season_id uuid references public.team_seasons(id) on delete cascade,
  category text not null default 'attaque'
    check (category in ('attaque','defense','touche','situation','lexique')),
  title text not null,
  call_name text,               -- l'appel dit aux joueurs
  status text not null default 'a_installer' check (status in ('a_installer','en_cours','installe')),
  summary text,                 -- en bref
  principles text,              -- principes, pourquoi et quand
  technical text,               -- axes techniques, consignes
  variants text,                -- variantes, évolutions
  videos text,                  -- liens, un par ligne
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_playbook_entries_updated on public.playbook_entries;
create trigger trg_playbook_entries_updated before update on public.playbook_entries
  for each row execute function public.set_updated_at();
alter table public.playbook_entries enable row level security;
drop policy if exists "playbook_entries_owner_all" on public.playbook_entries;
create policy "playbook_entries_owner_all" on public.playbook_entries
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists playbook_entries_owner_updated_idx on public.playbook_entries (owner_id, updated_at);
create index if not exists playbook_entries_team_idx on public.playbook_entries (team_season_id);

notify pgrst, 'reload schema';
