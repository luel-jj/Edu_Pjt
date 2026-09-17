-- task-tracking-core: initial schema
-- Applied directly via Supabase SQL Editor (no local Supabase CLI workflow).

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index projects_user_id_idx on public.projects (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  task_type text not null check (task_type in ('dev', 'review')),
  requested_due_date date not null,
  original_due_date date not null,
  estimated_hours numeric(5, 1) not null check (estimated_hours > 0),
  progress_percent smallint check (
    progress_percent is null
    or (
      progress_percent between 0 and 100
      and progress_percent % 5 = 0
    )
  ),
  accumulated_hours numeric(6, 1) not null default 0,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  actual_hours numeric(6, 1),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_user_id_status_idx on public.tasks (user_id, status);
create index tasks_user_id_project_id_idx on public.tasks (user_id, project_id);

create table public.task_reference_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  url text,
  created_at timestamptz not null default now()
);

create index task_reference_links_task_id_idx on public.task_reference_links (task_id);

create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created',
      'due_date_changed',
      'estimate_changed',
      'progress_changed',
      'time_logged',
      'status_changed',
      'reference_added',
      'edited'
    )
  ),
  detail jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history (task_id, created_at desc);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meeting_hours numeric(4, 1) not null default 0,
  work_hours numeric(4, 1) not null default 8,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.task_daily_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  hours numeric(4, 1) not null default 0,
  created_at timestamptz not null default now(),
  unique (task_id, entry_date)
);

create index task_daily_entries_user_date_idx on public.task_daily_entries (user_id, entry_date);

-- Row Level Security: owner-only access on every table.
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reference_links enable row level security;
alter table public.task_history enable row level security;
alter table public.daily_logs enable row level security;
alter table public.task_daily_entries enable row level security;

create policy "projects_owner_select" on public.projects for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "projects_owner_insert" on public.projects for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "projects_owner_update" on public.projects for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "projects_owner_delete" on public.projects for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_owner_select" on public.tasks for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_owner_insert" on public.tasks for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_owner_update" on public.tasks for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tasks_owner_delete" on public.tasks for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "task_reference_links_owner_select" on public.task_reference_links for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "task_reference_links_owner_insert" on public.task_reference_links for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "task_reference_links_owner_update" on public.task_reference_links for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "task_reference_links_owner_delete" on public.task_reference_links for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "task_history_owner_select" on public.task_history for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "task_history_owner_insert" on public.task_history for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "daily_logs_owner_select" on public.daily_logs for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "daily_logs_owner_insert" on public.daily_logs for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_logs_owner_update" on public.daily_logs for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "task_daily_entries_owner_select" on public.task_daily_entries for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "task_daily_entries_owner_insert" on public.task_daily_entries for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "task_daily_entries_owner_update" on public.task_daily_entries for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Migration: 퇴근 전 화면에서 오늘 실제 근무 시간을 입력받아 가용 시간 계산에 반영한다.
-- 이미 daily_logs 테이블이 있는 기존 Supabase 프로젝트에서는 이 구문만 SQL Editor에 실행하면 된다.
alter table public.daily_logs
  add column if not exists work_hours numeric(4, 1) not null default 8;
