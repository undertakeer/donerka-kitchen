-- ============================================================================
--  Кухня Donerka — схема базы, версия 1.
--  Вставить целиком в Supabase → SQL Editor → Run.
--  Файл можно прогонять повторно: он ничего не удаляет и не дублирует.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- служебное: версия схемы ----------
create table if not exists public.app_meta (
  key   text primary key,
  value text not null
);

-- ---------- профили (кто вошёл и с какой ролью) ----------
-- Логин «admin» внутри Supabase — это адрес admin@donerka.local.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  login      text not null unique,
  role       text check (role in ('admin', 'cook')),   -- null = доступа нет
  created_at timestamptz not null default now()
);

-- Какие логины получают доступ и с какой ролью.
-- Даже если в настройках Supabase случайно оставить открытой регистрацию,
-- посторонний аккаунт не получит роль и не увидит данные.
create table if not exists public.allowed_logins (
  login text primary key,
  role  text not null check (role in ('admin', 'cook'))
);
insert into public.allowed_logins (login, role) values
  ('admin',  'admin'),
  ('kuhnya', 'admin')
on conflict (login) do nothing;

create or replace function public.login_from_email(p_email text)
returns text language sql immutable as $$
  select lower(split_part(coalesce(p_email, ''), '@', 1))
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login, role)
  values (
    new.id,
    public.login_from_email(new.email),
    (select role from public.allowed_logins where login = public.login_from_email(new.email))
  )
  on conflict (id) do update set role = excluded.role;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Пользователи, созданные до этого файла, тоже получают профили.
insert into public.profiles (id, login, role)
select u.id, public.login_from_email(u.email),
       (select role from public.allowed_logins a where a.login = public.login_from_email(u.email))
from auth.users u
on conflict (id) do update set role = excluded.role;

-- Роль текущего пользователя
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_member()
returns boolean language sql stable as $$
  select public.my_role() is not null
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.my_role() = 'admin'
$$;

-- ---------- общий триггер updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- разделы ----------
create table if not exists public.sections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- сотрудники (кто на смене) ----------
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  sort       integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- шаблоны повторяющихся задач ----------
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  section_id  uuid references public.sections(id) on delete set null,
  qty         numeric check (qty is null or qty >= 0),
  unit        text,
  due_time    time,
  note        text,
  sort        integer not null default 0,
  repeat_kind text not null check (repeat_kind in ('daily', 'weekdays', 'every_n', 'monthly')),
  weekdays    smallint[] check (weekdays is null or weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  every_n     integer check (every_n is null or every_n between 1 and 365),
  month_day   integer check (month_day is null or month_day between 1 and 31),
  start_date  date not null,
  end_date    date,
  archived_at timestamptz,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint templates_repeat_ok check (
    (repeat_kind = 'daily')
    or (repeat_kind = 'weekdays' and coalesce(array_length(weekdays, 1), 0) > 0)
    or (repeat_kind = 'every_n' and every_n is not null)
    or (repeat_kind = 'monthly' and month_day is not null)
  )
);

-- ---------- задачи на конкретный день ----------
-- Задача из шаблона имеет id, вычисляемый из (шаблон, дата) одинаково на всех
-- устройствах, плюс уникальность (template_id, date) — дубль невозможен.
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.templates(id) on delete set null,
  date          date not null,
  title         text not null check (length(trim(title)) > 0),
  section_id    uuid references public.sections(id) on delete set null,
  qty           numeric check (qty is null or qty >= 0),
  unit          text,
  due_time      time,
  note          text,
  sort          integer not null default 0,
  done_at       timestamptz,
  done_by_staff uuid references public.staff(id) on delete set null,
  done_by_name  text,
  done_by_user  uuid,
  qty_done      numeric check (qty_done is null or qty_done >= 0),
  deleted_at    timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_template_date_uniq unique (template_id, date)
);
create index if not exists tasks_date_idx on public.tasks (date);
create index if not exists tasks_open_idx on public.tasks (date) where done_at is null and deleted_at is null;

