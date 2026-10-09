// MiRenta · Apertura tributaria (E0C-B). Pantalla mínima: Documento → Propuesta del sistema → Revisión humana → Declaración → Verificación Master.
// Usa solo la sesión del usuario (window._sbAuthClient) y el backend E0C-A/E0B.2: renta_fuente_registrar, Edge mirenta-f22-leer,
// renta_apertura_declarar (6 args), renta_apertura_verificar, renta_apertura_vigente. La base es la autoridad; aquí no hay
// service_role, ni rutas de storage visibles, ni datos ingresados a mano de RUT/AT/sha/parser.
(function () {
  'use strict';
  var L = window.AperturaLogica;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var S = { sb: null, yo: null, casos: [], clientes: {}, caso: null, fuentes: [], lecturas: [], vigente: null, usuarios: {},
            filas: null, lecturaEdit: null, abierta: {}, motivo: '', motivoVerif: '', ocupado: null, aviso: null, tecnico: false, editarNueva: false, reemplazar: false };

  // ── acceso a datos (solo sesión del usuario) ──────────────────────────────
  function rpc(fn, args) {
    return S.sb.rpc(fn, args).then(function (r) { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; });
  }
  function tabla(q) { return q.then(function (r) { if (r.error) throw new Error(r.error.message); return r.data || []; }); }

  function cargarInicio() {
    return rpc('renta_yo', {}).then(function (y) {
      S.yo = Array.isArray(y) ? y[0] : y;
      if (!S.yo || !S.yo.id) throw new Error('Tu usuario no tiene acceso a MiRenta.');
      return tabla(S.sb.from('renta_casos').select('id, cliente_id, anio_comercial, anio_tributario, regimen, estado, version').neq('estado', 'RECTIFIED').order('id', { ascending: false }));
    }).then(function (casos) {
      S.casos = casos;
      var ids = casos.map(function (c) { return c.cliente_id; });
      if (!ids.length) return [];
      return tabla(S.sb.from('clientes').select('id, razon_social').in('id', ids));
    }).then(function (cls) {
      cls.forEach(function (c) { S.clientes[c.id] = c.razon_social; });
      var q = new URLSearchParams(location.search).get('caso');
      var c = q && S.casos.find(function (x) { return String(x.id) === q; });
      if (c) return elegirCaso(c.id);
      render();
    });
  }

  function elegirCaso(id) {
    S.caso = S.casos.find(function (c) { return c.id === Number(id); }) || null;
    S.filas = null; S.lecturaEdit = null; S.abierta = {}; S.motivo = ''; S.motivoVerif = ''; S.aviso = null; S.editarNueva = false; S.reemplazar = false;
    try { history.replaceState(null, '', S.caso ? '?caso=' + S.caso.id : location.pathname); } catch (e) {}
    if (!S.caso) { render(); return Promise.resolve(); }
    return recargarCaso();
  }

  function recargarCaso() {
    var id = S.caso.id; S.ocupado = 'cargando'; render();
    return Promise.all([
      tabla(S.sb.from('renta_fuentes').select('id, tipo_fuente, origen, nombre_original, estado, sha256_estado, cargado_por, cargado_at').eq('caso_id', id).order('id', { ascending: true })),
      tabla(S.sb.from('renta_f22_lecturas').select('id, fuente_id, estado, parser, parser_version, blocking_count, resultado, resultado_hash, error_codigo, actor, creado_at, finalizado_at').eq('caso_id', id).order('id', { ascending: false })),
      rpc('renta_apertura_vigente', { p_caso_id: id })
    ]).then(function (r) {
      S.fuentes = r[0]; S.lecturas = r[1]; S.vigente = r[2]; S.ocupado = null;
      var lec = lecturaActual();
      if (lec && lec.estado === 'PROPUESTA' && (!S.lecturaEdit || S.lecturaEdit !== lec.id)) {
        S.filas = L.filasDesdePropuesta((lec.resultado || {}).propuesta); S.lecturaEdit = lec.id;
      } else if (!lec || lec.estado !== 'PROPUESTA') { S.filas = null; S.lecturaEdit = null; }
      return cargarNombres();
    }).then(render).catch(function (e) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: 'No se pudo cargar el caso: ' + e.message }; render(); });
  }

  // Nombres de quien declaró / verificó / leyó (si la política no los deja ver, se muestra "usuario #id").
  function cargarNombres() {
    var ids = {}; var w = S.vigente || {};
    [w.effective, w.working].forEach(function (a) { if (a) { if (a.declarado_por) ids[a.declarado_por] = 1; if (a.verificado_por) ids[a.verificado_por] = 1; } });
    S.lecturas.forEach(function (l) { ids[l.actor] = 1; });
    var faltan = Object.keys(ids).filter(function (k) { return !S.usuarios[k]; });
    if (!faltan.length) return Promise.resolve();
    return S.sb.from('usuarios_sistema').select('id, nombre').in('id', faltan).then(function (r) {
      (r.data || []).forEach(function (u) { S.usuarios[u.id] = u.nombre; });
    }, function () {});
  }
  function quien(id) { return id ? esc(S.usuarios[id] || ('usuario #' + id)) : '—'; }

  function f22Actual() { return L.f22Vigente(S.fuentes); }
  function lecturaActual() {
    var f = f22Actual(); if (!f) return null;
    return S.lecturas.find(function (l) { return l.fuente_id === f.id; }) || null;
  }
  function respaldosDisponibles() {
    var f = f22Actual();
    return S.fuentes.filter(function (x) { return x.estado === 'REGISTRADA' && (!f || x.id !== f.id); });
  }

  // ── subir un archivo como fuente del caso (F22 o respaldo) ───────────────
  function sha256(buf) {
    return crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  // reemplazaA: solo para F22 (E0C-B R1). Se toma del F22 vigente en el momento de subir; la base exige que sea exactamente ese.
  function subirFuente(archivo, tipo, reemplazaA) {
    if (!archivo) return Promise.reject(new Error('Elige un archivo.'));
    if (tipo === 'F22_ANTERIOR' && archivo.type !== 'application/pdf') return Promise.reject(new Error('El F22 debe ser el PDF del Compacto descargado del SII.'));
    if (archivo.size > 50 * 1024 * 1024) return Promise.reject(new Error('El archivo supera 50 MB.'));
    var clave = crypto.randomUUID();
    return archivo.arrayBuffer().then(sha256).then(function (sha) {
      var ruta = S.caso.cliente_id + '/' + S.caso.anio_comercial + '/' + clave + '_' + sha;   // formato exigido por la política del bucket
      return S.sb.storage.from('mirenta-fuentes').upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream', upsert: false })
        .then(function (r) { if (r.error) throw new Error('No se pudo subir el archivo (' + r.error.message + ').'); })
        .then(function () {
          return rpc('renta_fuente_registrar', { p_caso_id: S.caso.id, p_clave: clave, p_tipo_fuente: tipo, p_origen: tipo === 'F22_ANTERIOR' ? 'SII' : 'CONTADOOR',
                                                 p_nombre_original: archivo.name, p_sha256: sha, p_reemplaza_a: reemplazaA || null });
        });
    });
  }

  function leerF22(fuenteId) {
    S.ocupado = 'leyendo'; S.aviso = null; render();
    return S.sb.functions.invoke('mirenta-f22-leer', { body: { caso_id: S.caso.id, fuente_id: fuenteId } }).then(function (r) {
      if (r.error) {
        var ctx = r.error.context;
        var p = ctx && typeof ctx.json === 'function' ? ctx.json().catch(function () { return null; }) : Promise.resolve(null);
        return p.then(function (j) {
          var cod = (j && (j.error || j.codigo)) || r.error.message;
          throw new Error(/SIN_ACCESO/.test(cod) ? 'No tienes acceso a este caso.' : /FUENTE_INVALIDA/.test(cod) ? 'El documento no es un F22 válido para este caso.' : 'La lectura no se pudo completar (' + cod + ').');
        });
      }
    }).then(function () { S.ocupado = null; return recargarCaso(); })
      .catch(function (e) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: e.message }; return recargarCaso(); });
  }

  function declarar() {
    var lec = lecturaActual();
    var ev = L.evaluarDeclaracion(lec, S.filas, S.motivo);
    if (!ev.ok) { S.aviso = { tipo: 'ambar', texto: ev.motivos.join(' ') }; render(); return; }
    S.ocupado = 'declarando'; S.aviso = null; render();
    rpc('renta_apertura_declarar', L.payloadDeclarar(S.caso, lec, S.filas, S.motivo)).then(function (r) {
      S.ocupado = null; S.motivo = ''; S.editarNueva = false;
      S.aviso = { tipo: 'verde', texto: 'Apertura declarada (versión ' + r.version + '). Queda en revisión hasta que otra persona Master la verifique.' };
      return recargarCaso();
    }).catch(function (e) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: L.mensajeError(e.message) }; render(); });   // la edición se conserva
  }

  function verificar() {
    var w = S.vigente && S.vigente.working; if (!w) return;
    if (!S.motivoVerif.trim()) { S.aviso = { tipo: 'ambar', texto: 'Escribe el motivo de la verificación.' }; render(); return; }
    S.ocupado = 'verificando'; S.aviso = null; render();
    rpc('renta_apertura_verificar', { p_apertura_id: w.apertura_id, p_motivo: S.motivoVerif.trim() }).then(function () {
      S.ocupado = null; S.motivoVerif = ''; S.aviso = { tipo: 'verde', texto: 'Apertura verificada.' }; return recargarCaso();
    }).catch(function (e) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: L.mensajeError(e.message) }; render(); });
  }

  // ── render ────────────────────────────────────────────────────────────────
  function pill(clase, texto) { return '<span class="estado ' + clase + '">' + esc(texto) + '</span>'; }
  function fecha(t) { if (!t) return '—'; var d = new Date(t); return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short' }); }
  function monto(v) { var m = L.formatoMonto(v); return m ? esc(m) : '<span class="t3">sin monto</span>'; }

  function pasos() {
    var lec = lecturaActual(), w = S.vigente && S.vigente.working, ef = S.vigente && S.vigente.effective;
    var hecho = [!!f22Actual(), !!(lec && lec.estado !== 'EN_PROCESO'), !!(w || ef), !!(w || ef), !!ef && !w];
    var nombres = ['Documento', 'Propuesta del sistema', 'Revisión humana', 'Declaración', 'Verificación Master'];
    var actual = hecho.indexOf(false);
    return '<ol class="mr-pasos">' + nombres.map(function (n, i) {
      return '<li class="' + (hecho[i] ? 'ok' : i === actual ? 'act' : '') + '"><b>' + (i + 1) + '</b>' + esc(n) + '</li>';
    }).join('') + '</ol>';
  }

  function selectorCaso() {
    var ops = '<option value="">Elige un caso…</option>' + S.casos.map(function (c) {
      return '<option value="' + c.id + '"' + (S.caso && S.caso.id === c.id ? ' selected' : '') + '>' + esc((S.clientes[c.cliente_id] || 'Cliente #' + c.cliente_id) + ' · AC ' + c.anio_comercial + ' (AT ' + c.anio_tributario + ') · ' + c.regimen + ' · caso #' + c.id) + '</option>';
    }).join('');
    return '<label class="mr-sel"><span>Caso</span><select data-accion="caso">' + ops + '</select></label>';
  }

  function historialF22() {
    var hist = L.f22Historicos(S.fuentes); if (!hist.length) return '';
    return '<details class="mr-hist"><summary>Versiones anteriores del F22 (' + hist.length + ')</summary><ul>' + hist.map(function (x) {
      return '<li>' + esc(x.nombre_original) + ' <span class="t3">· cargado ' + esc(fecha(x.cargado_at)) + ' · ' + (x.estado === 'REEMPLAZADA' ? 'reemplazado' : 'anulado') + '</span></li>';
    }).join('') + '</ul></details>';
  }

  function tarjetaDocumento() {
    var f = f22Actual(), lec = lecturaActual(), puedeSubir = S.caso && (S.caso.estado === 'DRAFT' || S.caso.estado === 'IN_PROGRESS');
    var h = '<section class="card"><div class="h"><h2>1 · Documento</h2>' + (f ? pill('verde', 'F22 registrado') : pill('gris', 'Sin F22')) + '</div>';
    if (!f) {
      h += '<p class="t2">Sube el <b>F22 Compacto</b> del año tributario ' + (S.caso.anio_tributario - 1) + ' tal como se descarga del SII (PDF). MiRenta lo guarda en el expediente del caso y lo lee.</p>';
      h += puedeSubir ? '<div class="mr-subir"><input type="file" accept="application/pdf" id="mr-f22-archivo"><button class="btn" data-accion="subir-f22"' + (S.ocupado ? ' disabled' : '') + '>' + (S.ocupado === 'subiendo' ? 'Subiendo…' : 'Subir F22 Compacto') + '</button></div>'
                      : '<div class="aviso gris">El caso está en estado ' + esc(S.caso.estado) + ': ya no admite documentos nuevos.</div>';
      return h + historialF22() + '</section>';
    }
    h += '<div class="mr-doc"><div><span class="t3">Archivo</span><b>' + esc(f.nombre_original) + '</b></div><div><span class="t3">Cargado</span>' + esc(fecha(f.cargado_at)) + '</div>';
    if (lec && lec.resultado && lec.resultado.document) {
      var d = lec.resultado.document;
      h += '<div><span class="t3">RUT</span>' + esc(d.rut || '—') + '</div><div><span class="t3">Año tributario</span>' + esc(d.anio_tributario || '—') + '</div><div><span class="t3">Folio</span>' + esc(d.folio || '—') + '</div>';
    }
    h += '</div>';
    h += historialF22();
    if (S.ocupado === 'leyendo') h += '<div class="aviso lila"><span class="mr-spin"></span>Leyendo el F22… (unos segundos)</div>';
    else if (!lec) h += '<div class="mr-acciones"><button class="btn" data-accion="leer" data-fuente="' + f.id + '">Leer F22</button></div>';
    else if (lec.estado === 'EN_PROCESO') h += '<div class="aviso ambar">Hay una lectura iniciada el ' + esc(fecha(lec.creado_at)) + ' que no terminó.</div><div class="mr-acciones"><button class="btn sec" data-accion="leer" data-fuente="' + f.id + '">Leer de nuevo</button></div>';
    else if (lec.estado === 'ERROR') h += '<div class="aviso rojo">La lectura terminó con error (' + esc(lec.error_codigo) + '). Si el PDF es una imagen escaneada, descarga el Compacto directamente desde el SII y súbelo de nuevo.</div><div class="mr-acciones"><button class="btn sec" data-accion="leer" data-fuente="' + f.id + '">Leer de nuevo</button></div>';
    if (puedeSubir && S.ocupado !== 'leyendo') {
      h += S.reemplazar
        ? '<div class="mr-reemplazo"><div class="aviso ambar">Este archivo reemplazará el F22 actualmente utilizado por MiRenta. El anterior y sus lecturas quedan en el historial.</div>' +
          '<div class="mr-subir"><input type="file" accept="application/pdf" id="mr-f22-archivo"><button class="btn" data-accion="subir-f22"' + (S.ocupado ? ' disabled' : '') + '>' + (S.ocupado === 'subiendo' ? 'Subiendo…' : 'Subir y reemplazar') + '</button>' +
          '<button class="btn sec" data-accion="cancelar-reemplazo">Cancelar</button></div></div>'
        : '<div class="mr-acciones"><button class="btn sec chico" data-accion="reemplazar">Reemplazar F22…</button></div>';
    }
    return h + '</section>';
  }

  function bloqueos(lec) {
    var b = (lec.resultado && lec.resultado.blocking_findings) || [];
    var filas = b.map(function (x) {
      var m = /^(.*?)\s*\(código (\d+)\)/.exec(x.mensaje || '');
      return '<tr><td class="mono">' + esc(m ? m[2] : x.codigo) + '</td><td>' + esc(m ? m[1] : x.mensaje) + '</td><td class="num">' + (x.monto != null ? esc(L.formatoMonto(x.monto)) : '—') + '</td><td class="t2">' + esc(m ? 'El modelo de apertura aún no representa este saldo.' : x.codigo) + '</td></tr>';
    }).join('');
    return '<div class="aviso rojo fuerte"><b>Bloqueado.</b> Este F22 contiene saldos que MiRenta todavía no puede representar automáticamente. La apertura no puede declararse todavía.</div>' +
      '<div class="mr-tabla-wrap"><table class="mr-tabla"><thead><tr><th>Código</th><th>Concepto</th><th class="num">Monto</th><th>Motivo</th></tr></thead><tbody>' + filas + '</tbody></table></div>';
  }

  function estadoFila(f) {
    var d = f.decision;
    if (d.tipo === 'F22') return pill('verde', 'Leído desde F22');
    if (d.tipo === 'REVISAR') return pill('ambar', 'Requiere revisión');
    if (d.tipo === 'PENDIENTE') return pill('gris', 'Pendiente');
    if (d.tipo === 'NO_APLICA') return pill('gris', 'No aplica');
    if (d.tipo === 'OTRA') return pill('lila', 'Respaldado por otra evidencia');
    return pill('rojo', 'Falta');
  }

  function filaRevision(f, i) {
    var p = f.prop || {}, d = f.decision, ops = L.opciones(f), errs = L.erroresFila(f, (lecturaActual() || {}).fuente_id);
    var nombresOp = { F22: 'Mantener (leído desde F22)', REVISAR: 'Marcar “requiere revisión”', PENDIENTE: 'Dejar pendiente', NO_APLICA: 'No aplica', OTRA: 'Usar otro valor…' };
    var montoMostrado = d.tipo === 'OTRA' ? d.monto : (d.tipo === 'PENDIENTE' || d.tipo === 'NO_APLICA') ? null : p.monto;
    var h = '<div class="mr-fila' + (errs.length ? ' con-error' : '') + '" data-i="' + i + '">' +
      '<div class="c-concepto"><b>' + esc(f.concepto) + '</b><span class="t3">' + (p.codigo ? 'Código F22 ' + esc(p.codigo) : 'Sin código F22') + '</span></div>' +
      '<div class="c-monto num"><b class="m">' + monto(montoMostrado) + '</b>' + (d.tipo === 'OTRA' && p.monto != null ? '<span class="t3">F22: ' + esc(L.formatoMonto(p.monto)) + '</span>' : '') + '</div>' +
      '<div class="c-estado">' + estadoFila(f) + '<span class="t3">' + esc(d.tipo === 'OTRA' ? (L.NOMBRE_PROC[d.provenance] || 'Procedencia por elegir') : 'Procedencia: F22') + '</span></div>' +
      '<div class="c-accion"><select data-accion="decidir" data-i="' + i + '">' + ops.map(function (o) { return '<option value="' + o + '"' + (o === d.tipo ? ' selected' : '') + '>' + nombresOp[o] + '</option>'; }).join('') + '</select></div>';
    if (p.estado === 'PENDING' && d.tipo !== 'OTRA') h += '<div class="c-full aviso gris">No fue posible determinar este saldo automáticamente desde el F22. Déjalo pendiente con una nota, o resuélvelo con otro respaldo.</div>';
    if (d.tipo === 'OTRA') {
      var resp = respaldosDisponibles();
      var listo = d.provenance && d.evidencia_fuente_id;
      h += '<div class="c-full mr-otra"><div class="aviso ambar">Este valor será distinto al informado por el F22. Debes indicar la evidencia que respalda el nuevo monto.</div><div class="mr-otra-grid">' +
        '<label><span>¿De dónde sale?</span><select data-accion="prov" data-i="' + i + '"><option value="">Elegir…</option>' + L.PROCEDENCIAS_OTRAS.map(function (x) { return '<option value="' + x[0] + '"' + (d.provenance === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label><span>Respaldo</span><select data-accion="evid" data-i="' + i + '"><option value="">Elegir documento…</option>' + resp.map(function (x) { return '<option value="' + x.id + '"' + (d.evidencia_fuente_id === x.id ? ' selected' : '') + '>' + esc(x.nombre_original) + '</option>'; }).join('') + '</select>' +
          '<span class="mr-mini"><input type="file" id="mr-ev-' + i + '"><button class="btn sec chico" data-accion="subir-ev" data-i="' + i + '">Subir respaldo</button></span></label>' +
        '<label><span>Nuevo monto</span><input type="number" min="0" step="1" inputmode="numeric" data-accion="monto" data-i="' + i + '" value="' + esc(d.monto == null ? '' : d.monto) + '"' + (listo ? '' : ' disabled title="Primero elige procedencia y respaldo"') + '></label></div></div>';
    }
    if (d.tipo !== 'F22' || p.nota) h += '<div class="c-full"><input type="text" class="mr-nota" placeholder="' + esc((d.tipo === 'REVISAR' || d.tipo === 'PENDIENTE' || d.tipo === 'NO_APLICA' ? 'Nota (obligatoria)' : 'Nota (opcional)') + (p.nota ? ' · lector: ' + p.nota : '')) + '" data-accion="nota" data-i="' + i + '" value="' + esc(d.nota || '') + '"></div>';
    if (errs.length) h += '<div class="c-full mr-err">' + errs.map(esc).join(' · ') + '</div>';
    return h + '</div>';
  }

  function tarjetaPropuesta() {
    var lec = lecturaActual(); if (!lec || lec.estado === 'EN_PROCESO' || lec.estado === 'ERROR') return '';
    var w = S.vigente && S.vigente.working;
    var r = lec.resultado || {}, warns = r.warnings || [];
    var h = '<section class="card"><div class="h"><h2>2 · Propuesta del sistema</h2>' + (lec.estado === 'BLOQUEADO' ? pill('rojo', 'Bloqueado') : pill('lila', 'Leído desde F22')) + '</div>';
    h += '<p class="t3 mr-meta">Lectura del ' + esc(fecha(lec.finalizado_at)) + ' · lector ' + esc(lec.parser) + ' ' + esc(lec.parser_version) + ' · por ' + quien(lec.actor) + (S.tecnico ? ' · <span class="mono">lectura #' + lec.id + ' · resultado ' + esc(lec.resultado_hash) + '</span>' : '') + '</p>';
    if (warns.length) h += '<div class="aviso ambar">' + warns.map(function (x) { return esc(x.mensaje) + (x.monto != null ? ' (' + esc(L.formatoMonto(x.monto)) + ')' : ''); }).join('<br>') + '</div>';
    if (lec.estado === 'BLOQUEADO') return h + bloqueos(lec) + '</section>';
    if (w && !S.editarNueva) {
      return h + '<p class="t2">La propuesta ya se usó para declarar la versión ' + w.version + ', que está en revisión (arriba). Si hay que corregir algo, prepara una nueva versión.</p>' +
        '<div class="mr-acciones"><button class="btn sec" data-accion="nueva">Preparar nueva versión</button></div></section>';
    }
    h += '<h3 class="mr-sub">3 · Revisión humana</h3><p class="t2">Revisa cada saldo. Lo leído desde el F22 no se edita: si el valor correcto es otro, usa “Usar otro valor…” con su respaldo.</p>';
    h += '<div class="mr-filas"><div class="mr-fila cab"><div>Concepto</div><div class="num">Monto</div><div>Estado</div><div>Decisión</div></div>' + S.filas.map(filaRevision).join('') + '</div>';
    var ev = L.evaluarDeclaracion(lec, S.filas, S.motivo);
    h += '<h3 class="mr-sub">4 · Declaración</h3><label class="mr-campo"><span>Motivo</span><input type="text" data-accion="motivo" value="' + esc(S.motivo) + '" placeholder="Ej.: Apertura desde F22 AT ' + (S.caso.anio_tributario - 1) + '"></label>' +
      '<div class="mr-acciones"><button class="btn" data-accion="declarar"' + (ev.ok && !S.ocupado ? '' : ' disabled') + '>' + (S.ocupado === 'declarando' ? 'Declarando…' : 'Declarar apertura') + '</button>' +
      (S.editarNueva ? '<button class="btn sec" data-accion="cancelar-nueva">Cancelar</button>' : '') + '</div>' +
      (S.aviso && S.aviso.tipo === 'rojo' ? '<div class="aviso rojo">' + esc(S.aviso.texto) + '</div>' : '') +
      '<p class="t3" id="mr-motivos">' + (ev.ok ? 'Lista para declarar. Quedará en revisión hasta la verificación Master.' : esc(ev.motivos.join(' '))) + '</p>';
    return h + '</section>';
  }

  function itemsApertura(a) {
    var porClave = {}; (a.items || []).forEach(function (i) { porClave[i.item_key] = i; });
    return '<div class="mr-tabla-wrap"><table class="mr-tabla"><thead><tr><th>Concepto</th><th>Código F22</th><th class="num">Monto</th><th>Estado</th><th>Procedencia</th><th>Nota</th></tr></thead><tbody>' +
      L.CLAVES.map(function (c) {
        var i = porClave[c[0]] || {};
        var otra = i.estado === 'OK' && i.provenance && i.provenance !== 'DECLARED_F22';
        var cls = otra ? 'lila' : i.estado === 'OK' ? 'verde' : i.estado === 'REVIEW' ? 'ambar' : 'gris';
        var txt = otra ? 'Respaldado por otra evidencia' : (L.NOMBRE_ESTADO[i.estado] || i.estado || '—');
        return '<tr><td>' + esc(c[1]) + '</td><td class="mono">' + esc(i.f22_codigo_ref || '—') + '</td><td class="num">' + monto(i.monto) + '</td><td>' + pill(cls, txt) + '</td><td>' + esc(L.NOMBRE_PROC[i.provenance] || i.provenance || '—') + '</td><td class="t2">' + esc(i.nota || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function auditoria(a) {
    var f = a.fuente_f22 || {};
    return '<p class="t3 mr-meta">F22 usado: ' + esc(f.nombre_original || '—') + ' · AT origen ' + esc(a.anio_tributario_origen) + ' · declaró ' + quien(a.declarado_por) + ' el ' + esc(fecha(a.declarado_at)) +
      (a.verificado_por ? ' · verificó ' + quien(a.verificado_por) + ' el ' + esc(fecha(a.verificado_at)) : '') + (a.motivo ? ' · motivo: ' + esc(a.motivo) : '') +
      (a.huella_ok === false ? ' · <b class="rojo-t">huella alterada</b>' : '') + (S.tecnico ? ' · <span class="mono">apertura #' + a.apertura_id + ' · huella ' + esc(a.huella) + '</span>' : '') + '</p>';
  }

  function tarjetaVersiones() {
    var v = L.vistaVersiones(S.vigente); if (!v.efectiva && !v.enRevision) return '';
    var h = '';
    if (v.efectiva) h += '<section class="card"><div class="h"><h2>Apertura vigente</h2>' + pill('verde', 'Verificado') + '</div><p class="t2">Versión ' + v.efectiva.version + '. Es la que usa MiRenta para el caso.</p>' + itemsApertura(v.efectiva) + auditoria(v.efectiva) + '</section>';
    if (v.enRevision) {
      var w = v.enRevision, ver = L.evaluarVerificacion(S.vigente, S.yo);
      var abiertos = (w.items || []).filter(function (i) { return i.estado === 'PENDING' || i.estado === 'REVIEW'; }).length;
      h += '<section class="card"><div class="h"><h2>' + (v.efectiva ? 'Nueva versión en revisión' : 'Apertura en revisión') + '</h2>' + pill('ambar', 'Declarada · por verificar') + '</div>' +
        '<p class="t2">Versión ' + w.version + '. ' + (abiertos ? 'Tiene ' + abiertos + (abiertos === 1 ? ' saldo pendiente o por revisar' : ' saldos pendientes o por revisar') + ': se resuelven con una nueva versión antes de verificar.' : 'Todos los saldos están resueltos.') +
        (v.efectiva ? ' La apertura vigente no cambia hasta que esta versión se verifique.' : '') + '</p>' + itemsApertura(w) + auditoria(w);
      if (ver.mostrar) {
        h += '<h3 class="mr-sub">5 · Verificación Master</h3>' + (ver.ok ? '' : '<div class="aviso ' + (ver.doble_control ? 'lila' : 'gris') + '">' + esc(ver.motivo) + '</div>') +
          '<label class="mr-campo"><span>Motivo</span><input type="text" data-accion="motivo-verif" value="' + esc(S.motivoVerif) + '"' + (ver.ok ? '' : ' disabled') + '></label>' +
          '<div class="mr-acciones"><button class="btn" data-accion="verificar"' + (ver.ok && !S.ocupado ? '' : ' disabled') + '>' + (S.ocupado === 'verificando' ? 'Verificando…' : 'Verificar apertura') + '</button></div>' +
          (S.aviso && S.aviso.tipo === 'rojo' ? '<div class="aviso rojo">' + esc(S.aviso.texto) + '</div>' : '');
      }
      h += '</section>';
    }
    return h;
  }

  function render() {
    var raiz = $('#mr-app'); if (!raiz) return;
    var h = '<div class="mr-cabecera">' + selectorCaso() + '<label class="mr-tec"><input type="checkbox" data-accion="tecnico"' + (S.tecnico ? ' checked' : '') + '> Modo técnico</label></div>';
    if (S.aviso) h += '<div class="aviso ' + S.aviso.tipo + '" role="status">' + esc(S.aviso.texto) + '</div>';
    if (!S.caso) h += '<section class="card"><div class="h"><h2>Apertura tributaria</h2></div><p class="t2">Elige un caso para revisar su apertura: los saldos iniciales que vienen del F22 del año anterior.</p>' + (S.casos.length ? '' : '<div class="aviso gris">No tienes casos de MiRenta asignados.</div>') + '</section>';
    else if (S.ocupado === 'cargando' && !S.vigente) h += '<section class="card"><div class="aviso lila"><span class="mr-spin"></span>Cargando…</div></section>';
    else {
      var v = L.vistaVersiones(S.vigente);
      h += '<div class="mr-resumen"><b>' + esc(S.clientes[S.caso.cliente_id] || 'Cliente #' + S.caso.cliente_id) + '</b><span>AC ' + S.caso.anio_comercial + ' · AT ' + S.caso.anio_tributario + ' · ' + esc(S.caso.regimen) + ' · caso ' + esc(S.caso.estado) + '</span>' + pill(v.efectiva ? 'verde' : v.enRevision ? 'ambar' : 'gris', v.titulo) + '</div>';
      h += pasos() + tarjetaVersiones() + tarjetaDocumento() + tarjetaPropuesta();
    }
    // conservar el foco (y el cursor) al re-dibujar, para no interrumpir al analista
    var act = document.activeElement, clave = act && act.getAttribute && act.getAttribute('data-accion') ? '[data-accion="' + act.getAttribute('data-accion') + '"]' + (act.hasAttribute('data-i') ? '[data-i="' + act.getAttribute('data-i') + '"]' : '') : null;
    var cur = null; try { cur = act && act.selectionStart; } catch (e) {}
    raiz.innerHTML = h;
    if (clave && raiz.contains(act) === false) { var n = $(clave, raiz); if (n && !n.disabled) { n.focus(); try { if (cur != null) n.setSelectionRange(cur, cur); } catch (e) {} } }
  }

  // Refresca solo el texto de "por qué no se puede declarar" (sin re-render, para no perder el foco al escribir).
  function refrescarMotivos() {
    var lec = lecturaActual(), ev = L.evaluarDeclaracion(lec, S.filas, S.motivo), btn = $('[data-accion="declarar"]'), m = $('#mr-motivos');
    if (btn) btn.disabled = !ev.ok || !!S.ocupado;
    if (m) m.textContent = ev.ok ? 'Lista para declarar. Quedará en revisión hasta la verificación Master.' : ev.motivos.join(' ');
  }

  // Actualiza errores y monto de una fila sin re-dibujarla (el analista puede estar haciendo clic en otro campo).
  function refrescarFila(i) {
    var nodo = $('.mr-fila[data-i="' + i + '"]'); if (!nodo) return;
    var f = S.filas[i], errs = L.erroresFila(f, (lecturaActual() || {}).fuente_id), e = $('.mr-err', nodo);
    nodo.classList.toggle('con-error', errs.length > 0);
    if (errs.length) { if (!e) { e = document.createElement('div'); e.className = 'c-full mr-err'; nodo.appendChild(e); } e.textContent = errs.join(' · '); }
    else if (e) e.remove();
    if (f.decision.tipo === 'OTRA') { var m = $('.c-monto .m', nodo), fm = L.formatoMonto(f.decision.monto); if (m) m.textContent = fm || 'sin monto'; }
    refrescarMotivos();
  }

  function cambiarFila(i, cambios) {
    var f = S.filas[i], d = Object.assign({}, f.decision, cambios);
    var r = L.decidir(f, d);
    if (r.error) { S.aviso = { tipo: 'ambar', texto: r.error }; return; }
    S.filas[i] = r.fila;
  }

  // ── eventos (delegados) ───────────────────────────────────────────────────
  function enlazar() {
    var raiz = $('#mr-app');
    raiz.addEventListener('change', function (e) {
      var t = e.target, a = t.getAttribute('data-accion'), i = Number(t.getAttribute('data-i'));
      if (a === 'caso') return elegirCaso(t.value);
      if (a === 'tecnico') { S.tecnico = t.checked; return render(); }
      if (a === 'decidir') {
        var tipo = t.value, f = S.filas[i];
        var base = tipo === 'OTRA' ? { tipo: 'OTRA', provenance: null, evidencia_fuente_id: null, monto: null, nota: f.decision.nota } : { tipo: tipo, nota: f.decision.nota };
        var r = L.decidir(f, base); if (!r.error) S.filas[i] = r.fila; S.aviso = r.error ? { tipo: 'ambar', texto: r.error } : null; return render();
      }
      if (a === 'prov') { cambiarFila(i, { provenance: t.value || null }); return render(); }
      if (a === 'evid') { cambiarFila(i, { evidencia_fuente_id: t.value ? Number(t.value) : null }); return render(); }
      if (a === 'monto' || a === 'nota') return refrescarFila(i);
    });
    raiz.addEventListener('input', function (e) {
      var t = e.target, a = t.getAttribute('data-accion'), i = Number(t.getAttribute('data-i'));
      if (a === 'nota') cambiarFila(i, { nota: t.value });
      else if (a === 'monto') cambiarFila(i, { monto: t.value === '' ? null : Number(t.value) });
      else if (a === 'motivo') S.motivo = t.value;
      else if (a === 'motivo-verif') { S.motivoVerif = t.value; return; }
      else return;
      refrescarMotivos();
    });
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-accion]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-accion');
      if (a === 'leer') return leerF22(Number(b.getAttribute('data-fuente')));
      if (a === 'declarar') return declarar();
      if (a === 'verificar') return verificar();
      if (a === 'nueva') { var lec = lecturaActual(); S.filas = L.filasDesdePropuesta(lec.resultado.propuesta); S.editarNueva = true; return render(); }
      if (a === 'cancelar-nueva') { S.editarNueva = false; return render(); }
      if (a === 'reemplazar') { S.reemplazar = true; return render(); }
      if (a === 'cancelar-reemplazo') { S.reemplazar = false; return render(); }
      if (a === 'subir-f22') {
        var arch = ($('#mr-f22-archivo').files || [])[0];
        S.ocupado = 'subiendo'; S.aviso = null; render();
        S.reemplazar = false;
        return subirFuente(arch, 'F22_ANTERIOR', L.reemplazoF22(S.fuentes)).then(function (r) { S.ocupado = null; return recargarCaso().then(function () { return leerF22(r.id); }); })
          .catch(function (err) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: L.mensajeError(err.message) }; render(); });
      }
      if (a === 'subir-ev') {
        var i = Number(b.getAttribute('data-i')), archivo = ($('#mr-ev-' + i).files || [])[0], prov = S.filas[i].decision.provenance;
        S.ocupado = 'subiendo'; render();
        return subirFuente(archivo, prov === 'DJ' ? 'DJ_ANTERIOR' : 'OTRO').then(function (r) {
          S.ocupado = null;
          return tabla(S.sb.from('renta_fuentes').select('id, tipo_fuente, origen, nombre_original, estado, sha256_estado, cargado_por, cargado_at').eq('caso_id', S.caso.id).order('id', { ascending: true }))
            .then(function (fs) { S.fuentes = fs; cambiarFila(i, { evidencia_fuente_id: r.id }); render(); });
        }).catch(function (err) { S.ocupado = null; S.aviso = { tipo: 'rojo', texto: L.mensajeError(err.message) }; render(); });
      }
    });
  }

  function iniciar() {
    S.sb = window._sbAuthClient;
    if (!S.sb) { $('#mr-app').innerHTML = '<div class="aviso rojo">No hay sesión de Gestoor.</div>'; return; }
    enlazar();
    cargarInicio().catch(function (e) { S.aviso = { tipo: 'rojo', texto: e.message }; render(); });
  }
  if (window._sbAuthReady) iniciar(); else window.addEventListener('gestoor-auth-ready', iniciar, { once: true });
})();
