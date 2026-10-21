-- SPECTRE: quitar permisos que nadie usa (revisión de configuración, oct 2026).
-- Supabase deja TRUNCATE a los usuarios con sesión por default; TRUNCATE no pasa por las reglas RLS.
-- No se puede usar desde la API del sitio, pero no tiene por qué existir.
revoke truncate on public.compras, public.ediciones, public.descargas, public.accesos, public.bloqueos, public.revocaciones from anon, authenticated;
-- limites() solo la usa abrir_area() por dentro (corre como dueño): nadie de fuera necesita llamarla
revoke all on function public.limites() from public, anon, authenticated;
grant execute on function public.limites() to service_role;