drop trigger if exists sections_touch on public.sections;
create trigger sections_touch before update on public.sections for each row execute function public.touch_updated_at();
drop trigger if exists staff_touch on public.staff;
create trigger staff_touch before update on public.staff for each row execute function public.touch_updated_at();
drop trigger if exists templates_touch on public.templates;
create trigger templates_touch before update on public.templates for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- ---------- отметка «сделано» ----------
-- Если двое отметили одновременно — засчитывается первая отметка,
-- вторая её не перезаписывает. Удалённую задачу отметить нельзя.
create or replace function public.set_task_done(
  p_id uuid,
  p_done boolean,
  p_at timestamptz default null,
  p_staff_id uuid default null,
  p_staff_name text default null,
  p_qty_done numeric default null
) returns public.tasks
language plpgsql security invoker set search_path = public as $$
declare
  r public.tasks;
  v_at timestamptz := least(coalesce(p_at, now()), now() + interval '5 minutes');
begin
  if not public.is_member() then
    raise exception 'no access' using errcode = '42501';
  end if;
  select * into r from public.tasks where id = p_id for update;
  if not found or r.deleted_at is not null then
    raise exception 'task_deleted' using errcode = 'KT404';
  end if;
  if p_done then
    if r.done_at is null then
      update public.tasks set
        done_at = v_at,
        done_by_staff = p_staff_id,
        done_by_name = p_staff_name,
        done_by_user = auth.uid(),
        qty_done = p_qty_done
      where id = p_id
      returning * into r;
    end if;
  else
    update public.tasks set
      done_at = null, done_by_staff = null, done_by_name = null, done_by_user = null, qty_done = null
    where id = p_id
    returning * into r;
  end if;
  return r;
end $$;

-- ---------- удаление шаблона ----------
-- Шаблон уходит в архив; несделанные задачи по нему исчезают,
-- сделанные остаются в истории.
create or replace function public.archive_template(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no access' using errcode = '42501';
  end if;
  update public.templates set archived_at = coalesce(archived_at, now()) where id = p_id;
  update public.tasks set deleted_at = now()
  where template_id = p_id and done_at is null and deleted_at is null;
end $$;

-- ---------- права доступа (RLS) ----------
alter table public.app_meta       enable row level security;
alter table public.profiles       enable row level security;
alter table public.allowed_logins enable row level security;
alter table public.sections       enable row level security;
alter table public.staff          enable row level security;
alter table public.templates      enable row level security;
alter table public.tasks          enable row level security;

drop policy if exists app_meta_read on public.app_meta;
create policy app_meta_read on public.app_meta for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());

-- allowed_logins: без политик — никто из приложения её не видит и не меняет.

-- Разделы, сотрудники, шаблоны: читают все свои, меняет только admin.
do $$
declare t text;
begin
  foreach t in array array['sections', 'staff', 'templates'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.is_member())', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Задачи: и admin, и cook читают, добавляют и отмечают. Строки не удаляются
-- физически — только пометка deleted_at, чтобы история не терялась.
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (public.is_member());
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_member());
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_member()) with check (public.is_member());

-- Явные права на уровне таблиц (на новых проектах Supabase они не выдаются сами).
-- Гость без входа (anon) не получает ничего.
grant usage on schema public to authenticated;
grant select on public.app_meta, public.profiles to authenticated;
grant select, insert, update, delete on public.sections, public.staff, public.templates to authenticated;
grant select, insert, update on public.tasks to authenticated;
revoke delete on public.tasks from authenticated;
revoke all on public.app_meta, public.profiles, public.allowed_logins,
              public.sections, public.staff, public.templates, public.tasks from anon;
revoke all on public.allowed_logins from authenticated;
grant execute on function public.set_task_done(uuid, boolean, timestamptz, uuid, text, numeric) to authenticated;
grant execute on function public.archive_template(uuid) to authenticated;
grant execute on function public.my_role(), public.is_member(), public.is_admin() to authenticated;
revoke execute on function public.set_task_done(uuid, boolean, timestamptz, uuid, text, numeric) from anon, public;
revoke execute on function public.archive_template(uuid) from anon, public;

-- ---------- синхронизация в реальном времени ----------
do $$
declare t text;
begin
  foreach t in array array['sections', 'staff', 'templates', 'tasks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- стартовые данные (только если пусто) ----------
insert into public.sections (name, sort)
select * from (values
  ('Утренние заготовки', 10),
  ('К открытию', 20),
  ('В течение дня', 30),
  ('Закрытие смены', 40)
) v(name, sort)
where not exists (select 1 from public.sections);

insert into public.app_meta (key, value) values ('schema_version', '1')
on conflict (key) do update set value = greatest(public.app_meta.value::int, 1)::text;

-- PostgREST должен увидеть новые таблицы и функции сразу
notify pgrst, 'reload schema';
