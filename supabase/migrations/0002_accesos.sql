-- SPECTRE: registro de accesos, banderas rojas y bloqueo de cuentas compartidas.
--
-- El contenido ya no se lee directo de la tabla: el sitio llama a abrir_area(), que corre en el servidor,
-- registra cada entrada (IP y dispositivo), revisa los límites y solo entonces entrega el contenido.
-- Nadie puede saltarse el registro: sin pasar por aquí no hay forma de leer las ediciones.

create table if not exists public.accesos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ip text,
  agente text,
  creada timestamptz not null default now()
);
create index if not exists accesos_usuario on public.accesos (user_id, creada desc);

create table if not exists public.bloqueos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  motivo text not null,
  automatico boolean not null default false,
  creado timestamptz not null default now()
);

alter table public.accesos enable row level security;
alter table public.bloqueos enable row level security;
revoke all on public.accesos, public.bloqueos from anon, authenticated;
grant all on public.accesos, public.bloqueos to service_role;

-- límites (cámbialos aquí y vuelve a correr este archivo)
create or replace function public.limites() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'bandera_entradas_24h', 10,   -- más de esto en 24 h = bandera roja
    'bandera_ips_24h', 3,         -- desde esta cantidad de IPs distintas en 24 h = bandera roja
    'bloqueo_entradas_24h', 30,   -- más de esto en 24 h = bloqueo automático
    'bloqueo_ips_24h', 6          -- desde esta cantidad de IPs distintas en 24 h = bloqueo automático
  )
$$;

-- el contenido ya no se puede leer directo: solo a través de abrir_area()
drop policy if exists "ver ediciones compradas" on public.ediciones;
revoke select on public.ediciones from authenticated;

create or replace function public.abrir_area()
returns table (id text, contenido jsonb)
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cab jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ip_actual text := split_part(coalesce(cab ->> 'x-forwarded-for', cab ->> 'x-real-ip', cab ->> 'cf-connecting-ip', ''), ',', 1);
  lim jsonb := public.limites();
  entradas int;
  ips int;
begin
  if uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if exists (select 1 from public.bloqueos b where b.user_id = uid) then
    raise exception 'cuenta_bloqueada' using errcode = '42501';
  end if;
  -- sin compra activa no se registra ni se entrega nada
  if not exists (select 1 from public.compras c where c.user_id = uid and c.activa) then
    return;
  end if;

  insert into public.accesos (user_id, ip, agente) values (uid, nullif(trim(ip_actual), ''), left(cab ->> 'user-agent', 300));

  select count(*), count(distinct a.ip) into entradas, ips
  from public.accesos a where a.user_id = uid and a.creada > now() - interval '24 hours';

  if entradas > (lim ->> 'bloqueo_entradas_24h')::int or ips >= (lim ->> 'bloqueo_ips_24h')::int then
    insert into public.bloqueos (user_id, motivo, automatico)
    values (uid, format('automático: %s entradas y %s IPs en 24 h', entradas, ips), true)
    on conflict (user_id) do nothing;
    -- (no se usa raise aquí: desharía el registro y el bloqueo) se avisa con una fila especial
    return query select 'bloqueada'::text, null::jsonb;
    return;
  end if;

  return query
    select e.id, e.contenido from public.ediciones e
    where exists (select 1 from public.compras c where c.user_id = uid and c.activa and c.edicion = e.id);
end;
$$;
revoke all on function public.abrir_area() from public, anon;
grant execute on function public.abrir_area() to authenticated;

-- panorama para Roberto (solo servidor): una fila por cuenta con su actividad y su bandera
create or replace function public.actividad_cuentas()
returns table (
  email text, ediciones text, creada timestamptz, ultima_entrada timestamptz,
  entradas_24h bigint, ips_24h bigint, entradas_total bigint, descargas_total bigint,
  bandera boolean, bloqueada text
)
language sql stable security definer set search_path = '' as $$
  with lim as (select public.limites() l)
  select u.email::text,
    (select string_agg(c.edicion || case when c.activa then '' else ' (inactiva)' end, ', ') from public.compras c where c.user_id = u.id),
    u.created_at,
    (select max(a.creada) from public.accesos a where a.user_id = u.id),
    (select count(*) from public.accesos a where a.user_id = u.id and a.creada > now() - interval '24 hours'),
    (select count(distinct a.ip) from public.accesos a where a.user_id = u.id and a.creada > now() - interval '24 hours'),
    (select count(*) from public.accesos a where a.user_id = u.id),
    (select count(*) from public.descargas d where d.user_id = u.id),
    (select count(*) from public.accesos a where a.user_id = u.id and a.creada > now() - interval '24 hours') > (select (l ->> 'bandera_entradas_24h')::int from lim)
      or (select count(distinct a.ip) from public.accesos a where a.user_id = u.id and a.creada > now() - interval '24 hours') >= (select (l ->> 'bandera_ips_24h')::int from lim),
    (select b.motivo from public.bloqueos b where b.user_id = u.id)
  from auth.users u
  order by 9 desc, 5 desc, u.created_at desc
$$;
revoke all on function public.actividad_cuentas() from public, anon, authenticated;
grant execute on function public.actividad_cuentas() to service_role;
