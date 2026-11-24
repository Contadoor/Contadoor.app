/* ============================================================
   clientes/diagnostico.js — pantalla «Tu diagnóstico "Aquí partimos"» (24-11-2026).
   · ?cliente=<id>  → diag_datos_cliente (+ sii_levantamiento_iva si quien mira puede, + sii_historial_anual si está instalada).
   · ?lead=<id>     → diag_datos_prospecto (propuesta / presupuesto para un prospecto en evaluación).
   · ?informe=<id>  → diag_informe: reabre una copia emitida (solo lectura, la misma que se imprimió).
   · Vista previa en vivo (iframe) + ajustes antes de emitir: semáforo, frase del cliente, propuesta en UF, plan, observaciones.
   · «Emitir» guarda la copia inmutable (diag_emitir) y entrega el enlace https; si el cliente viene del Onboarding V2 ofrece
     marcar el paso 9 con ese enlace (onb_paso_marcar_v2, que valida quién puede marcarlo).
   · Datos SOLO por RPC con el JWT (sbFetch de supabase.js). Todo se arma con nodos y textContent (nunca HTML como texto en la pantalla).
   · Demo local: ?demo=1 SOLO en localhost (datos ficticios de pruebas/diagnostico-datos.js; no llama al servidor).
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document, D = raiz.GestoorDiagDoc;
  var MSJ = {
    SIN_PERMISO: 'No tienes permiso para ver el diagnóstico de esta empresa.', SIN_SESION: 'Tu sesión no está lista. Recarga la página.',
    USUARIO_INACTIVO: 'Tu usuario no está activo en Gestoor.', USUARIO_BLOQUEADO: 'Tu usuario está bloqueado.', CLIENTE_NO_EXISTE: 'El cliente no existe.',
    LEAD_NO_EXISTE: 'El prospecto no existe.', DATOS_INVALIDOS: 'El diagnóstico no tiene el formato esperado. Recarga la página.',
    DATOS_MUY_GRANDES: 'El diagnóstico es demasiado grande para guardarlo. Acorta las observaciones.',
    CLAVE_PROHIBIDA: 'Hay algo que parece una clave o contraseña en el texto: bórralo para poder emitir.',
    FALTA_REQUISITO: 'Ese paso del onboarding todavía no se puede marcar (falta un paso anterior).', SIN_PERMISO_PASO: 'El paso 9 lo marca el analista contable a cargo o el Master.',
    VERSION_CONFLICTO: 'Alguien cambió el paso recién. Vuelve a intentarlo.', CASO_CERRADO: 'El onboarding de este cliente ya está cerrado.',
    PASO_YA_LISTO: 'El paso 9 ya estaba listo.', ENLACE_INVALIDO: 'El enlace no es válido.'
  };
  function q(n) { var m = new RegExp('[?&]' + n + '=(\\d{1,12})(?:&|$)').exec(raiz.location.search); return m ? Number(m[1]) : null; }
  function esLocal() { var h = raiz.location.hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'; }
  var DEMO = esLocal() && /(?:^|[?&])demo=1(?:&|$)/.test(raiz.location.search);
  function el(t, c, txt) { var e = doc.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function mensaje(e) {
    var c = (e && (e.codigo || e.mensaje)) || ''; var k = Object.keys(MSJ).filter(function (x) { return c.indexOf(x) === 0 || (e && e.mensaje && e.mensaje.indexOf(x) === 0); })[0];
    return k ? MSJ[k] : 'No se pudo completar (' + (e && e.status ? 'HTTP ' + e.status : 'error') + '). Inténtalo de nuevo.';
  }
  function rpc(nombre, cuerpo) {
    if (DEMO) return demoRpc(nombre, cuerpo);
    if (typeof raiz.sbFetch !== 'function') return Promise.reject({ codigo: 'SIN_SESION' });
    return raiz.sbFetch('rpc/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) }).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (x) { /* */ }
        if (!r.ok) throw { status: r.status, codigo: (j && j.code) || '', mensaje: (j && j.message) || '' };
        return j; });
    });
  }
  function demoRpc(n, b) {
    var w = raiz, r = { diag_datos_cliente: w.DIAG_DEMO_CLIENTE, diag_datos_prospecto: w.DIAG_DEMO_PROSPECTO, sii_levantamiento_iva: w.LIVA_DEMO, sii_historial_anual: w.DIAG_DEMO_HIST,
      diag_emitir: { ok: true, id: 1, version: 1, enlace: 'https://gestoor.contadoor.cl/clientes/diagnostico.html?informe=1' } }[n];
    return r ? Promise.resolve(JSON.parse(JSON.stringify(r))) : Promise.reject({ status: 404, codigo: 'PGRST202' });
  }
  function rango60() { var h = new Date(), f = new Date(h.getFullYear(), h.getMonth() - 1, 1), i = new Date(f.getFullYear(), f.getMonth() - 59, 1);
    var a = function (d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); }; return { desde: a(i), hasta: a(f) }; }
  function logos() { return { logoBlanco: new URL('../assets/contadoor-lockup-white.png', raiz.location.href).href, logoColor: new URL('../assets/contadoor-lockup-glossy.png', raiz.location.href).href }; }

  var S = null;   // { datos, liva, historial, estadoLiva, estadoHist, ajustes, emitido }

  function cargar(app) {
    var cli = q('cliente'), lead = q('lead'), inf = q('informe');
    app.textContent = ''; app.appendChild(el('div', 'dg-aviso', 'Cargando…'));
    if (inf) return rpc('diag_informe', { p_id: inf }).then(function (r) { verInforme(app, r); }, function (e) { error(app, e); });
    if (!cli && !lead) return error(app, { mensaje: 'Abre el diagnóstico desde la ficha del cliente o del prospecto.' });
    var p = cli ? rpc('diag_datos_cliente', { p_cliente_id: cli }) : rpc('diag_datos_prospecto', { p_lead_id: lead });
    return p.then(function (d) {
      S = { datos: d, liva: null, historial: null, estadoLiva: 'sin_datos', estadoHist: 'sin_datos', ajustes: {}, emitido: null };
      if (d.tipo !== 'cliente') return;
      var r = rango60(), tareas = [];
      if (d.actor && d.actor.puede_levantamiento && d.conexion && d.conexion.estado !== 'sin_conexion')
        tareas.push(rpc('sii_levantamiento_iva', { p_cliente_id: cli, p_desde: r.desde, p_hasta: r.hasta, p_opciones: { medio: 'internet' } })
          .then(function (x) { S.liva = x; S.estadoLiva = 'ok'; }, function () { S.estadoLiva = 'error'; }));
      tareas.push(rpc('sii_historial_anual', { p_cliente_id: cli, p_anio: new Date().getFullYear() })
        .then(function (x) { S.historial = x; S.estadoHist = 'ok'; },
              function (e) { S.estadoHist = (e && (e.status === 404 || e.codigo === 'PGRST202')) ? 'no_instalado' : (e && (e.status === 403 || e.codigo === '42501')) ? 'sin_permiso' : 'error'; }));
      return Promise.all(tareas);
    }).then(function () { if (S) { var b = D.propuestaBase(S.datos, D.resumenLiva(S.liva)); S.ajustes.items = b.items; S.ajustes.plan = b.plan; pintar(app); } },
            function (e) { error(app, e); });
  }
  function error(app, e) { app.textContent = ''; app.appendChild(el('div', 'dg-aviso err', e && e.mensaje && !MSJ[e.codigo] && !/^[A-Z_]+$/.test(e.mensaje) ? e.mensaje : mensaje(e))); }
  function modeloActual() { return D.modelo(S.datos, { liva: S.liva, historial: S.historial, estadoLiva: S.estadoLiva, estadoHist: S.estadoHist, ajustes: S.ajustes }); }

  var tPrev = null;
  function previa(frame) { clearTimeout(tPrev); tPrev = setTimeout(function () { frame.srcdoc = D.documento(modeloActual(), logos()); }, 150); }
  function imprimir(frame) { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { /* jsdom */ } }

  function pintar(app) {
    var d = S.datos, cli = d.tipo === 'cliente';
    app.textContent = '';
    var cab = el('div', 'dg-cab'); var h = el('h2', null, D.TITULO);
    h.appendChild(el('span', null, cli ? (d.cliente.razon_social + ' · ' + (d.cliente.rut || '')) : ('Prospecto · ' + (d.prospecto.empresa || d.prospecto.atencion || ''))));
    cab.appendChild(h); app.appendChild(cab);
    if (!cli && d.cliente_id) app.appendChild(el('div', 'dg-aviso', 'Este prospecto ya es cliente: el diagnóstico completo (con el SII) se genera desde su ficha.'));
    if (cli && (!d.conexion || d.conexion.estado === 'sin_conexion')) app.appendChild(el('div', 'dg-aviso', 'La empresa aún no está conectada a Cartapra: las secciones del SII quedan «a confirmar».'));
    if (S.estadoLiva === 'error') app.appendChild(el('div', 'dg-aviso', 'No se pudo calcular el cruce de IVA: esa sección queda «a confirmar».'));
    var g = el('div', 'dg-grid'), izq = el('div', 'dg-panel'), der = el('div', 'dg-prev');
    var frame = el('iframe'); frame.id = 'dg-frame'; frame.title = 'Vista previa del diagnóstico'; der.appendChild(frame);
    g.appendChild(izq); g.appendChild(der); app.appendChild(g);
    var refrescar = function () { previa(frame); };

    // Semáforo
    var m0 = modeloActual(), sem = el('fieldset', 'dg-bloque'); sem.appendChild(el('legend', null, 'Semáforo'));
    m0.secciones[0].areas.forEach(function (a) {
      var l = el('label', 'dg-fila'); l.appendChild(el('span', null, a.titulo));
      var s = el('select'); s.setAttribute('data-area', a.area);
      [['', 'Automático (' + D.ESTADOS[a.estado] + ')'], ['bien', 'Bien'], ['revisar', 'Revisar'], ['urgente', 'Urgente'], ['confirmar', 'A confirmar']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; s.appendChild(op); });
      s.addEventListener('change', function () { S.ajustes.semaforo = S.ajustes.semaforo || {}; if (s.value) S.ajustes.semaforo[a.area] = s.value; else delete S.ajustes.semaforo[a.area]; refrescar(); });
      l.appendChild(s); sem.appendChild(l);
    });
    izq.appendChild(sem);

    // Frase del cliente y observaciones
    var tx = el('fieldset', 'dg-bloque'); tx.appendChild(el('legend', null, 'En palabras del cliente'));
    var cita = el('input'); cita.id = 'dg-cita'; cita.maxLength = 300; cita.placeholder = 'Ej.: «Quiero ordenar mis impuestos.» (opcional)';
    cita.addEventListener('input', function () { S.ajustes.cita = cita.value; refrescar(); }); tx.appendChild(cita);
    var notas = el('textarea'); notas.id = 'dg-notas'; notas.maxLength = 3000; notas.rows = 4; notas.placeholder = 'Observaciones del analista para el cliente (opcional). Sin claves ni contraseñas.';
    notas.addEventListener('input', function () { S.ajustes.notas = notas.value; refrescar(); }); tx.appendChild(notas);
    izq.appendChild(tx);

    // Propuesta (UF)
    var pr = el('fieldset', 'dg-bloque'); pr.appendChild(el('legend', null, 'Propuesta de regularización (UF, exenta de IVA)'));
    var lista = el('div', 'dg-items'); pr.appendChild(lista);
    function filas() {
      lista.textContent = '';
      S.ajustes.items.forEach(function (it, i) {
        var f = el('div', 'dg-item');
        var gl = el('input'); gl.value = it.glosa; gl.maxLength = 120; gl.setAttribute('aria-label', 'Servicio'); gl.addEventListener('input', function () { it.glosa = gl.value; refrescar(); });
        var ca = el('input'); ca.type = 'number'; ca.min = '0'; ca.step = '1'; ca.value = it.cantidad; ca.setAttribute('aria-label', 'Cantidad'); ca.addEventListener('input', function () { it.cantidad = ca.value === '' ? 0 : Number(ca.value); refrescar(); });
        var va = el('input'); va.type = 'number'; va.min = '0'; va.step = '0.01'; va.value = it.valor_uf == null ? '' : it.valor_uf; va.placeholder = 'A definir'; va.setAttribute('aria-label', 'Valor UF');
        va.addEventListener('input', function () { it.valor_uf = va.value === '' ? null : Number(va.value); refrescar(); });
        var lc = el('label', 'dg-chk'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!it.a_confirmar; cb.addEventListener('change', function () { it.a_confirmar = cb.checked; refrescar(); });
        lc.appendChild(cb); lc.appendChild(doc.createTextNode('a confirmar'));
        var x = el('button', 'dg-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Quitar'); x.addEventListener('click', function () { S.ajustes.items.splice(i, 1); filas(); refrescar(); });
        [gl, ca, va, lc, x].forEach(function (n) { f.appendChild(n); }); lista.appendChild(f);
      });
    }
    filas();
    var mas = el('button', 'dg-btn sec', 'Agregar servicio'); mas.type = 'button'; mas.id = 'dg-agregar';
    mas.addEventListener('click', function () { S.ajustes.items.push({ glosa: 'Servicio', cantidad: 1, valor_uf: null, a_confirmar: true }); filas(); refrescar(); });
    pr.appendChild(mas);
    var pl = el('label', 'dg-fila'); pl.appendChild(el('span', null, 'Plan mensual')); var sp = el('select'); sp.id = 'dg-plan';
    var o0 = el('option', null, 'Sin plan'); o0.value = ''; sp.appendChild(o0);
    ((d.catalogo && d.catalogo.planes) || []).forEach(function (p) { var o = el('option', null, p.nombre); o.value = p.codigo; sp.appendChild(o); });
    sp.value = S.ajustes.plan ? S.ajustes.plan.codigo : '';
    var vp = el('input'); vp.type = 'number'; vp.min = '0'; vp.step = '0.01'; vp.id = 'dg-plan-uf'; vp.placeholder = 'UF/mes'; vp.value = S.ajustes.plan && S.ajustes.plan.valor_uf != null ? S.ajustes.plan.valor_uf : '';
    function plan() { S.ajustes.plan = sp.value ? { codigo: sp.value, valor_uf: vp.value === '' ? null : Number(vp.value), valor_trab_uf: S.ajustes.plan && S.ajustes.plan.codigo === sp.value ? S.ajustes.plan.valor_trab_uf : null } : null; refrescar(); }
    sp.addEventListener('change', function () { var p = ((d.catalogo && d.catalogo.planes) || []).filter(function (x) { return x.codigo === sp.value; })[0]; vp.value = p && !p.por_propuesta ? p.precio_uf : ''; plan(); });
    vp.addEventListener('input', plan); pl.appendChild(sp); pl.appendChild(vp); pr.appendChild(pl);
    izq.appendChild(pr);

    // Acciones
    var acc = el('div', 'dg-acc');
    var bP = el('button', 'dg-btn sec', 'Imprimir / Guardar PDF'); bP.type = 'button'; bP.id = 'dg-imprimir'; bP.addEventListener('click', function () { frame.srcdoc = D.documento(modeloActual(), logos()); setTimeout(function () { imprimir(frame); }, 600); });
    acc.appendChild(bP);
    var res = el('div', 'dg-res'); res.id = 'dg-res'; res.setAttribute('role', 'status');
    if (d.actor && d.actor.puede_emitir) {
      var bE = el('button', 'dg-btn', 'Emitir diagnóstico'); bE.type = 'button'; bE.id = 'dg-emitir';
      bE.addEventListener('click', function () { emitir(bE, res); }); acc.appendChild(bE);
    } else acc.appendChild(el('small', null, 'Puedes revisarlo e imprimirlo; lo emite Comercial o el analista contable a cargo.'));
    izq.appendChild(acc); izq.appendChild(res);
    if ((d.anteriores || []).length) {
      var an = el('div', 'dg-anteriores'); an.appendChild(el('b', null, 'Emitidos antes'));
      d.anteriores.forEach(function (x) { var a = el('a', null, 'Versión ' + x.version + ' · ' + String(x.emitido_at || '').slice(0, 10) + (x.estado === 'anulado' ? ' · anulada' : '') + (x.emitido_por ? ' · ' + x.emitido_por : ''));
        a.href = 'diagnostico.html?informe=' + Number(x.id); an.appendChild(a); });
      izq.appendChild(an);
    }
    frame.srcdoc = D.documento(modeloActual(), logos());
  }

  function emitir(btn, res) {
    var d = S.datos, cli = d.tipo === 'cliente', v = ((d.anteriores || []).length || 0) + 1;
    if (typeof raiz.confirm === 'function' && !raiz.confirm('Se guardará una copia que NO se puede editar (versión ' + v + '). ¿Emitir el diagnóstico?')) return;
    btn.disabled = true; res.className = 'dg-res'; res.textContent = 'Guardando…';
    var modelo = modeloActual();
    rpc('diag_emitir', { p_cliente_id: cli ? d.cliente.id : null, p_lead_id: cli ? null : d.prospecto.id, p_datos: modelo }).then(function (r) {
      S.emitido = r; res.textContent = ''; res.className = 'dg-res ok';
      res.appendChild(el('div', null, 'Diagnóstico emitido (versión ' + r.version + ').'));
      var a = el('a', null, r.enlace); a.href = r.enlace; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.id = 'dg-enlace'; res.appendChild(a);
      var c = el('button', 'dg-btn sec', 'Copiar enlace'); c.type = 'button'; c.addEventListener('click', function () { try { raiz.navigator.clipboard.writeText(r.enlace); c.textContent = 'Copiado'; } catch (e) { /* */ } });
      res.appendChild(c);
      var o = d.onboarding;
      if (cli && o && o.lista_version === 2 && !(o.paso9 && o.paso9.estado === 'listo')) {
        var b9 = el('button', 'dg-btn', 'Marcar el paso 9 del onboarding con este enlace'); b9.type = 'button'; b9.id = 'dg-paso9';
        b9.addEventListener('click', function () { marcarPaso9(b9, res, r.enlace); }); res.appendChild(b9);
      }
    }, function (e) { btn.disabled = false; res.className = 'dg-res err'; res.textContent = mensaje(e); });
  }
  function marcarPaso9(btn, res, enlace) {
    btn.disabled = true; var d = S.datos, aviso = el('div', null, 'Marcando…'); res.appendChild(aviso);
    rpc('onb_pasos_cliente', { p_cliente_id: d.cliente.id }).then(function (o) {
      if (!o || !o.caso_id) throw { mensaje: 'Este cliente no tiene un onboarding abierto.' };
      var p9 = (o.pasos || []).filter(function (p) { return Number(p.paso) === 9; })[0];
      return rpc('onb_paso_marcar_v2', { p_caso_id: Number(o.caso_id), p_paso: 9, p_estado: 'listo', p_motivo: null,
        p_version: p9 && p9.marca ? p9.marca.actualizado : null, p_fecha: null, p_enlace: enlace });
    }).then(function () { aviso.textContent = 'Paso 9 del onboarding marcado como listo con el enlace del diagnóstico.'; },
            function (e) { btn.disabled = false; aviso.textContent = e && e.mensaje && !/^[A-Z_]+/.test(e.mensaje) ? e.mensaje : mensaje(e); aviso.className = 'err'; });
  }

  function verInforme(app, r) {
    app.textContent = '';
    var cab = el('div', 'dg-cab'); var h = el('h2', null, D.TITULO);
    h.appendChild(el('span', null, 'Versión ' + r.version + ' · emitida el ' + String(r.emitido_at || '').slice(0, 10) + (r.emitido_por ? ' por ' + r.emitido_por : '')));
    cab.appendChild(h); app.appendChild(cab);
    if (r.estado === 'anulado') app.appendChild(el('div', 'dg-aviso err', 'Este diagnóstico fue ANULADO' + (r.anulacion_motivo ? ': ' + r.anulacion_motivo : '') + '. No lo entregues.'));
    if (r.huella_ok === false) app.appendChild(el('div', 'dg-aviso err', 'La copia no coincide con su huella: avisa al Master.'));
    var frame = el('iframe'); frame.id = 'dg-frame'; frame.title = 'Diagnóstico emitido';
    var acc = el('div', 'dg-acc'); var b = el('button', 'dg-btn sec', 'Imprimir / Guardar PDF'); b.type = 'button'; b.id = 'dg-imprimir';
    b.addEventListener('click', function () { imprimir(frame); }); acc.appendChild(b);
    if (r.tipo === 'cliente' && r.cliente_id) { var a = el('a', 'dg-btn sec', 'Generar una versión nueva'); a.href = 'diagnostico.html?cliente=' + Number(r.cliente_id); acc.appendChild(a); }
    app.appendChild(acc);
    var w = el('div', 'dg-prev solo'); w.appendChild(frame); app.appendChild(w);
    frame.srcdoc = D.documento(r.datos, logos());
  }

  function iniciar() { var app = doc.getElementById('dgApp'); if (app) cargar(app); }
  raiz.GestoorDiag = { iniciar: iniciar, cargar: cargar, rpc: rpc, mensaje: mensaje, estado: function () { return S; }, DEMO: DEMO };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window);
