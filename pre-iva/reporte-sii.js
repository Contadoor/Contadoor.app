/* ============================================================
   pre-iva/reporte-sii.js — «Validar y pasar al reporte» (REPORTE-AUTO A).
   El analista contable responsable (o el Master) valida el Pre-IVA calculado con los datos del SII (Cartapra) y los montos pasan
   al reporte mensual EN EL SERVIDOR (RPC public.reporte_aplicar_preiva_sii). Esta pantalla NO calcula ni envía montos:
     1) pide la vista al servidor (public.reporte_preiva_sii_vista): montos, remanente, bloqueos, avisos y huella;
     2) si no hay F29 del mes anterior en Cartapra, pide el remanente anterior (cód. 77) A MANO con un motivo (≥ 10 caracteres);
     3) confirma con la huella (si los datos del SII cambiaron entremedio, el servidor rechaza: DATOS_CAMBIARON);
     4) después crea la obligación F29 de Pagos con crear_obligacion, igual que Contable al marcar el reporte OK.
   RPC no instalada (404 / PGRST202 / 42883): el botón no aparece. Fail-closed: cualquier error se muestra y no se guarda nada.
   ============================================================ */
(function (raiz) {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fmt(n) { var x = Number(n); return isFinite(x) ? (x < 0 ? '−$' : '$') + Math.round(Math.abs(x)).toLocaleString('es-CL') : '—'; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mes(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : String(p || ''); }
  function perGuion(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? p.slice(0, 4) + '-' + p.slice(4) : ''; }

  // Validación del ingreso manual (la base la repite: es solo para avisar antes).
  function validarManual(cod77, motivo) {
    var t = String(cod77 == null ? '' : cod77).trim(), m = String(motivo || '').trim();
    if (!/^\d+$/.test(t)) return 'El cód. 77 debe ser un monto en pesos, sin puntos ni decimales (0 si no había remanente).';
    if (Number(t) > 999999999999) return 'El cód. 77 es demasiado grande.';
    if (m.length < 10) return 'Escribe de dónde sale el monto (mínimo 10 caracteres).';
    if (m.length > 500) return 'El motivo puede tener como máximo 500 caracteres.';
    if (m.slice(0, 5) === '[SII]') return 'El motivo no puede empezar con [SII].';
    return null;
  }
  // Mensaje del servidor → texto para el analista (sin HTML, corto).
  var MAPA = [
    [/SOLO_ANALISTA_ASIGNADO/, 'Solo el analista contable responsable del cliente o el Master pueden validar este Pre-IVA.'],
    [/SIN_SESION/, 'Tu sesión terminó. Vuelve a ingresar a Gestoor.'],
    [/DATOS_CAMBIARON/, 'Los datos del SII cambiaron mientras revisabas. Vuelve a abrir «Validar y pasar al reporte».'],
    [/REPORTE_YA_VALIDADO/, 'Este Pre-IVA ya está validado en el reporte. Para cambiarlo, el Master reabre el reporte contable.'],
    [/REPORTE_CERRADO/, 'El reporte ya está cerrado. El Master debe reabrirlo primero.'],
    [/REPORTE_NO_EXISTE/, 'No existe el reporte de este período (la nómina la genera el Master).']
  ];
  function mensajeError(msg) {
    var m = String(msg || '').replace(/<[^>]+>/g, '');
    for (var i = 0; i < MAPA.length; i++) if (MAPA[i][0].test(m)) return MAPA[i][1];
    return m.replace(/^[A-Z0-9_]+: /, '').slice(0, 400) || 'No se pudo completar. Inténtalo de nuevo.';
  }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }

  function rpc(nombre, cuerpo, f) {
    f = f || (typeof sbFetch === 'function' ? sbFetch : null);
    if (!f) return Promise.reject(new Error('Gestoor no está listo (recarga la página).'));
    return f('rpc/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (res) {
        return res.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
          if (!res.ok) { var e = new Error((j && j.message) || ('HTTP ' + res.status)); e.status = res.status; e.code = j && j.code; throw e; }
          return j;
        });
      });
  }
  function vista(cliId, periodo, f) { return rpc('reporte_preiva_sii_vista', { p_cliente_id: Number(cliId), p_periodo: perGuion(periodo) }, f); }
  function aplicar(cliId, periodo, huella, cod77, motivo, f) {
    return rpc('reporte_aplicar_preiva_sii', { p_cliente_id: Number(cliId), p_periodo: perGuion(periodo), p_huella: huella,
      p_rem_cod77: cod77 == null || cod77 === '' ? null : Number(cod77), p_rem_motivo: motivo || null }, f);
  }
  // Obligación F29 de Pagos (mismos parámetros que Contable, reportes-contable crearActualizarObligacionF29). No bloquea: si falla, se avisa.
  function crearObligacion(rut, res, f) {
    var o = res && res.obligacion; if (!o || !res.reporte_id) return Promise.resolve({ estado: 'sin_datos' });
    return rpc('crear_obligacion', { p_cliente_rut: rut, p_periodo: res.periodo, p_area_origen: 'contable', p_tipo_obligacion: 'f29', p_concepto: o.concepto,
      p_monto_total: o.monto_total, p_monto_exigible: o.monto_exigible, p_monto_postergado: o.monto_postergado, p_vencimiento: o.vencimiento || null,
      p_iva_fecha_venc: null, p_ref_reporte_id: Number(res.reporte_id), p_ref_factura_id: null }, f)
      .then(function (rows) { var r = rows && rows[0]; return { estado: 'ok', resultado: r && r.resultado, mensaje: r && r.mensaje }; })
      .catch(function (e) { return { estado: 'error', mensaje: e && e.message }; });
  }

  // Filas del resumen (puras, se prueban aparte)
  function filasResumen(v) {
    var p = (v && v.previa) || null, e = (v && v.entrada) || {}, r = (v && v.remanente) || {};
    if (!p) return [];
    var remTxt = r.accion === 'registrar_sii' ? 'del F29 del SII (cód. 77 ' + fmt(r.cod77) + ' × UTM)' : r.fuente === 'manual' ? 'ingresado a mano' : r.fuente === 'mes_anterior' ? 'del reporte del mes anterior' : 'del SII';
    var f = [['IVA débito (ventas del SII)', fmt(p.debito)], ['IVA crédito (compras registradas)', fmt(p.credito)],
             ['Remanente anterior (cód. 504) · ' + remTxt, fmt(p.remanente_anterior)], ['IVA a pagar', fmt(p.iva_pagar)]];
    if (p.remanente_siguiente > 0) f.push(['Remanente para el mes siguiente', fmt(p.remanente_siguiente)]);
    f.push(['PPM · tasa ' + (e.ppm_tasa == null ? '—' : String(e.ppm_tasa).replace('.', ',')) + ' % (' + (e.ppm_tasa_fuente === 'sii' ? 'F29 del SII' : 'ficha') + ')', fmt(p.ppm)]);
    f.push(['Retención boletas de honorarios', fmt(p.ret_hon)]);
    f.push(['Impuesto único (RR. HH.)', v.iu_pendiente ? 'Pendiente RR. HH.' : fmt(p.iu)]);
    if (p.otros_imp > 0) f.push(['Otros impuestos', fmt(p.otros_imp)]);
    f.push(['Total F29', fmt(p.total_f29)]);
    return f;
  }

  // ── Ventana ─────────────────────────────────────────────────────────────
  var CSS = '.rsii-fondo{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.rsii{background:var(--sur,#1c1220);color:var(--t1,#fff);border:1px solid var(--bdr,#3a2b40);border-radius:16px;max-width:560px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.45)}'
    + '.rsii h3{margin:0;font:800 15px var(--tit,Montserrat,sans-serif);color:var(--p,#c88fca)}'
    + '.rsii-cab{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--bdr,#3a2b40)}'
    + '.rsii-cuerpo{padding:14px 18px;display:flex;flex-direction:column;gap:10px;font-size:13px}'
    + '.rsii-fila{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed var(--bdr,#3a2b40)}.rsii-fila b{white-space:nowrap}'
    + '.rsii-fila.tot{border-bottom:0;font-weight:800;font-size:14px}'
    + '.rsii-av{margin:0;padding:8px 10px 8px 26px;border-radius:10px;background:rgba(255,196,0,.08);border:1px solid rgba(255,196,0,.35);font-size:12px;line-height:1.45}'
    + '.rsii-bl{margin:0;padding:8px 10px 8px 26px;border-radius:10px;background:rgba(211,68,51,.1);border:1px solid rgba(211,68,51,.5);font-size:12px;line-height:1.45}'
    + '.rsii label{display:flex;flex-direction:column;gap:4px;font-size:12px}.rsii input,.rsii textarea{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--bdr,#3a2b40);background:var(--sur2,#24182a);color:inherit}'
    + '.rsii-pie{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--bdr,#3a2b40)}'
    + '.rsii-err{color:#ff8a7a;font-size:12px}.rsii-ok{color:#5fd39a;font-weight:700}';
  function estilo() { if (document.getElementById('rsii-css')) return; var s = document.createElement('style'); s.id = 'rsii-css'; s.textContent = CSS; document.head.appendChild(s); }

  function abrir(o) {
    // o = { cliente: {id, rut, razon}, periodo: 'AAAAMM' | 'AAAA-MM', alTerminar: fn }
    if (!o || !o.cliente || !o.cliente.id) { alert('Selecciona un cliente primero.'); return; }
    estilo();
    var viejo = document.getElementById('rsii-fondo'); if (viejo) viejo.remove();
    var fondo = document.createElement('div'); fondo.id = 'rsii-fondo'; fondo.className = 'rsii-fondo';
    fondo.innerHTML = '<div class="rsii" role="dialog" aria-modal="true" aria-labelledby="rsii-t"><div class="rsii-cab"><h3 id="rsii-t">Validar y pasar al reporte · ' + esc(mes(o.periodo)) + '</h3>'
      + '<button type="button" class="btn sec chico" data-rsii="cerrar" aria-label="Cerrar">×</button></div><div class="rsii-cuerpo" id="rsii-cuerpo">Consultando al servidor…</div>'
      + '<div class="rsii-pie" id="rsii-pie"><button type="button" class="btn sec" data-rsii="cerrar">Cancelar</button></div></div>';
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); }
    fondo.addEventListener('click', function (ev) { var b = ev.target.closest('[data-rsii="cerrar"]'); if (b || ev.target === fondo) cerrar(); });
    var cuerpo = fondo.querySelector('#rsii-cuerpo'), pie = fondo.querySelector('#rsii-pie');
    vista(o.cliente.id, o.periodo).then(function (v) {
      var h = '<div><b>' + esc(o.cliente.razon || o.cliente.rut || '') + '</b> · los montos los calcula el servidor con los datos del SII (Cartapra)</div>';
      (v.bloqueos || []).forEach(function (b) { h += '<p class="rsii-bl">⛔ ' + esc(b.mensaje || b.codigo) + '</p>'; });
      (v.avisos || []).forEach(function (a) { h += '<p class="rsii-av">⚠️ ' + esc(a.mensaje || a.codigo) + '</p>'; });
      if (v.remanente && v.remanente.aviso) h += '<p class="rsii-av">⚠️ ' + esc(v.remanente.aviso) + '</p>';
      filasResumen(v).forEach(function (f, i, arr) { h += '<div class="rsii-fila' + (i === arr.length - 1 ? ' tot' : '') + '"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
      if (v.requiere_remanente_manual) {
        h += '<p class="rsii-av">✍️ ' + esc(v.remanente.mensaje) + '</p>'
          + '<label>Remanente anterior · cód. 77 del F29 de ' + esc(mes((v.entrada && v.entrada.remanente_sii && v.entrada.remanente_sii.periodo) || '')) + ' (en pesos)'
          + '<input id="rsii-cod77" inputmode="numeric" placeholder="0" autocomplete="off"></label>'
          + '<label>Motivo (de dónde sale el monto) · queda registrado con tu nombre<textarea id="rsii-motivo" rows="2" maxlength="500" placeholder="Ej.: F29 septiembre 2026 presentado en papel, cód. 77, folio …"></textarea></label>';
      }
      if (v.iu_pendiente) h += '<p class="rsii-av">ℹ️ El impuesto único de RR. HH. aún no está: el F29 queda sin él hasta que RR. HH. lo informe (y habría que reabrir el reporte).</p>';
      h += '<div class="rsii-err" id="rsii-err" role="alert"></div>';
      cuerpo.innerHTML = h;
      if (v.puede_aplicar) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Validar y pasar al reporte'; pie.appendChild(b);
        b.onclick = function () {
          var err = fondo.querySelector('#rsii-err'), cod = null, mot = null;
          if (v.requiere_remanente_manual) {
            cod = fondo.querySelector('#rsii-cod77').value.trim(); mot = fondo.querySelector('#rsii-motivo').value.trim();
            var m = validarManual(cod, mot); if (m) { err.textContent = m; return; }
          }
          b.disabled = true; b.textContent = 'Guardando…'; err.textContent = '';
          aplicar(o.cliente.id, o.periodo, v.huella, cod, mot).then(function (res) {
            return crearObligacion(o.cliente.rut, res).then(function (ob) {
              cuerpo.innerHTML = '<p class="rsii-ok">✓ Pre-IVA validado y pasado al reporte de ' + esc(mes(o.periodo)) + '.</p>'
                + '<div class="rsii-fila tot"><span>Total F29</span><b>' + esc(fmt(res.montos && res.montos.total_f29)) + '</b></div>'
                + '<div>Remanente anterior: ' + esc(fmt(res.remanente && res.remanente.cod504)) + ' (' + esc(res.remanente && res.remanente.fuente === 'manual' ? 'ingresado a mano' : 'SII') + ')</div>'
                + (ob.estado === 'error' ? '<p class="rsii-av">⚠️ El reporte quedó validado, pero la obligación F29 de Pagos no se pudo crear: avisa a Pagos. (' + esc(mensajeError(ob.mensaje)) + ')</p>' : '')
                + '<div>Siguiente paso: en el Panel de Control, «Cerrar reporte».</div>';
              pie.innerHTML = '<button type="button" class="btn" data-rsii="cerrar">Listo</button>';
              if (typeof o.alTerminar === 'function') o.alTerminar(res);
            });
          }).catch(function (e) { b.disabled = false; b.textContent = 'Validar y pasar al reporte'; err.textContent = mensajeError(e && e.message); });
        };
      }
    }).catch(function (e) {
      cuerpo.innerHTML = '<p class="rsii-bl">' + esc(noInstalada(e) ? 'Esta función aún no está instalada en Gestoor.' : mensajeError(e && e.message)) + '</p>';
    });
  }

  var api = { abrir: abrir, vista: vista, aplicar: aplicar, crearObligacion: crearObligacion, validarManual: validarManual, mensajeError: mensajeError, filasResumen: filasResumen, perGuion: perGuion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaReporteSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
