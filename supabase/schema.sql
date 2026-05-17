-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- TRIPS
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'reconstructing', 'ready')),
  created_at timestamptz default now()
);

-- MEMORIES
create table memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('photo', 'voice', 'note')),
  file_path text,
  file_url text,
  thumbnail_url text,
  content text,
  day_assigned integer,
  ai_metadata jsonb default '{}',
  needs_clarification boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SCRAPBOOKS
create table scrapbooks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null unique,
  theme text not null default 'earthy' check (theme in ('earthy', 'vintage', 'handdrawn')),
  share_token uuid unique,
  is_shared boolean default false,
  ai_config jsonb default '{}',
  created_at timestamptz default now()
);

-- SCRAPBOOK PAGES
create table scrapbook_pages (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid references scrapbooks(id) on delete cascade not null,
  day_number integer not null,
  location_label text,
  ai_summary text,
  user_summary text,
  layout_config jsonb default '{}',
  order_index integer not null,
  unique(scrapbook_id, day_number)
);

-- REACTIONS
create table reactions (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid references scrapbooks(id) on delete cascade not null,
  emoji text not null,
  session_id text not null,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table trips enable row level security;
alter table memories enable row level security;
alter table scrapbooks enable row level security;
alter table scrapbook_pages enable row level security;
alter table reactions enable row level security;

-- TRIPS policies
create policy "Users manage own trips"
  on trips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- MEMORIES policies
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

-- SCRAPBOOKS policies
create policy "Users manage own scrapbooks"
  on scrapbooks for all
  using (
    exists (select 1 from trips where trips.id = scrapbooks.trip_id and trips.user_id = auth.uid())
  )
  with check (
    exists (select 1 from trips where trips.id = scrapbooks.trip_id and trips.user_id = auth.uid())
  );

-- SCRAPBOOK PAGES policies
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

-- REACTIONS policies
create policy "Owner can read reactions on their scrapbooks"
  on reactions for select
  using (
    exists (
      select 1 from scrapbooks
      join trips on trips.id = scrapbooks.trip_id
      where scrapbooks.id = reactions.scrapbook_id
      and trips.user_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE SETUP (PRIVATE BUCKET + SIGNED URLS)
-- The backend stores private object paths and generates short-lived
-- signed URLs on demand via the service role key.
-- ============================================================

-- Create a PRIVATE bucket (public = false):
insert into storage.buckets (id, name, public) values ('memories', 'memories', false)
  on conflict (id) do update set public = false;

-- To migrate an existing public bucket: run the upsert above in the SQL editor,
-- then go to Storage → memories → Settings → toggle Public OFF.

create policy "Authenticated users can upload their own memories"
  on storage.objects for insert
  with check (
    bucket_id = 'memories'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Users can read their own memories"
  on storage.objects for select
  using (
    bucket_id = 'memories'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Users can delete their own memories"
  on storage.objects for delete
  using (
    bucket_id = 'memories'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
