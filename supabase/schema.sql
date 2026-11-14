-- Stige: tabell for synk mellom enheter.
-- Kjøres én gang i SQL Editor i Supabase-prosjektet.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,          -- exercise, workout, routine, diary, kv
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated on public.records (user_id, updated_at);

-- Serveren setter alltid tidspunktet selv, så enhetenes klokker ikke betyr noe.
create or replace function public.records_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch();

-- Hver bruker ser og endrer bare sine egne rader.
alter table public.records enable row level security;

drop policy if exists "egne rader" on public.records;
create policy "egne rader" on public.records
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
