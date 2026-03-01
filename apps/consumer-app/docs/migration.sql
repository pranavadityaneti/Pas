-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone default now(),
  full_name text,
  avatar_url text,
  tier text default 'Member',
  credits decimal(10,2) default 0.00,
  coupons_count int default 0,
  date_of_birth date
);

-- Ensure columns exist even if table was already created
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists tier text default 'Member';
alter table public.profiles add column if not exists credits decimal(10,2) default 0.00;
alter table public.profiles add column if not exists coupons_count int default 0;
alter table public.profiles add column if not exists notification_preferences jsonb default '{"push": true, "email": true, "sms": false, "orders": true, "marketing": false, "security": true}'::jsonb;
alter table public.profiles add column if not exists security_preferences jsonb default '{"two_factor": false, "biometric": false}'::jsonb;

-- Enable RLS
alter table public.profiles enable row level security;

-- Drop existing policies to ensure a clean slate
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

-- Create robust policies
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Ensure the authenticated role has permissions on the table
grant all on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- Create a helper function to handle new user signups
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, tier, credits, coupons_count)
  values (new.id, new.raw_user_meta_data->>'full_name', 'Member', 0.00, 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible."
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload an avatar."
on storage.objects for insert
to authenticated
with check ( bucket_id = 'avatars' );

create policy "Users can update their own avatar."
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' )
with check ( (storage.foldername(name))[1] = auth.uid()::text );
