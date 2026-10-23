-- Notificaciones en el celular (panel spectrecolor.com/admin agregado a la pantalla de inicio).
-- push_subs: la dirección de envío de cada celular que activó los avisos (solo cuentas en public.admins).
-- push_enviados: cada venta ya avisada (Stripe puede mandar el mismo evento más de una vez).
-- Nadie las lee desde el navegador: el panel solo puede guardar o quitar su propia dirección con las funciones de abajo.

create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null,
  creado timestamptz not null default now(),
  ultimo_envio timestamptz,
  fallas integer not null default 0
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;
grant select, insert, update, delete on public.push_subs to service_role;

create table if not exists public.push_enviados (
  stripe_session text primary key,
  enviado timestamptz not null default now()
);
alter table public.push_enviados enable row level security;
revoke all on public.push_enviados from anon, authenticated;
grant select, insert, update, delete on public.push_enviados to service_role;

create or replace function public.admin_guardar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'sin acceso' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'dirección no válida' using errcode = '22023';
  end if;
  insert into public.push_subs (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict on constraint push_subs_pkey do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id, fallas = 0;
end;
$$;

create or replace function public.admin_quitar_push(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'sin acceso' using errcode = '42501';
  end if;
  delete from public.push_subs s where s.endpoint = p_endpoint and s.user_id = auth.uid();
end;
$$;

revoke all on function public.admin_guardar_push(text, text, text) from public, anon;
revoke all on function public.admin_quitar_push(text) from public, anon;
grant execute on function public.admin_guardar_push(text, text, text) to authenticated;
grant execute on function public.admin_quitar_push(text) to authenticated;
