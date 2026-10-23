-- Panel privado en spectrecolor.com/admin.
-- Solo las cuentas cuyo correo está en public.admins (y ya confirmado) reciben datos; a nadie más se le da nada.
-- La página es pública (el código está en GitHub) pero no trae datos: los pide a admin_vivo() y admin_archivos().

create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  agregado timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
-- los correos aprobados se agregan directo en la base (no se publican aquí):
--   insert into public.admins (email) values ('correo@ejemplo.com');

-- copias de los archivos del tablero que se generan cada hora (Umami, Stripe, cuentas, estado)
create table if not exists public.metricas_archivos (
  nombre text primary key,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.metricas_archivos enable row level security;
revoke all on public.metricas_archivos from anon, authenticated;
grant select, insert, update, delete on public.metricas_archivos to service_role;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

-- lo que cambia al momento: cada venta (sin pruebas) y personas en el sitio
create or replace function public.admin_vivo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if not public.es_admin() then
    raise exception 'sin acceso' using errcode = '42501';
  end if;
  with c as (
    select creada, edicion, monto, moneda, activa, motivo, pais, origen,
      array_remove(string_to_array(coalesce(origen, ''), '_'), 'auto') as partes
    from public.compras
    where creada >= '2026-10-22T22:45:00Z'
      and coalesce(motivo, '') not in ('prueba', 'prueba-ui', 'manual')
  ),
  canales(k, nombre) as (values
    ('ig','Instagram'),('yt','YouTube'),('fb','Facebook'),('tt','TikTok'),('wa','WhatsApp'),
    ('youtube','YouTube'),('instagram','Instagram'),('tiktok','TikTok'),('whatsapp','WhatsApp'),('facebook','Facebook'),
    ('google','Google'),('x','X'),('linkedin','LinkedIn'),('pinterest','Pinterest'),('reddit','Reddit'),('telegram','Telegram'),
    ('snapchat','Snapchat'),('buscador','Otro buscador'),('correo','Correo'),('twowaves','Two Waves'),('otro-sitio','Otro sitio')),
  v as (
    select
      (row_number() over (order by c.creada))::int as n,
      to_char(c.creada at time zone 'America/Mexico_City', 'YYYY-MM-DD') as dia,
      to_char(c.creada at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') as fecha,
      case when c.motivo = 'upgrade desde LUT Pack' then 'Upgrade a Full System'
           when c.edicion = 'full' then 'Full System' else 'LUT Pack' end as edicion,
      c.monto::float8 as monto,
      upper(coalesce(c.moneda, '')) as moneda,
      case when c.activa then 'pagada' else coalesce(c.motivo, 'reembolsada') end as estado,
      coalesce(c.pais, '') as pais,
      case when coalesce(c.origen, '') = '' then 'Directo / otro'
           else (select string_agg(case when t.ord = 1 then coalesce(k1.nombre, t.p) else t.p end, ' · ' order by t.ord)
                 from unnest(c.partes) with ordinality as t(p, ord)
                 left join canales k1 on k1.k = t.p) end as fuente,
      case when coalesce(c.origen, '') = '' then 'directo'
           else coalesce((case split_part(c.origen, '_', 1) when 'ig' then 'instagram' when 'yt' then 'youtube'
                          when 'fb' then 'facebook' when 'tt' then 'tiktok' when 'wa' then 'whatsapp' end),
                         split_part(c.origen, '_', 1)) end as canal
    from c
  )
  select jsonb_build_object(
    'ventas', coalesce((select jsonb_agg(to_jsonb(v) order by v.n) from v), '[]'::jsonb),
    'presencia', jsonb_build_array(jsonb_build_object(
      'activos', (select count(*) from public.presencia where ultimo > now() - interval '2 minutes' and visitante <> '00000000-0000-4000-8000-000000000001'),
      'visitantes_24h', (select count(*) from public.presencia where ultimo > now() - interval '24 hours' and visitante <> '00000000-0000-4000-8000-000000000001'),
      'revisado', to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS')
    ))
  ) into r;
  return r;
end;
$$;

-- lo que se actualiza cada hora
create or replace function public.admin_archivos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'sin acceso' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(nombre, jsonb_build_object('datos', datos, 'actualizado', actualizado)) from public.metricas_archivos), '{}'::jsonb);
end;
$$;

revoke all on function public.es_admin() from public, anon;
revoke all on function public.admin_vivo() from public, anon;
revoke all on function public.admin_archivos() from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.admin_vivo() to authenticated;
grant execute on function public.admin_archivos() to authenticated;
