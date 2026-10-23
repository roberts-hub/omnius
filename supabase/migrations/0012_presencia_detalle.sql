-- Visitantes en vivo con detalle (sin depender de Umami ni de la Mac): el latido de cada página ahora también manda
-- el país aproximado (por la zona horaria del dispositivo, sin IP), el canal por el que llegó y el tipo de dispositivo.
alter table public.presencia add column if not exists pais text;
alter table public.presencia add column if not exists canal text;
alter table public.presencia add column if not exists dispositivo text;

-- la función vieja (2 datos) se reemplaza por una de 5 con valores por defecto: las páginas que todavía tengan
-- el latido.js anterior en caché siguen funcionando igual
drop function if exists public.latido(uuid, text);
create or replace function public.latido(v uuid, pagina text default null, pais text default null, canal text default null, dispositivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := case when latido.pais ~ '^[A-Z]{2}$' then latido.pais end;
  c text := nullif(left(lower(regexp_replace(coalesce(latido.canal, ''), '[^a-z0-9_-]', '', 'gi')), 30), '');
  d text := case when latido.dispositivo in ('celular', 'tablet', 'computadora') then latido.dispositivo end;
begin
  insert into public.presencia (visitante, pagina, pais, canal, dispositivo)
  values (v, left(coalesce(latido.pagina, ''), 60), p, c, d)
  on conflict (visitante) do update
    set ultimo = now(), pagina = excluded.pagina, latidos = public.presencia.latidos + 1,
        pais = coalesce(excluded.pais, public.presencia.pais),
        canal = coalesce(excluded.canal, public.presencia.canal),
        dispositivo = coalesce(excluded.dispositivo, public.presencia.dispositivo)
    where public.presencia.ultimo < now() - interval '10 seconds';
  if random() < 0.02 then
    delete from public.presencia where ultimo < now() - interval '3 days';
  end if;
end;
$$;
revoke all on function public.latido(uuid, text, text, text, text) from public;
grant execute on function public.latido(uuid, text, text, text, text) to anon, authenticated;
