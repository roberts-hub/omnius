-- De qué canal vino cada compra (YouTube, Instagram…): lo manda el sitio a Stripe como client_reference_id
-- ("src_youtube_video_masterclass") y el webhook lo guarda aquí sin el prefijo ("youtube_video_masterclass").
alter table public.compras add column if not exists origen text;
