/* ============================================================
   reportes-contable/docs-sii.js — «Documentos contables del período» con los datos del SII (Cartapra). SOLO LECTURA.
   19-11 (pedido de Luciano): reemplaza las tarjetas del flujo SimpleAPI (Sincronizar SII, «falta validar la autorización SII»)
   por un RESUMEN AUTOMÁTICO por libro (Compras, Ventas, Honorarios recibidos) y una lupa «Ver detalle» por libro.
   · Resumen: RPC public.sii_preiva_periodo (ya en producción; Master + analista contable/RRHH asignado). La sincronización
     con el SII la hace Cartapra a diario: aquí no hay botón de sincronizar.
   · Lupa: detalle POR TIPO de documento (33, 34, 61, 56, 46, 39/41…; NC restan) y, dentro de cada tipo, la lista de documentos
     (folio, fecha, RUT y razón social, montos) desde la RPC public.sii_documentos_periodo. Si esa RPC aún no está instalada
     (404 / PGRST202 / 42883) se muestra el desglose por tipo del resumen y «Detalle por documento disponible pronto» (fail-closed).
   · Empresa no conectada: «Esta empresa aún no está conectada al SII» y la carga manual de libros queda a la vista (es la única vía).
   · Empresa conectada con datos: la carga manual queda plegada como respaldo, porque el Pre-IVA de esta pantalla todavía
     se abre con los libros cargados (librosListos). No cambia ningún cálculo ni guarda nada.
   · Todo dato externo se pinta con textContent. Una consulta por cliente y período (caché en memoria).
   Uso: ContableDocsSii.montar(slot, { clienteId, periodo, nombre })  — slot = .docsii-slot; el respaldo manual es
        el .libros-manual[data-cid] hermano.
   ============================================================ */
