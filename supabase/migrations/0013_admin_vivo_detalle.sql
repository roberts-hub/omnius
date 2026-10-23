-- admin_vivo() ahora también da los visitantes de hoy (total y por país, canal y dispositivo) del contador propio.
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
      'visitantes_hoy', (select count(*) from public.presencia where ultimo >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') and visitante <> '00000000-0000-4000-8000-000000000001'),
      'revisado', to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS')
    )),
    -- visitantes de hoy (hora de México) por país, canal y dispositivo, del contador propio
    'vivo_hoy', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'clave', clave, 'visitantes', n) order by tipo, n desc, clave)
      from (
        select tipo, clave, count(*)::int as n from (
          select 'pais' as tipo, coalesce(h.pais, '') as clave from public.presencia h
            where h.ultimo >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') and h.visitante <> '00000000-0000-4000-8000-000000000001'
          union all
          select 'canal', coalesce(h.canal, '') from public.presencia h
            where h.ultimo >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') and h.visitante <> '00000000-0000-4000-8000-000000000001'
          union all
          select 'dispositivo', coalesce(h.dispositivo, '') from public.presencia h
            where h.ultimo >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') and h.visitante <> '00000000-0000-4000-8000-000000000001'
        ) x group by tipo, clave
      ) y), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

