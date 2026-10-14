-- SPECTRE: base de clientes. Cada compra guarda nombre, país, monto, moneda y si aceptó recibir novedades.
-- La vista `clientes` junta todo por persona (compras + actividad). Solo la ve el dueño del proyecto.
alter table public.compras
  add column if not exists nombre text,
  add column if not exists pais text,
  add column if not exists monto numeric(12, 2),
  add column if not exists moneda text,
  add column if not exists novedades boolean;

create or replace view public.clientes with (security_invoker = false) as
  select
    c.email                                                         as correo,
    max(c.nombre)                                                   as nombre,
    max(c.pais)                                                     as pais,
    string_agg(distinct c.edicion, ', ')                            as compro,
    string_agg(distinct case when c.monto is not null then c.monto::text || ' ' || upper(c.moneda) end, ' + ') as pagado,
    bool_or(c.novedades)                                            as acepta_novedades,
    min(c.creada)                                                   as primera_compra,
    max(c.creada)                                                   as ultima_compra,
    bool_or(c.activa)                                               as acceso_activo,
    string_agg(distinct c.motivo, ', ') filter (where not c.activa) as sin_acceso_por,
    a.ultima_entrada, a.entradas_24h, a.entradas_total, a.descargas_total, a.bandera, a.bloqueada
  from public.compras c
  left join public.actividad_cuentas() a on a.email = c.email
  group by c.email, a.ultima_entrada, a.entradas_24h, a.entradas_total, a.descargas_total, a.bandera, a.bloqueada
  order by max(c.creada) desc;
revoke all on public.clientes from public, anon, authenticated;
grant select on public.clientes to service_role;
