/* P1-B · Puente 12-nov · "Registrar envío manual" del reporte mensual (PDF + Outlook) y guardado de la Nota del analista (A-PAN-01).
   Flujo de 4 pasos (dictamen ChatGPT 08-11): 1) validar datos, destinatario, período y responsable · 2) generar el PDF y revisar todas
   las páginas · 3) enviar por Outlook verificando destinatario y adjunto · 4) registrar en Gestoor «enviado manualmente» con fecha, operador
   y evidencia (archivo subido al bucket privado).
   R2 (contrato 2): huella honesta (SHA-256 DECLARADO por este navegador; el servidor solo comprueba el MD5 contra el que calcula el
   almacenamiento), id de INTENTO por registro (idempotencia; reenvío el mismo día con motivo) y RESULTADO de entrega aparte
   (rebote / entrega confirmada): enviado ≠ entregado.
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
    if (res && res.ok && j && j.envio_manual === true && j.contrato !== 2) {
      return { estado: 'error', texto: 'La base tiene otra versión del registro (contrato ' + esc(j.contrato == null ? '1' : j.contrato) + ', se espera 2). No registres nada: avisa al Master.' };
    }
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
  // MD5 (RFC 1321) en JS: crypto.subtle no lo ofrece. Se compara en el servidor con el eTag que calcula el almacenamiento.
  function md5Bytes(bytes) {
    var K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], i;
    for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    var n = bytes.length, nb = ((n + 8) >>> 6) + 1, M = new Int32Array(nb * 16);
    for (i = 0; i < n; i++) M[i >> 2] |= bytes[i] << ((i % 4) * 8);
    M[n >> 2] |= 0x80 << ((n % 4) * 8);
    M[nb * 16 - 2] = (n * 8) | 0; M[nb * 16 - 1] = Math.floor(n / 536870912) | 0;
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var o = 0; o < M.length; o += 16) {
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var f, g, r = Math.floor(i / 16);
        if (r === 0) { f = (B & C) | (~B & D); g = i; } else if (r === 1) { f = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (r === 2) { f = B ^ C ^ D; g = (3 * i + 5) % 16; } else { f = C ^ (B | ~D); g = (7 * i) % 16; }
        var t = D; D = C; C = B; var x = (A + f + K[i] + M[o + g]) | 0, sft = S[r * 4 + (i % 4)];
        B = (B + ((x << sft) | (x >>> (32 - sft)))) | 0; A = t;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return [a0, b0, c0, d0].map(function (v) { var h = ''; for (var k = 0; k < 4; k++) h += ('0' + ((v >>> (k * 8)) & 255).toString(16)).slice(-2); return h; }).join('');
  }
  function md5(file) { return file.arrayBuffer().then(function (b) { return md5Bytes(new Uint8Array(b)); }); }
  function nuevoIntento() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
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
    if (v.motivo && (String(v.motivo).trim().length < 10 || String(v.motivo).trim().length > 300)) e.push('El motivo del reenvío debe tener entre 10 y 300 caracteres.');
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
    REENVIO_SIN_MOTIVO: 'Ese correo ya tiene un envío registrado de este reporte. Si es un reenvío, escribe el motivo (p. ej. «rebotó», «corrección del monto»).',
    EVIDENCIA_YA_USADA: 'Ese archivo ya respalda otro registro: cada envío lleva su propia evidencia.',
    INTENTO_REUTILIZADO: 'Este registro ya se guardó con otros datos. Cierra y abre «Registrar envío manual» de nuevo.',
    EVIDENCIA_HUELLA_NO_COINCIDE: 'La huella del archivo guardado no coincide con la calculada aquí. Vuelve a elegir el archivo.',
    EVIDENCIA_HUELLA_NO_VERIFICABLE: 'El almacenamiento no pudo comprobar la huella del archivo. Vuelve a subirlo.',
    RESULTADO_YA_REGISTRADO: 'Ese envío ya tiene un resultado registrado (no se reemplaza).',
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
    if (!ctx || !/^[0-9a-f-]{36}$/i.test(String(ctx.intentoId || ''))) return Promise.reject(new Error('Falta el id del intento: cierra y vuelve a abrir «Registrar envío manual».'));
    return sondear(true).then(function (s) {
      if (s.estado !== 'disponible') throw new Error(s.texto);
      return Promise.all([sha256(v.archivo), v.adjunto ? sha256(v.adjunto) : Promise.resolve(null), md5(v.archivo)]);
    }).then(function (h) {
      return subirEvidencia(ctx.reporteId, v.archivo, h[0]).then(function (path) {
        return rpc('registrar_envio_manual_reporte', {
          p_intento_id: ctx.intentoId, p_reporte_id: Number(ctx.reporteId), p_periodo: ctx.periodo, p_destinatarios: val.destinatarios, p_remitente: String(v.remitente).trim().toLowerCase(),
          p_asunto: String(v.asunto).trim(), p_enviado_at: new Date(v.enviadoAt).toISOString(), p_evidencia_tipo: v.tipo, p_evidencia_path: path,
          p_evidencia_sha256: h[0], p_evidencia_md5: h[2], p_adjunto_sha256: h[1],
          p_motivo_reenvio: v.motivo ? String(v.motivo).trim() : null, p_obs: v.obs ? String(v.obs).trim().slice(0, 500) : null
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

  // Resultado de la ENTREGA (aparte del envío): REBOTE o ENTREGA_CONFIRMADA, con su propia evidencia.
  var TIPOS_RES = { REBOTE: ['AVISO_NO_ENTREGA', 'CAPTURA'], ENTREGA_CONFIRMADA: ['RESPUESTA_CLIENTE', 'CAPTURA'] };
  function registrarResultado(r) {
    // r: {intentoId, reporteId, envioId, resultado, tipo, ocurridoAt, detalle, archivo}
    var e = [];
    if (!TIPOS_RES[r.resultado]) e.push('Elige el resultado.');
    else if (TIPOS_RES[r.resultado].indexOf(r.tipo) < 0) e.push('Ese tipo de evidencia no sirve para ese resultado.');
    if (String(r.detalle || '').trim().length < 5) e.push('Describe qué pasó.');
    var f = r.ocurridoAt ? new Date(r.ocurridoAt) : null; if (!f || isNaN(f.getTime())) e.push('Indica fecha y hora.');
    if (!r.archivo || !extDe(r.archivo) || r.archivo.size <= 0 || r.archivo.size > MAX) e.push('Adjunta la evidencia (PDF, imagen o .eml, máx. 10 MB).');
    if (e.length) return Promise.reject(new Error(e.join(' ')));
    return sondear(true).then(function (s) {
      if (s.estado !== 'disponible') throw new Error(s.texto);
      return Promise.all([sha256(r.archivo), md5(r.archivo)]);
    }).then(function (h) {
      return subirEvidencia(r.reporteId, r.archivo, h[0]).then(function (path) {
        return rpc('registrar_resultado_envio_manual', { p_intento_id: r.intentoId, p_envio_id: Number(r.envioId), p_resultado: r.resultado, p_detalle: String(r.detalle).trim(),
          p_ocurrido_at: f.toISOString(), p_evidencia_tipo: r.tipo, p_evidencia_path: path, p_evidencia_sha256: h[0], p_evidencia_md5: h[1] });
      });
    }).then(function (res) {
      if (!res.ok || !res.json || res.json.ok !== true) throw new Error(mensajeError(res.json, res.status));
      return res.json;
    });
  }

  function registrosPrevios(reporteId) {
    return fetchApi('v_reportes_envios_estado?reporte_id=eq.' + encodeURIComponent(reporteId) + '&select=envio_id,intento_n,destinatario,fecha_envio,registrado_nombre,estado_entrega,motivo_reenvio&order=envio_id')
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // ── Modal de 4 pasos ──
  function abrir(ctx) {
    // ctx: {reporteId, periodo, periodoTxt, empresa, destinatarios, responsable, remitente, listo, motivos[], html, imprimir()}
    var prev = document.getElementById('modal-envio-manual'); if (prev) prev.remove();
    ctx = Object.assign({}, ctx, { intentoId: nuevoIntento() });   // un intento por apertura: reintentos y doble clic no duplican
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
        campo('Motivo del reenvío (obligatorio solo si ese correo ya recibió este reporte)', '<input id="em-motivo" maxlength="300" placeholder="Ej.: rebotó; corrección del monto" style="' + inp + '">') +
        campo('Observación (opcional)', '<input id="em-obs" maxlength="500" style="' + inp + '">') +
        '<div style="font-size:11px;color:var(--tm,#666);margin-top:6px">Huella del archivo: este navegador calcula su SHA-256 (queda como «declarada») y su MD5; el servidor comprueba el MD5 contra el que calcula el almacenamiento. Registrar el envío NO confirma la entrega: si rebota o el cliente confirma, regístralo abajo en «Envíos ya registrados».</div>' +
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
                       tipo: $('em-tipo').value, archivo: $('em-archivo').files[0], adjunto: $('em-adjunto').files[0], obs: $('em-obs').value, motivo: $('em-motivo').value })
        .then(function (j) {
          ocupado = false; $('em-reg').textContent = '📤 Registrar envío';
          $('em-err').style.color = '#28865B';
          $('em-err').textContent = (j.estado === 'YA_REGISTRADO' ? '✅ Ya estaba registrado (no se duplicó): ' : '✅ Registrado en Gestoor como «enviado manualmente»: ') +
            j.registros.map(function (x) { return x.destinatario; }).join(', ') + ' · ' + j.fecha_envio + ' · intento ' + j.intento_n + ' · entrega sin confirmar';
          if (typeof ctx.alRegistrar === 'function') ctx.alRegistrar(j);
          cargarPrevios(); refrescar();
        })
        .catch(function (e) { ocupado = false; $('em-reg').textContent = '📤 Registrar envío'; $('em-err').style.color = '#D34433'; $('em-err').textContent = '❌ ' + (e && e.message || e); refrescar(); });
    };
    function cargarPrevios() {
      if (!sondaEstado || sondaEstado.estado !== 'disponible') return;
      registrosPrevios(ctx.reporteId).then(function (rows) {
        if (!rows || !rows.length) { $('em-previos').textContent = ''; return; }
        var ETQ = { SIN_CONFIRMAR: '⏳ entrega sin confirmar', ENTREGA_CONFIRMADA: '✅ entrega confirmada', REBOTE: '↩️ rebotó' };
        $('em-previos').innerHTML = '<div style="font-weight:700;margin-bottom:4px">📋 Envíos ya registrados</div>' + rows.map(function (x) {
          return '<div style="margin:2px 0">Intento ' + esc(x.intento_n) + ' · ' + esc(x.destinatario) + ' · ' + esc(x.fecha_envio) + ' · ' + esc(x.registrado_nombre) + ' · <b>' + esc(ETQ[x.estado_entrega] || x.estado_entrega) + '</b>'
            + (x.estado_entrega === 'SIN_CONFIRMAR' ? ' <button class="btn-s btn-sm em-res" data-envio="' + esc(x.envio_id) + '" style="font-size:11px">Registrar rebote / entrega</button>' : '') + '</div>';
        }).join('') + '<div id="em-res-form"></div>';
        Array.prototype.forEach.call(document.querySelectorAll('#modal-envio-manual .em-res'), function (b) { b.onclick = function () { formResultado(b.getAttribute('data-envio')); }; });
      });
    }
    function formResultado(envioId) {
      var intento = nuevoIntento();
      $('em-res-form').innerHTML = '<div style="border:1px solid var(--bdr,#ddd);border-radius:8px;padding:8px 10px;margin-top:6px">' +
        campo('Resultado', '<select id="emr-res" style="' + inp + '"><option value="REBOTE">↩️ Rebotó (llegó aviso de no entrega)</option><option value="ENTREGA_CONFIRMADA">✅ Entrega confirmada (el cliente respondió)</option></select>') +
        campo('Tipo de evidencia', '<select id="emr-tipo" style="' + inp + '"><option value="AVISO_NO_ENTREGA">Aviso de no entrega (.eml/PDF/captura)</option><option value="RESPUESTA_CLIENTE">Respuesta del cliente (.eml/PDF/captura)</option><option value="CAPTURA">Captura de pantalla</option></select>') +
        campo('Fecha y hora del aviso o de la respuesta', '<input id="emr-fecha" type="datetime-local" style="' + inp + '">') +
        campo('Qué pasó', '<input id="emr-det" maxlength="500" style="' + inp + '">') +
        campo('Archivo de evidencia', '<input id="emr-arch" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.eml" style="font-size:12px">') +
        '<div id="emr-err" style="font-size:12px;margin-top:4px"></div><div style="text-align:right;margin-top:6px"><button class="btn-p btn-sm" id="emr-ok">Registrar resultado</button></div></div>';
      $('emr-ok').onclick = function () {
        $('emr-ok').disabled = true; $('emr-err').style.color = 'inherit'; $('emr-err').textContent = '⏳ Registrando…';
        registrarResultado({ intentoId: intento, reporteId: ctx.reporteId, envioId: envioId, resultado: $('emr-res').value, tipo: $('emr-tipo').value,
                             ocurridoAt: $('emr-fecha').value, detalle: $('emr-det').value, archivo: $('emr-arch').files[0] })
          .then(function (j) { $('emr-err').style.color = '#28865B'; $('emr-err').textContent = '✅ Resultado registrado: ' + j.resultado + (j.estado === 'YA_REGISTRADO' ? ' (ya estaba)' : ''); cargarPrevios(); })
          .catch(function (e) { $('emr-ok').disabled = false; $('emr-err').style.color = '#D34433'; $('emr-err').textContent = '❌ ' + (e && e.message || e); });
      };
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
    sha256: sha256, md5Bytes: md5Bytes, registrar: registrar, registrarResultado: registrarResultado, guardarNota: guardarNota, abrir: abrir, TIPOS: TIPOS, _reiniciar: function () { _sonda = null; } };
})();
