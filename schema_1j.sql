-- COACH ISMO — Phase 1I : schémas du playbook (dessinés au doigt sur un demi-terrain)
-- À coller dans Supabase > SQL Editor > New query > Run. Peut être relancé sans risque.
-- Prérequis : les scripts précédents (dont schema_1i.sql) déjà exécutés.

create table if not exists public.playbook_diagrams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id uuid not null references public.playbook_entries(id) on delete cascade,
  title text,                 -- ex. « Phase 1 »
  note text,                  -- légende : ce qui se passe sur le schéma
  court text not null default 'half',
  data jsonb not null default '{"items":[]}'::jsonb,   -- joueurs, flèches, textes
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_playbook_diagrams_updated on public.playbook_diagrams;
create trigger trg_playbook_diagrams_updated before update on public.playbook_diagrams
  for each row execute function public.set_updated_at();
alter table public.playbook_diagrams enable row level security;
drop policy if exists "playbook_diagrams_owner_all" on public.playbook_diagrams;
create policy "playbook_diagrams_owner_all" on public.playbook_diagrams
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists playbook_diagrams_owner_updated_idx on public.playbook_diagrams (owner_id, updated_at);
create index if not exists playbook_diagrams_entry_idx on public.playbook_diagrams (entry_id);

notify pgrst, 'reload schema';
