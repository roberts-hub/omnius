-- SPECTRE: reembolsos y contracargos que no se olvidan.
--
-- Stripe puede entregar los eventos en desorden: si el aviso de reembolso llega ANTES que la compra
-- (por ejemplo, porque la compra falló la primera vez y Stripe la reintenta después), el webhook no
-- encontraba nada que desactivar y la compra entraba activa más tarde. Ahora cada reembolso o
-- contracargo queda anotado aquí, y cualquier compra de ese pago que entre después nace desactivada.

create table if not exists public.revocaciones (
  stripe_payment_intent text primary key,
  motivo text not null,
  creada timestamptz not null default now()
);
alter table public.revocaciones enable row level security;
revoke all on public.revocaciones from anon, authenticated;
grant all on public.revocaciones to service_role;

create or replace function public.compra_revocada()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m text;
begin
  if new.stripe_payment_intent is not null then
    select r.motivo into m from public.revocaciones r where r.stripe_payment_intent = new.stripe_payment_intent;
    if found then
      new.activa := false;
      new.motivo := m;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.compra_revocada() from public, anon, authenticated;

drop trigger if exists compra_revocada on public.compras;
create trigger compra_revocada before insert on public.compras
  for each row execute function public.compra_revocada();
