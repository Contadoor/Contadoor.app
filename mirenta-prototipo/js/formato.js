// Formato de presentación (sin lógica tributaria). null = "No disponible", nunca $0.
export const ND = '<span class="nd">No disponible</span>';
export const clp = (v) => (v === null || v === undefined) ? ND : (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('es-CL');
export const mm = (v) => (v === null || v === undefined) ? ND : (v < 0 ? '−' : '') + '$' + (Math.abs(v) / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' MM';
export const pct = (v) => (v === null || v === undefined) ? ND : v.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' %';
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const NIVEL = { URGENTE: 'rojo', REVISAR: 'ambar', INFORMATIVO: 'lila' };
export const ESTADO_DATO = { OK: ['✓', 'verde'], REVISAR: ['!', 'ambar'], SIN_DATOS: ['—', 'gris'], RIESGO: ['✕', 'rojo'] };
