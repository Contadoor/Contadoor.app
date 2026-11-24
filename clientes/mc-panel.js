/* ============================================================
   clientes/mc-panel.js — «Accesos MiContadoor»: vista de TODA la cartera (MICONTADOOR-APERTURA, 24-11-2026)
   Botón en la barra del módulo Clientes → panel con tres pestañas:
     · Clientes  → RPC public.mc_accesos_panel(): resumen + un renglón por cliente (con / sin acceso, invitados sin activar,
                   términos pendientes). Clic en un renglón → ficha del cliente (verDetalle), donde se invita, de a una persona.
     · Soporte   → RPC public.mc_soporte_listar(p_estado) · public.mc_soporte_actualizar(p_id, p_estado, p_nota, p_es_incidente, p_severidad)
                   · public.mc_incidente_registrar(p_cliente_id, p_titulo, p_detalle, p_severidad) (solo Master).
     · Términos  → RPC public.mc_terminos_estado() (solo lectura).
   NO hay envíos masivos: este panel no invita ni escribe a clientes. Invitar = ficha del cliente, de a uno (mc-accesos.js).
   Quién lo ve: lo decide el SERVIDOR con public.mc_yo() → puede_dar_alta === true. Fail-closed: error o respuesta rara → sin botón.
   Si una RPC aún no existe en el servidor (HTTP 404 / PGRST202) → «Aún no instalado en el servidor», sin romper la pantalla.
   Usa el adaptador de mc-accesos.js (sbFetch de ../supabase.js con el JWT; solo RPC mc_*). Todo texto pasa por esc().
   Pruebas: node --test pruebas/mc_panel.test.mjs (dobles; datos ficticios).
   ============================================================ */
