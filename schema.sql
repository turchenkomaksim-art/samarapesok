-- Таблица заявок. Выполнить один раз: Supabase → SQL Editor → New query → Run.
create table if not exists public.orders (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text,
  phone       text not null,
  tons        numeric,
  need_by     text,
  delivery    text,
  zone        text,
  address     text,
  docs        text,
  message     text,
  status      text not null default 'новая'
);
-- Закрываем таблицу от публичного доступа: писать может только функция (service role).
alter table public.orders enable row level security;
