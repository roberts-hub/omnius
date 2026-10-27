-- SPECTRE · compradores en vivo (nombre, correo, qué compró, desde cuándo, entradas, descargas y alertas).
-- Antes era un archivo que se subía cada hora (herramientas/metricas.mjs); ahora lo leen en vivo:
--   · el tablero de Claude (conector de Supabase: select * from public.usuarios_tablero())
--   · el panel spectrecolor.com/admin (admin_usuarios(), solo cuentas en public.admins)
-- Mismas columnas y reglas de alerta que metricas.mjs.

create or replace function public.usuarios_tablero()
returns table (
  nombre text, correo text, compro text, estado text, tipo text, cuenta_creada text, ultima_entrada text,
  entradas_total int, entradas_24h int, ips_total int, descargas_full int, descargas_luts int,
  descargas_practica int, descargas_total int, alerta text
)
language sql stable security definer set search_path = public, auth
as $$
with lim as (select public.limites() as l),
cmp as (select user_id, edicion, activa, motivo, creada, nombre from public.compras)
select
  coalesce((select trim(c.nombre) from cmp c where c.user_id = u.id and coalesce(trim(c.nombre), '') <> '' order by c.creada desc limit 1), '') as nombre,
  u.email as correo,
  coalesce((select string_agg(distinct case when c.edicion = 'full' then 'Full System' else 'LUT Pack' end, ' + ') from cmp c where c.user_id = u.id), '—') as compro,
  case when b.user_id is not null then 'bloqueada'
       when exists (select 1 from cmp c where c.user_id = u.id and c.activa) then 'activa'
       when exists (select 1 from cmp c where c.user_id = u.id) then 'sin acceso (reembolso)'
       else 'sin compra' end as estado,
  case when exists (select 1 from cmp c where c.user_id = u.id)
        and not exists (select 1 from cmp c where c.user_id = u.id and coalesce(c.motivo, '') not in ('prueba', 'prueba-ui', 'manual'))
       then 'prueba' else 'real' end as tipo,
  to_char(u.created_at at time zone 'America/Mexico_City', 'YYYY-MM-DD') as cuenta_creada,
  coalesce(to_char(a.ultima at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'), '') as ultima_entrada,
  coalesce(a.total, 0)::int as entradas_total,
  coalesce(a.d24, 0)::int as entradas_24h,
  coalesce(a.ips, 0)::int as ips_total,
  coalesce(d.full_, 0)::int as descargas_full,
  coalesce(d.luts, 0)::int as descargas_luts,
  coalesce(d.prac, 0)::int as descargas_practica,
  coalesce(d.total, 0)::int as descargas_total,
  concat_ws(' · ',
    case when b.user_id is not null then 'Bloqueada: ' || b.motivo end,
    case when a.d24 > (lim.l ->> 'bandera_entradas_24h')::int then a.d24 || ' entradas en 24 h' end,
    case when a.ips24 >= (lim.l ->> 'bandera_ips_24h')::int then a.ips24 || ' lugares (IPs) distintos en 24 h' end,
    case when a.ips >= 8 then a.ips || ' IPs distintas en total' end,
    case when d.full_ >= 6 then d.full_ || ' descargas del Full System' end,
    case when d.luts >= 6 then d.luts || ' descargas del LUT Pack' end) as alerta
from auth.users u
cross join lim
left join public.bloqueos b on b.user_id = u.id
left join lateral (
  select max(creada) as ultima, count(*) as total,
    count(*) filter (where creada > now() - interval '24 hours') as d24,
    count(distinct ip) as ips,
    count(distinct ip) filter (where creada > now() - interval '24 hours') as ips24
  from public.accesos where user_id = u.id) a on true
left join lateral (
  select count(*) filter (where archivo ~* 'full system') as full_,
    count(*) filter (where archivo ~* 'lut pack') as luts,
    count(*) filter (where archivo ~* '(practice|pr[aá]ctica)') as prac,
    count(*) as total
  from public.descargas where user_id = u.id) d on true
order by u.created_at desc
$$;
revoke all on function public.usuarios_tablero() from public, anon, authenticated;

create or replace function public.admin_usuarios()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then raise exception 'sin acceso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(u)) from public.usuarios_tablero() u), '[]'::jsonb);
end $$;
revoke all on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;
