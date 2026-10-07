// MiRentaShell (R2.2) · navegación, modo Cliente/Asesor, estado demo y paneles laterales. Sin cálculos tributarios.
// Roles: CLIENTE · ASESOR. MASTER (validación, aprobación, certificación, cierre) queda reservado: sin botón en R2.
import { ESTADOS } from './demo-data.js';
import { SECCIONES, OCULTAS, render } from './vistas.js';
import { cabecera } from './componentes/cabecera.js';
import { traza, regimen } from './componentes/traza.js';
import { vistaDocumento } from './componentes/registros.js';

const S = { seccion: 'resumen', modo: 'CLIENTE', estado: 'preliminar', escSel: ['a'], regAbierto: 'RLI', subProy: 'renta', subTec: 'Contabilidad', detalleEsc: false, lotes: false,
  blq: 'det', rliCompleta: false, codigos: true, estr: false, exportar: false, socio: 'A', gcDet: false,
  rliGrupos: [], incPaso: 1, verConsol: false };
const $ = (s) => document.querySelector(s);
try { const g = JSON.parse(localStorage.getItem('mirenta-proto') || '{}'); Object.assign(S, { modo: g.modo ?? S.modo, estado: g.estado ?? S.estado }); } catch { /* sin almacenamiento */ }
const guardar = () => { try { localStorage.setItem('mirenta-proto', JSON.stringify({ modo: S.modo, estado: S.estado })); } catch { /* ignorar */ } };

function pintar() {
  const d = ESTADOS[S.estado];
  document.body.dataset.modo = S.modo;
  $('#cabecera').innerHTML = cabecera(d);
  $('#nav').innerHTML = SECCIONES.filter((s) => !s.asesor || S.modo === 'ASESOR')
    .map((s) => `<button class="nv ${s.id === S.seccion ? 'on' : ''} ${s.asesor ? 'interna' : ''}" data-sec="${s.id}">${s.nombre}</button>`).join('');
  const sec = SECCIONES.find((s) => s.id === S.seccion) ?? OCULTAS[S.seccion];
  $('#pregunta').textContent = sec.pregunta;
  $('#contenido').innerHTML = render(S.seccion, d, S);
  document.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('on', b.dataset.modo === S.modo));
  $('#selEstado').value = S.estado;
}
function abrir(html) { $('#traza-cuerpo').innerHTML = html; $('#traza').classList.add('on'); $('#velo').classList.add('on'); }
function cerrar() { $('#traza').classList.remove('on'); $('#velo').classList.remove('on'); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-sec],[data-ir],[data-modo],[data-traza],[data-regimen],[data-esc],[data-reg],[data-proy],[data-tec],[data-detalle-esc],[data-lotes],[data-blq],[data-rli-completa],[data-codigos],[data-estr],[data-exportar],[data-doc],[data-socio],[data-gc],[data-decide],[data-grupo],[data-paso],[data-ver-consol],[data-cerrar-doc],#doc,#cerrarTraza,#velo');
  if (!t) return;
  if (t.id === 'doc') { if (e.target.id === 'doc') $('#doc').classList.remove('on'); return; }
  const d = ESTADOS[S.estado];
  if (t.dataset.sec || t.dataset.ir) { S.seccion = t.dataset.sec || t.dataset.ir; pintar(); window.scrollTo({ top: 0 }); }
  else if (t.dataset.proy) { S.seccion = 'proyeccion'; S.subProy = t.dataset.proy; pintar(); window.scrollTo({ top: 0 }); }
  else if (t.dataset.tec) { S.subTec = t.dataset.tec; pintar(); }
  else if (t.dataset.modo) { S.modo = t.dataset.modo; if (S.seccion === 'tecnica' && S.modo === 'CLIENTE') S.seccion = 'resumen'; guardar(); pintar(); }
  else if (t.dataset.traza) abrir(traza(d, t.dataset.traza, S.modo));
  else if (t.hasAttribute('data-regimen')) abrir(regimen(d, S.modo));
  else if (t.dataset.esc) { const id = t.dataset.esc; S.escSel = S.escSel.includes(id) ? S.escSel.filter((x) => x !== id) : [...S.escSel, id]; pintar(); }
  else if (t.dataset.reg) { S.regAbierto = t.dataset.reg; S.blq = t.dataset.reg === 'RLI' ? 'det' : 'reg'; S.estr = false; S.exportar = false; pintar(); }
  else if (t.dataset.blq) { S.blq = t.dataset.blq; if (S.blq === 'det') S.regAbierto = 'RLI'; else if (S.blq === 'reg' && S.regAbierto === 'RLI') S.regAbierto = 'CPTS'; S.exportar = false; pintar(); }
  else if (t.hasAttribute('data-rli-completa')) { S.rliCompleta = !S.rliCompleta; pintar(); }
  else if (t.hasAttribute('data-codigos')) { S.codigos = !S.codigos; pintar(); }
  else if (t.hasAttribute('data-estr')) { S.estr = !S.estr; pintar(); }
  else if (t.hasAttribute('data-exportar')) { S.exportar = !S.exportar; pintar(); }
  else if (t.dataset.doc) { S.exportar = false; pintar(); $('#doc-cuerpo').innerHTML = vistaDocumento(d, t.dataset.doc, t.dataset.docreg || S.regAbierto); $('#doc').classList.add('on'); }
  else if (t.hasAttribute('data-cerrar-doc')) $('#doc').classList.remove('on');
  else if (t.dataset.socio) { S.socio = t.dataset.socio; pintar(); }
  else if (t.hasAttribute('data-gc')) { S.gcDet = !S.gcDet; pintar(); }
  else if (t.dataset.decide) { S.seccion = 'escenarios'; const id = t.dataset.decide;
    if (id === 'retiro') { S.verConsol = true; pintar(); document.getElementById('comparador')?.scrollIntoView({ behavior: 'smooth' }); } else { S.escSel = [id]; if (id === 'c') S.incPaso = 1; pintar(); } }
  else if (t.dataset.grupo) { const g = t.dataset.grupo, todos = ['ing', 'egr', 'ben', 'fin'];
    S.rliGrupos = g === 'abrir-todo' ? todos : g === 'cerrar-todo' ? [] : S.rliGrupos.includes(g) ? S.rliGrupos.filter((x) => x !== g) : [...S.rliGrupos, g]; pintar(); }
  else if (t.dataset.paso) { S.incPaso = Number(t.dataset.paso); pintar(); document.querySelector('.incentivo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (t.hasAttribute('data-ver-consol')) { S.verConsol = !S.verConsol; pintar(); }
  else if (t.hasAttribute('data-detalle-esc')) { S.detalleEsc = !S.detalleEsc; pintar(); }
  else if (t.hasAttribute('data-lotes')) { S.lotes = !S.lotes; pintar(); }
  else cerrar();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrar(); $('#doc').classList.remove('on'); } });
$('#selEstado').addEventListener('change', (e) => { S.estado = e.target.value; guardar(); pintar(); });
pintar();
