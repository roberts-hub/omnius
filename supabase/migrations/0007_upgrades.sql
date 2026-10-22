-- Upgrades de LUT Pack a Full System que NO se pudieron aplicar (la cuenta no tenía un LUT Pack activo, o ya
-- tenía el Full System). El webhook guarda aquí el pago en vez de dar acceso; Roberto decide (reembolsar o
-- dar el LUT Pack). Solo la llave de servicio la lee y escribe: sin políticas RLS, nadie de fuera la ve.
create table if not exists public.upgrades_revisar (
  id bigint generated always as identity primary key,
  stripe_session text unique not null,
  stripe_payment_intent text,
  email text not null,
  referencia text,                 -- client_reference_id que traía el link (id de la cuenta), si traía
  motivo text not null,            -- "sin LUT Pack activo" o "ya tenía el Full System"
  monto numeric,
  moneda text,
  resuelto boolean not null default false,
  creada timestamptz not null default now()
);
alter table public.upgrades_revisar enable row level security;
revoke all on public.upgrades_revisar from anon, authenticated;
