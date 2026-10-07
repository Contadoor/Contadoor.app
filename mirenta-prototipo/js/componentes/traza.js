// SourceTrace · drill-down "¿Por qué?": resumen → explicación → detalle → fuente.
import { clp, pct, esc } from '../formato.js';
export function traza(d, id, modo) {
  const r = d.resumen, P = (k) => d.puente.find((p) => p.id === k);
  const T = {
    base: { t: 'Base tributaria proyectada', v: r.baseTributaria.valor, exp: 'Resultado contable + gastos que requieren ajuste − beneficios / deducciones ± otros ajustes = base tributaria.',
      det: [['Resultado contable', P('resultado').valor], ['+ Agregados', P('agregados').valor], ['− Deducciones', P('deducciones').valor], ['= Base tributaria', P('base').valor]], fuente: P('resultado').fuente },
    impuesto: { t: 'Impuesto proyectado', v: r.impuesto.valor, exp: 'Base tributaria multiplicada por la tasa aplicable que informa el motor versionado (no está escrita en la pantalla).',
      det: [['Base tributaria', r.baseTributaria.valor], ['Tasa aplicable estimada', null, pct(r.impuesto.tasaAplicable)], ['= Impuesto', r.impuesto.valor]], fuente: { nombre: 'Regla de tasa versionada (backend)', fecha: '—', periodo: 'AT 2027', estado: 'DEMO' } },
    ppm: { t: 'PPM disponibles', v: r.ppmDisponible.valor, exp: 'Pagos provisionales efectivamente reconocidos como disponibles para la renta.',
      det: [['PPM determinado', d.ppm.determinado], ['PPM declarado', d.ppm.declarado], ['PPM pagado', d.ppm.pagado], ['PPM disponible para la renta', d.ppm.disponible]], fuente: P('ppm').fuente },
    saldo: { t: 'Saldo proyectado', v: r.saldo.valor, exp: 'Impuesto proyectado − PPM disponibles − créditos. Los créditos aún no están disponibles: no se asumen en cero.',
      det: [['Impuesto proyectado', r.impuesto.valor], ['− PPM disponibles', r.ppmDisponible.valor], ['− Créditos', null], ['= Saldo', r.saldo.valor]], fuente: null },
  }[id];
  if (!T) return '';
  return `<div class="tr-cab"><small>¿Por qué?</small><h3>${esc(T.t)}</h3><div class="tr-v">${clp(T.v)}</div></div>
    <section><h4>Explicación simple</h4><p>${esc(T.exp)}</p></section>
    <section><h4>Cálculo</h4><table class="cmp">${T.det.map(([a, v, txt]) => `<tr class="${a.startsWith('=') ? 'fuerte' : ''}"><td>${esc(a)}</td><td>${txt ?? clp(v)}</td></tr>`).join('')}</table></section>
    ${modo === 'ASESOR' ? `<section><h4>Fuente</h4>${T.fuente ? `<table class="cmp"><tr><td>Fuente</td><td>${esc(T.fuente.nombre)}</td></tr><tr><td>Fecha</td><td>${esc(T.fuente.fecha)}</td></tr><tr><td>Período</td><td>${esc(T.fuente.periodo)}</td></tr><tr><td>Estado</td><td>${esc(T.fuente.estado)}</td></tr></table>` : '<p>Combinación de las cifras anteriores.</p>'}
      <section><h4>Detalle técnico</h4><p class="nota">${esc(d.tecnico.snapshot)} · ${esc(d.tecnico.reglas)}</p></section></section>` : ''}`;
}

// "Tu régimen tributario" (abre desde la cabecera). Lenguaje cliente; detalle técnico solo en asesor.
export function regimen(d, modo) {
  const r = d.regimenInfo;
  return `<div class="tr-cab"><small>Tu régimen tributario</small><h3>${esc(d.caso.regimen.nombre)}</h3><p class="tr-sub">${esc(d.caso.regimen.articulo)}</p></div>
    <p>${esc(r.resumen)}</p>${r.puntos.map((p) => `<section><h4>${esc(p.t)}</h4><p>${esc(p.d)}</p></section>`).join('')}
    ${modo === 'ASESOR' ? `<section><h4>Detalle técnico</h4><p class="nota">${esc(r.tecnico)}</p></section>` : ''}
    <p class="nota">Texto demo: el contenido definitivo lo valida el asesor.</p>`;
}
