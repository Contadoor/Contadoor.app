/* P1-B · Puente 12-nov · "Registrar envío manual" del reporte mensual (PDF + Outlook) y guardado de la Nota del analista (A-PAN-01).
   Flujo de 4 pasos (dictamen ChatGPT 08-11): 1) validar datos, destinatario, período y responsable · 2) generar el PDF y revisar todas
   las páginas · 3) enviar por Outlook verificando destinatario y adjunto · 4) registrar en Gestoor «enviado manualmente» con fecha, operador
   y evidencia (archivo subido al bucket privado, con su SHA-256).
   FAIL-CLOSED: antes de habilitar el paso 4 se consulta la sonda rpc/reporte_envio_manual_disponible. Si la función no existe en la base
   (PostgREST 404 / PGRST202) el botón queda DESACTIVADO con texto honesto: Gestoor NO registra el envío y se sigue la guía manual.
   Nunca se simula un registro ni se marca nada como enviado en el navegador. */
(function () {
  var BUCKET = 'reportes-envio-evidencia';
  var MAX = 10 * 1024 * 1024;
  var EXT_MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', eml: 'message/rfc822' };
  var TIPOS = {
    CAPTURA_ENVIADOS: { txt: 'Captura de «Elementos enviados» de Outlook (PNG/JPG/PDF)', ext: ['png', 'jpg', 'webp', 'pdf'] },
    EML: { txt: 'Correo enviado guardado como archivo .eml', ext: ['eml'] },
    PDF_ENVIADO: { txt: 'Correo enviado impreso a PDF', ext: ['pdf'] }
  };
  var RE_MAIL = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  var _sonda = null;   // promesa cacheada (se reintenta si hubo error de red)

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function fetchApi(path, opts) { if (typeof sbFetch !== 'function') return Promise.reject(new Error('supabase.js no está cargado')); return sbFetch(path, opts); }
  function rpc(fn, params) {
    return fetchApi('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}) })
      .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} return { status: r.status, ok: r.ok, json: j }; }); });
  }

  // ¿La función existe? 404 o PGRST202 = no instalada. Otro error = no se pudo verificar (también desactiva).
  function estadoDesdeRespuesta(res) {
    var j = res && res.json || {};
    var code = String(j.code || ''), msg = String(j.message || '');
    if (res && res.ok && j && j.envio_manual === true) {
      return j.puede_operar === true ? { estado: 'disponible', texto: 'Registro en Gestoor disponible.' }
        : { estado: 'sin_permiso', texto: 'Tu usuario no tiene el módulo Panel de Control: pide al Master que registre el envío.' };
    }
    if ((res && res.status === 404) || code === 'PGRST202' || /Could not find the function/i.test(msg)) {
      return { estado: 'no_instalado', texto: 'El registro del envío en Gestoor todavía NO está instalado (falta autorización). Gestoor no registra este envío: guarda la evidencia según la guía «Envío manual 12-nov».' };
    }
    return { estado: 'error', texto: 'No se pudo verificar el registro en Gestoor (' + (code || ('HTTP ' + (res && res.status))) + '). No registres nada: sigue la guía manual y avisa al Master.' };
  }
  function sondear(forzar) {
    if (!_sonda || forzar) {
      _sonda = rpc('reporte_envio_manual_disponible', {}).then(estadoDesdeRespuesta, function (e) {
        _sonda = null; return { estado: 'error', texto: 'No se pudo verificar el registro en Gestoor (' + (e && e.message || e) + '). Sigue la guía manual.' };
      });
    }
    return _sonda;
  }

  function sha256(file) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Este navegador no permite calcular la huella SHA-256.'));
    return file.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); })
      .then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  function extDe(file) {
    var m = /\.([a-z0-9]+)$/i.exec(String(file && file.name || '')); var e = m ? m[1].toLowerCase() : '';
    if (e === 'jpeg') e = 'jpg';
    return EXT_MIME[e] ? e : '';
  }
  function parsearDestinatarios(txt) {
    var lista = String(txt || '').split(/[;,\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
    var unicos = lista.filter(function (x, i) { return lista.indexOf(x) === i; });
    return { lista: unicos, malos: unicos.filter(function (x) { return !RE_MAIL.test(x); }) };
  }
  // Valida los datos del paso 4 sin tocar la red (se prueba aparte).
  function validarRegistro(v) {
    var e = [];
    var d = parsearDestinatarios(v.destinatarios);
    if (!d.lista.length) e.push('Indica al menos un destinatario.');
    if (d.malos.length) e.push('Destinatario inválido: ' + d.malos.join(', '));
    if (d.lista.length > 10) e.push('Máximo 10 destinatarios.');
    if (!RE_MAIL.test(String(v.remitente || '').trim().toLowerCase())) e.push('Indica el correo desde el que enviaste (remitente).');
    if (String(v.asunto || '').trim().length < 5) e.push('Copia el asunto del correo enviado.');
    var f = v.enviadoAt ? new Date(v.enviadoAt) : null;
    if (!f || isNaN(f.getTime())) e.push('Indica la fecha y hora de envío que muestra Outlook en «Enviados».');
    else if (f.getTime() > Date.now() + 10 * 60 * 1000) e.push('La fecha de envío no puede ser futura.');
    if (!TIPOS[v.tipo]) e.push('Elige el tipo de evidencia.');
    if (!v.archivo) e.push('Adjunta el archivo de evidencia.');
    else {
      var x = extDe(v.archivo);
      if (!x || (TIPOS[v.tipo] && TIPOS[v.tipo].ext.indexOf(x) < 0)) e.push('El archivo de evidencia no corresponde al tipo elegido (' + (TIPOS[v.tipo] ? TIPOS[v.tipo].ext.join(', ') : '') + ').');
      if (v.archivo.size <= 0 || v.archivo.size > MAX) e.push('La evidencia debe pesar entre 1 byte y 10 MB.');
    }
    return { ok: !e.length, errores: e, destinatarios: d.lista };
  }

  function subirEvidencia(reporteId, file, hash) {
    var ext = extDe(file), path = String(reporteId) + '/' + hash + '.' + ext;
    if (typeof _gestoorAccessToken === 'undefined' || !_gestoorAccessToken) return Promise.reject(new Error('Tu sesión expiró. Vuelve a entrar a Gestoor.'));
    return fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + _gestoorAccessToken, 'apikey': SB_KEY, 'Content-Type': EXT_MIME[ext], 'x-upsert': 'false' }, body: file
    }).then(function (r) {
      if (r.ok) return path;
      return r.text().then(function (t) {
        // Mismo nombre = misma huella = mismo archivo: ya estaba subido (reintento). La RPC vuelve a comprobarlo en el servidor.
        if (r.status === 409 || /already exists|Duplicate/i.test(t)) return path;
        throw new Error('No se pudo subir la evidencia (' + r.status + ').' + (r.status === 403 || r.status === 400 ? ' Revisa que tengas el módulo Panel de Control y el cliente en tu cartera.' : ''));
      });
    });
  }
  var MSG_ERR = {
    REPORTE_NO_LISTO: 'El reporte no está listo (Contable o RR. HH. sin OK).', PERIODO_NO_COINCIDE: 'El período no coincide con el reporte.',
    ENVIO_YA_REGISTRADO: 'Ese envío (destinatario y fecha) ya estaba registrado con OTRA evidencia. No se reemplaza: avisa al Master.',
    EVIDENCIA_NO_SUBIDA: 'La evidencia no quedó subida. Vuelve a intentarlo.', SIN_PERMISO: 'No tienes permiso sobre este cliente.',
    NO_AUTORIZADO: 'Tu sesión no es válida. Vuelve a entrar.', FECHA_ENVIO_FUTURA: 'La fecha de envío no puede ser futura.'
  };
  function mensajeError(j, status) {
    var m = String(j && j.message || ''), k = (m.match(/^[A-Z_]+/) || [''])[0];
    if (status === 404 || (j && j.code === 'PGRST202')) return 'El registro en Gestoor no está instalado: NO quedó registrado. Sigue la guía manual.';
    return (MSG_ERR[k] ? MSG_ERR[k] + ' ' : '') + '(' + (m || ('HTTP ' + status)) + ')';
  }
  // Registra: sube la evidencia y llama a la RPC. Solo devuelve éxito si la base responde ok=true.
  function registrar(ctx, v) {
    var val = validarRegistro(v);
    if (!val.ok) return Promise.reject(new Error(val.errores.join(' ')));
    return sondear(true).then(function (s) {
      if (s.estado !== 'disponible') throw new Error(s.texto);
      return Promise.all([sha256(v.archivo), v.adjunto ? sha256(v.adjunto) : Promise.resolve(null)]);
    }).then(function (h) {
      return subirEvidencia(ctx.reporteId, v.archivo, h[0]).then(function (path) {
        return rpc('registrar_envio_manual_reporte', {
          p_reporte_id: Number(ctx.reporteId), p_periodo: ctx.periodo, p_destinatarios: val.destinatarios, p_remitente: String(v.remitente).trim().toLowerCase(),
          p_asunto: String(v.asunto).trim(), p_enviado_at: new Date(v.enviadoAt).toISOString(), p_evidencia_tipo: v.tipo, p_evidencia_path: path,
          p_evidencia_sha256: h[0], p_adjunto_sha256: h[1], p_obs: v.obs ? String(v.obs).trim().slice(0, 500) : null
        });
      });
    }).then(function (res) {
      if (!res.ok || !res.json || res.json.ok !== true) throw new Error(mensajeError(res.json, res.status));
      return res.json;
    });
  }

  // ── Nota del analista: en la base si la RPC existe; si no, solo en este computador (y se dice) ──
  function guardarNota(reporteId, texto, textoAnterior) {
    return sondear(true).then(function (s) {
      if (s.estado !== 'disponible') return { modo: 'local', texto: s.estado === 'no_instalado' ? 'Guardada SOLO en este computador: el guardado en la base aún no está instalado.' : s.texto };
      return rpc('guardar_nota_reporte', { p_reporte_id: Number(reporteId), p_texto: String(texto || ''), p_texto_anterior: textoAnterior == null ? null : String(textoAnterior) })
        .then(function (res) {
          if (!res.ok || !res.json || res.json.ok !== true) {
            var m = String(res.json && res.json.message || ('HTTP ' + res.status));
            throw new Error(/NOTA_DESACTUALIZADA/.test(m) ? 'Otra persona cambió la nota. Recarga el Panel antes de guardar.' : 'No se guardó la nota: ' + m);
          }
          return { modo: 'base', estado: res.json.estado, nota: res.json.nota, texto: res.json.estado === 'SIN_CAMBIO' ? 'Sin cambios.' : 'Nota guardada en Gestoor.' };
        });
    });
  }

  function registrosPrevios(reporteId) {
    return fetchApi('reportes_envios_manuales?reporte_id=eq.' + encodeURIComponent(reporteId) + '&select=destinatario,fecha_envio,registrado_nombre,registrado_at,evidencia_tipo&order=id')
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // ── Modal de 4 pasos ──
  function abrir(ctx) {
    // ctx: {reporteId, periodo, periodoTxt, empresa, destinatarios, responsable, remitente, listo, motivos[], html, imprimir()}
    var prev = document.getElementById('modal-envio-manual'); if (prev) prev.remove();
    var ov = document.createElement('div'); ov.id = 'modal-envio-manual';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:320;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var asunto = 'Reporte mensual ' + (ctx.periodoTxt || ctx.periodo) + ' · ' + (ctx.empresa || '');
    var caja = 'background:var(--sur,#fff);color:var(--t1,#222);border-radius:12px;max-width:620px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.3);overflow:hidden;font-family:var(--sans,Inter,Arial)';
    var paso = function (n, titulo, cuerpo) { return '<div class="em-paso" data-paso="' + n + '" style="padding:12px 18px;border-top:1px solid var(--bdr,#ddd)"><div style="font-size:13px;font-weight:700;color:var(--p,#924893);margin-bottom:6px">Paso ' + n + ' · ' + titulo + '</div>' + cuerpo + '</div>'; };
    var chk = function (id, txt) { return '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;margin:4px 0"><input type="checkbox" id="' + id + '"> <span>' + txt + '</span></label>'; };
    var campo = function (lbl, html) { return '<label style="display:block;font-size:11px;color:var(--tm,#666);margin:6px 0 2px">' + lbl + '</label>' + html; };
    var inp = 'width:100%;box-sizing:border-box;font-size:12px;padding:7px 9px;border:1px solid var(--bdr,#ccc);border-radius:7px;background:var(--sur2,#fafafa);color:var(--t1,#222)';
    ov.innerHTML = '<div style="' + caja + '">' +
      '<div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:700">📤 Registrar envío manual · ' + esc(ctx.empresa) + ' · ' + esc(ctx.periodoTxt || ctx.periodo) + '</div><button id="em-x" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--tm,#666)">×</button></div>' +
      '<div id="em-sonda" style="margin:0 18px 8px;padding:8px 10px;border-radius:8px;font-size:12px;background:var(--sur2,#f4f4f4)">⏳ Verificando si el registro en Gestoor está disponible…</div>' +
      '<div id="em-previos" style="margin:0 18px 8px;font-size:12px"></div>' +
      paso(1, 'Validar el reporte',
        '<div style="font-size:12px;line-height:1.6">Cliente: <b>' + esc(ctx.empresa) + '</b> · Período: <b>' + esc(ctx.periodoTxt || ctx.periodo) + '</b><br>Destinatario(s) en la ficha: <b>' + esc((ctx.destinatarios || []).join(', ') || 'sin email') + '</b><br>Responsable: <b>' + esc(ctx.responsable || 'sin sesión') + '</b></div>' +
        (ctx.listo ? '<div style="font-size:12px;color:#28865B;margin:4px 0">✅ RR. HH., Contable y Nuestros servicios en OK; F29 completo.</div>'
                   : '<div style="font-size:12px;color:#D34433;margin:4px 0">⛔ El reporte no está listo: ' + esc((ctx.motivos || []).join(' · ')) + '. No lo envíes.</div>') +
        chk('em-c1', 'Revisé los montos, el período y que el destinatario es el correcto.')) +
      paso(2, 'Generar el PDF',
        '<button class="btn-s btn-sm" id="em-pdf" style="margin:2px 0 6px">🖨️ Generar PDF (Guardar como PDF)</button>' +
        '<div style="font-size:11px;color:var(--tm,#666)">En la ventana de impresión elige «Guardar como PDF». Nombre sugerido: <b>' + esc(window.GestoorReportePDF ? GestoorReportePDF.nombreArchivo({ periodo: ctx.periodo, empresa: ctx.empresa }) : 'Reporte') + '.pdf</b></div>' +
        chk('em-c2', 'Abrí el PDF y revisé que TODAS las páginas se leen completas (nada cortado).')) +
      paso(3, 'Enviar por Outlook',
        '<a id="em-outlook" class="btn-s btn-sm" style="display:inline-block;margin:2px 0 6px;text-decoration:none" href="#">✉️ Abrir borrador en Outlook</a>' +
        '<div style="font-size:11px;color:var(--tm,#666)">Adjunta el PDF a mano. Antes de «Enviar», revisa el destinatario y que el adjunto sea el de este cliente y período.</div>' +
        chk('em-c3', 'Lo envié desde Outlook con el PDF adjunto y verifiqué destinatario y adjunto.')) +
      paso(4, 'Registrar en Gestoor con evidencia',
        campo('Destinatario(s) a los que se envió (separados por coma)', '<input id="em-dest" style="' + inp + '" value="' + esc((ctx.destinatarios || []).join(', ')) + '">') +
        campo('Correo desde el que enviaste (remitente)', '<input id="em-rem" style="' + inp + '" value="' + esc(ctx.remitente || '') + '">') +
        campo('Asunto del correo enviado', '<input id="em-asunto" style="' + inp + '" value="' + esc(asunto) + '">') +
        campo('Fecha y hora de envío (la que muestra Outlook en «Enviados»)', '<input id="em-fecha" type="datetime-local" style="' + inp + '">') +
        campo('Tipo de evidencia', '<select id="em-tipo" style="' + inp + '">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + esc(TIPOS[k].txt) + '</option>'; }).join('') + '</select>') +
        campo('Archivo de evidencia (máx. 10 MB)', '<input id="em-archivo" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.eml" style="font-size:12px">') +
        campo('Opcional: el PDF que adjuntaste (solo se calcula su huella; no se sube)', '<input id="em-adjunto" type="file" accept=".pdf" style="font-size:12px">') +
        campo('Observación (opcional)', '<input id="em-obs" maxlength="500" style="' + inp + '">') +
        '<div id="em-err" style="font-size:12px;color:#D34433;margin-top:6px"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn-s" id="em-cancel">Cerrar</button><button class="btn-p" id="em-reg" disabled title="">📤 Registrar envío</button></div>' +
        '<div id="em-reg-motivo" style="font-size:11px;color:var(--tm,#666);margin-top:4px;text-align:right"></div>') +
      '</div>';
    document.body.appendChild(ov);
    var $ = function (id) { return document.getElementById(id); };
    var sondaEstado = null, ocupado = false;
    function refrescar() {
      var listos = ctx.listo && $('em-c1').checked && $('em-c2').checked && $('em-c3').checked;
      var motivo = !ctx.listo ? 'El reporte no está listo.' : !listos ? 'Completa los pasos 1 a 3.' : !sondaEstado ? 'Verificando…' : sondaEstado.estado !== 'disponible' ? sondaEstado.texto : '';
      $('em-reg').disabled = !!motivo || ocupado;
      $('em-reg').style.opacity = $('em-reg').disabled ? '.5' : '1';
      $('em-reg-motivo').textContent = motivo;
    }
    ['em-c1', 'em-c2', 'em-c3'].forEach(function (id) { $(id).onchange = refrescar; });
    if (!ctx.listo) $('em-c1').disabled = true;
    $('em-x').onclick = $('em-cancel').onclick = function () { ov.remove(); };
    $('em-pdf').onclick = function () { if (typeof ctx.imprimir === 'function') ctx.imprimir(); };
    $('em-outlook').onclick = function (ev) {
      ev.preventDefault();
      var dest = parsearDestinatarios($('em-dest').value).lista.join(',');
      var cuerpo = 'Hola,\n\nTe enviamos adjunto tu reporte mensual de ' + (ctx.periodoTxt || ctx.periodo) + ' de ' + (ctx.empresa || '') + '.\n\nCualquier duda, responde este correo.\n\nSaludos,\nContadoor';
      window.location.href = 'mailto:' + dest + '?subject=' + encodeURIComponent($('em-asunto').value) + '&body=' + encodeURIComponent(cuerpo);
    };
    $('em-reg').onclick = function () {
      $('em-err').textContent = ''; ocupado = true; refrescar(); $('em-reg').textContent = '⏳ Registrando…';
      registrar(ctx, { destinatarios: $('em-dest').value, remitente: $('em-rem').value, asunto: $('em-asunto').value, enviadoAt: $('em-fecha').value,
                       tipo: $('em-tipo').value, archivo: $('em-archivo').files[0], adjunto: $('em-adjunto').files[0], obs: $('em-obs').value })
        .then(function (j) {
          ocupado = false; $('em-reg').textContent = '📤 Registrar envío';
          $('em-err').style.color = '#28865B';
          $('em-err').textContent = (j.estado === 'YA_REGISTRADO' ? '✅ Ya estaba registrado (no se duplicó): ' : '✅ Registrado en Gestoor como «enviado manualmente»: ') +
            j.registros.map(function (x) { return x.destinatario; }).join(', ') + ' · ' + j.fecha_envio;
          if (typeof ctx.alRegistrar === 'function') ctx.alRegistrar(j);
          cargarPrevios(); refrescar();
        })
        .catch(function (e) { ocupado = false; $('em-reg').textContent = '📤 Registrar envío'; $('em-err').style.color = '#D34433'; $('em-err').textContent = '❌ ' + (e && e.message || e); refrescar(); });
    };
    function cargarPrevios() {
      if (!sondaEstado || sondaEstado.estado !== 'disponible') return;
      registrosPrevios(ctx.reporteId).then(function (rows) {
        if (!rows || !rows.length) { $('em-previos').textContent = ''; return; }
        $('em-previos').innerHTML = '📋 Envíos manuales ya registrados: ' + rows.map(function (x) { return esc(x.destinatario) + ' (' + esc(x.fecha_envio) + ', ' + esc(x.registrado_nombre) + ')'; }).join(' · ');
      });
    }
    sondear(true).then(function (s) {
      sondaEstado = s;
      var col = s.estado === 'disponible' ? '#28865B' : '#B26A00';
      $('em-sonda').innerHTML = '<span style="color:' + col + '">' + (s.estado === 'disponible' ? '🟢 ' : '🟠 ') + esc(s.texto) + '</span>';
      refrescar(); cargarPrevios();
    });
    refrescar();
    return ov;
  }

  window.GestoorEnvioManual = { sondear: sondear, estadoDesdeRespuesta: estadoDesdeRespuesta, validarRegistro: validarRegistro, parsearDestinatarios: parsearDestinatarios,
    sha256: sha256, registrar: registrar, guardarNota: guardarNota, abrir: abrir, TIPOS: TIPOS, _reiniciar: function () { _sonda = null; } };
})();
