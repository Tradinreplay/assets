-- Create asset_records table
create table if not exists public.asset_records (
  id text primary key,
  asset_number text,
  device_name text,
  serial_number text,
  unit text,
  is_managed boolean default false,
  scan_date_time text,
  scan_timestamp bigint,
  is_scrapped boolean default false,
  scrap_date_time text,
  scrap_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.asset_records enable row level security;

-- Create policy for anonymous access (select, insert, update, delete)
create policy "Enable all access for all users" on public.asset_records
for all using (true) with check (true);