(function (raiz) {
  'use strict';
  var TIPOS = { 0: 'Boleta de honorarios', 29: 'Factura de inicio', 30: 'Factura', 32: 'Factura no afecta o exenta', 33: 'Factura electrónica',
    34: 'Factura exenta', 35: 'Boleta', 38: 'Boleta exenta', 39: 'Boleta electrónica', 41: 'Boleta exenta electrónica', 43: 'Liquidación factura',
    45: 'Factura de compra', 46: 'Factura de compra electrónica', 48: 'Comprobante de pago electrónico', 52: 'Guía de despacho',
    55: 'Nota de débito', 56: 'Nota de débito electrónica', 60: 'Nota de crédito', 61: 'Nota de crédito electrónica',
    110: 'Factura de exportación', 111: 'Nota de débito de exportación', 112: 'Nota de crédito de exportación', 914: 'Declaración de ingreso (DIN)' };
  var RESTA = { 60: true, 61: true, 112: true };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ESTADO_COMPRA = { registro: 'Registrada', pendiente: 'Pendiente', reclamado: 'Reclamada', no_incluir: 'No incluir' };

  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function n0(v) { return num(v) || 0; }
  function pesos(v) { var x = num(v); if (x === null) return '—'; x = Math.round(x); return (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('es-CL'); }
  function nombreTipo(t) { return TIPOS[t] || ('Documento tipo ' + t); }
  function mesTxt(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : String(p || ''); }
  function fechaChile(iso) {
    if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null;
    return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }
  function fechaCorta(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : '—'; }

  // ── Lógica pura (con pruebas en docs-sii.test.js) ──────────────────────────────────────────────
  // r = respuesta de sii_preiva_periodo → lo que muestran las tarjetas.
  function resumir(r) {
    r = r || {};
    var est = (r.conexion && r.conexion.estado) || 'sin_conexion';
    var out = { conectado: est !== 'sin_conexion', estadoConexion: est, datosAl: r.datos_al || null, datosAlTxt: fechaChile(r.datos_al),
      incompleto: (r.avisos || []).indexOf('cobertura_incompleta') >= 0, ventas: null, compras: null, honorarios: null };
    var v = r.ventas;
    if (v) out.ventas = { documentos: n0(v.documentos), neto: n0(v.neto), exento: n0(v.exento), iva: n0(v.iva), total: n0(v.total), porTipo: porTipo(v.por_tipo) };
    var c = r.compras, cr = c && c.registro;
    if (cr) {
      var otros = [];
      ['pendiente', 'reclamado', 'no_incluir'].forEach(function (k) { var x = c[k]; if (x && n0(x.documentos) > 0) otros.push({ estado: k, etiqueta: ESTADO_COMPRA[k], documentos: n0(x.documentos), iva: n0(x.iva), total: n0(x.total) }); });
      out.compras = { documentos: n0(cr.documentos), neto: n0(cr.neto), exento: n0(cr.exento), iva: n0(cr.iva), total: n0(cr.total), porTipo: porTipo(c.por_tipo), otros: otros };
    }
    var h = r.honorarios || null, hr = h && h.honorarios_recibidos, he = h && h.honorarios_emitidos;
    if (hr) out.honorarios = { documentos: n0(hr.documentos), bruto: n0(hr.bruto), retencion: n0(hr.retencion), liquido: n0(hr.bruto) - n0(hr.retencion),
      emitidas: he ? n0(he.documentos) : 0 };
    out.hayDatos = !!(out.ventas || out.compras || out.honorarios);
    return out;
  }
  // por_tipo del servidor (ya con signo: NC restan) → filas ordenadas por código
  function porTipo(pt) {
    return Object.keys(pt || {}).map(function (k) {
      var x = pt[k] || {}, t = Number(k);
      return { tipo: t, nombre: nombreTipo(t), resta: !!RESTA[t], n: n0(x.n), neto: n0(x.neto), exento: n0(x.exento), iva: n0(x.iva), total: n0(x.total), docs: null };
    }).sort(function (a, b) { return a.tipo - b.tipo; });
  }
  // documentos de sii_documentos_periodo → grupos por tipo con totales (NC restan). Compras: solo REGISTRADAS suman;
  // pendientes/reclamadas/no incluir van aparte. Honorarios: anuladas aparte (no suman).
  function agrupar(docs, libro) {
    var grupos = {}, aparte = [];
    (docs || []).forEach(function (d) {
      if (!d) return;
      var t = Number(d.tipo_dte) || 0, est = String(d.estado || '').toLowerCase();
      var sg = (num(d.signo) === -1 || RESTA[t]) ? -1 : 1;
      var fila = { folio: d.folio, fecha: d.fecha || null, rut: d.rut || null, razonSocial: d.razon_social || null, estado: est,
        neto: sg * n0(d.neto), exento: sg * n0(d.exento), iva: sg * n0(d.iva), total: sg * n0(d.total), retencion: n0(d.retencion), resta: sg < 0 };
      if (libro === 'honorarios') { fila.liquido = fila.total - fila.retencion; }
      var fuera = (libro === 'compra' && est && est !== 'registro') || (libro === 'honorarios' && /^(anu|nul)/.test(est));
      if (fuera) { aparte.push(Object.assign({ tipo: t, nombre: nombreTipo(t), etiqueta: ESTADO_COMPRA[est] || 'Anulada' }, fila)); return; }
      var g = grupos[t] || (grupos[t] = { tipo: t, nombre: nombreTipo(t), resta: sg < 0, n: 0, neto: 0, exento: 0, iva: 0, total: 0, retencion: 0, docs: [] });
      g.n++; g.neto += fila.neto; g.exento += fila.exento; g.iva += fila.iva; g.total += fila.total; g.retencion += fila.retencion; g.docs.push(fila);
    });
    var lista = Object.keys(grupos).map(function (k) { return grupos[k]; }).sort(function (a, b) { return a.tipo - b.tipo; });
    var tot = lista.reduce(function (s, g) { s.n += g.n; s.neto += g.neto; s.exento += g.exento; s.iva += g.iva; s.total += g.total; s.retencion += g.retencion; return s; },
      { n: 0, neto: 0, exento: 0, iva: 0, total: 0, retencion: 0 });
    return { grupos: lista, aparte: aparte, totales: tot };
  }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  function clasificarError(e) { return noInstalada(e) ? 'no_disponible' : (e && (e.code === '42501' || e.status === 401 || e.status === 403) ? 'sin_permiso' : 'error'); }

  // ── Acceso a datos (solo supabase.js: sbFetch con el JWT del usuario) ──────────────────────────
  function rpc(nombre, cuerpo, f) {
    f = f || (typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null);
    if (!f) return Promise.reject({ status: 0, code: 'SIN_CLIENTE' });
    return f('rpc/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (x) { /* */ }
        if (!res.ok) throw { status: res.status, code: j && j.code, message: j && j.message };
        return j;
      });
    });
  }
  var cacheRes = {}, cacheDoc = {};
  function leerResumen(cid, per, f) {
    var k = cid + '|' + per;
    if (!cacheRes[k]) cacheRes[k] = rpc('sii_preiva_periodo', { p_cliente_id: Number(cid), p_periodo: String(per) }, f)
      .then(function (j) { return { estado: 'ok', r: resumir(j) }; }, function (e) { delete cacheRes[k]; return { estado: clasificarError(e) }; });
    return cacheRes[k];
  }
  function leerDocumentos(cid, per, libro, f) {
    var k = cid + '|' + per + '|' + libro;
    if (!cacheDoc[k]) cacheDoc[k] = rpc('sii_documentos_periodo', { p_cliente_id: Number(cid), p_periodo: String(per), p_libro: libro }, f)
      .then(function (j) { return { estado: 'ok', d: j || {} }; }, function (e) { var s = clasificarError(e); if (s !== 'no_disponible') delete cacheDoc[k]; return { estado: s }; });
    return cacheDoc[k];
  }

  // ── Pantalla ───────────────────────────────────────────────────────────────────────────────────
  var doc = raiz.document;
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  // Lupa (no está en gIcon; mismo trazo que los íconos de línea de Gestoor)
  var LUPA = '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
  var CHEV = '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  function icono(n, color) { var i = el('i', 'ic dsii-ic ' + (color || '')); i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function estilos() {
    if (doc.getElementById('docs-sii-css')) return;
    var s = el('style'); s.id = 'docs-sii-css';
    s.textContent = [
      '.dsii-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px;margin-bottom:10px}',
      '.dsii-card{border:1px solid #4A2B50;border-radius:14px;background:rgba(42,20,48,.72);padding:12px 14px;color:#F3E9F4;display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.dsii-hd{display:flex;align-items:center;gap:8px}.dsii-hd b{flex:1;font:800 13px var(--g-titulo,Montserrat,sans-serif);letter-spacing:.2px}',
      '.dsii-ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;flex:0 0 28px;font-style:normal}.dsii-ic .g-ic{width:16px;height:16px}',
      '.dsii-cel{color:#5CC8FF;background:rgba(92,200,255,.16)}.dsii-ver{color:#46D69A;background:rgba(70,214,154,.16)}.dsii-ama{color:#FFC85A;background:rgba(255,200,90,.16)}',
      '.dsii-mor{color:#E39BE5;background:rgba(227,155,229,.16)}.dsii-roj{color:#FF8A7A;background:rgba(255,138,122,.16)}',
      '.dsii-n{font-size:11px;color:#C9A8CC}',
      '.dsii-fila{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:2px 0;border-bottom:1px solid rgba(74,43,80,.6);font-variant-numeric:tabular-nums}',
      '.dsii-fila:last-of-type{border-bottom:0}.dsii-fila span:first-child{color:#C9A8CC}.dsii-fila.tot{font-weight:700}.dsii-fila.tot span:first-child{color:#F3E9F4}',
      '.dsii-pie{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}',
      '.dsii-al{font-size:10.5px;color:#C9A8CC}',
      '.dsii-lupa{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid #6B4672;background:transparent;color:#F3E9F4;font:600 12px Inter,sans-serif;cursor:pointer}',
      '.dsii-lupa:hover{border-color:#924893;background:rgba(146,72,147,.18)}.dsii-lupa .g-ic{width:14px;height:14px;color:#5CC8FF}',
      '.dsii-aviso{font-size:11.5px;line-height:1.45;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,200,90,.45);background:rgba(255,200,90,.10);color:#FFC85A;margin-bottom:8px}',
      '.dsii-nota{font-size:11px;color:#FFC85A}',
      '.dsii-vacio{display:flex;align-items:center;gap:10px;border:1px solid #4A2B50;border-radius:14px;background:rgba(42,20,48,.5);padding:12px 14px;color:#F3E9F4;font-size:12.5px;margin-bottom:10px}',
      '.dsii-vacio small{display:block;color:#C9A8CC;font-size:11.5px;margin-top:2px}',
      '.libros-manual[data-modo="pendiente"],.libros-manual[data-modo="respaldo"]:not(.abierto) .libros-grid{display:none}',
      '.dsii-resp{display:inline-flex;align-items:center;gap:6px;text-align:left;background:none;border:0;color:#C9A8CC;font:600 11px Inter,sans-serif;cursor:pointer;padding:4px 0;margin-bottom:6px}',
      '.dsii-resp .g-ic{width:13px;height:13px}.dsii-resp:hover{color:#F3E9F4}',
      // Modal de detalle
      '.dsii-velo{position:fixed;inset:0;z-index:400;background:rgba(12,7,14,.78);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.dsii-modal{width:860px;max-width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:#1E1222;color:#F2EAF4;border:1px solid #3A2140;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.dsii-mhd{display:flex;align-items:flex-start;gap:10px;padding:16px 18px;border-bottom:1px solid #3A2140}.dsii-mhd .t{flex:1;min-width:0}',
      '.dsii-mhd h4{margin:0;font:800 16px var(--g-titulo,Montserrat,sans-serif)}.dsii-mhd small{display:block;color:#C9A8CC;font-size:12px;margin-top:2px;overflow-wrap:anywhere}',
      '.dsii-x{border:1px solid #6B4672;background:transparent;color:#F3E9F4;border-radius:999px;min-height:34px;padding:0 14px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '.dsii-mbd{padding:14px 18px 18px;overflow:auto}',
      '.dsii-tabla{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.dsii-tabla th{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC;font-weight:700;text-align:right;padding:6px 8px;border-bottom:1px solid #3A2140;white-space:nowrap}',
      '.dsii-tabla th:first-child,.dsii-tabla td:first-child{text-align:left}',
      '.dsii-tabla td{text-align:right;padding:6px 8px;border-bottom:1px solid rgba(58,33,64,.7);white-space:nowrap}',
      '.dsii-tabla tr.tipo td{font-weight:700;background:rgba(42,20,48,.6)}.dsii-tabla tr.tipo td:first-child{white-space:normal}',
      '.dsii-tabla tr.resta td{color:#FF8A7A}.dsii-tabla tr.total td{font-weight:800;border-top:1px solid #6B4672;border-bottom:0}',
      '.dsii-tabla tr.doc td{color:#E9DCEB;font-weight:400}.dsii-tabla tr.doc.resta td{color:#FF8A7A}.dsii-tabla tr.doc td.rs{white-space:normal;min-width:160px;color:#C9A8CC;text-align:left}',
      '.dsii-tabla tr.msg td{text-align:left;color:#C9A8CC;font-style:italic;white-space:normal}',
      '.dsii-abre{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0;text-align:left}',
      '.dsii-abre .g-ic{width:13px;height:13px;color:#5CC8FF;flex:0 0 13px}.dsii-abre[aria-expanded="true"] .g-ic{transform:rotate(90deg)}',
      '.dsii-scroll{overflow-x:auto;margin:0 -4px;padding:0 4px}',
      '.dsii-sec{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC;margin:16px 0 6px}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  var abiertoRespaldo = {};   // cid → el usuario desplegó la carga manual (sobrevive a renderTabla)
  function manualDe(slot) { var p = slot.parentNode; return p ? p.querySelector('.libros-manual[data-cid="' + slot.getAttribute('data-cid') + '"]') : null; }
  function modoManual(slot, modo) {
    var m = manualDe(slot); if (!m) return;
    m.setAttribute('data-modo', modo);
    var b = m.querySelector('.dsii-resp');
    if (modo !== 'respaldo') { if (b) b.remove(); m.classList.remove('abierto'); return; }
    var cid = slot.getAttribute('data-cid');
    if (abiertoRespaldo[cid]) m.classList.add('abierto');
    if (!b) {
      b = el('button', 'dsii-resp'); b.type = 'button';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation(); abiertoRespaldo[cid] = !abiertoRespaldo[cid]; m.classList.toggle('abierto', !!abiertoRespaldo[cid]); textoResp(b, !!abiertoRespaldo[cid]);
      });
      m.insertBefore(b, m.firstChild);
    }
    textoResp(b, !!abiertoRespaldo[cid]);
  }
  function textoResp(b, abierto) {
    b.innerHTML = raiz.gIcon ? raiz.gIcon(abierto ? 'menos' : 'mas') : '';
    b.appendChild(doc.createTextNode(abierto ? 'Ocultar carga manual de libros' : 'Carga manual de libros (respaldo: el Pre-IVA de esta pantalla aún la pide)'));
  }

  function fila(card, l, v, cls) { var f = el('div', 'dsii-fila' + (cls ? ' ' + cls : '')); f.appendChild(el('span', null, l)); f.appendChild(el('span', null, v)); card.appendChild(f); }
  function tarjeta(titulo, ic, color, n, datosAl, alLupa) {
    var c = el('div', 'dsii-card'), hd = el('div', 'dsii-hd');
    hd.appendChild(icono(ic, color)); hd.appendChild(el('b', null, titulo)); hd.appendChild(el('span', 'dsii-n', n === 1 ? '1 documento' : (n || 0).toLocaleString('es-CL') + ' documentos'));
    c.appendChild(hd);
    c._pie = function () {
      var p = el('div', 'dsii-pie'); p.appendChild(el('span', 'dsii-al', datosAl ? 'Datos del SII al ' + datosAl : 'Datos del SII'));
      var b = el('button', 'dsii-lupa'); b.type = 'button'; b.title = 'Ver el detalle por tipo de documento';
      b.innerHTML = LUPA; b.appendChild(doc.createTextNode('Ver detalle'));
      b.addEventListener('click', function (ev) { ev.stopPropagation(); alLupa(); });
      p.appendChild(b); c.appendChild(p);
    };
    return c;
  }
  function vacio(slot, ic, color, titulo, sub) {
    var v = el('div', 'dsii-vacio'); v.appendChild(icono(ic, color));
    var t = el('div'); t.appendChild(el('b', null, titulo)); if (sub) t.appendChild(el('small', null, sub)); v.appendChild(t); slot.appendChild(v);
  }

  function pintar(slot, x, op) {
    slot.textContent = '';
    if (x.estado !== 'ok') {
      vacio(slot, 'alerta', 'dsii-ama', x.estado === 'sin_permiso' ? 'No tienes acceso a los datos del SII de esta empresa.' : 'No se pudieron leer los datos del SII.',
        'Puedes seguir con la carga manual de libros.');
      modoManual(slot, 'visible'); return;
    }
    var r = x.r;
    if (!r.conectado) {
      vacio(slot, 'edificio', 'dsii-mor', 'Esta empresa aún no está conectada al SII.', 'Cuando se conecte, aquí aparecerá el resumen automático de compras, ventas y honorarios.');
      modoManual(slot, 'visible'); return;
    }
    if (!r.hayDatos) {
      vacio(slot, 'reloj', 'dsii-cel', 'Cartapra aún no trae datos del SII para ' + mesTxt(op.periodo) + '.',
        r.estadoConexion === 'clave_rechazada' ? 'El SII rechazó la clave guardada en Cartapra: hay que reconectar la empresa.' : 'La lectura del SII corre a diario. Mientras tanto, usa la carga manual.');
      modoManual(slot, 'visible'); return;
    }
    if (r.estadoConexion === 'clave_rechazada') slot.appendChild(el('div', 'dsii-aviso', 'El SII rechazó la clave guardada en Cartapra: estos datos pueden no estar al día hasta reconectar la empresa.'));
    if (r.incompleto) slot.appendChild(el('div', 'dsii-aviso', 'El SII aún no entrega completo este mes en Cartapra: los montos pueden cambiar.'));
    var g = el('div', 'dsii-grid'), al = r.datosAlTxt;
    var base = { clienteId: op.clienteId, periodo: op.periodo, nombre: op.nombre, datosAl: al, f: op.sbFetch };
    // Compras
    var cc = r.compras, t1 = tarjeta('Compras', 'factura', 'dsii-cel', cc ? cc.documentos : 0, al, function () { abrirDetalle(Object.assign({ libro: 'compra', resumen: r }, base)); });
    if (cc) {
      fila(t1, 'Neto', pesos(cc.neto)); if (cc.exento) fila(t1, 'Exento', pesos(cc.exento));
      fila(t1, 'IVA crédito', pesos(cc.iva)); fila(t1, 'Total', pesos(cc.total), 'tot');
      cc.otros.forEach(function (o) { t1.appendChild(el('div', 'dsii-nota', o.documentos + ' ' + o.etiqueta.toLowerCase() + (o.documentos === 1 ? '' : 's') + ' en el SII: no suman crédito')); });
    } else t1.appendChild(el('div', 'dsii-n', 'Sin datos de compras para este mes.'));
    t1._pie(); g.appendChild(t1);
    // Ventas
    var vv = r.ventas, t2 = tarjeta('Ventas', 'grafico', 'dsii-ver', vv ? vv.documentos : 0, al, function () { abrirDetalle(Object.assign({ libro: 'venta', resumen: r }, base)); });
    if (vv) { fila(t2, 'Neto', pesos(vv.neto)); if (vv.exento) fila(t2, 'Exento', pesos(vv.exento)); fila(t2, 'IVA débito', pesos(vv.iva)); fila(t2, 'Total', pesos(vv.total), 'tot'); }
    else t2.appendChild(el('div', 'dsii-n', 'Sin datos de ventas para este mes.'));
    t2._pie(); g.appendChild(t2);
    // Honorarios recibidos
    var hh = r.honorarios, t3 = tarjeta('Honorarios recibidos', 'maletin', 'dsii-ama', hh ? hh.documentos : 0, al, function () { abrirDetalle(Object.assign({ libro: 'honorarios', resumen: r }, base)); });
    if (hh) {
      fila(t3, 'Bruto', pesos(hh.bruto)); fila(t3, 'Retención', pesos(hh.retencion)); fila(t3, 'Líquido', pesos(hh.liquido), 'tot');
      if (hh.emitidas > 0) t3.appendChild(el('div', 'dsii-n', hh.emitidas + (hh.emitidas === 1 ? ' boleta emitida' : ' boletas emitidas') + ' por la empresa (no entran aquí).'));
    } else t3.appendChild(el('div', 'dsii-n', 'Sin datos de honorarios para este mes.'));
    t3._pie(); g.appendChild(t3);
    slot.appendChild(g);
    modoManual(slot, 'respaldo');
  }

  var seqMontar = 0;
  function montar(slot, op) {
    if (!slot || !op || !(Number(op.clienteId) > 0) || !op.periodo) return Promise.resolve();
    estilos();
    var n = ++seqMontar; slot.setAttribute('data-seq', String(n));
    if (!slot.firstChild) vacio(slot, 'reloj', 'dsii-cel', 'Consultando los datos del SII…');
    return leerResumen(op.clienteId, op.periodo, op.sbFetch).then(function (x) {
      if (slot.getAttribute('data-seq') !== String(n) || !slot.isConnected) return;
      pintar(slot, x, op);
    });
  }

  // ── Modal «Ver detalle» ───────────────────────────────────────────────────────────────────────
  var velo = null, alTecla = null;
  function cerrar() { if (velo) { velo.remove(); velo = null; } if (alTecla) { doc.removeEventListener('keydown', alTecla); alTecla = null; } }
  function celdas(tr, vals, primeraEl) {
    vals.forEach(function (v, i) { var td = el('td'); if (i === 0 && primeraEl) td.appendChild(primeraEl); else td.textContent = v; tr.appendChild(td); });
    return tr;
  }
  function abrirDetalle(op) {
    estilos(); cerrar();
    var titulo = op.libro === 'compra' ? 'Compras' : op.libro === 'venta' ? 'Ventas' : 'Honorarios recibidos';
    velo = el('div', 'dsii-velo'); velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
    var m = el('div', 'dsii-modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', titulo + ' — detalle del SII');
    var hd = el('div', 'dsii-mhd'), t = el('div', 't');
    t.appendChild(el('h4', null, titulo + ' · ' + mesTxt(op.periodo)));
    t.appendChild(el('small', null, (op.nombre ? op.nombre + ' · ' : '') + (op.datosAl ? 'Datos del SII al ' + op.datosAl : 'Datos del SII')));
    var x = el('button', 'dsii-x', 'Cerrar'); x.type = 'button'; x.addEventListener('click', cerrar);
    hd.appendChild(icono(op.libro === 'compra' ? 'factura' : op.libro === 'venta' ? 'grafico' : 'maletin', op.libro === 'compra' ? 'dsii-cel' : op.libro === 'venta' ? 'dsii-ver' : 'dsii-ama'));
    hd.appendChild(t); hd.appendChild(x); m.appendChild(hd);
    var bd = el('div', 'dsii-mbd'); bd.appendChild(el('div', 'dsii-n', 'Cargando el detalle…')); m.appendChild(bd);
    velo.appendChild(m); doc.body.appendChild(velo);
    alTecla = function (e) { if (e.key === 'Escape') cerrar(); }; doc.addEventListener('keydown', alTecla);
    x.focus();
    var mio = velo;
    return leerDocumentos(op.clienteId, op.periodo, op.libro, op.f).then(function (res) { if (velo === mio) pintarDetalle(bd, op, res); });
  }

  function pintarDetalle(bd, op, res) {
    bd.textContent = '';
    var hon = op.libro === 'honorarios', r = op.resumen || {};
    var conDocs = res.estado === 'ok' && Array.isArray(res.d.documentos);
    var ag = conDocs ? agrupar(res.d.documentos, op.libro) : null;
    var grupos, tot;
    if (ag) { grupos = ag.grupos; tot = ag.totales; }
    else if (hon) { var h = r.honorarios || { documentos: 0, bruto: 0, retencion: 0 }; grupos = [{ tipo: 0, nombre: nombreTipo(0), n: h.documentos, total: h.bruto, retencion: h.retencion, docs: null }]; tot = null; }
    else { var s = op.libro === 'compra' ? r.compras : r.ventas; grupos = s ? s.porTipo : []; tot = s ? { n: s.documentos, neto: s.neto, exento: s.exento, iva: s.iva, total: s.total } : null; }
    var motivo = res.estado === 'no_disponible' ? 'Detalle por documento disponible pronto.'
      : res.estado === 'sin_permiso' ? 'No tienes acceso al detalle por documento de esta empresa.'
      : res.estado !== 'ok' ? 'No se pudo cargar el detalle por documento. Vuelve a abrir la lupa en un momento.' : null;
    if (motivo && res.estado !== 'no_disponible') bd.appendChild(el('div', 'dsii-aviso', motivo));
    if (conDocs && res.d.truncado) bd.appendChild(el('div', 'dsii-aviso', 'Se muestran los primeros ' + res.d.documentos.length.toLocaleString('es-CL') + ' de ' + Number(res.d.total_documentos || 0).toLocaleString('es-CL') + ' documentos.'));
    if (!grupos.length) { bd.appendChild(el('div', 'dsii-n', 'El SII no registra documentos en este mes.')); }
    else {
      var cols = hon ? ['Tipo de documento', 'Cant.', 'Bruto', 'Retención', 'Líquido'] : ['Tipo de documento', 'Cant.', 'Neto', 'Exento', op.libro === 'venta' ? 'IVA débito' : 'IVA crédito', 'Total'];
      var sc = el('div', 'dsii-scroll'), tb = el('table', 'dsii-tabla'), th = el('thead'), trh = el('tr');
      cols.forEach(function (c) { trh.appendChild(el('th', null, c)); }); th.appendChild(trh); tb.appendChild(th);
      var ncol = cols.length;
      grupos.forEach(function (g) {
        var body = el('tbody'), tr = el('tr', 'tipo' + (g.resta ? ' resta' : ''));
        var btn = el('button', 'dsii-abre'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = CHEV;
        btn.appendChild(doc.createTextNode((g.tipo ? g.tipo + ' · ' : '') + g.nombre + (g.resta ? ' (resta)' : '')));
        var vals = hon ? ['', g.n, pesos(g.total), pesos(g.retencion), pesos(g.total - g.retencion)] : ['', g.n, pesos(g.neto), pesos(g.exento), pesos(g.iva), pesos(g.total)];
        celdas(tr, vals, btn); body.appendChild(tr);
        var abierto = false, filas = [];
        btn.addEventListener('click', function () {
          abierto = !abierto; btn.setAttribute('aria-expanded', String(abierto));
          if (!abierto) { filas.forEach(function (f) { f.remove(); }); filas = []; return; }
          var ref = tr.nextSibling;
          function add(f) { body.insertBefore(f, ref); filas.push(f); }
          if (!g.docs) { var mt = el('tr', 'msg'), td = el('td', null, motivo || 'Detalle por documento disponible pronto.'); td.colSpan = ncol; mt.appendChild(td); add(mt); return; }
          var hd2 = el('tr', 'msg'), td2 = el('td', null, 'Folio · fecha · ' + (op.libro === 'venta' ? 'RUT y razón social del receptor' : 'RUT y razón social del emisor')); td2.colSpan = ncol; hd2.appendChild(td2); add(hd2);
          g.docs.forEach(function (d) { add(filaDoc(d, hon)); });
        });
        tb.appendChild(body);
      });
      if (tot) {
        var tf = el('tbody'), trt = el('tr', 'total');
        celdas(trt, hon ? ['Total', tot.n, pesos(tot.total), pesos(tot.retencion), pesos(tot.total - tot.retencion)] : ['Total', tot.n, pesos(tot.neto), pesos(tot.exento), pesos(tot.iva), pesos(tot.total)]);
        tf.appendChild(trt); tb.appendChild(tf);
      }
      sc.appendChild(tb); bd.appendChild(sc);
    }
    // Compras que no suman crédito / boletas anuladas
    var aparte = ag ? ag.aparte : [];
    if (aparte.length) {
      bd.appendChild(el('div', 'dsii-sec', hon ? 'Boletas anuladas (no suman)' : 'En el SII pero sin sumar crédito (pendientes, reclamadas o no incluir)'));
      var sc2 = el('div', 'dsii-scroll'), tb2 = el('table', 'dsii-tabla'), b2 = el('tbody');
      aparte.forEach(function (d) { b2.appendChild(filaDoc(d, hon, true)); }); tb2.appendChild(b2); sc2.appendChild(tb2); bd.appendChild(sc2);
    } else if (!ag && op.libro === 'compra' && r.compras && r.compras.otros.length) {
      bd.appendChild(el('div', 'dsii-sec', 'En el SII pero sin sumar crédito'));
      r.compras.otros.forEach(function (o) { bd.appendChild(el('div', 'dsii-n', o.etiqueta + ': ' + o.documentos + ' documento' + (o.documentos === 1 ? '' : 's') + ' · IVA ' + pesos(o.iva) + ' · total ' + pesos(o.total))); });
    }
    if (!conDocs && res.estado === 'no_disponible') bd.appendChild(el('div', 'dsii-n', 'Detalle por documento disponible pronto: por ahora se muestra el desglose por tipo que entrega el SII.'));
  }
  function filaDoc(d, hon, conEstado) {
    var tr = el('tr', 'doc' + (d.resta ? ' resta' : ''));
    var primero = 'Folio ' + d.folio + ' · ' + fechaCorta(d.fecha) + (conEstado ? ' · ' + (d.tipo ? d.tipo + ' ' : '') + (d.etiqueta || '') : '');
    var td0 = el('td', null, primero); tr.appendChild(td0);
    var rs = el('td', 'rs', (d.rut || 'RUT no informado') + (d.razonSocial ? ' · ' + d.razonSocial : '')); rs.colSpan = 1;
    if (hon) { tr.appendChild(rs); [pesos(d.total), pesos(d.retencion), pesos(d.total - d.retencion)].forEach(function (v) { tr.appendChild(el('td', null, v)); }); }
    else { tr.appendChild(rs); [pesos(d.neto), pesos(d.exento), pesos(d.iva), pesos(d.total)].forEach(function (v) { tr.appendChild(el('td', null, v)); }); }
    return tr;
  }

  var api = { resumir: resumir, agrupar: agrupar, porTipo: porTipo, pesos: pesos, fechaChile: fechaChile, clasificarError: clasificarError,
    leerResumen: leerResumen, leerDocumentos: leerDocumentos, montar: montar, abrirDetalle: abrirDetalle, cerrar: cerrar, TIPOS: TIPOS,
    _limpiarCache: function () { cacheRes = {}; cacheDoc = {}; abiertoRespaldo = {}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.ContableDocsSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
