-- SPECTRE: panel de cuentas para ver desde el dashboard de Supabase (Table Editor → panel_cuentas),
-- también desde el celular. Solo lo ve el dueño del proyecto: el sitio y los usuarios no tienen permiso.
create or replace view public.panel_cuentas with (security_invoker = false) as
  select * from public.actividad_cuentas();
revoke all on public.panel_cuentas from public, anon, authenticated;
grant select on public.panel_cuentas to service_role;
