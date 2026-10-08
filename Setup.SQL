-- Giftbox: Supabase setup.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Contains no secrets.

-- 1. Gifts table. "data" holds the whole gift (selections, photo URLs,
--    arrangement, message) as JSON.
create table if not exists public.gifts (
    id text primary key check (id ~ '^[a-z0-9]{10,24}$'),
    created_at timestamptz not null default now(),
    data jsonb not null check (octet_length(data::text) < 500000)
);

alter table public.gifts enable row level security;

-- Anyone may create a gift. There is deliberately no SELECT policy, so the
-- table cannot be listed or scraped through the public API.
drop policy if exists "anyone can create a gift" on public.gifts;
create policy "anyone can create a gift"
    on public.gifts for insert
    to anon, authenticated
    with check (true);

grant insert on public.gifts to anon, authenticated;

-- 2. A gift can only be read by asking for its exact id.
create or replace function public.get_gift(gift_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
    select data from public.gifts where id = gift_id;
$$;

revoke all on function public.get_gift(text) from public;
grant execute on function public.get_gift(text) to anon, authenticated;

-- 3. Public bucket for photos (5 MB per file, images only). Public means a
--    photo can be viewed by anyone who has its URL; listing is not allowed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-photos', 'gift-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "anyone can upload gift photos" on storage.objects;
create policy "anyone can upload gift photos"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'gift-photos');