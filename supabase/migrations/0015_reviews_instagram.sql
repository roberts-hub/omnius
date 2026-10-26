-- SPECTRE · reviews: se pide el Instagram (opcional) en lugar de "a qué te dedicas".
-- Se guarda solo el usuario (sin @ ni link), en minúsculas. La columna rol queda sin usar.

alter table public.reviews add column if not exists instagram text;

create or replace function public.review_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'producto', r.producto,
    'idioma', r.idioma,
    'estado', r.estado,
    'estrellas', r.estrellas,
    'texto', r.texto,
    'instagram', r.instagram,
    'nombre', coalesce(r.nombre, nullif(split_part(trim(coalesce(r.nombre_compra, '')), ' ', 1), ''))
  )
  from public.reviews r where r.token = p_token;
$$;

drop function if exists public.review_guardar(uuid, int, text, text, text);
create function public.review_guardar(p_token uuid, p_estrellas int, p_texto text, p_nombre text, p_instagram text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.reviews;
  t text := trim(regexp_replace(coalesce(p_texto, ''), '\s+$', ''));
  n text := trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  -- acepta "@usuario", "usuario" o el link del perfil; se queda solo con el usuario
  ig text := lower(regexp_replace(regexp_replace(trim(coalesce(p_instagram, '')), '^(https?://)?(www\.)?(instagram\.com/)?@?', '', 'i'), '[/?#].*$', ''));
begin
  select * into r from public.reviews where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'link'); end if;
  if r.estado = 'oculto' then return jsonb_build_object('ok', false, 'error', 'cerrado'); end if;
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then return jsonb_build_object('ok', false, 'error', 'estrellas'); end if;
  if char_length(t) < 10 or char_length(t) > 1500 then return jsonb_build_object('ok', false, 'error', 'texto'); end if;
  if char_length(n) < 1 or char_length(n) > 60 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
  if ig <> '' and ig !~ '^[a-z0-9._]{1,30}$' then return jsonb_build_object('ok', false, 'error', 'instagram'); end if;
  update public.reviews set estrellas = p_estrellas, texto = t, nombre = n, instagram = nullif(ig, ''), rol = null,
    estado = 'pendiente', escrita = now(), aprobada = null, avisada = null
  where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reviews_publicos()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'promedio', round(avg(estrellas)::numeric, 1),
    'lista', coalesce(jsonb_agg(jsonb_build_object(
        'nombre', nombre, 'instagram', instagram, 'pais', pais, 'estrellas', estrellas, 'texto', texto,
        'producto', producto, 'fecha', to_char(coalesce(escrita, aprobada), 'YYYY-MM-DD'))
      order by aprobada desc), '[]'::jsonb)
  )
  from (select * from public.reviews where estado = 'aprobado' order by aprobada desc limit 60) a;
$$;

drop function if exists public.reviews_nuevas();
create function public.reviews_nuevas()
returns table (id bigint, email text, nombre text, instagram text, estrellas smallint, texto text, producto text, pais text)
language sql security definer set search_path = public as $$
  update public.reviews r set avisada = now()
  where r.estado = 'pendiente' and r.avisada is null
  returning r.id, r.email, r.nombre, r.instagram, r.estrellas, r.texto, r.producto, r.pais;
$$;

create or replace function public.admin_reviews()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'invitados', (select count(*) from public.reviews where invitada is not null),
    'sin_escribir', (select count(*) from public.reviews where invitada is not null and estado = 'invitado'),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'nombre', nombre, 'instagram', instagram, 'pais', pais, 'estrellas', estrellas, 'texto', texto,
        'producto', producto, 'estado', estado, 'escrita', escrita, 'aprobada', aprobada)
      order by (estado = 'pendiente') desc, escrita desc)
      from public.reviews where estado <> 'invitado'), '[]'::jsonb)
  );
end $$;

revoke all on function public.review_guardar(uuid, int, text, text, text), public.reviews_nuevas() from public, anon, authenticated;
grant execute on function public.review_guardar(uuid, int, text, text, text) to anon, authenticated;
grant execute on function public.reviews_nuevas() to service_role;
