/* REPORTE-AUTO B · «🔒 Cerrar reporte» en el Panel de Control (un solo paso, decisiones de Luciano 19-11).
   El servidor arma la FOTO del reporte (public.reporte_cierre_vista) desde la base, revisa lo que falta y, al confirmar
   (public.reporte_cerrar con la huella de lo que se vio), la guarda inmutable, marca el reporte «enviado» y lo publica en MiContadoor.
   Flujo visible: revisar (opcional, en el Pre-IVA) → Cerrar reporte. Si los datos del SII aún no pasaron al reporte, el cierre los
   pasa por dentro (mismo cálculo del servidor que «Pasar al reporte» del Pre-IVA); si falta el remanente anterior, se pide aquí
   (cód. 77 + motivo). Si el servidor encuentra un bloqueo, el cierre se detiene y lo explica; no se guarda nada.
   Reglas: la factura del mes NO bloquea (aviso interno); RR. HH. bloquea solo si el cliente tiene trabajadores con sueldos;
   cierran SOLO el Master o el analista contable asignado. Reabrir: SOLO el Master, con motivo (public.reporte_reabrir).
   Esta pantalla no calcula montos ni marca nada sola: si la RPC no está instalada (404 / PGRST202), lo dice y no hace nada. */
(function (raiz) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { var x = Number(n); return isFinite(x) ? '$' + Math.round(Math.abs(x)).toLocaleString('es-CL') : '—'; }
  function fecha(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  function rpc(fn, cuerpo, f) {
    f = f || (typeof sbFetch === 'function' ? sbFetch : null);
    if (!f) return Promise.reject(new Error('supabase.js no está cargado'));
    return f('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
        if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; } return j; });
    });
  }
  var MAPA = [[/SIN_PERMISO/, 'Cierra el reporte solo el Master o el analista contable asignado al cliente.'],
    [/REMANENTE_NO_CORRESPONDE/, 'Los impuestos ya están en el reporte: no hace falta indicar el remanente anterior.'],
    [/DATOS_CAMBIARON/, 'El reporte cambió mientras lo revisabas. Vuelve a abrir «Cerrar reporte».'], [/REAPERTURA_SOLO_MASTER/, 'Solo el Master puede reabrir un reporte cerrado.'],
    [/MOTIVO_OBLIGATORIO/, 'El motivo debe tener entre 10 y 500 caracteres.'], [/SIN_SESION/, 'Tu sesión terminó. Vuelve a ingresar a Gestoor.']];
  function mensajeError(m) {
    m = String(m || '').replace(/<[^>]+>/g, ''); for (var i = 0; i < MAPA.length; i++) if (MAPA[i][0].test(m)) return MAPA[i][1];
    // CIERRE_DETENIDO: el paso SII → reporte se detuvo; se muestra el motivo del servidor, sin los códigos internos.
    if (/^CIERRE_DETENIDO/.test(m)) return 'El cierre se detuvo: ' + m.replace(/^CIERRE_DETENIDO: [^:]*: /, '').replace(/[A-Z0-9_]{6,}: /g, '').slice(0, 380);
    return m.replace(/^[A-Z0-9_]+: /, '').slice(0, 400) || 'No se pudo completar.';
  }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  // Avisos que también ve el cliente (lista blanca del servidor) e internos (solo el equipo; nunca van en la foto).
  var AVISOS = { IU_PENDIENTE_RRHH: 'El impuesto único de RR. HH. aún no está: el F29 va sin él',
    F29_DECLARADO: 'F29 declarados según Cartapra', F29_SIN_DECLARAR: 'Hay F29 sin declarar según Cartapra',
    F29_OBSERVADO: 'F29 observados por el SII', F29_EN_REVISION: 'F29 en revisión en el SII',
    FACTURA_NO_EMITIDA: 'Interno: la factura de Nuestros servicios del período no está emitida (no bloquea; el cliente no lo ve)',
    FACTURA_EN_PROCESO: 'Interno: hay factura(s) del período en proceso en Facturación (no bloquea; el cliente no lo ve)' };
  function textoAviso(a) {
    if (a && a.codigo === 'SII_OBSERVACIONES') {
      var p = [];
      if (a.cartas > 0) p.push(a.cartas + (a.cartas === 1 ? ' carta o notificación' : ' cartas o notificaciones') + ' del SII en los últimos 12 meses');
      if (a.cumple === false) p.push('situación de cumplimiento tributario: no cumple');
      if (a.f22 > 0) p.push(a.f22 + (a.f22 === 1 ? ' observación' : ' observaciones') + ' en el F22');
      return 'Observaciones del SII: ' + (p.join('; ') || 'revisar') + '.';
    }
    return (AVISOS[a.codigo] || a.codigo) + (a.periodos && a.periodos.length ? ': ' + a.periodos.join(', ') : '') + '.';
  }
  var R = raiz.PreIvaReporteSii || (typeof require === 'function' ? (function () { try { return require('../pre-iva/reporte-sii.js'); } catch (e) { return null; } })() : null);
  // Validación del remanente a mano (la misma del Pre-IVA; el servidor la repite).
  function validarManual(cod77, motivo) {
    if (R && R.validarManual) return R.validarManual(cod77, motivo);
    var t = String(cod77 == null ? '' : cod77).trim(), m = String(motivo || '').trim();
    if (!/^\d+$/.test(t)) return 'El cód. 77 debe ser un monto en pesos, sin puntos ni decimales (0 si no había remanente).';
    if (m.length < 10 || m.length > 500) return 'Escribe de dónde sale el monto (10 a 500 caracteres).';
    if (m.slice(0, 5) === '[SII]') return 'El motivo no puede empezar con [SII].';
    return null;
  }
  // Vista previa de los impuestos que el cierre pasará desde el SII (puras, se prueban aparte).
  function filasPuente(p) {
    if (!p || !p.previa) return [];
    var v = { previa: p.previa, entrada: p.entrada || {}, remanente: p.remanente || {}, iu_pendiente: p.iu_pendiente };
    if (R && R.filasResumen) return R.filasResumen(v);
    return [['Total F29 (datos del SII)', fmt(p.previa.total_f29)]];
  }

  // Filas del resumen de la foto (puras, se prueban aparte)
  function filasFoto(d) {
    var f = [], i = (d && d.impuestos) || {}, r = (d && d.rrhh) || {}, s = (d && d.servicios) || {};
    if (i.estado === 'ok') {
      f.push(['Impuestos F29 (' + (i.fuente === 'sii' ? 'datos del SII' : 'Contable') + ')', fmt(i.total_f29)]);
      f.push(['· IVA a pagar', fmt(i.iva_pagar)], ['· PPM', fmt(i.ppm)], ['· Retención honorarios', fmt(i.ret_hon)], ['· Impuesto único', i.iu_pendiente ? 'Pendiente RR. HH.' : fmt(i.iu)]);
      f.push(['· Remanente anterior (' + ({ sii: 'SII', manual: 'a mano', mes_anterior: 'mes anterior' }[i.remanente_anterior_fuente] || '—') + ')', fmt(i.remanente_anterior)]);
      if (i.vence) f.push(['· Vence', String(i.vence).split('-').reverse().join('-')]);
    } else f.push(['Impuestos F29', i.estado === 'no_aplica' ? 'No aplica' : i.estado === 'por_aplicar_sii' ? 'Se pasan desde el SII al cerrar' : 'Pendiente']);
    f.push(['RR. HH.', r.estado === 'listo' ? fmt(r.cotizaciones) + ' cotizaciones' : r.estado === 'no_aplica' ? 'No aplica (sin trabajadores con sueldo)' : 'Pendiente']);
    f.push(['Nuestros servicios', s.estado === 'emitida' ? fmt(s.monto) + ' · factura N° ' + (s.folios || []).join(', ') : 'Sin factura emitida']);
    return f;
  }
  var CSS = '.crep-fondo{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.crep{background:#1c1220;color:#f4eef6;border:1px solid #3a2b40;border-radius:16px;max-width:540px;width:100%;max-height:92vh;overflow:auto;font-size:13px}'
    + '.crep-cab{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:14px 18px;border-bottom:1px solid #3a2b40}.crep-cab b{font:800 15px Montserrat,sans-serif;color:#d6a5d7}'
    + '.crep-c{padding:14px 18px;display:flex;flex-direction:column;gap:8px}.crep-f{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #3a2b40;padding:4px 0}.crep-f b{white-space:nowrap}'
    + '.crep-av{margin:0;padding:8px 10px;border-radius:10px;background:rgba(255,196,0,.08);border:1px solid rgba(255,196,0,.35);font-size:12px}'
    + '.crep-bl{margin:0;padding:8px 10px;border-radius:10px;background:rgba(211,68,51,.12);border:1px solid rgba(211,68,51,.5);font-size:12px}'
    + '.crep-ok{color:#5fd39a;font-weight:700}.crep-err{color:#ff8a7a;font-size:12px}'
    + '.crep label{display:flex;flex-direction:column;gap:4px;font-size:12px}'
    + '.crep textarea,.crep input{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #3a2b40;background:#24182a;color:inherit;width:100%;box-sizing:border-box}'
    + '.crep-pie{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #3a2b40}';

  function abrir(o) {
    // o = { reporteId, empresa, periodoTxt, alTerminar(estado, fechaEnvio) }
    if (!document.getElementById('crep-css')) { var st = document.createElement('style'); st.id = 'crep-css'; st.textContent = CSS; document.head.appendChild(st); }
    var x = document.getElementById('crep-fondo'); if (x) x.remove();
    var fondo = document.createElement('div'); fondo.id = 'crep-fondo'; fondo.className = 'crep-fondo';
    fondo.innerHTML = '<div class="crep" role="dialog" aria-modal="true" aria-label="Cerrar reporte"><div class="crep-cab"><b>Cerrar reporte · ' + esc(o.periodoTxt || '') + '</b>'
      + '<button type="button" class="btn-s btn-sm" data-crep="x" aria-label="Cerrar">×</button></div><div class="crep-c" id="crep-c">Consultando al servidor…</div>'
      + '<div class="crep-pie" id="crep-pie"><button type="button" class="btn-s" data-crep="x">Volver</button></div></div>';
    document.body.appendChild(fondo);
    fondo.addEventListener('click', function (ev) { if (ev.target === fondo || ev.target.closest('[data-crep="x"]')) fondo.remove(); });
    var c = fondo.querySelector('#crep-c'), pie = fondo.querySelector('#crep-pie');
    function boton(txt, clase, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = clase; b.textContent = txt; b.onclick = function () { fn(b); }; pie.appendChild(b); return b; }
    var avisoPost = '';
    function cargar() {
      pie.querySelectorAll('[data-acc]').forEach(function (b) { b.remove(); });
      rpc('reporte_cierre_vista', { p_reporte_id: Number(o.reporteId) }).then(function (v) {
        var h = '<div><b>' + esc(o.empresa || '') + '</b></div>';
        if (v.estado === 'cerrado') {
          h += '<p class="crep-ok">✓ Cerrado (versión ' + esc(v.cierre.version) + ') el ' + esc(fecha(v.cierre.cerrado_at)) + ' por ' + esc(v.cierre.cerrado_por) + '. Publicado en MiContadoor.</p>';
          filasFoto(v.cierre.datos).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
          if (v.puede_reabrir) h += '<label>Motivo de la reapertura (solo Master, queda registrado)<textarea id="crep-mot" rows="2" maxlength="500"></textarea></label>';
          h += '<div class="crep-err" id="crep-err" role="alert">' + esc(avisoPost) + '</div>'; c.innerHTML = h; avisoPost = '';
          if (v.puede_reabrir) {
            var br = boton('Reabrir reporte', 'btn-s', function (b) {
              var m = fondo.querySelector('#crep-mot').value.trim(), er = fondo.querySelector('#crep-err');
              if (m.length < 10) { er.textContent = 'Escribe el motivo (mínimo 10 caracteres).'; return; }
              b.disabled = true;
              rpc('reporte_reabrir', { p_reporte_id: Number(o.reporteId), p_motivo: m }).then(function (r) {
                if (typeof o.alTerminar === 'function') o.alTerminar('borrador', null);
                c.innerHTML = '<p class="crep-ok">Reporte reabierto. La foto anterior queda como historial.</p><p class="crep-av">' + esc(r.nota || '') + '</p>';
                pie.querySelectorAll('[data-acc]').forEach(function (z) { z.remove(); });
              }).catch(function (e) { b.disabled = false; er.textContent = mensajeError(e && e.message); });
            }); br.setAttribute('data-acc', '1');
          }
          return;
        }
        var e = v.evaluacion || {}, bl = e.bloqueos || [], pu = e.puente || null, manual = !!(pu && pu.requiere_remanente_manual);
        bl.forEach(function (b) { h += '<p class="crep-bl">⛔ ' + esc(b.mensaje || b.codigo) + (b.origen === 'puente_sii' ? ' (datos del SII)' : '') + '</p>'; });
        (e.avisos || []).forEach(function (a) { h += '<p class="crep-av">⚠️ ' + esc(textoAviso(a)) + '</p>'; });
        (e.avisos_internos || []).forEach(function (a) { h += '<p class="crep-av">🗂️ ' + esc(textoAviso(a)) + '</p>'; });
        filasFoto(e.datos).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
        if (pu) {
          h += '<p style="font-size:12px;margin:4px 0 0"><b>Impuestos que se pasan al reporte al cerrar</b> (los calcula el servidor con los datos del SII; no hace falta validar antes en el Pre-IVA):</p>';
          filasPuente(pu).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
          (pu.avisos || []).forEach(function (a) { if (a.codigo !== 'F29_SIN_DECLARAR') h += '<p class="crep-av">ℹ️ ' + esc(a.mensaje || a.codigo) + '</p>'; });
          if (pu.remanente && pu.remanente.aviso) h += '<p class="crep-av">ℹ️ ' + esc(pu.remanente.aviso) + '</p>';
          if (manual) {
            h += '<p class="crep-av">✍️ ' + esc((pu.remanente && pu.remanente.mensaje) || 'Ingresa el remanente anterior (cód. 77) a mano, con el motivo.') + '</p>'
              + '<label>Remanente anterior · cód. 77 del F29 del mes anterior (en pesos)<input id="crep-cod77" inputmode="numeric" placeholder="0" autocomplete="off"></label>'
              + '<label>Motivo (de dónde sale el monto) · queda registrado con tu nombre<textarea id="crep-mot77" rows="2" maxlength="500" placeholder="Ej.: F29 septiembre 2026 presentado en papel, cód. 77, folio …"></textarea></label>';
          }
        }
        h += '<p style="font-size:11.5px;opacity:.8;margin:0">Al cerrar se guarda esta foto tal cual (no cambia después), el reporte queda «enviado» y el cliente lo ve en MiContadoor con «Validado por Contadoor».</p>'
          + '<div class="crep-err" id="crep-err" role="alert"></div>';
        c.innerHTML = h;
        if (!v.puede_cerrar) { c.insertAdjacentHTML('beforeend', '<p class="crep-av">Tu usuario no puede cerrar este reporte (solo el Master o el analista contable asignado).</p>'); return; }
        if (bl.length) return;
        var bc = boton('🔒 Cerrar reporte', 'btn-p', function (b) {
          var er = fondo.querySelector('#crep-err'), cod = null, mot = null;
          if (manual) {
            cod = fondo.querySelector('#crep-cod77').value.trim(); mot = fondo.querySelector('#crep-mot77').value.trim();
            var m = validarManual(cod, mot); if (m) { er.textContent = m; return; }
          }
          b.disabled = true; b.textContent = 'Cerrando…'; er.textContent = '';
          rpc('reporte_cerrar', { p_reporte_id: Number(o.reporteId), p_huella: e.huella, p_rem_cod77: cod === null || cod === '' ? null : Number(cod), p_rem_motivo: mot || null }).then(function (r) {
            if (typeof o.alTerminar === 'function') o.alTerminar('enviado', r.fecha_envio);
            // Si el cierre pasó los datos del SII: obligación F29 de Pagos, igual que el Pre-IVA y Contable. No revierte el cierre si falla.
            var ob = (r && r.puente && R && R.crearObligacion) ? R.crearObligacion(v.cliente_rut, r.puente) : Promise.resolve(null);
            return ob.then(function (res) {
              avisoPost = res && res.estado === 'error' ? 'Reporte cerrado, pero la obligación F29 de Pagos no se pudo crear: avisa a Pagos. (' + mensajeError(res.mensaje) + ')' : '';
              cargar();
            });
          }).catch(function (x) { b.disabled = false; b.textContent = '🔒 Cerrar reporte'; er.textContent = mensajeError(x && x.message); });
        }); bc.setAttribute('data-acc', '1');
      }).catch(function (e) { c.innerHTML = '<p class="crep-bl">' + esc(noInstalada(e) ? 'El cierre de reportes aún no está instalado en Gestoor.' : mensajeError(e && e.message)) + '</p>'; });
    }
    cargar();
  }
  var api = { abrir: abrir, filasFoto: filasFoto, filasPuente: filasPuente, textoAviso: textoAviso, mensajeError: mensajeError, validarManual: validarManual };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.GestoorCierreReporte = api;
})(typeof window !== 'undefined' ? window : globalThis);