(function (raiz, fabrica) {
  var A = (typeof module === 'object' && module && module.exports) ? require('./mc-accesos.js') : (raiz && raiz.MCAccesos && raiz.MCAccesos._lib);
  var M = fabrica(A);
  if (typeof module === 'object' && module && module.exports) module.exports = M;
  if (raiz && raiz.document) raiz.MCPanel = M.navegador(raiz);
})(typeof window !== 'undefined' ? window : this, function (A) {
  'use strict';
  var esc = A.esc, fFechaHora = A.fFechaHora;

  var FILTROS = { todos: 'Todos', con: 'Con acceso', sin: 'Sin acceso', invitados: 'Invitados sin activar', terminos: 'Términos pendientes' };
  var ESTADOS_SOP = { abierta: 'Abierta', en_curso: 'En curso', cerrada: 'Cerrada' };
  var TIPOS_SOP = { consulta: 'Consulta', acceso: 'Problema de acceso', datos: 'Dato incorrecto', seguridad: 'Seguridad', otro: 'Otro', incidente: 'Incidente' };
  var SEVERIDADES = { baja: 'Baja', media: 'Media', alta: 'Alta' };
  var NO_INSTALADO = 'Aún no instalado en el servidor. Se activa cuando se instale el paquete MICONTADOOR-APERTURA.';

  function n(x) { var v = Number(x); return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0; }
  function codigoError(e) {
    if (!e) return 'MC_ERROR';
    if (e.status === 404 || e.codigo === 'PGRST202') return 'NO_INSTALADO';
    return e.codigo || 'MC_ERROR';
  }
  function mensaje(c) { return c === 'NO_INSTALADO' ? NO_INSTALADO : A.mensajeError(c); }
  function normTxt(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\-\s]/g, ''); }

  /* Filtro de la tabla de clientes. */
  function filtrar(clientes, filtro, texto) {
    var t = normTxt(texto);
    return (Array.isArray(clientes) ? clientes : []).filter(function (c) {
      if (!c || typeof c !== 'object') return false;
      var vig = n(c.vigentes);
      if (filtro === 'con' && !(vig > 0)) return false;
      if (filtro === 'sin' && vig > 0) return false;
      if (filtro === 'invitados' && !(n(c.invitados) > 0)) return false;
      if (filtro === 'terminos' && !(n(c.terminos_pendientes) > 0)) return false;
      if (t && normTxt(c.razon_social).indexOf(t) < 0 && normTxt(c.rut).indexOf(t) < 0) return false;
      return true;
    });
  }

  function validarActualizacion(d) {
    d = d || {}; var e = {};
    if (!Number.isSafeInteger(Number(d.id)) || Number(d.id) <= 0) e.id = 'Solicitud inválida.';
    if (!ESTADOS_SOP[d.estado]) e.estado = 'Elige un estado.';
    var nota = typeof d.nota === 'string' ? d.nota.trim() : '';
    if (nota.length < 3 || nota.length > 1000) e.nota = 'Escribe una nota de 3 a 1000 letras (queda en el registro).';
    if (typeof d.es_incidente !== 'boolean') e.es_incidente = 'Indica si es un incidente.';
    if (d.severidad != null && !SEVERIDADES[d.severidad]) e.severidad = 'Severidad inválida.';
    if (d.es_incidente === true && !SEVERIDADES[d.severidad]) e.severidad = 'Un incidente necesita severidad.';
    return { ok: !Object.keys(e).length, errores: e };
  }
  function validarIncidente(d) {
    d = d || {}; var e = {};
    var tit = typeof d.titulo === 'string' ? d.titulo.trim() : '', det = typeof d.detalle === 'string' ? d.detalle.trim() : '';
    if (d.cliente_id != null && !(Number.isSafeInteger(Number(d.cliente_id)) && Number(d.cliente_id) > 0)) e.cliente_id = 'Cliente inválido.';
    if (tit.length < 3 || tit.length > 120) e.titulo = 'Título de 3 a 120 letras.';
    if (det.length < 10 || det.length > 2000) e.detalle = 'Detalle de 10 a 2000 letras: qué pasó, a quién afecta, qué se hizo.';
    if (!SEVERIDADES[d.severidad]) e.severidad = 'Elige la severidad.';
    return { ok: !Object.keys(e).length, errores: e };
  }

  /* ── Controlador (sin DOM) ── */
  function crearControlador(deps) {
    var api = deps.api, ocupado = false;
    function puede() {
      return api.rpc('mc_yo').then(function (yo) {
        return { visible: !!yo && yo.puede_dar_alta === true, es_master: !!yo && yo.es_master === true };
      }, function () { return { visible: false, es_master: false }; });
    }
    function leerRpc(fn, args, valida) {
      return api.rpc(fn, args).then(function (r) {
        if (!r || r.ok !== true || (valida && !valida(r))) return { ok: false, codigo: 'MC_ERROR', mensaje: mensaje('MC_ERROR') };
        return { ok: true, datos: r };
      }, function (e) { var c = codigoError(e); return { ok: false, codigo: c, mensaje: mensaje(c), ocultar: c === 'MC_SIN_PERMISO' || c === 'NO_SESSION' }; });
    }
    function escribir(fn, args) {
      if (ocupado) return Promise.resolve({ ok: false, codigo: 'OCUPADO', mensaje: 'Hay otra acción en curso. Espera a que termine.' });
      ocupado = true;
      return leerRpc(fn, args).then(function (r) { ocupado = false; return r; });
    }
    return {
      puede: puede,
      panel: function () { return leerRpc('mc_accesos_panel', {}, function (r) { return Array.isArray(r.clientes) && r.resumen && typeof r.resumen === 'object'; }); },
      soporte: function (estado) {
        return leerRpc('mc_soporte_listar', { p_estado: ESTADOS_SOP[estado] ? estado : null }, function (r) { return Array.isArray(r.solicitudes); });
      },
      terminos: function () { return leerRpc('mc_terminos_estado', {}, function (r) { return Array.isArray(r.versiones); }); },
      actualizar: function (d) {
        var v = validarActualizacion(d);
        if (!v.ok) return Promise.resolve({ ok: false, codigo: 'VALIDACION', errores: v.errores, mensaje: 'Revisa los campos marcados.' });
        return escribir('mc_soporte_actualizar', { p_id: Number(d.id), p_estado: d.estado, p_nota: d.nota.trim(), p_es_incidente: d.es_incidente,
          p_severidad: SEVERIDADES[d.severidad] ? d.severidad : null });
      },
      incidente: function (d) {
        var v = validarIncidente(d);
        if (!v.ok) return Promise.resolve({ ok: false, codigo: 'VALIDACION', errores: v.errores, mensaje: 'Revisa los campos marcados.' });
        return escribir('mc_incidente_registrar', { p_cliente_id: d.cliente_id == null ? null : Number(d.cliente_id), p_titulo: d.titulo.trim(),
          p_detalle: d.detalle.trim(), p_severidad: d.severidad });
      }
    };
  }

  /* ── Vista (texto HTML; todo lo dinámico con esc) ── */
  var PROPIOS = { cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>' };
  function ic(nombre, clase, icono) { return '<i class="ic ' + (clase || '') + '">' + (icono ? icono(nombre) : '') + '</i>'; }

  function renderResumen(r, icono) {
    r = r || {};
    var t = [['clientes', 'ic-mor', 'Clientes activos', r.clientes_activos], ['check', 'ic-ver', 'Con acceso', r.con_acceso], ['alerta', 'ic-amb', 'Sin acceso', r.sin_acceso],
      ['llave', 'ic-cel', 'Cuentas activas', r.cuentas_activas], ['correo', 'ic-cel', 'Invitadas sin activar', r.cuentas_invitadas], ['chat', 'ic-ama', 'Solicitudes abiertas', r.solicitudes_abiertas]];
    return '<div class="mcp-kpis">' + t.map(function (x) {
      return '<div class="mcp-kpi">' + ic(x[0], x[1], icono) + '<b>' + n(x[3]) + '</b><span>' + esc(x[2]) + '</span></div>';
    }).join('') + '</div>';
  }
  function renderClientes(est, icono) {
    est = est || {};
    var lista = filtrar(est.clientes, est.filtro || 'todos', est.texto || '');
    var h = '<div class="mcp-filtros" role="group" aria-label="Filtrar clientes">' + Object.keys(FILTROS).map(function (k) {
      return '<button type="button" class="mcp-chip' + ((est.filtro || 'todos') === k ? ' on' : '') + '" data-mcp-filtro="' + k + '" aria-pressed="' + ((est.filtro || 'todos') === k) + '">' + esc(FILTROS[k]) + '</button>';
    }).join('') + '</div>';
    h += '<label class="mcp-buscar">' + ic('buscar', 'ic-cel', icono) + '<input type="search" id="mcpBuscar" placeholder="Buscar por razón social o RUT" autocomplete="off" value="' + esc(est.texto || '') + '" aria-label="Buscar cliente"></label>';
    if (!lista.length) return h + '<p class="mcp-vacio">Ningún cliente coincide con el filtro.</p>';
    h += '<div class="mcp-tabla" role="table" aria-label="Clientes y accesos a MiContadoor"><div class="mcp-tr mcp-th" role="row"><span role="columnheader">Cliente</span><span role="columnheader">Accesos</span><span role="columnheader">Términos</span><span role="columnheader">Último ingreso</span></div>';
    h += lista.map(function (c) {
      var vig = n(c.vigentes), inv = n(c.invitados), act = n(c.activos), sus = n(c.suspendidos), tp = n(c.terminos_pendientes);
      var acc = vig === 0 ? '<span class="mcp-est mcp-sin">Sin acceso</span>'
        : '<span class="mcp-est mcp-con">' + act + (act === 1 ? ' activo' : ' activos') + '</span>' + (inv ? '<span class="mcp-est mcp-inv">' + inv + (inv === 1 ? ' invitado' : ' invitados') + '</span>' : '')
          + (sus ? '<span class="mcp-est mcp-sus">' + sus + (sus === 1 ? ' suspendido' : ' suspendidos') + '</span>' : '');
      var ter = vig === 0 ? '—' : tp ? '<span class="mcp-est mcp-inv">' + tp + ' pendiente' + (tp === 1 ? '' : 's') + '</span>' : '<span class="mcp-ok">' + ic('check', 'ic-ver', icono) + 'Al día</span>';
      var ult = fFechaHora(c.ultimo_ingreso_at);
      return '<button type="button" class="mcp-tr" role="row" data-mcp-cliente="' + esc(n(c.cliente_id)) + '"><span role="cell" class="mcp-cli"><b>' + esc(c.razon_social || 'Sin razón social') + '</b><small>' + esc(c.rut || '') + (c.estado_cliente && c.estado_cliente !== 'activo' ? ' · ' + esc(c.estado_cliente) : '') + '</small></span>'
        + '<span role="cell" class="mcp-acc">' + acc + '</span><span role="cell">' + ter + '</span><span role="cell" class="mcp-ult">' + (ult ? esc(ult) : (vig ? 'Aún no ingresa' : '—')) + '</span></button>';
    }).join('') + '</div>';
    return h + '<p class="mcp-pie">' + ic('info', 'ic-cel', icono) + '<span>Para invitar, abre la ficha del cliente: se invita de a una persona y con motivo. Este panel no envía correos.</span></p>';
  }
  function renderSoporte(est, icono) {
    est = est || {};
    var h = '<div class="mcp-filtros" role="group" aria-label="Filtrar solicitudes">' + [['', 'Pendientes'], ['abierta', 'Abiertas'], ['en_curso', 'En curso'], ['cerrada', 'Cerradas']].map(function (x) {
      return '<button type="button" class="mcp-chip' + ((est.estadoSop || '') === x[0] ? ' on' : '') + '" data-mcp-sop="' + x[0] + '">' + esc(x[1]) + '</button>';
    }).join('') + (est.es_master ? '<button type="button" class="mcp-btn mcp-prim" data-mcp-accion="incidente">' + ic('alerta', '', icono) + 'Registrar incidente</button>' : '') + '</div>';
    var sol = Array.isArray(est.solicitudes) ? est.solicitudes : [];
    if (!sol.length) return h + '<p class="mcp-vacio">No hay solicitudes en esta vista.</p>';
    return h + '<div class="mcp-sols">' + sol.map(function (s, i) {
      if (!s || typeof s !== 'object') return '';
      var notas = Array.isArray(s.notas) ? s.notas : [];
      return '<article class="mcp-sol mcp-sol-' + esc(ESTADOS_SOP[s.estado] ? s.estado : 'x') + '"><div class="mcp-sol-cab"><b>' + esc(s.folio || '—') + '</b>'
        + '<span class="mcp-est">' + esc(ESTADOS_SOP[s.estado] || 'Estado desconocido') + '</span><span class="mcp-tipo">' + esc(TIPOS_SOP[s.tipo] || s.tipo || '') + '</span>'
        + (s.es_incidente === true ? '<span class="mcp-est mcp-inc">' + ic('alerta', 'ic-roj', icono) + 'Incidente' + (SEVERIDADES[s.severidad] ? ' · ' + esc(SEVERIDADES[s.severidad]) : '') + '</span>' : '') + '</div>'
        + '<div class="mcp-sol-meta">' + esc(s.razon_social || (s.origen === 'equipo' ? 'General (registrado por el equipo)' : 'Sin empresa')) + (s.correo ? ' · ' + esc(s.correo) : '')
        + (fFechaHora(s.creada_at) ? ' · ' + esc(fFechaHora(s.creada_at)) : '') + '</div>'
        + '<p class="mcp-sol-msg">' + esc(s.mensaje || '') + '</p>'
        + (notas.length ? '<ul class="mcp-notas">' + notas.map(function (x) {
          return '<li><small>' + esc(fFechaHora(x && x.at) || '') + (x && x.por ? ' · ' + esc(x.por) : '') + (x && ESTADOS_SOP[x.estado] ? ' · ' + esc(ESTADOS_SOP[x.estado]) : '') + '</small>' + esc((x && x.nota) || '') + '</li>';
        }).join('') + '</ul>' : '')
        + '<div class="mcp-sol-acc"><button type="button" class="mcp-btn" data-mcp-accion="actualizar" data-mcp-i="' + i + '">' + ic('lapiz', 'ic-ama', icono) + 'Actualizar</button></div></article>';
    }).join('') + '</div>';
  }
  function renderTerminos(t, icono) {
    t = t || {};
    var v = t.vigente || null, vs = Array.isArray(t.versiones) ? t.versiones : [];
    var h = v ? '<div class="mcp-vig">' + ic('check', 'ic-ver', icono) + '<div><b>Versión vigente: ' + esc(v.version || '—') + '</b><small>Publicada ' + esc(fFechaHora(v.publicada_at) || '—')
      + ' · huella ' + esc(String(v.sha256 || '').slice(0, 12)) + '…</small></div></div>' : '<p class="mcp-vacio mcp-err">No hay una versión vigente: los clientes no pueden aceptar términos. Avisa al Master.</p>';
    h += '<div class="mcp-tabla mcp-tabla-t" role="table" aria-label="Versiones de términos"><div class="mcp-tr mcp-th" role="row"><span role="columnheader">Versión</span><span role="columnheader">Publicada</span><span role="columnheader">Aceptaciones</span><span role="columnheader">Estado</span></div>'
      + vs.map(function (x) {
        return '<div class="mcp-tr" role="row"><span role="cell"><b>' + esc(x.version || '') + '</b><small>' + esc(x.titulo || '') + '</small></span><span role="cell">' + esc(fFechaHora(x.publicada_at) || '—') + '</span><span role="cell">' + n(x.aceptaciones) + '</span><span role="cell">'
          + (x.vigente === true ? '<span class="mcp-est mcp-con">Vigente</span>' : '<span class="mcp-est">Anterior</span>') + '</span></div>';
      }).join('') + '</div>';
    return h + '<p class="mcp-pie">' + ic('info', 'ic-cel', icono) + '<span>El texto aceptado por cada cliente queda guardado y no se puede modificar. Publicar una versión nueva lo hace el Master con un paso aparte (todos deberán aceptarla de nuevo).</span></p>';
  }
  function renderPanel(est, icono) {
    est = est || {};
    var tabs = [['clientes', 'Clientes'], ['soporte', 'Soporte'], ['terminos', 'Términos']];
    var h = '<div class="mcp-cab"><h2 id="mcpTitulo">' + ic('llave', 'ic-cel', icono) + 'Accesos MiContadoor</h2><button type="button" class="mcp-x" data-mcp-accion="cerrar" aria-label="Cerrar">' + ic('cerrar', '', icono) + '</button></div>';
    h += '<div class="mcp-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" class="mcp-tab' + (est.tab === t[0] ? ' on' : '') + '" aria-selected="' + (est.tab === t[0]) + '" data-mcp-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div><div class="mcp-cuerpo">';
    if (est.banner) h += '<div class="mcp-banner mcp-banner-' + esc(est.banner.tipo) + '" role="status">' + esc(est.banner.mensaje) + '</div>';
    if (est.cargando) return h + '<p class="mcp-vacio">Cargando…</p></div>';
    if (est.error) return h + '<p class="mcp-vacio' + (est.errorCodigo === 'NO_INSTALADO' ? '' : ' mcp-err') + '" role="alert">' + esc(est.error) + '</p></div>';
    if (est.tab === 'soporte') h += renderSoporte(est, icono);
    else if (est.tab === 'terminos') h += renderTerminos(est.terminos, icono);
    else h += renderResumen(est.resumen, icono) + renderClientes(est, icono);
    return h + '</div>';
  }

  /* ── Navegador ── */
  function navegador(win) {
    var doc = win.document, ctl = null, est = null, modal = null, velo = null, sub = null;
    function icono(nm) {
      if (PROPIOS[nm]) return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + PROPIOS[nm] + '</svg>';
      if (nm === 'info') return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
      return typeof win.gIcon === 'function' ? win.gIcon(nm) : '';
    }
    function ctrl() {
      if (ctl) return ctl;
      var api = A.crearApiReal({ sbFetch: function (p, o) { return win.sbFetch(p, o); }, sbH: function (x) { return win.sbH(x); }, fetch: function (u, o) { return win.fetch(u, o); }, SB_URL: win.SB_URL });
      ctl = crearControlador({ api: api });
      return ctl;
    }
    function pintar() { if (modal && est) modal.innerHTML = renderPanel(est, icono); }
    function ocultarTodo(msg) {
      cerrar(); var b = doc.getElementById('mcPanelBoton'); if (b) { b.hidden = true; b.innerHTML = ''; }
      if (msg && typeof win.toast === 'function') win.toast(msg);
    }
    function cargarTab() {
      var tab = est.tab; est.cargando = true; est.error = null; est.errorCodigo = null; pintar();
      var p = tab === 'soporte' ? ctrl().soporte(est.estadoSop) : tab === 'terminos' ? ctrl().terminos() : ctrl().panel();
      return p.then(function (r) {
        if (!est || est.tab !== tab) return;
        est.cargando = false;
        if (!r.ok) { if (r.ocultar) return ocultarTodo(r.mensaje); est.error = r.mensaje; est.errorCodigo = r.codigo; return pintar(); }
        if (tab === 'soporte') est.solicitudes = r.datos.solicitudes;
        else if (tab === 'terminos') est.terminos = r.datos;
        else { est.resumen = r.datos.resumen; est.clientes = r.datos.clientes; }
        pintar();
      });
    }
    function abrir() {
      cerrar();
      velo = doc.createElement('div'); velo.className = 'mcp-velo';
      modal = doc.createElement('div'); modal.className = 'mcp-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'mcpTitulo');
      doc.body.appendChild(velo); doc.body.appendChild(modal);
      velo.addEventListener('click', cerrar);
      modal.addEventListener('click', alClic);
      modal.addEventListener('input', function (ev) {
        if (ev.target && ev.target.id === 'mcpBuscar') {
          est.texto = ev.target.value; var pos = ev.target.selectionStart; pintar();
          var i = modal.querySelector('#mcpBuscar'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
        }
      });
      doc.addEventListener('keydown', tecla, true);
      est = { tab: 'clientes', filtro: 'todos', texto: '', estadoSop: '', es_master: est0.es_master };
      return cargarTab();
    }
    function tecla(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (sub) cerrarSub(); else cerrar(); } }
    function cerrar() {
      cerrarSub();
      doc.removeEventListener('keydown', tecla, true);
      if (velo) velo.remove(); if (modal) modal.remove(); velo = null; modal = null;
    }
    function alClic(ev) {
      var t = ev.target.closest ? ev.target : null; if (!t) return;
      var b;
      if ((b = t.closest('[data-mcp-tab]'))) { est.tab = b.getAttribute('data-mcp-tab'); est.banner = null; return cargarTab(); }
      if ((b = t.closest('[data-mcp-filtro]'))) { est.filtro = b.getAttribute('data-mcp-filtro'); return pintar(); }
      if ((b = t.closest('[data-mcp-sop]'))) { est.estadoSop = b.getAttribute('data-mcp-sop'); return cargarTab(); }
      if ((b = t.closest('[data-mcp-cliente]'))) {
        var id = Number(b.getAttribute('data-mcp-cliente')); cerrar();
        if (id > 0 && typeof win.verDetalle === 'function') win.verDetalle(id);
        return;
      }
      if ((b = t.closest('[data-mcp-accion]'))) {
        var k = b.getAttribute('data-mcp-accion');
        if (k === 'cerrar') return cerrar();
        if (k === 'actualizar') return dlgActualizar(est.solicitudes[Number(b.getAttribute('data-mcp-i'))]);
        if (k === 'incidente') return dlgIncidente();
      }
    }
    /* Sub-diálogo (sobre el panel) */
    function cerrarSub() { if (sub) { sub.v.remove(); sub.m.remove(); sub = null; } }
    function dlgSub(titulo, html, alAceptar) {
      cerrarSub();
      var v = doc.createElement('div'); v.className = 'mcp-velo mcp-velo2';
      var m = doc.createElement('div'); m.className = 'mcp-modal mcp-sub'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      m.innerHTML = '<h3>' + esc(titulo) + '</h3>' + html + '<p class="mcp-merr" role="alert"></p><div class="mcp-macc"><button type="button" class="mcp-btn" data-s="no">Cancelar</button><button type="button" class="mcp-btn mcp-prim" data-s="si">Guardar</button></div>';
      doc.body.appendChild(v); doc.body.appendChild(m); sub = { v: v, m: m };
      v.addEventListener('click', cerrarSub);
      m.querySelector('[data-s="no"]').addEventListener('click', cerrarSub);
      var si = m.querySelector('[data-s="si"]');
      si.addEventListener('click', function () {
        if (si.disabled) return;
        m.querySelectorAll('.mcp-cerr').forEach(function (x) { x.textContent = ''; }); m.querySelector('.mcp-merr').textContent = '';
        si.disabled = true;
        alAceptar(m).then(function (r) {
          if (!sub || sub.m !== m) return;
          si.disabled = false;
          if (r.ok) { cerrarSub(); est.banner = { tipo: 'exito', mensaje: r.mensajeOk }; return cargarTab(); }
          if (r.ocultar) return ocultarTodo(r.mensaje);
          m.querySelector('.mcp-merr').textContent = r.mensaje || 'No se pudo guardar.';
          if (r.errores) Object.keys(r.errores).forEach(function (k) { var c = m.querySelector('[data-cerr="' + k + '"]'); if (c) c.textContent = r.errores[k]; });
        });
      });
      var f = m.querySelector('select,textarea,input'); if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* nada */ } }, 30);
    }
    function opciones(obj, sel, vacio) {
      return (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') + Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(obj[k]) + '</option>'; }).join('');
    }
    function campo(id, etiqueta, control) { return '<label class="mcp-campo"><span>' + esc(etiqueta) + '</span>' + control + '<em class="mcp-cerr" data-cerr="' + id + '"></em></label>'; }
    function dlgActualizar(s) {
      if (!s) return;
      dlgSub('Actualizar ' + (s.folio || 'solicitud'),
        campo('estado', 'Estado', '<select id="mcpEst">' + opciones(ESTADOS_SOP, s.estado) + '</select>')
        + campo('nota', 'Nota (queda en el registro; no la ve el cliente)', '<textarea id="mcpNota" rows="3" maxlength="1000" placeholder="Qué se hizo o qué falta"></textarea>')
        + '<label class="mcp-op"><input type="checkbox" id="mcpInc"' + (s.es_incidente === true ? ' checked' : '') + '><span>Es un <b>incidente</b> (afecta la seguridad o los datos de un cliente)</span></label>'
        + campo('severidad', 'Severidad', '<select id="mcpSev">' + opciones(SEVERIDADES, s.severidad, 'Sin severidad') + '</select>'),
        function (m) {
          var sev = m.querySelector('#mcpSev').value;
          return ctrl().actualizar({ id: s.id, estado: m.querySelector('#mcpEst').value, nota: m.querySelector('#mcpNota').value, es_incidente: m.querySelector('#mcpInc').checked, severidad: sev || null })
            .then(function (r) { r.mensajeOk = 'Solicitud ' + (s.folio || '') + ' actualizada.'; return r; });
        });
    }
    function dlgIncidente() {
      var clientes = Array.isArray(est.clientes) ? est.clientes : [];
      var ops = '<option value="">General (no es de un cliente)</option>' + clientes.map(function (c) { return '<option value="' + n(c.cliente_id) + '">' + esc(c.razon_social || '') + '</option>'; }).join('');
      dlgSub('Registrar incidente',
        '<p class="mcp-intro">Úsalo para todo hecho que pueda afectar la seguridad o los datos de un cliente (acceso indebido, correo equivocado, dato erróneo publicado). Queda en el registro con fecha y tu nombre.</p>'
        + campo('cliente_id', 'Cliente', '<select id="mcpCli">' + ops + '</select>')
        + campo('titulo', 'Título', '<input id="mcpTit" type="text" maxlength="120" autocomplete="off" placeholder="Ej.: invitación enviada a un correo equivocado">')
        + campo('detalle', 'Detalle', '<textarea id="mcpDet" rows="4" maxlength="2000" placeholder="Qué pasó, a quién afecta, qué se hizo y qué falta"></textarea>')
        + campo('severidad', 'Severidad', '<select id="mcpSev">' + opciones(SEVERIDADES, null, 'Elige…') + '</select>'),
        function (m) {
          var cli = m.querySelector('#mcpCli').value;
          return ctrl().incidente({ cliente_id: cli ? Number(cli) : null, titulo: m.querySelector('#mcpTit').value, detalle: m.querySelector('#mcpDet').value, severidad: m.querySelector('#mcpSev').value })
            .then(function (r) { r.mensajeOk = 'Incidente registrado' + (r.datos && r.datos.folio ? ' (' + r.datos.folio + ')' : '') + '.'; return r; });
        });
    }
    var est0 = { es_master: false };
    function iniciar() {
      var cont = doc.getElementById('mcPanelBoton'); if (!cont) return Promise.resolve(false);
      return ctrl().puede().then(function (p) {
        if (!p.visible) { cont.hidden = true; cont.innerHTML = ''; return false; }
        est0.es_master = p.es_master;
        cont.innerHTML = '<button type="button" class="mcp-abrir" id="mcpAbrir">' + ic('llave', 'ic-cel', icono) + 'Accesos MiContadoor</button>';
        cont.hidden = false;
        cont.querySelector('#mcpAbrir').addEventListener('click', abrir);
        return true;
      });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar); else setTimeout(iniciar, 0);
    return { iniciar: iniciar, abrir: abrir, cerrar: cerrar };
  }

  return { FILTROS: FILTROS, ESTADOS_SOP: ESTADOS_SOP, SEVERIDADES: SEVERIDADES, NO_INSTALADO: NO_INSTALADO, filtrar: filtrar, codigoError: codigoError,
    validarActualizacion: validarActualizacion, validarIncidente: validarIncidente, crearControlador: crearControlador,
    renderPanel: renderPanel, renderClientes: renderClientes, renderSoporte: renderSoporte, renderTerminos: renderTerminos, renderResumen: renderResumen, navegador: navegador };
});
