-- Daily Tasks (Calendar Checklist)
-- Run this in Supabase SQL Editor

create table if not exists daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  task_date date not null,
  text text not null,
  done boolean default false,
  created_at timestamp default now()
);

alter table daily_tasks enable row level security;

create policy "Users read own tasks" on daily_tasks
  for select using (user_id = auth.uid());

create policy "Users insert own tasks" on daily_tasks
  for insert with check (user_id = auth.uid());

create policy "Users update own tasks" on daily_tasks
  for update using (user_id = auth.uid());

create policy "Users delete own tasks" on daily_tasks
  for delete using (user_id = auth.uid());

-- Index for fast date lookups
create index idx_daily_tasks_user_date on daily_tasks(user_id, task_date);
