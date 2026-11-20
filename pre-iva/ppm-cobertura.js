/* ============================================================
   pre-iva/ppm-cobertura.js — PPM: «Tasa usada en el último F29» + «Cobertura de la renta» (pedido de Luciano 19-11). SOLO LECTURA.
   COMPARTIDO por el Pre-IVA (fila del PPM) y la tarjeta «Cálculo del F29» del Reporte Contable (reportes-contable/calculo-f29.js).
   1) Tasa del último F29: la del F29 VIGENTE más reciente ANTERIOR al período, con montos leídos por Cartapra (sii.f29_vigente.tasa_ppm,
      = cód. 115 del formulario; el monto del PPM es el cód. 62 y la base el cód. 563 — verificado en prod el 19-11: 525/526 F29 cuadran).
      Se usa por defecto (manda sobre la tasa del Pre-IVA guardado y la ficha). «Editar PPM» la sigue pudiendo cambiar (con motivo).
      Tasa fuera de rango (≤ 0 o > 10 %) NO se usa: se avisa y se sigue con la de antes (Pre-IVA guardado → historial → ficha).
   2) Cobertura de la renta = PPM pagados en el año comercial (cód. 62 de los F29 del SII de enero al mes anterior; si el mes ya tiene
      F29, también ese) ÷ impuesto proyectado (forecast.idpc de MiRenta, caso 14D3 del AT siguiente). El PPM del mes en cálculo
      (con la edición, si la hay) se muestra APARTE como proyección. Colores: verde ≥ 90 %, amarillo 60–89 %, rojo < 60 %.
      Tasa sugerida (~T %) = faltante ÷ ventas que quedan del año; ventas que quedan = base PPM promedio de los F29 del año
      (o la base del mes, si aún no hay F29) × meses que faltan (incluido el mes en cálculo si no está declarado). Es una estimación simple.
      Sin proyección → «Sin proyección de renta aún» (no se inventa). Sin permiso / RPC no instalada → «disponible pronto».
   Fuentes (RPC existentes, sin SQL nuevo): rpc/sii_renta_resumen (meses del año con F29 vigente) · renta_casos + rpc/renta_e1_proyeccion_vigente.
   Pruebas: node --test pre-iva/ppm-cobertura.test.js
   ============================================================ */
