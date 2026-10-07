// MiRentaShell · navegación, modo Cliente/Asesor, estado demo y panel "¿Por qué?". Sin cálculos tributarios.
import { ESTADOS } from './demo-data.js';
import { SECCIONES, render } from './vistas.js';
import { cabecera } from './componentes/cabecera.js';
import { traza } from './componentes/traza.js';

const S = { seccion: 'resumen', modo: 'CLIENTE', estado: 'preliminar', escSel: ['base', 'a'], regAbierto: 'SAC' };
const $ = (s) => document.querySelector(s);
try { const g = JSON.parse(localStorage.getItem('mirenta-proto') || '{}'); Object.assign(S, { modo: g.modo ?? S.modo, estado: g.estado ?? S.estado }); } catch { /* sin almacenamiento */ }
const guardar = () => { try { localStorage.setItem('mirenta-proto', JSON.stringify({ modo: S.modo, estado: S.estado })); } catch { /* ignorar */ } };

function pintar() {
  const d = ESTADOS[S.estado];
  document.body.dataset.modo = S.modo;
  $('#cabecera').innerHTML = cabecera(d);
  $('#nav').innerHTML = SECCIONES.filter((s) => !s.asesor || S.modo === 'ASESOR')
    .map((s) => `<button class="nv ${s.id === S.seccion ? 'on' : ''} ${s.asesor ? 'interna' : ''}" data-sec="${s.id}">${s.nombre}</button>`).join('');
  const sec = SECCIONES.find((s) => s.id === S.seccion);
  $('#pregunta').textContent = sec.pregunta;
  $('#contenido').innerHTML = render(S.seccion, d, S);
  document.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('on', b.dataset.modo === S.modo));
  $('#selEstado').value = S.estado;
}
function abrirTraza(id) { $('#traza-cuerpo').innerHTML = traza(ESTADOS[S.estado], id, S.modo); $('#traza').classList.add('on'); $('#velo').classList.add('on'); }
function cerrarTraza() { $('#traza').classList.remove('on'); $('#velo').classList.remove('on'); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-sec],[data-ir],[data-modo],[data-traza],[data-esc],[data-reg],[data-imprimir],#cerrarTraza,#velo');
  if (!t) return;
  if (t.dataset.sec || t.dataset.ir) { S.seccion = t.dataset.sec || t.dataset.ir; pintar(); window.scrollTo({ top: 0 }); }
  else if (t.dataset.modo) { S.modo = t.dataset.modo; if (SECCIONES.find((s) => s.id === S.seccion)?.asesor && S.modo === 'CLIENTE') S.seccion = 'resumen'; guardar(); pintar(); }
  else if (t.dataset.traza) abrirTraza(t.dataset.traza);
  else if (t.dataset.esc) { const id = t.dataset.esc; S.escSel = S.escSel.includes(id) ? S.escSel.filter((x) => x !== id) : [...S.escSel, id]; pintar(); }
  else if (t.dataset.reg) { S.regAbierto = t.dataset.reg; pintar(); }
  else if (t.hasAttribute('data-imprimir')) window.print();
  else cerrarTraza();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarTraza(); });
$('#selEstado').addEventListener('change', (e) => { S.estado = e.target.value; guardar(); pintar(); });
pintar();
