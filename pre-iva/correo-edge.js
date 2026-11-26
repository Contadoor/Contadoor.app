/* ============================================================
   pre-iva/correo-edge.js — Envío del Pre-IVA por correo desde Gestoor (CORREO-PREIVA-1, 26-11-2026).
   Llama a la Edge gestoor-correo-enviar (Microsoft Graph desde reportes@contadoor.cl, con registro en correos_envios).
   Reglas (las hace cumplir el SERVIDOR; aquí solo se muestran):
     · El navegador NO manda montos, destinatario, asunto ni responder-a: el servidor arma el correo con el Pre-IVA GUARDADO.
     · El botón aparece solo si el servicio responde y el Master lo tiene habilitado (correos_parametros.envio_habilitado);
       si la Edge no existe, falla o está en pausa, se sigue usando el PDF para Outlook.
     · En modo PRUEBA todo llega a info@contadoor.cl y el Pre-IVA NO queda marcado como enviado.
     · Si el correo sale en modo REAL, el servidor marca fecha_envio en la misma operación (preiva_marcado = 'marcado').
   Sin dependencias del DOM: pruebas en correo-edge.test.js (node --test).
   ============================================================ */
(function (raiz) {
  'use strict';
  var EDGE = 'gestoor-correo-enviar';

  // env: { url (SB_URL), key (anon), token (JWT del usuario), fetch }
  function llamar(env, cuerpo) {
    if (!env || !env.token) return Promise.resolve({ status: 401, j: { ok: false, codigo: 'SESION', mensaje: 'Tu sesión expiró: vuelve a ingresar.' } });
    var f = env.fetch || raiz.fetch;
    return f(env.url + '/functions/v1/' + EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.key, Authorization: 'Bearer ' + env.token },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; } return { status: r.status, j: j || {} }; });
    }, function () { return { status: 0, j: { ok: false, codigo: 'RED' } }; });
  }

  // periodo de pantalla "202611" → "2026-11"
  function perGuion(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? p.slice(0, 4) + '-' + p.slice(4) : ''; }

  // Consulta (sin enviar) si se puede mandar por correo y a quién. Nunca lanza: ante cualquier problema → disponible:false.
  function consultar(env, clienteId, periodo) {
    var per = perGuion(periodo);
    if (!clienteId || !per) return Promise.resolve({ disponible: false, motivo: 'datos' });
    return llamar(env, { accion: 'vista_previa', tipo: 'preiva', cliente_id: Number(clienteId), periodo: per }).then(function (x) {
      var j = x.j || {};
      if (x.status !== 200 || j.ok !== true) return { disponible: false, motivo: j.codigo || ('HTTP_' + x.status), mensaje: j.mensaje || '' };
      return {
        disponible: j.envio_habilitado === true, motivo: j.envio_habilitado === true ? null : 'ENVIO_PAUSADO',
        modo: j.modo === 'REAL' ? 'REAL' : 'PRUEBA', destinatarios: j.destinatarios || [], destinatariosFicha: j.destinatarios_ficha || [],
        responderA: j.responder_a || '', asunto: j.asunto || '', f29: j.preiva ? j.preiva.f29 : null, yaEnviado: j.preiva ? j.preiva.ya_enviado : null
      };
    });
  }

  function fmt(n) { return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('es-CL'); }
  function fecha(iso) {
    try { return new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(iso || ''); }
  }

  // Texto del confirm: SIEMPRE con el destinatario real que devolvió el servidor y el F29 que va en el correo (el guardado).
  function textoConfirmar(c, nombre, periodoTxt) {
    var l = [];
    if (c.yaEnviado) l.push('⚠ Este Pre-IVA ya figura enviado el ' + fecha(c.yaEnviado) + '. Si continúas, el cliente recibe otro correo.\n');
    l.push('¿Enviar por correo la Proyección de IVA de ' + periodoTxt + ' a ' + nombre + '?');
    l.push('');
    if (c.modo === 'PRUEBA') {
      l.push('🧪 MODO PRUEBA: el correo llega SOLO a ' + c.destinatarios.join(', ') + '.');
      l.push('En producción iría a: ' + (c.destinatariosFicha.join(', ') || '(sin correo en la ficha)'));
      l.push('En prueba el Pre-IVA NO queda marcado como enviado.');
    } else {
      l.push('Para: ' + c.destinatarios.join(', '));
    }
    l.push('De: Contadoor <reportes@contadoor.cl> · Responder a: ' + c.responderA);
    if (c.f29 !== null && c.f29 !== undefined) l.push('F29 estimado en el correo: ' + fmt(c.f29) + ' (lo guardado en Gestoor)');
    return l.join('\n');
  }

  // Resultado del envío → { ok, marcado, texto } para avisar en pantalla.
  function resultado(x) {
    var j = (x && x.j) || {}, st = x ? x.status : 0;
    if (st === 200 && j.estado === 'enviado') {
      if (j.preiva_marcado === 'marcado') return { ok: true, marcado: true, texto: '✅ Correo enviado a ' + (j.destinatarios || []).join(', ') + ' y Pre-IVA marcado como enviado' };
      if (j.preiva_marcado === 'cambiado') return { ok: true, marcado: false, texto: 'El correo salió, pero el Pre-IVA cambió mientras se enviaba: NO quedó marcado como enviado. Revísalo y, si corresponde, márcalo a mano.' };
      if (j.modo === 'PRUEBA') return { ok: true, marcado: false, texto: '🧪 Prueba enviada solo a ' + (j.destinatarios || []).join(', ') + '. El Pre-IVA no se marcó como enviado.' };
      return { ok: true, marcado: false, texto: '✅ Correo enviado a ' + (j.destinatarios || []).join(', ') };
    }
    if (j.estado === 'ya_enviado') return { ok: true, marcado: false, yaEnviado: true, texto: 'Este correo ya se había enviado (no se duplicó).' };
    if (j.estado === 'incierto' || j.codigo === 'ENVIO_INCIERTO') return { ok: false, incierto: true, texto: 'Microsoft no confirmó el envío. NO lo reenvíes: el Master lo revisa en Enviados de reportes@.' };
    var porCodigo = {
      SESION: 'Tu sesión expiró: vuelve a ingresar.', PREIVA_SIN_GUARDAR: 'Guarda el Pre-IVA antes de enviarlo.',
      PERIODO_CERRADO: 'Este período ya cerró: el Pre-IVA solo se envía para el mes en curso.', CLIENTE_SIN_CORREO: 'El cliente no tiene correo en su ficha.',
      NO_ASIGNADO: 'Solo el analista contable del cliente o el Master pueden enviarlo.', ENVIO_PAUSADO: 'El envío de correos está en pausa (lo maneja el Master). Usa el PDF.',
      LIMITE_CLIENTE: 'Ya se enviaron varios correos a este cliente en las últimas 24 horas.', LIMITE_USUARIO: 'Llegaste al máximo de correos de las últimas 24 horas.',
      DUPLICADO_RECIENTE: 'Este mismo correo salió hace menos de 10 minutos.', EN_CURSO: 'Este correo se está enviando: espera un momento.',
      ENVIO_FALLIDO: 'Microsoft rechazó el envío. Puedes reintentar.', RED: 'Sin conexión con Gestoor.'
    };
    return { ok: false, texto: porCodigo[j.codigo] || ('No se pudo enviar' + (j.mensaje ? ': ' + j.mensaje : '.')) };
  }

  function enviar(env, clienteId, periodo, reenvio) {
    return llamar(env, { accion: 'enviar', tipo: 'preiva', cliente_id: Number(clienteId), periodo: perGuion(periodo), reenvio: reenvio === true }).then(resultado);
  }

  var api = { consultar: consultar, enviar: enviar, textoConfirmar: textoConfirmar, resultado: resultado, perGuion: perGuion, EDGE: EDGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaCorreo = api;
})(typeof window !== 'undefined' ? window : globalThis);