(function (raiz) {
  'use strict';
  function fx() { return raiz.PreIvaF29 || (typeof require === 'function' ? require('./f29-formula.js') : null); }   // perezoso: el orden de los <script> no importa
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var TASA_MAX = 10, VERDE = 90, AMARILLO = 60;
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function per6(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? p : ''; }
  function mesTxt(p) { p = per6(p); return p ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : ''; }
  function mesCorto(p) { p = per6(p); return p ? MESES[+p.slice(4) - 1] : ''; }
  function pesos(v) { var x = Math.round(num(v) || 0); return (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('es-CL'); }
  function tasaTxt(t) { return String(Math.round((num(t) || 0) * 1000) / 1000).replace('.', ','); }

  // ── 1) Tasa del último F29 declarado (antes del período) ─────────────────────────────────────────
  // meses = [{periodo:'AAAAMM', f29:{folio, ppm, base_ppm, tasa_ppm, montos}}] (de sii_renta_resumen; puede juntar 2 años)
  function ultimoF29(meses, periodo) {
    var p = per6(periodo);
    var c = (meses || []).filter(function (m) { return m && m.f29 && m.f29.montos && per6(m.periodo) && (!p || per6(m.periodo) < p); })
      .sort(function (a, b) { return per6(b.periodo) < per6(a.periodo) ? -1 : 1; })[0];
    if (!c) return null;
    var t = num(c.f29.tasa_ppm);
    return { periodo: per6(c.periodo), folio: c.f29.folio || null, tasa: t, ppm: num(c.f29.ppm), base: num(c.f29.base_ppm),
             valida: t !== null && t > 0 && t <= TASA_MAX };
  }
  // «Tasa usada en el último F29: 1,25 % (octubre 2026, según SII)»
  function textoTasa(u) {
    if (!u) return null;
    if (u.valida) return 'Tasa usada en el último F29: ' + tasaTxt(u.tasa) + ' % (' + mesTxt(u.periodo) + ', según SII)';
    if (u.tasa === null || u.tasa === 0) return 'El último F29 (' + mesTxt(u.periodo) + ', según SII) no trae tasa PPM: se usa la del Pre-IVA o la ficha';
    return 'El último F29 (' + mesTxt(u.periodo) + ', según SII) trae una tasa PPM fuera de rango (' + tasaTxt(u.tasa) + ' %): no se usa';
  }
  // Tasa por defecto: la del último F29 del SII (si es válida) → la de siempre (Pre-IVA guardado → historial → ficha).
  function tasaPorDefecto(u, fila, hist, fichaTasa) {
    if (u && u.valida) return { tasa: u.tasa, fuente: 'sii', periodo: u.periodo };
    var F = fx(); return F ? F.tasaPPMDesdeGuardado(fila || null, hist || [], fichaTasa) : { tasa: 0, fuente: null, periodo: null };
  }

  // ── 2) Cobertura de la renta ──────────────────────────────────────────────────────────────────────
  // o: { meses, periodo, ppmMes (PPM del mes en cálculo, con edición), baseMes (base PPM del mes),
  //      siiEstado ('ok'|'sin_conexion'|…), renta: {estado:'ok'|'sin_proyeccion'|'sin_permiso'|'no_disponible'|'error', idpc, proyEstado, corte} }
  function colorDe(pct) { return pct >= VERDE ? 'verde' : pct >= AMARILLO ? 'amarillo' : 'rojo'; }
  function cobertura(o) {
    o = o || {};
    var p = per6(o.periodo), anio = p ? p.slice(0, 4) : '', mes = p ? +p.slice(4) : 0, R = o.renta || {};
    var out = { anio: anio, periodo: p, estado: null, pagados: 0, mesesPagados: [], sinMontos: 0, mesDeclarado: false, ppmMes: 0,
                idpc: null, pct: null, pctConMes: null, color: null, faltante: null, tasaSugerida: null, baseProm: null, mesesRestantes: null };
    if (!p) { out.estado = 'sin_periodo'; return out; }
    var bases = [];
    (o.meses || []).forEach(function (m) {
      var mp = per6(m && m.periodo); if (!mp || mp.slice(0, 4) !== anio || mp > p || !m.f29) return;
      if (!m.f29.montos) { if (mp < p) out.sinMontos++; return; }
      out.pagados += Math.max(0, num(m.f29.ppm) || 0); out.mesesPagados.push(mp);
      if (num(m.f29.base_ppm) > 0) bases.push(num(m.f29.base_ppm));
      if (mp === p) out.mesDeclarado = true;
    });
    out.mesesPagados.sort();
    out.ppmMes = out.mesDeclarado ? 0 : Math.max(0, num(o.ppmMes) || 0);
    // Sin F29 del SII legibles no se calcula (sumar $0 daría un porcentaje falso)
    if (o.siiEstado && o.siiEstado !== 'ok') { out.estado = o.siiEstado === 'sin_conexion' ? 'sin_conexion' : o.siiEstado === 'sin_permiso' ? 'sin_permiso' : 'no_disponible'; return out; }
    if (R.estado !== 'ok') { out.estado = R.estado || 'no_disponible'; return out; }
    var idpc = num(R.idpc);
    if (idpc === null) { out.estado = 'sin_proyeccion'; return out; }
    out.idpc = idpc; out.proyEstado = R.proyEstado || null; out.corte = R.corte || null;
    if (!(idpc > 0)) { out.estado = 'sin_impuesto'; return out; }
    out.estado = 'ok';
    out.pct = Math.round(out.pagados / idpc * 100);
    out.pctConMes = Math.round((out.pagados + out.ppmMes) / idpc * 100);
    out.color = colorDe(out.pagados / idpc * 100);
    out.faltante = Math.max(0, idpc - out.pagados);
    out.mesesRestantes = Math.max(0, 12 - mes + (out.mesDeclarado ? 0 : 1));
    out.baseProm = bases.length ? Math.round(bases.reduce(function (a, b) { return a + b; }, 0) / bases.length) : (num(o.baseMes) > 0 ? Math.round(num(o.baseMes)) : null);
    var ventasRest = out.baseProm && out.mesesRestantes ? out.baseProm * out.mesesRestantes : 0;
    if (out.faltante > 0 && ventasRest > 0) out.tasaSugerida = Math.round(out.faltante / ventasRest * 10000) / 100;
    return out;
  }
  // Textos de la línea (todo se pinta con textContent)
  function textos(c) {
    if (!c) return null;
    var t = { linea: null, sub: [], sugerencia: null, color: c.color || 'gris' };
    var hasta = c.mesesPagados.length ? 'F29 de ' + mesCorto(c.mesesPagados[0]) + ' a ' + mesCorto(c.mesesPagados[c.mesesPagados.length - 1]) + ' según SII' : 'aún sin F29 del año en el SII';
    if (c.estado === 'sin_proyeccion' || c.estado === 'sin_caso') { t.linea = 'Cobertura de la renta: sin proyección de renta aún'; t.sub.push('PPM pagados en ' + c.anio + ': ' + pesos(c.pagados) + ' (' + hasta + ')'); return t; }
    if (c.estado === 'sin_impuesto') { t.linea = 'Cobertura de la renta: el impuesto proyectado en MiRenta es ' + pesos(c.idpc); t.sub.push('PPM pagados en ' + c.anio + ': ' + pesos(c.pagados) + ' (' + hasta + '). Sin impuesto proyectado, no hay porcentaje que calcular.'); return t; }
    if (c.estado === 'sin_conexion') { t.linea = 'Cobertura de la renta: la empresa aún no está conectada al SII'; t.sub.push('Se calcula con los F29 que trae Cartapra.'); return t; }
    if (c.estado !== 'ok') { t.linea = 'Cobertura de la renta: disponible pronto'; t.sub.push(c.estado === 'sin_permiso' ? 'La proyección de renta la ve el Master y el analista contable asignado.' : 'No se pudo leer la proyección de renta o los F29 del año.'); return t; }
    t.linea = '🎯 PPM pagados en ' + c.anio + ': ' + pesos(c.pagados) + ' → cubren el ' + c.pct + ' % del impuesto proyectado (' + pesos(c.idpc) + ')';
    t.sub.push(hasta + ' · impuesto: proyección de renta de MiRenta' + (c.proyEstado === 'DESACTUALIZADA' ? ' (desactualizada: hay datos nuevos)' : ''));
    if (c.ppmMes > 0) t.sub.push('Con el PPM de ' + mesCorto(c.periodo) + ' (' + pesos(c.ppmMes) + ', proyección): ' + c.pctConMes + ' %');
    if (c.sinMontos > 0) t.sub.push(c.sinMontos + ' F29 del año aún sin montos en Cartapra: no se suman');
    if (c.color !== 'verde') {
      t.sugerencia = c.tasaSugerida != null
        ? 'Para llegar al 100 % la tasa debería ser ~' + tasaTxt(c.tasaSugerida) + ' % (faltan ' + pesos(c.faltante) + '; supone ventas de ' + pesos(c.baseProm) + ' al mes por ' + c.mesesRestantes + ' mes' + (c.mesesRestantes === 1 ? '' : 'es') + ', el promedio del año)'
        : 'Faltan ' + pesos(c.faltante) + ' para cubrir el impuesto proyectado' + (c.mesesRestantes === 0 ? ' y ya no quedan meses del año: revisa un PPM voluntario.' : '.');
    }
    return t;
  }

  // ── Datos (solo lectura con el JWT del usuario) ──────────────────────────────────────────────────
  function leerJson(r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
      if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
      return j;
    });
  }
  function estadoError(e) { return !e ? 'error' : (e.status === 404 || e.code === 'PGRST202' || e.code === '42883') ? 'no_disponible' : (e.code === '42501' || e.status === 401 || e.status === 403) ? 'sin_permiso' : 'error'; }
  function resumen(f, cliId, at) {
    return f('rpc/sii_renta_resumen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_cliente_id: Number(cliId), p_anio_tributario: Number(at) }) }).then(leerJson);
  }
  function puedeVerRenta() {
    var u = {}; try { u = JSON.parse((raiz.sessionStorage && raiz.sessionStorage.getItem('usuario_activo')) || '{}'); } catch (e) { /* */ }
    return !!(u.esMaster || u.rol === 'contable' || u.rol === 'master');   // la RLS de MiRenta devuelve vacío a otros roles: no es «sin proyección»
  }
  function leerRenta(f, cliId, anio) {
    if (!puedeVerRenta()) return Promise.resolve({ estado: 'sin_permiso' });
    return f('renta_casos?cliente_id=eq.' + encodeURIComponent(cliId) + '&anio_comercial=eq.' + encodeURIComponent(anio) + '&regimen=eq.14D3&estado=neq.RECTIFIED&select=id,anio_comercial,anio_tributario,estado&order=id.desc&limit=1')
      .then(leerJson).then(function (cs) {
        var caso = (cs || [])[0]; if (!caso) return { estado: 'sin_proyeccion', motivo: 'sin_caso' };
        return f('rpc/renta_e1_proyeccion_vigente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_caso_id: caso.id }) }).then(leerJson).then(function (vg) {
          vg = vg || {};
          if (!vg.estado || vg.estado === 'SIN_PROYECCION') return { estado: 'sin_proyeccion' };
          var o = (vg.outputs || []).filter(function (x) { return x && x.output_key === 'forecast.idpc'; })[0];
          var idpc = o && o.estado_dato !== 'PENDING' && o.estado_dato !== 'PARAM_UNAVAILABLE' ? num(o.monto) : null;
          return idpc === null ? { estado: 'sin_proyeccion' } : { estado: 'ok', idpc: idpc, proyEstado: vg.estado, corte: vg.corrida && vg.corrida.cutoff_date || null, casoId: caso.id };
        });
      }).catch(function (e) { return { estado: estadoError(e) }; });
  }
  var cache = {};
  // → { sii: {estado, meses}, renta: {estado, idpc, …}, ultimo }   (el AT del año comercial del período; en enero también el anterior para la tasa)
  function leer(cliId, periodo, sbFetchFn) {
    var f = sbFetchFn || (typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null), p = per6(periodo);
    if (!f || !(Number(cliId) > 0) || !p) return Promise.resolve({ sii: { estado: 'no_disponible', meses: [] }, renta: { estado: 'no_disponible' }, ultimo: null });
    var k = cliId + '|' + p;
    if (cache[k]) return cache[k];
    var anio = +p.slice(0, 4), lecturas = [resumen(f, cliId, anio + 1)];
    if (p.slice(4) === '01') lecturas.push(resumen(f, cliId, anio));
    var sii = Promise.all(lecturas).then(function (rs) {
      var meses = []; rs.forEach(function (r) { (r && r.meses || []).forEach(function (m) { meses.push(m); }); });
      var con = rs[0] && rs[0].conexion && rs[0].conexion.estado;
      return { estado: con === 'sin_conexion' ? 'sin_conexion' : 'ok', meses: meses };
    }, function (e) { return { estado: estadoError(e), meses: [] }; });
    cache[k] = Promise.all([sii, leerRenta(f, cliId, anio)]).then(function (x) {
      var r = { sii: x[0], renta: x[1], ultimo: ultimoF29(x[0].meses, p) };
      if (x[0].estado === 'error' || x[1].estado === 'error') delete cache[k];   // reintenta la próxima vez
      return r;
    });
    return cache[k];
  }

  // ── Pantalla (oscuro Gestoor, sin animaciones, íconos gIcon en <i class="ic">) ─────────────────────
  function estilos(doc) {
    if (!doc || doc.getElementById('ppm-cob-css')) return;
    var s = doc.createElement('style'); s.id = 'ppm-cob-css';
    s.textContent = [
      '.ppmc{display:flex;gap:10px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border-radius:12px;border:1px solid #4A2B50;background:rgba(42,20,48,.6);color:#F3E9F4;font-size:12px;line-height:1.45}',
      '.ppmc .ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;font-style:normal}',
      '.ppmc .ic .g-ic{width:15px;height:15px}',
      '.ppmc-t{flex:1;min-width:0}.ppmc-l{display:block;font-weight:700;overflow-wrap:anywhere}',
      '.ppmc-s{display:block;color:#C9A8CC;font-size:11px;margin-top:2px;overflow-wrap:anywhere}',
      '.ppmc-g{display:block;font-size:11.5px;font-weight:600;margin-top:4px;overflow-wrap:anywhere}',
      '.ppmc.verde{border-color:rgba(70,214,154,.5)}.ppmc.verde .ic{color:#46D69A;background:rgba(70,214,154,.16)}.ppmc.verde .ppmc-l{color:#46D69A}',
      '.ppmc.amarillo{border-color:rgba(255,200,90,.55)}.ppmc.amarillo .ic{color:#FFC85A;background:rgba(255,200,90,.16)}.ppmc.amarillo .ppmc-l,.ppmc.amarillo .ppmc-g{color:#FFC85A}',
      '.ppmc.rojo{border-color:rgba(255,122,110,.6)}.ppmc.rojo .ic{color:#FF8A7E;background:rgba(255,122,110,.16)}.ppmc.rojo .ppmc-l,.ppmc.rojo .ppmc-g{color:#FF8A7E}',
      '.ppmc.gris .ic{color:#C9A8CC;background:rgba(201,168,204,.14)}',
      '.ppm-tasa-sii{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:#5CC8FF;font-weight:600;overflow-wrap:anywhere}',
      '.ppm-tasa-sii .ic{display:inline-flex;width:14px;height:14px;font-style:normal}.ppm-tasa-sii .ic .g-ic{width:13px;height:13px}',
      '.ppm-tasa-sii.av{color:#FFC85A}',
      '.ppm-tasa-sii[hidden],.ppmc-slot[hidden]{display:none}'
    ].join('\n');
    doc.head.appendChild(s);
  }
  function icono(doc, n) { var i = doc.createElement('i'); i.className = 'ic'; i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function span(doc, cls, txt) { var e = doc.createElement('span'); e.className = cls; e.textContent = txt; return e; }
  // Línea «Tasa usada en el último F29…» dentro de un contenedor (vacío si no hay F29 en el SII)
  function pintarTasa(cont, u) {
    if (!cont) return; var doc = cont.ownerDocument; estilos(doc); cont.textContent = '';
    var t = textoTasa(u); cont.hidden = !t; if (!t) return;
    cont.className = 'ppm-tasa-sii' + (u.valida ? '' : ' av');
    cont.appendChild(icono(doc, u.valida ? 'check' : 'alerta')); cont.appendChild(span(doc, 'ppmc-x', t));
  }
  function pintarCobertura(cont, c) {
    if (!cont) return; var doc = cont.ownerDocument; estilos(doc); cont.textContent = '';
    var t = textos(c); cont.hidden = !t; if (!t) return;
    var box = doc.createElement('div'); box.className = 'ppmc ' + t.color;
    box.appendChild(icono(doc, 'objetivo'));
    var tx = doc.createElement('div'); tx.className = 'ppmc-t';
    tx.appendChild(span(doc, 'ppmc-l', t.linea));
    t.sub.forEach(function (s) { tx.appendChild(span(doc, 'ppmc-s', s)); });
    if (t.sugerencia) tx.appendChild(span(doc, 'ppmc-g', t.sugerencia));
    box.appendChild(tx); cont.appendChild(box);
  }

  var api = { ultimoF29: ultimoF29, textoTasa: textoTasa, tasaPorDefecto: tasaPorDefecto, cobertura: cobertura, textos: textos, colorDe: colorDe,
              leer: leer, pintarTasa: pintarTasa, pintarCobertura: pintarCobertura, _limpiarCache: function () { cache = {}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaPPMCobertura = api;
})(typeof window !== 'undefined' ? window : globalThis);
