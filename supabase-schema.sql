-- ============================================================
--  To do — esquema para sincronizar entre celular y compu
--  (Supabase / Postgres). Diseño simple para un solo usuario:
--  toda la app se guarda como un único registro JSON.
-- ============================================================

-- 1) Tabla que guarda todo el estado de la app en una sola fila.
create table if not exists app_state (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Fila inicial (vacía). La app la llena sola.
insert into app_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- 3) Permisos: como es una app personal sin login, dejamos que la
--    "anon key" pueda leer y escribir SOLO esta tabla.
alter table app_state enable row level security;

drop policy if exists "acceso anon a app_state" on app_state;
create policy "acceso anon a app_state"
  on app_state
  for all
  to anon
  using (true)
  with check (true);

-- ⚠️ Nota: cualquiera que tenga tu URL + anon key podría leer/escribir
-- estos datos. Para uso personal está bien. Si más adelante quieres
-- privacidad real, agregamos login (Supabase Auth) y filtramos por usuario.
