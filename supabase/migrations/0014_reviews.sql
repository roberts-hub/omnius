-- SPECTRE · reviews de compradores verificados.
-- A los 7 días de su última compra, cada comprador recibe un correo (Apps Script, desde support@) con un link
-- personal spectrecolor.com/review?t=<token>. Solo con ese link se puede escribir (un review por comprador).
-- Roberto aprueba cada uno en spectrecolor.com/admin → Reviews; solo los aprobados salen en la landing.
-- Toda la lectura y escritura pasa por funciones: la tabla no se puede tocar directo desde el navegador.

create table if not exists public.reviews (
  id bigserial primary key,
  token uuid not null unique default gen_random_uuid(),
  email text not null unique,                    -- un review por comprador (en minúsculas)
  compra_id bigint references public.compras(id) on delete set null,
  producto text not null check (producto in ('full', 'luts')),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  pais text,
  nombre_compra text,                            -- nombre con el que pagó (solo para sugerirlo y saludar)
  invitada timestamptz,                          -- cuándo salió el correo
  estrellas smallint check (estrellas between 1 and 5),
  texto text,
  nombre text,                                   -- como quiere aparecer
  rol text,                                      -- a qué se dedica (opcional)
  estado text not null default 'invitado' check (estado in ('invitado', 'pendiente', 'aprobado', 'oculto')),
  escrita timestamptz,
  aprobada timestamptz,
  avisada timestamptz,                           -- aviso a Roberto de que llegó (celular y correo)
  creada timestamptz not null default now()
);
create index if not exists reviews_estado on public.reviews (estado, aprobada desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant all on public.reviews to service_role;
grant usage, select on sequence public.reviews_id_seq to service_role;

-- ── para el Apps Script (vía la función "resumen", con la llave de servicio) ──

-- compradores cuya ÚLTIMA compra cumplió 7 días (si compró y luego hizo upgrade, cuenta el upgrade).
-- Ventana de 21 días: si algo estuvo apagado unos días, igual les llega; compras muy viejas nunca.
create or replace function public.reviews_por_invitar()
returns table (token uuid, email text, nombre text, producto text, idioma text)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.reviews (email, compra_id, producto, idioma, pais, nombre_compra)
  select c.e, c.id, c.producto,
    case when upper(coalesce(c.pais, '')) in ('MX','ES','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','PR','GQ') then 'es' else 'en' end,
    c.pais, c.nombre
  from (
    select lower(x.email) as e,
      max(x.creada) as ultima,
      (array_agg(x.id order by x.creada desc))[1] as id,
      case when bool_or(x.edicion = 'full' or x.motivo = 'upgrade desde LUT Pack') then 'full' else 'luts' end as producto,
      (array_agg(x.pais order by x.creada desc))[1] as pais,
      (array_agg(x.nombre order by x.creada desc))[1] as nombre
    from public.compras x
    where x.activa and coalesce(x.motivo, '') not in ('prueba', 'prueba-ui', 'manual')
      and x.email is not null and x.email !~* '@example\.com$'
    group by lower(x.email)
  ) c
  where c.ultima <= now() - interval '7 days' and c.ultima > now() - interval '21 days'
  on conflict on constraint reviews_email_key do nothing;

  return query
    select r.token, r.email, r.nombre_compra, r.producto, r.idioma
    from public.reviews r
    where r.invitada is null and r.estado = 'invitado'
    order by r.creada;
end $$;

create or replace function public.review_marcar_invitada(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.reviews set invitada = now() where token = p_token and invitada is null;
$$;

-- reviews recién escritas que Roberto todavía no sabe (se marcan como avisadas al leerlas)
create or replace function public.reviews_nuevas()
returns table (id bigint, email text, nombre text, estrellas smallint, texto text, producto text, pais text)
language sql security definer set search_path = public as $$
  update public.reviews r set avisada = now()
  where r.estado = 'pendiente' and r.avisada is null
  returning r.id, r.email, r.nombre, r.estrellas, r.texto, r.producto, r.pais;
$$;

revoke all on function public.reviews_por_invitar(), public.review_marcar_invitada(uuid), public.reviews_nuevas() from public, anon, authenticated;
grant execute on function public.reviews_por_invitar(), public.review_marcar_invitada(uuid), public.reviews_nuevas() to service_role;

-- ── página spectrecolor.com/review (cualquiera con el link; el token es imposible de adivinar) ──

create or replace function public.review_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'producto', r.producto,
    'idioma', r.idioma,
    'estado', r.estado,
    'estrellas', r.estrellas,
    'texto', r.texto,
    'rol', r.rol,
    -- si aún no escribe, se sugiere su primer nombre (nunca el correo)
    'nombre', coalesce(r.nombre, nullif(split_part(trim(coalesce(r.nombre_compra, '')), ' ', 1), ''))
  )
  from public.reviews r where r.token = p_token;
$$;

create or replace function public.review_guardar(p_token uuid, p_estrellas int, p_texto text, p_nombre text, p_rol text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.reviews;
  t text := trim(regexp_replace(coalesce(p_texto, ''), '\s+$', ''));
  n text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  o text := trim(regexp_replace(coalesce(p_rol, ''), '\s+', ' ', 'g'));
begin
  select * into r from public.reviews where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'link'); end if;
  if r.estado = 'oculto' then return jsonb_build_object('ok', false, 'error', 'cerrado'); end if;
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then return jsonb_build_object('ok', false, 'error', 'estrellas'); end if;
  if char_length(t) < 10 or char_length(t) > 1500 then return jsonb_build_object('ok', false, 'error', 'texto'); end if;
  if char_length(n) < 1 or char_length(n) > 60 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
  if char_length(o) > 60 then return jsonb_build_object('ok', false, 'error', 'rol'); end if;
  -- cada cambio vuelve a revisión (si ya estaba aprobado, sale de la página hasta que lo apruebes otra vez)
  update public.reviews set estrellas = p_estrellas, texto = t, nombre = n, rol = nullif(o, ''),
    estado = 'pendiente', escrita = now(), aprobada = null, avisada = null
  where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

-- reviews aprobados para la landing (sin correos)
create or replace function public.reviews_publicos()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'promedio', round(avg(estrellas)::numeric, 1),
    'lista', coalesce(jsonb_agg(jsonb_build_object(
        'nombre', nombre, 'rol', rol, 'pais', pais, 'estrellas', estrellas, 'texto', texto,
        'producto', producto, 'fecha', to_char(coalesce(escrita, aprobada), 'YYYY-MM-DD'))
      order by aprobada desc), '[]'::jsonb)
  )
  from (select * from public.reviews where estado = 'aprobado' order by aprobada desc limit 60) a;
