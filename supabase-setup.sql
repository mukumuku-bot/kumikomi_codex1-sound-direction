create table if not exists public.dog_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dog_name text not null default 'ポチ',
  updated_at timestamptz not null default now()
);

alter table public.dog_profiles enable row level security;

drop policy if exists "dog_profiles_select_own" on public.dog_profiles;
create policy "dog_profiles_select_own"
on public.dog_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "dog_profiles_insert_own" on public.dog_profiles;
create policy "dog_profiles_insert_own"
on public.dog_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "dog_profiles_update_own" on public.dog_profiles;
create policy "dog_profiles_update_own"
on public.dog_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
