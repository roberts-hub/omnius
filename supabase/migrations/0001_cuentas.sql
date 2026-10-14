-- SPECTRE: cuentas por comprador.
-- Cada compra pagada en Stripe crea (o reutiliza) un usuario de Supabase Auth y una fila en `compras`.
-- El contenido del área de miembros vive en `ediciones` y solo lo puede leer quien tenga una compra activa
-- de esa edición (Row Level Security). Nadie más: ni visitantes anónimos ni otros usuarios.

create table if not exists public.compras (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  edicion text not null check (edicion in ('full', 'luts')),
  stripe_session text unique,
  stripe_payment_intent text,
  activa boolean not null default true,       -- false = reembolso o contracargo: pierde el acceso
  motivo text,                                 -- por qué se desactivó, o "manual" si la dio Roberto
  creada timestamptz not null default now()
);
create index if not exists compras_usuario on public.compras (user_id);
create index if not exists compras_pago on public.compras (stripe_payment_intent);

create table if not exists public.ediciones (
  id text primary key check (id in ('full', 'luts')),
  contenido jsonb not null,                    -- textos, videos, descargas (con su llave de descifrado)
  actualizada timestamptz not null default now()
);

create table if not exists public.descargas (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  archivo text not null,
  creada timestamptz not null default now()
);
create index if not exists descargas_usuario on public.descargas (user_id, creada);

alter table public.compras enable row level security;
alter table public.ediciones enable row level security;
alter table public.descargas enable row level security;

drop policy if exists "ver mis compras" on public.compras;
create policy "ver mis compras" on public.compras
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "ver ediciones compradas" on public.ediciones;
create policy "ver ediciones compradas" on public.ediciones
  for select to authenticated using (
    exists (
      select 1 from public.compras c
      where c.user_id = (select auth.uid()) and c.activa and c.edicion = ediciones.id
    )
  );

-- registro de descargas: cada quien solo inserta las suyas, nadie las lee desde el sitio
drop policy if exists "registrar mis descargas" on public.descargas;
create policy "registrar mis descargas" on public.descargas
  for insert to authenticated with check (user_id = (select auth.uid()));

-- quitar cualquier permiso por defecto a anónimos
revoke all on public.compras, public.ediciones, public.descargas from anon;
grant select on public.compras, public.ediciones to authenticated;
grant insert on public.descargas to authenticated;

-- el webhook busca si el correo ya tiene cuenta (solo lo puede llamar el servidor)
create or replace function public.usuario_por_correo(correo text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(correo) limit 1
$$;
revoke all on function public.usuario_por_correo(text) from public, anon, authenticated;
grant execute on function public.usuario_por_correo(text) to service_role;
