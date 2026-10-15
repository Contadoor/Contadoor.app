-- ============================================================
-- novedades/novedades.sql — Backend del módulo Novedades · Gestoor
-- ESPECIFICACIÓN para aplicar en Supabase (no se ejecuta desde el frontend).
--
-- Dos tablas:
--   · novedades_hallazgos : lo que detecta el Radar (fuente oficial, vigencia, prioridad P0/P1/P2)
--   · novedades_piezas    : la parrilla (reel, historia, carrusel, recurso) y su estado real
--
-- Permisos (la base decide; el frontend solo muestra/oculta botones):
--   · Lectura: todo usuario activo de Gestoor (el equipo también usa los hallazgos laborales/tributarios).
--   · Crear/editar: master y comercial.
--   · Estados 'aprobada' y 'publicada': solo master (Luciano aprueba antes de publicar).
-- ============================================================

-- Usuario actual de Gestoor a partir del JWT
create or replace function public.novedades_usuario_actual()
returns table(id bigint, rol text, es_master boolean)
language sql stable security definer set search_path = public as $$
  select u.id::bigint, u.rol, coalesce(u.es_master,false)
  from public.usuarios u
  where u.auth_user_id = auth.uid() and coalesce(u.activo,true)
  limit 1
$$;
revoke all on function public.novedades_usuario_actual() from public;
grant execute on function public.novedades_usuario_actual() to authenticated;

create or replace function public.novedades_puede_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.novedades_usuario_actual() x where x.es_master or x.rol in ('admin','comercial'))
$$;
create or replace function public.novedades_es_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.novedades_usuario_actual() x where x.es_master or x.rol = 'admin')
$$;
grant execute on function public.novedades_puede_editar(), public.novedades_es_master() to authenticated;

-- ── Hallazgos del Radar ─────────────────────────────────────
create table if not exists public.novedades_hallazgos (
  id                uuid primary key default gen_random_uuid(),
  fecha_radar       date not null default (now() at time zone 'America/Santiago')::date,
  titulo            text not null check (length(titulo) between 3 and 300),
  organismo         text not null,
  url_fuente        text not null check (url_fuente ~ '^https://'),        -- siempre fuente oficial
  fecha_publicacion date,
  fecha_vigencia    text,                                                  -- texto: "1-ene-2027", "desde su publicación", "por confirmar"
  tipo_norma        text not null check (tipo_norma in
                      ('ley','reglamento','resolucion','circular','dictamen','oficio','anuncio','proyecto','convocatoria','calendario','no_confirmado')),
  area              text not null check (area in ('tributario','laboral','previsional','emprendimiento','municipal')),
  alcance           text not null default 'nacional',                       -- nacional | región | comuna
  prioridad         text not null check (prioridad in ('P0','P1','P2')),
  a_quien_afecta    text,
  requisitos        text,
  plazos_montos     text,                                                  -- solo cifras confirmadas en la fuente
  accion            text,                                                  -- qué debe hacer el empresario
  riesgo            text,                                                  -- consecuencia real de no actuar
  confianza         text not null default 'media' check (confianza in ('alta','media','baja')),
  estado            text not null default 'nuevo' check (estado in ('nuevo','en_revision','a_parrilla','banco','descartado')),
  notas             text,
  creado_por        bigint,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (url_fuente, titulo)                                              -- evita cargar dos veces el mismo hallazgo
);
create index if not exists novedades_hallazgos_radar_idx on public.novedades_hallazgos (fecha_radar desc, prioridad);

-- ── Piezas de la parrilla ───────────────────────────────────
create table if not exists public.novedades_piezas (
  id                uuid primary key default gen_random_uuid(),
  hallazgo_id       uuid references public.novedades_hallazgos(id) on delete set null,  -- null = evergreen
  fecha_propuesta   date,
  formato           text not null check (formato in ('reel','historia','carrusel','recurso','newsletter','whatsapp')),
  titulo            text not null check (length(titulo) between 3 and 200),
  gancho            text,                                                  -- hook conversacional 0–5 s
  ejemplo           text,                                                  -- factura, liquidación, simulación, línea de tiempo…
  angulo            text,                                                  -- qué debe entender el empresario
  cta               text,
  estado            text not null default 'idea' check (estado in
                      ('idea','propuesta','aprobada','guion','grabada','editada','publicada','archivada')),
  canales           text[] not null default '{instagram}',
  desplaza_pieza_id uuid references public.novedades_piezas(id) on delete set null,
  url_publicada     text check (url_publicada is null or url_publicada ~ '^https://'),
  fecha_publicada   date,
  notion_url        text check (notion_url is null or notion_url ~ '^https://'),  -- guion/brief en Notion
  notas             text,
  creado_por        bigint,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  check (estado <> 'publicada' or fecha_publicada is not null)
);
create index if not exists novedades_piezas_fecha_idx on public.novedades_piezas (fecha_propuesta);

-- ── Sellos y regla de aprobación ────────────────────────────
create or replace function public.novedades_sellar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' then
    new.creado_por := (select id from public.novedades_usuario_actual());
  else
    new.creado_por := old.creado_por;
    new.creado_en  := old.creado_en;
  end if;
  if tg_table_name = 'novedades_piezas'
     and new.estado in ('aprobada','publicada')
     and (tg_op = 'INSERT' or old.estado is distinct from new.estado)
     and not public.novedades_es_master() then
    raise exception 'Solo Master puede aprobar o marcar como publicada una pieza';
  end if;
  return new;
end $$;

drop trigger if exists novedades_hallazgos_sellar on public.novedades_hallazgos;
create trigger novedades_hallazgos_sellar before insert or update on public.novedades_hallazgos
  for each row execute function public.novedades_sellar();
drop trigger if exists novedades_piezas_sellar on public.novedades_piezas;
create trigger novedades_piezas_sellar before insert or update on public.novedades_piezas
  for each row execute function public.novedades_sellar();

-- ── RLS ─────────────────────────────────────────────────────
alter table public.novedades_hallazgos enable row level security;
alter table public.novedades_piezas    enable row level security;

drop policy if exists nov_h_leer on public.novedades_hallazgos;
create policy nov_h_leer on public.novedades_hallazgos for select to authenticated
  using (exists(select 1 from public.novedades_usuario_actual()));
drop policy if exists nov_h_crear on public.novedades_hallazgos;
create policy nov_h_crear on public.novedades_hallazgos for insert to authenticated
  with check (public.novedades_puede_editar());
drop policy if exists nov_h_editar on public.novedades_hallazgos;
create policy nov_h_editar on public.novedades_hallazgos for update to authenticated
  using (public.novedades_puede_editar()) with check (public.novedades_puede_editar());

drop policy if exists nov_p_leer on public.novedades_piezas;
create policy nov_p_leer on public.novedades_piezas for select to authenticated
  using (exists(select 1 from public.novedades_usuario_actual()));
drop policy if exists nov_p_crear on public.novedades_piezas;
create policy nov_p_crear on public.novedades_piezas for insert to authenticated
  with check (public.novedades_puede_editar());
drop policy if exists nov_p_editar on public.novedades_piezas;
create policy nov_p_editar on public.novedades_piezas for update to authenticated
  using (public.novedades_puede_editar()) with check (public.novedades_puede_editar());
-- Sin políticas de DELETE: nada se borra; se descarta (hallazgo) o se archiva (pieza).

grant select, insert, update on public.novedades_hallazgos, public.novedades_piezas to authenticated;
