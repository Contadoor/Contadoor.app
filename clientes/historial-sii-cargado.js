/* ============================================================
   clientes/historial-sii-cargado.js — «Historial SII» en la ficha del cliente (24-11-2026): qué tenemos CARGADO en Gestoor del SII,
   por año y mes. Distinto de «Historia SII» (historia-sii.js), que PIDE años a Cartapra.
   · RCV ventas / compras: documentos e IVA del resumen del SII, cuántos con detalle por documento, origen (sincronización diaria
     o Historia SII) y fecha de lectura. F29: folio, estado, si fue rectificado y si tenemos sus montos.
   · Doble clic (o lupa) en un mes → el mismo detalle de documentos del Levantamiento (levantamiento-detalle.js).
     Botón «F29» → el formulario del mes con TODOS sus códigos.
   · Solo lectura: RPC public.sii_historial_cargado y public.sii_f29_codigos_mes (Master o analista contable asignado; si no → 42501).
   · Datos externos SIEMPRE con textContent.
   Uso: GestoorHistorialSII.montar(elemento, {id, razon, rut}, sesion)
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document;
  var NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var ORIGEN = { sync: 'Diaria', historia: 'Historia SII' };
  var COB = { completa: 'Completa', parcial: 'Parcial', no_disponible: 'No disponible en Cartapra', fallida: 'Falló la lectura' };

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function icono(n) { var i = el('i', 'ic'); i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function cant(v) { var n = num(v); return n == null ? '—' : Math.round(n).toLocaleString('es-CL'); }
  function mesTxt(p) { p = String(p || ''); return p.length === 6 ? NOMBRE_MES[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function fechaHora(t) {
    if (!t) return '—'; var d = new Date(t); if (isNaN(d.getTime())) return '—';
    try { return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
  }
  function aaaamm(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); }
  function puedeVer(s) { return !!s && (s.esMaster === true || s.rol === 'master' || s.rol === 'contable'); }
  function rpc(nombre, cuerpo) {
    var f = typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null;
    if (!f) return Promise.reject({ codigo: 'SIN_SESION', mensaje: 'Tu sesión no está lista. Recarga la página.' });
    return f('rpc/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
        if (!r.ok) throw { status: r.status, codigo: (j && j.code) || '', mensaje: (j && j.message) || '' };
        return j;
      });
    });
  }
  function mensajeError(e) {
    var c = e && e.codigo;
    if (c === '42501') return 'Solo el Master o el analista contable asignado a esta empresa pueden ver el historial SII.';
    if (c === 'PGRST202' || c === '42883' || (e && e.status === 404)) return 'El historial SII aún no está instalado en el servidor.';
    if (raiz.GestoorLevIVA && raiz.GestoorLevIVA.mensajeError) return raiz.GestoorLevIVA.mensajeError(e);
    return 'No pudimos cargar ahora. Intenta de nuevo en un momento.';
  }

  function estilos() {
    if (doc.getElementById('hcar-css')) return;
    var s = el('style'); s.id = 'hcar-css';
    s.textContent = [
      '.hcar-ficha{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hcar-ficha small{color:#C9A8CC;font-size:12px}',
      '.hcar-ctl{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:12px}.hcar-ctl label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#C9A8CC}',
      '.hcar-ctl select{min-height:38px;border-radius:10px;border:1px solid #4A2B50;background:#140B17;color:#F3E9F4;padding:0 10px;font:inherit;font-size:13px}',
      '.hcar-t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.hcar-t th{position:sticky;top:0;z-index:2;background:#2A1430;color:#C9A8CC;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:7px 8px;text-align:right;white-space:nowrap}',
      '.hcar-t td{padding:6px 8px;border-top:1px solid #33203A;text-align:right;white-space:nowrap}.hcar-t .izq{text-align:left}',
      '.hcar-t th+th{border-left:1px solid rgba(201,168,204,.30)}.hcar-t td+td{border-left:1px solid rgba(201,168,204,.18)}',
      '.hcar-t tr.anio td{background:rgba(146,72,147,.22);font:800 13px var(--g-titulo,Montserrat,sans-serif);color:#fff;text-align:left}',
      '.hcar-t tr.mes{cursor:pointer}.hcar-t tr.mes:hover td{background:rgba(255,255,255,.03)}.hcar-t td.gris{color:#9a849b}.hcar-t td.amb{color:#FFC85A}.hcar-t td.ver{color:#46D69A}',
      '.hcar-mini{min-height:28px;padding:0 10px;border-radius:8px;border:1px solid #4A2B50;background:transparent;color:#E39BE5;font:700 11.5px Inter,sans-serif;cursor:pointer}',
      '.hcar-mini:focus-visible,.hcar-mini:hover{background:rgba(227,155,229,.12);outline:2px solid #E39BE5}.hcar-mini[disabled]{opacity:.45;cursor:not-allowed}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  function montar(cont, cliente, sesion) {
    if (!cont) return;
    cont.textContent = '';
    if (!cliente || !(Number(cliente.id) > 0) || !puedeVer(sesion)) return;
    estilos();
    var w = el('div', 'hcar-ficha');
    var b = el('button', 'liva-btn sec'); b.type = 'button'; b.id = 'hcar-abrir';
    b.appendChild(icono('lista')); b.appendChild(doc.createTextNode('Historial SII'));
    b.addEventListener('click', function () { abrir(cliente); });
    w.appendChild(b); w.appendChild(el('small', null, 'Qué tenemos cargado del SII por mes: compras, ventas y F29 (origen y fecha de lectura).'));
    cont.appendChild(w);
  }

  var vista = null;
  function cerrar() { if (vista) vista.remove(); vista = null; doc.removeEventListener('keydown', alEsc); }
  function alEsc(ev) { if (ev.key === 'Escape' && !doc.getElementById('livd-velo') && !doc.getElementById('hcar-f29-velo')) cerrar(); }

  function abrir(cliente, hoy) {
    cerrar(); estilos();
    if (raiz.GestoorLevIVA && raiz.GestoorLevIVA.estilos) raiz.GestoorLevIVA.estilos();   // estilos base (velo, botones, tabla)
    hoy = hoy || new Date();
    var hasta = aaaamm(hoy), desde = (hoy.getFullYear() - 5) + '01';
    var velo = el('div', 'liva-velo'); velo.id = 'hcar-velo'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true'); velo.setAttribute('aria-label', 'Historial SII cargado');
    var caja = el('div', 'liva-caja'); velo.appendChild(caja);
    var cab = el('div', 'liva-cab'); cab.appendChild(icono('lista'));
    var h = el('h3', null, 'Historial SII cargado'); h.appendChild(el('span', null, (cliente.razon || 'Cliente') + (cliente.rut ? ' · ' + cliente.rut : ''))); cab.appendChild(h);
    var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrar); cab.appendChild(x);
    caja.appendChild(cab);
    var ctl = el('div', 'hcar-ctl'), lb = el('label', null, 'Año'), sel = el('select'); sel.id = 'hcar-anio';
    var o0 = el('option', null, 'Todos (6 años)'); o0.value = ''; sel.appendChild(o0);
    for (var y = hoy.getFullYear(); y >= hoy.getFullYear() - 5; y--) { var o = el('option', null, String(y)); o.value = String(y); sel.appendChild(o); }
    lb.appendChild(sel); ctl.appendChild(lb); caja.appendChild(ctl);
    var msg = el('div', 'liva-msg', 'Cargando el historial…'); msg.id = 'hcar-msg'; caja.appendChild(msg);
    var tw = el('div', 'liva-tw'); caja.appendChild(tw);
    caja.appendChild(el('div', 'liva-aviso', 'Doble clic en un mes (o «Docs») para ver sus documentos; «F29» muestra el formulario con todos sus códigos. Los meses sin datos se muestran «—» (no son cero).'));
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
    doc.addEventListener('keydown', alEsc);
    doc.body.appendChild(velo); vista = velo;
    function aviso(t, c) { msg.className = 'liva-msg' + (c ? ' ' + c : ''); msg.textContent = t; }

    // Contexto para el detalle de documentos (borrador: últimos 60 meses del historial, el remanente se encadena desde ahí).
    var d60 = new Date(hoy.getFullYear(), hoy.getMonth() - 59, 1);
    var ctx = { cliente: cliente, desde: aaaamm(d60), hasta: hasta, opciones: {}, datos: { desde: aaaamm(d60), hasta: hasta, meses: [], estimacion: {}, totales: {} }, rpc: rpc, mensajeError: mensajeError };
    var datos = null;
    rpc('sii_historial_cargado', { p_cliente_id: Number(cliente.id), p_desde: desde, p_hasta: hasta }).then(function (r) {
      if (vista !== velo) return; datos = r || { meses: [] }; pintar();
      var con = (datos.conexion || {}).estado;
      var n = (datos.meses || []).filter(function (m) { return m.ventas || m.compras; }).length, nf = (datos.meses || []).filter(function (m) { return m.f29; }).length;
      aviso(n + ' meses con compras y ventas y ' + nf + ' F29 cargados en los últimos 6 años' + (con && con !== 'conectada' ? ' · la empresa no está conectada con el SII (' + con + ')' : '') + '.', n ? 'ver' : 'amb');
    }).catch(function (e) { if (vista !== velo) return; aviso(mensajeError(e), 'roj'); });
    sel.addEventListener('change', function () { if (datos) pintar(); });

    function pintar() {
      tw.textContent = '';
      var t = el('table', 'hcar-t'); t.id = 'hcar-tabla';
      var hr = el('tr');
      [['Mes', 1], ['Ventas', 0], ['IVA ventas', 0], ['Compras', 0], ['IVA compras', 0], ['Pend. / Recl. / No incl.', 0], ['Con detalle', 0], ['Origen', 1], ['Leído', 1], ['F29', 1], ['Estado F29', 1], ['Montos F29', 1], ['', 1]]
        .forEach(function (c) { hr.appendChild(el('th', c[1] ? 'izq' : null, c[0])); });
      var hd = el('thead'); hd.appendChild(hr); t.appendChild(hd);
      var tb = el('tbody'), anio = null, fil = sel.value;
      (datos.meses || []).filter(function (m) { return !fil || m.periodo.slice(0, 4) === fil; }).forEach(function (m) {
        if (m.periodo.slice(0, 4) !== anio) { anio = m.periodo.slice(0, 4); var ra = el('tr', 'anio'); var ca = el('td', null, anio); ca.colSpan = 13; ra.appendChild(ca); tb.appendChild(ra); }
        var r = el('tr', 'mes'); r.setAttribute('data-periodo', m.periodo); r.tabIndex = -1;
        var v = m.ventas, c = m.compras || {}, cr = c.registro, lec = m.lectura || {}, lv = lec.rcv_ventas || {}, lc = lec.rcv_compras || {}, f = m.f29;
        r.appendChild(el('td', 'izq', mesTxt(m.periodo)));
        r.appendChild(el('td', v ? null : 'gris', v ? cant(v.documentos) : '—')); r.appendChild(el('td', v ? null : 'gris', v ? pesos(v.iva) : '—'));
        r.appendChild(el('td', cr ? null : 'gris', cr ? cant(cr.documentos) : '—')); r.appendChild(el('td', cr ? null : 'gris', cr ? pesos(cr.iva) : '—'));
        r.appendChild(el('td', m.compras ? null : 'gris', m.compras ? [c.pendiente, c.reclamado, c.no_incluir].map(function (z) { return z ? cant(z.documentos) : '0'; }).join(' / ') : '—'));
        var tot = Number((v || {}).documentos || 0) + Number((cr || {}).documentos || 0) + ['pendiente', 'reclamado', 'no_incluir'].reduce(function (s, k) { return s + Number((c[k] || {}).documentos || 0); }, 0);
        var det = Number((m.detalle || {}).ventas || 0) + Number((m.detalle || {}).compras || 0);
        r.appendChild(el('td', !(v || m.compras) ? 'gris' : det >= tot ? 'ver' : 'amb', !(v || m.compras) ? '—' : det >= tot ? 'Sí' : (det ? 'Parcial (' + cant(det) + ')' : 'Solo resumen')));
        var org = [lv.origen, lc.origen].filter(Boolean);
        r.appendChild(el('td', 'izq', org.length ? (org[0] === org[1] || org.length === 1 ? ORIGEN[org[0]] : 'Mixto') : '—'));
        var est = [lv.estado, lc.estado].filter(function (z) { return z && z !== 'completa'; });
        r.appendChild(el('td', 'izq' + (est.length ? ' amb' : ''), fechaHora(lv.leido_cartapra_en || lc.leido_cartapra_en) + (est.length ? ' · ' + (COB[est[0]] || est[0]) : '')));
        r.appendChild(el('td', 'izq' + (f ? '' : ' gris'), f ? String(f.folio) + (f.rectificada ? ' (rectificado)' : '') : '—'));
        r.appendChild(el('td', 'izq' + (f ? '' : ' gris'), f ? (f.estado_sii || f.letra || '—') : '—'));
        r.appendChild(el('td', 'izq ' + (!f ? 'gris' : f.montos ? 'ver' : 'amb'), !f ? '—' : f.montos ? 'Sí (IVA ' + pesos(f.iva_determinado) + ')' : 'Sin montos'));
        var acc = el('td', 'izq'), bd = el('button', 'hcar-mini', 'Docs'), bf = el('button', 'hcar-mini', 'F29');
        bd.type = 'button'; bd.setAttribute('aria-label', 'Ver documentos de ' + mesTxt(m.periodo)); bd.disabled = !(v || m.compras) || !raiz.GestoorLevDetalle;
        bf.type = 'button'; bf.setAttribute('aria-label', 'Ver el F29 de ' + mesTxt(m.periodo)); bf.disabled = !f; bf.setAttribute('data-f29', m.periodo);
        bd.addEventListener('click', function (ev) { ev.stopPropagation(); verDocs(m.periodo); });
        bf.addEventListener('click', function (ev) { ev.stopPropagation(); verF29(cliente, m.periodo); });
        acc.appendChild(bd); acc.appendChild(doc.createTextNode(' ')); acc.appendChild(bf); r.appendChild(acc);
        r.addEventListener('dblclick', function () { verDocs(m.periodo); });
        tb.appendChild(r);
      });
      t.appendChild(tb); tw.appendChild(t);
    }
    function verDocs(per) { if (raiz.GestoorLevDetalle) raiz.GestoorLevDetalle.abrirMes(ctx, per); }
  }

  /** F29 del mes con TODOS sus códigos (glosa del instructivo del SII cuando la tenemos). */
  function verF29(cliente, per) {
    var previo = doc.getElementById('hcar-f29-velo'); if (previo) previo.remove();
    var velo = el('div', 'liva-velo'); velo.id = 'hcar-f29-velo'; velo.style.zIndex = '445'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true');
    var caja = el('div', 'liva-caja'); caja.style.width = '760px'; velo.appendChild(caja);
    var cab = el('div', 'liva-cab'); var h = el('h3', null, 'Formulario 29 · ' + mesTxt(per)); h.appendChild(el('span', null, cliente.razon || '')); cab.appendChild(h);
    var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', function () { velo.remove(); }); cab.appendChild(x);
    caja.appendChild(cab);
    var msg = el('div', 'liva-msg', 'Cargando el F29…'); caja.appendChild(msg);
    var tw = el('div', 'liva-tw'); caja.appendChild(tw);
    velo.addEventListener('click', function (ev) { if (ev.target === velo) velo.remove(); });
    doc.body.appendChild(velo);
    rpc('sii_f29_codigos_mes', { p_cliente_id: Number(cliente.id), p_periodo: per }).then(function (r) {
      var f = r && r.f29;
      if (!f) { msg.className = 'liva-msg amb'; msg.textContent = 'No hay F29 cargado para este mes.'; return; }
      msg.className = 'liva-msg' + (f.montos ? ' ver' : ' amb');
      msg.textContent = 'Folio ' + f.folio + (f.estado_sii ? ' · estado ' + f.estado_sii : '') + (f.rectificada ? ' · rectificado' : '') + (f.montos ? ' · montos leídos el ' + fechaHora(f.montos_leidos_en) : ' · aún sin montos (pide el historial a Cartapra)');
      if (!(r.codigos || []).length) return;
      var t = el('table', 'hcar-t'); t.id = 'hcar-f29-tabla'; var hr = el('tr');
      [['Código', 1], ['Línea', 1], ['Descripción', 1], ['Valor', 0]].forEach(function (c) { hr.appendChild(el('th', c[1] ? 'izq' : null, c[0])); });
      var hd = el('thead'); hd.appendChild(hr); t.appendChild(hd); var tb = el('tbody');
      r.codigos.forEach(function (c) {
        var tr = el('tr'); tr.setAttribute('data-codigo', c.codigo);
        tr.appendChild(el('td', 'izq', c.codigo)); tr.appendChild(el('td', 'izq', c.linea || '—')); tr.appendChild(el('td', 'izq', c.glosa || (c.codigo === '7' ? 'Folio' : 'Código del F29')));
        tr.appendChild(el('td', null, /cantidad/i.test(c.glosa || '') || c.codigo === '7' || c.codigo === '115' ? cant(c.valor) : pesos(c.valor)));
        tb.appendChild(tr);
      });
      t.appendChild(tb); tw.appendChild(t);
      caja.appendChild(el('div', 'liva-aviso', 'Glosas según ' + (r.fuente_glosas || 'el instructivo del SII') + '.'));
    }).catch(function (e) { msg.className = 'liva-msg roj'; msg.textContent = mensajeError(e); });
  }

  raiz.GestoorHistorialSII = { montar: montar, abrir: abrir, cerrar: cerrar, verF29: verF29, puedeVer: puedeVer };
})(window);
