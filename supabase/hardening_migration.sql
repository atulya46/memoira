-- Run this once on an existing Memoira Supabase project before deploying
-- the hardened backend/frontend changes.

alter table memories add column if not exists file_path text;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'scrapbooks'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%theme%';

  if constraint_name is not null then
    execute format('alter table scrapbooks drop constraint %I', constraint_name);
  end if;
end $$;

update scrapbooks set theme = 'earthy' where theme in ('ghibli', 'pinteresty', 'minimal', 'digital');

alter table scrapbooks
  alter column theme set default 'earthy',
  add constraint scrapbooks_theme_check check (theme in ('earthy', 'vintage', 'handdrawn'));

drop policy if exists "Users manage own trips" on trips;
create policy "Users manage own trips"
  on trips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own memories" on memories;
create policy "Users manage own memories"
  on memories for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from trips
      where trips.id = memories.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own scrapbooks" on scrapbooks;
create policy "Users manage own scrapbooks"
  on scrapbooks for all
  using (
    exists (select 1 from trips where trips.id = scrapbooks.trip_id and trips.user_id = auth.uid())
  )
  with check (
    exists (select 1 from trips where trips.id = scrapbooks.trip_id and trips.user_id = auth.uid())
  );

drop policy if exists "Public can read shared scrapbooks" on scrapbooks;

drop policy if exists "Users manage own scrapbook pages" on scrapbook_pages;
create policy "Users manage own scrapbook pages"
  on scrapbook_pages for all
  using (
    exists (
      select 1 from scrapbooks
      join trips on trips.id = scrapbooks.trip_id
      where scrapbooks.id = scrapbook_pages.scrapbook_id
      and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from scrapbooks
      join trips on trips.id = scrapbooks.trip_id
      where scrapbooks.id = scrapbook_pages.scrapbook_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Public can read pages of shared scrapbooks" on scrapbook_pages;
drop policy if exists "Anyone can add reactions to shared scrapbooks" on reactions;