$$;

revoke all on function public.review_info(uuid), public.review_guardar(uuid, int, text, text, text), public.reviews_publicos() from public;
grant execute on function public.review_info(uuid), public.review_guardar(uuid, int, text, text, text), public.reviews_publicos() to anon, authenticated;

-- ── panel spectrecolor.com/admin → Reviews (solo cuentas en public.admins) ──

create or replace function public.admin_reviews()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'invitados', (select count(*) from public.reviews where invitada is not null),
    'sin_escribir', (select count(*) from public.reviews where invitada is not null and estado = 'invitado'),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'nombre', nombre, 'rol', rol, 'pais', pais, 'estrellas', estrellas, 'texto', texto,
        'producto', producto, 'estado', estado, 'escrita', escrita, 'aprobada', aprobada)
      order by (estado = 'pendiente') desc, escrita desc)
      from public.reviews where estado <> 'invitado'), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_review_estado(p_id bigint, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin permiso' using errcode = '42501'; end if;
  if p_estado not in ('aprobado', 'oculto', 'pendiente') then raise exception 'estado no válido'; end if;
  update public.reviews set estado = p_estado,
    aprobada = case when p_estado = 'aprobado' then now() else null end
  where id = p_id and estado <> 'invitado';
end $$;

revoke all on function public.admin_reviews(), public.admin_review_estado(bigint, text) from public, anon;
grant execute on function public.admin_reviews(), public.admin_review_estado(bigint, text) to authenticated;
