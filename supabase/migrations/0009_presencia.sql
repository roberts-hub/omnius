-- Personas en el sitio en vivo (para el tablero): cada pestaña abierta manda un "latido" cada 30 s.
-- Anónimo: un número al azar por navegador que cambia cada 24 h, la página y la hora. Sin IP, correo ni nombre.
-- Nadie lee ni escribe la tabla desde el navegador: solo se llama latido(); el tablero la lee con SELECT.
create table if not exists public.presencia (
  visitante uuid primary key,
  primero timestamptz not null default now(),
  ultimo timestamptz not null default now(),
  pagina text,
  latidos integer not null default 1
);
create index if not exists presencia_ultimo on public.presencia (ultimo);
alter table public.presencia enable row level security;
revoke all on public.presencia from anon, authenticated;

create or replace function public.latido(v uuid, pagina text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.presencia (visitante, pagina)
  values (v, left(coalesce(pagina, ''), 60))
  on conflict (visitante) do update
    set ultimo = now(), pagina = excluded.pagina, latidos = public.presencia.latidos + 1
    where public.presencia.ultimo < now() - interval '10 seconds';
  -- limpieza: solo se guardan 3 días
  if random() < 0.02 then
    delete from public.presencia where ultimo < now() - interval '3 days';
  end if;
end;
$$;

revoke all on function public.latido(uuid, text) from public;
grant execute on function public.latido(uuid, text) to anon, authenticated;
