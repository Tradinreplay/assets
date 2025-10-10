-- Supabase 資料庫 Schema 與 RLS 政策設定
-- 專案：fqoxszrfvvfzqkbuyjkt
-- 目的：
-- 1) profiles：使用者基本資料（已取消核准流程）
-- 2) locations：使用者目前定位（管理者即時監看）
-- 3) location_shares：使用者彼此分享定位
-- 4) route_shares：使用者彼此分享路線 JSON

-- =========================================
-- Tables
-- =========================================
create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  approved boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 若已存在 profiles，補上 is_admin 欄位
alter table public.profiles add column if not exists is_admin boolean default false;

create table if not exists public.locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz default now()
);

-- 若已存在 locations，補上 updated_at 欄位（避免建立索引時找不到欄位）
alter table public.locations add column if not exists updated_at timestamptz default now();

create table if not exists public.location_shares (
  id bigserial primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

create table if not exists public.route_shares (
  id bigserial primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  route jsonb not null,
  created_at timestamptz default now()
);

-- =========================================
-- RLS Enable
-- =========================================
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.location_shares enable row level security;
alter table public.route_shares enable row level security;

-- =========================================
-- Policies: profiles
-- =========================================
-- 先移除可能已存在的政策，讓腳本可重複執行
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid() and email = auth.email());

-- 以 is_admin 權限控管更新，不再綁定特定 Email
create policy profiles_update_admin on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- =========================================
-- Policies: locations
-- =========================================
drop policy if exists locations_select_self on public.locations;
drop policy if exists locations_select_admin on public.locations;
drop policy if exists locations_insert_self on public.locations;
drop policy if exists locations_update_self on public.locations;
drop policy if exists locations_update_admin on public.locations;

create policy locations_select_self on public.locations
  for select using (user_id = auth.uid());

create policy locations_select_admin on public.locations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 僅管理者/本人可讀，移除公開讀取政策

create policy locations_insert_self on public.locations
  for insert with check (
    user_id = auth.uid()
  );

create policy locations_update_self on public.locations
  for update using (
    user_id = auth.uid()
  );

create policy locations_update_admin on public.locations
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- =========================================
-- Policies: location_shares
-- =========================================
drop policy if exists location_shares_select_self on public.location_shares;
drop policy if exists location_shares_select_admin on public.location_shares;
drop policy if exists location_shares_insert_sender on public.location_shares;

create policy location_shares_select_self on public.location_shares
  for select using (recipient_email = auth.email() or sender_id = auth.uid());

create policy location_shares_select_admin on public.location_shares
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy location_shares_insert_sender on public.location_shares
  for insert with check (
    sender_id = auth.uid()
  );

-- =========================================
-- Policies: route_shares
-- =========================================
drop policy if exists route_shares_select_self on public.route_shares;
drop policy if exists route_shares_select_admin on public.route_shares;
drop policy if exists route_shares_insert_sender on public.route_shares;

create policy route_shares_select_self on public.route_shares
  for select using (recipient_email = auth.email() or sender_id = auth.uid());

create policy route_shares_select_admin on public.route_shares
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy route_shares_insert_sender on public.route_shares
  for insert with check (
    sender_id = auth.uid()
  );

-- =========================================
-- 索引（提升查詢效率）
-- =========================================
create index if not exists idx_locations_updated_at on public.locations(updated_at desc);
create index if not exists idx_location_shares_recipient on public.location_shares(recipient_email);
create index if not exists idx_route_shares_recipient on public.route_shares(recipient_email);

-- =========================================
-- Admin Bootstrap（初始化管理者）
-- =========================================
-- 將下列 email 改為你的管理者信箱後再執行：
-- 若 profiles 尚未建立，請先執行本檔前半段建表與 RLS，再執行此段
insert into public.profiles (id, email, approved, is_admin)
select id, email, false, true
from auth.users
where email in ('tzongbinn@gmail.com')
on conflict (id) do update set is_admin = true;

-- 完成。請在 Supabase SQL Editor 中執行本腳本。