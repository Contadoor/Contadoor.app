/* REPORTE-AUTO B · «Cerrar reporte» en el Panel de Control.
   El servidor arma la FOTO del reporte (public.reporte_cierre_vista) desde la base, revisa lo que falta y, al confirmar
   (public.reporte_cerrar con la huella de lo que se vio), la guarda inmutable, marca el reporte «enviado» y lo publica en MiContadoor.
   Reglas: Impuestos completados (reporte contable OK); factura del período emitida (solo el Master puede cerrar sin factura, con motivo);
   RR. HH. pendiente NO bloquea en el piloto (se muestra «pendiente»). Reabrir: SOLO el Master, con motivo (public.reporte_reabrir).
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
  var MAPA = [[/SIN_PERMISO/, 'Cierra el reporte el Master o el analista contable / de RR. HH. asignado al cliente.'], [/SOLO_MASTER/, 'Solo el Master puede cerrar un reporte sin factura emitida.'],
    [/DATOS_CAMBIARON/, 'El reporte cambió mientras lo revisabas. Vuelve a abrir «Cerrar reporte».'], [/REAPERTURA_SOLO_MASTER/, 'Solo el Master puede reabrir un reporte cerrado.'],
    [/MOTIVO_OBLIGATORIO/, 'El motivo debe tener entre 10 y 500 caracteres.'], [/SIN_SESION/, 'Tu sesión terminó. Vuelve a ingresar a Gestoor.']];
  function mensajeError(m) { m = String(m || '').replace(/<[^>]+>/g, ''); for (var i = 0; i < MAPA.length; i++) if (MAPA[i][0].test(m)) return MAPA[i][1]; return m.replace(/^[A-Z0-9_]+: /, '').slice(0, 400) || 'No se pudo completar.'; }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  var AVISOS = { RRHH_PENDIENTE: 'RR. HH. está pendiente: el reporte se cierra igual y el cliente ve RR. HH. «pendiente» (piloto)',
    IU_PENDIENTE_RRHH: 'El impuesto único de RR. HH. aún no está: el F29 va sin él',
    F29_SIN_DECLARAR: 'Hay F29 sin declarar según Cartapra' };
  function textoAviso(a) { return (AVISOS[a.codigo] || a.codigo) + (a.periodos && a.periodos.length ? ': ' + a.periodos.join(', ') : '') + '.'; }

  // Filas del resumen de la foto (puras, se prueban aparte)
  function filasFoto(d) {
    var f = [], i = (d && d.impuestos) || {}, r = (d && d.rrhh) || {}, s = (d && d.servicios) || {};
    if (i.estado === 'ok') {
      f.push(['Impuestos F29 (' + (i.fuente === 'sii' ? 'datos del SII' : 'Contable') + ')', fmt(i.total_f29)]);
      f.push(['· IVA a pagar', fmt(i.iva_pagar)], ['· PPM', fmt(i.ppm)], ['· Retención honorarios', fmt(i.ret_hon)], ['· Impuesto único', i.iu_pendiente ? 'Pendiente RR. HH.' : fmt(i.iu)]);
      f.push(['· Remanente anterior (' + ({ sii: 'SII', manual: 'a mano', mes_anterior: 'mes anterior' }[i.remanente_anterior_fuente] || '—') + ')', fmt(i.remanente_anterior)]);
      if (i.vence) f.push(['· Vence', String(i.vence).split('-').reverse().join('-')]);
    } else f.push(['Impuestos F29', i.estado === 'no_aplica' ? 'No aplica' : 'Pendiente']);
    f.push(['RR. HH.', r.estado === 'listo' ? fmt(r.cotizaciones) + ' cotizaciones' : r.estado === 'no_aplica' ? 'No aplica' : 'Pendiente']);
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
    + '.crep textarea{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #3a2b40;background:#24182a;color:inherit;width:100%;box-sizing:border-box}'
    + '.crep-pie{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #3a2b40}';

  function abrir(o) {
    // o = { reporteId, empresa, periodoTxt, alTerminar(estado) }
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
    function cargar() {
      pie.querySelectorAll('[data-acc]').forEach(function (b) { b.remove(); });
      rpc('reporte_cierre_vista', { p_reporte_id: Number(o.reporteId) }).then(function (v) {
        var h = '<div><b>' + esc(o.empresa || '') + '</b></div>';
        if (v.estado === 'cerrado') {
          h += '<p class="crep-ok">✓ Cerrado (versión ' + esc(v.cierre.version) + ') el ' + esc(fecha(v.cierre.cerrado_at)) + ' por ' + esc(v.cierre.cerrado_por) + '. Publicado en MiContadoor.</p>';
          if (v.cierre.sin_factura_motivo) h += '<p class="crep-av">Cerrado sin factura: ' + esc(v.cierre.sin_factura_motivo) + '</p>';
          filasFoto(v.cierre.datos).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
          if (v.puede_reabrir) h += '<label>Motivo de la reapertura (solo Master, queda registrado)<textarea id="crep-mot" rows="2" maxlength="500"></textarea></label>';
          h += '<div class="crep-err" id="crep-err" role="alert"></div>'; c.innerHTML = h;
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
        var e = v.evaluacion || {}, bl = e.bloqueos || [], soloFactura = bl.length === 1 && bl[0].codigo === 'FACTURA_NO_EMITIDA';
        bl.forEach(function (b) { h += '<p class="crep-bl">⛔ ' + esc(b.mensaje || b.codigo) + '</p>'; });
        (e.avisos || []).forEach(function (a) { h += '<p class="crep-av">⚠️ ' + esc(textoAviso(a)) + '</p>'; });
        filasFoto(e.datos).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
        if (soloFactura && v.es_master && v.puede_cerrar) h += '<label>Cerrar SIN factura (solo Master): motivo<textarea id="crep-sf" rows="2" maxlength="500" placeholder="Ej.: cuenta interna, no se factura"></textarea></label>';
        h += '<p style="font-size:11.5px;opacity:.8;margin:0">Al cerrar se guarda esta foto tal cual (no cambia después), el reporte queda «enviado» y el cliente lo ve en MiContadoor con «Validado por Contadoor».</p>'
          + '<div class="crep-err" id="crep-err" role="alert"></div>';
        c.innerHTML = h;
        if (!v.puede_cerrar) { c.insertAdjacentHTML('beforeend', '<p class="crep-av">Tu usuario no puede cerrar este reporte (Master o analista asignado).</p>'); return; }
        if (bl.length && !(soloFactura && v.es_master)) return;
        var bc = boton(soloFactura ? 'Cerrar sin factura' : 'Cerrar reporte', 'btn-p', function (b) {
          var er = fondo.querySelector('#crep-err'), sf = null;
          if (soloFactura) { sf = fondo.querySelector('#crep-sf').value.trim(); if (sf.length < 10) { er.textContent = 'Escribe el motivo (mínimo 10 caracteres).'; return; } }
          b.disabled = true; b.textContent = 'Cerrando…';
          rpc('reporte_cerrar', { p_reporte_id: Number(o.reporteId), p_huella: e.huella, p_sin_factura_motivo: sf }).then(function (r) {
            if (typeof o.alTerminar === 'function') o.alTerminar('enviado', r.fecha_envio);
            cargar();
          }).catch(function (x) { b.disabled = false; b.textContent = soloFactura ? 'Cerrar sin factura' : 'Cerrar reporte'; er.textContent = mensajeError(x && x.message); });
        }); bc.setAttribute('data-acc', '1');
      }).catch(function (e) { c.innerHTML = '<p class="crep-bl">' + esc(noInstalada(e) ? 'El cierre de reportes aún no está instalado en Gestoor.' : mensajeError(e && e.message)) + '</p>'; });
    }
    cargar();
  }
  var api = { abrir: abrir, filasFoto: filasFoto, textoAviso: textoAviso, mensajeError: mensajeError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.GestoorCierreReporte = api;
})(typeof window !== 'undefined' ? window : globalThis);
