/* ============================================================
   pre-iva/reporte-sii.js — «Revisar y pasar al reporte (opcional)» (REPORTE-AUTO A).
   OPCIONAL (decisión de Luciano 19-11): «🔒 Cerrar reporte» del Panel pasa los datos del SII al reporte por sí solo. Aquí el
   analista contable responsable (o el Master) puede revisar el Pre-IVA calculado con los datos del SII (Cartapra) y pasar los montos
   antes, EN EL SERVIDOR (RPC public.reporte_aplicar_preiva_sii). El Panel reusa validarManual, filasResumen y textoObligacion.
   Esta pantalla NO calcula ni envía montos:
     1) pide la vista al servidor (public.reporte_preiva_sii_vista): montos, remanente, bloqueos, avisos y huella;
     2) si no hay F29 del mes anterior en Cartapra, pide el remanente anterior (cód. 77) A MANO con un motivo (≥ 10 caracteres);
     3) confirma con la huella (si los datos del SII cambiaron entremedio, el servidor rechaza: DATOS_CAMBIARON);
     4) R2 (AUTO-B01): la obligación F29 de Pagos la crea / reutiliza EL SERVIDOR en la misma transacción (el navegador ya no
        llama a crear_obligacion); la pantalla solo muestra el resultado (obligacion_f29).
   R2 (AUTO-A02): cada fila muestra de dónde sale el dato (SII, a mano con motivo, mes anterior de Gestoor, ficha) con un distintivo.
   R2 (AUTO-A03): si RR. HH. no informó el impuesto único (o no se sabe si hubo trabajadores) el servidor NO deja pasar el F29.
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
    [/DATOS_CAMBIARON/, 'Los datos del SII cambiaron mientras revisabas. Vuelve a abrir «Revisar y pasar al reporte».'],
    [/REPORTE_YA_VALIDADO/, 'Este Pre-IVA ya está validado en el reporte. Para cambiarlo, el Master reabre el reporte contable.'],
    [/REPORTE_CERRADO/, 'El reporte ya está cerrado. El Master debe reabrirlo primero.'],
    [/REPORTE_NO_EXISTE/, 'No existe el reporte de este período (la nómina la genera el Master).'],
    [/OBLIGACION_CONCURRENTE/, 'Otra persona registró la obligación F29 al mismo tiempo. Vuelve a intentarlo.']
  ];
  function mensajeError(msg) {
    var m = String(msg || '').replace(/<[^>]+>/g, '');
    for (var i = 0; i < MAPA.length; i++) if (MAPA[i][0].test(m)) return MAPA[i][1];
    // «PREIVA_SII_BLOQUEADO: CODIGO (mensaje); CODIGO2 (mensaje2)» → solo los mensajes, sin códigos internos.
    return m.replace(/^[A-Z0-9_]+: /, '').replace(/\b[A-Z][A-Z0-9_]{5,} \(([^()]*)\)/g, '$1').slice(0, 400) || 'No se pudo completar. Inténtalo de nuevo.';
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
  // R2 (AUTO-B01): la obligación F29 de Pagos ya NO la crea el navegador. El servidor la crea, reutiliza o actualiza (si no tiene
  // dinero conciliado) en la misma transacción, o detiene todo con explicación. Aquí solo se traduce el resultado para mostrarlo.
  function textoObligacion(o) {
    var r = o && o.resultado;
    if (r === 'creada') return 'Obligación F29 registrada en Pagos.';
    if (r === 'reutilizada') return 'La obligación F29 ya estaba en Pagos con el mismo monto (se reutilizó, sin duplicar).';
    if (r === 'actualizada') return 'Obligación F29 de Pagos actualizada (no tenía dinero conciliado).';
    if (r === 'sin_obligacion') return 'El F29 no tiene monto a pagar: no hay obligación en Pagos.';
    return '';
  }
  // Fuente de cada dato (AUTO-A02): distintivo visible para no confundir lo del SII con lo ingresado a mano.
  var FUENTES = { sii: ['SII', 'rsii-f-sii'], manual: ['A mano', 'rsii-f-man'], mes_anterior: ['Gestoor', 'rsii-f-ges'], ficha: ['Ficha', 'rsii-f-ges'], rrhh: ['RR. HH.', 'rsii-f-ges'] };
  function chipFuente(k) { var x = FUENTES[k]; return x ? '<span class="rsii-f ' + x[1] + '">' + x[0] + '</span>' : ''; }

  // Filas del resumen (puras, se prueban aparte). Tercer elemento = fuente del dato (AUTO-A02).
  function fuenteRemanente(r) { return r.accion === 'registrar_sii' ? 'sii' : r.fuente === 'manual' ? 'manual' : r.fuente === 'mes_anterior' ? 'mes_anterior' : r.fuente === 'sii' ? 'sii' : null; }
  function filasResumen(v) {
    var p = (v && v.previa) || null, e = (v && v.entrada) || {}, r = (v && v.remanente) || {};
    if (!p) return [];
    var remTxt = r.accion === 'registrar_sii' ? 'del F29 del SII (cód. 77 ' + fmt(r.cod77) + ' × UTM)' : r.fuente === 'manual' ? 'ingresado a mano, con motivo' : r.fuente === 'mes_anterior' ? 'del reporte del mes anterior' : 'del SII';
    var iu = v.rrhh && v.rrhh.iu_estado;
    var f = [['IVA débito (ventas del SII, notas de crédito restadas)', fmt(p.debito), 'sii'], ['IVA crédito (compras registradas)', fmt(p.credito), 'sii'],
             ['Remanente anterior (cód. 504) · ' + remTxt, fmt(p.remanente_anterior), fuenteRemanente(r)], ['IVA a pagar', fmt(p.iva_pagar)]];
    if (p.remanente_siguiente > 0) f.push(['Remanente para el mes siguiente', fmt(p.remanente_siguiente)]);
    f.push(['PPM · tasa ' + (e.ppm_tasa == null ? '—' : String(e.ppm_tasa).replace('.', ',')) + ' % (' + (e.ppm_tasa_fuente === 'sii' ? 'F29 del SII' : 'ficha') + ')', fmt(p.ppm), e.ppm_tasa_fuente === 'sii' ? 'sii' : 'ficha']);
    f.push(['Retención boletas de honorarios', fmt(p.ret_hon), 'sii']);
    f.push(['Impuesto único (RR. HH.)', v.iu_pendiente ? 'Pendiente RR. HH.' : iu === 'no_aplica' ? 'No aplica (sin trabajadores)' : iu === 'desconocido' ? 'Por confirmar' : fmt(p.iu), 'rrhh']);
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
    + '.rsii-err{color:#ff8a7a;font-size:12px}.rsii-ok{color:#5fd39a;font-weight:700}'
    + '.rsii-f{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;vertical-align:1px}'
    + '.rsii-f-sii{background:rgba(95,211,154,.15);color:#5fd39a;border:1px solid rgba(95,211,154,.45)}'
    + '.rsii-f-man{background:rgba(255,196,0,.14);color:#ffc400;border:1px solid rgba(255,196,0,.5)}'
    + '.rsii-f-ges{background:rgba(200,143,202,.14);color:#d6a5d7;border:1px solid rgba(200,143,202,.45)}';
  function estilo() { if (document.getElementById('rsii-css')) return; var s = document.createElement('style'); s.id = 'rsii-css'; s.textContent = CSS; document.head.appendChild(s); }

  function abrir(o) {
    // o = { cliente: {id, rut, razon}, periodo: 'AAAAMM' | 'AAAA-MM', alTerminar: fn }
    if (!o || !o.cliente || !o.cliente.id) { alert('Selecciona un cliente primero.'); return; }
    estilo();
    var viejo = document.getElementById('rsii-fondo'); if (viejo) viejo.remove();
    var fondo = document.createElement('div'); fondo.id = 'rsii-fondo'; fondo.className = 'rsii-fondo';
    fondo.innerHTML = '<div class="rsii" role="dialog" aria-modal="true" aria-labelledby="rsii-t"><div class="rsii-cab"><h3 id="rsii-t">Revisar y pasar al reporte · ' + esc(mes(o.periodo)) + '</h3>'
      + '<button type="button" class="btn sec chico" data-rsii="cerrar" aria-label="Cerrar">×</button></div><div class="rsii-cuerpo" id="rsii-cuerpo">Consultando al servidor…</div>'
      + '<div class="rsii-pie" id="rsii-pie"><button type="button" class="btn sec" data-rsii="cerrar">Cancelar</button></div></div>';
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); }
    fondo.addEventListener('click', function (ev) { var b = ev.target.closest('[data-rsii="cerrar"]'); if (b || ev.target === fondo) cerrar(); });
    var cuerpo = fondo.querySelector('#rsii-cuerpo'), pie = fondo.querySelector('#rsii-pie');
    vista(o.cliente.id, o.periodo).then(function (v) {
      var h = '<div><b>' + esc(o.cliente.razon || o.cliente.rut || '') + '</b> · los montos los calcula el servidor con los datos del SII (Cartapra)</div>'
        + '<p class="rsii-av">ℹ️ Este paso es opcional: si no lo haces, «🔒 Cerrar reporte» en el Panel pasa estos mismos montos al cerrar.</p>';
      (v.bloqueos || []).forEach(function (b) { h += '<p class="rsii-bl">⛔ ' + esc(b.mensaje || b.codigo) + '</p>'; });
      (v.avisos || []).forEach(function (a) { h += '<p class="rsii-av">⚠️ ' + esc(a.mensaje || a.codigo) + '</p>'; });
      if (v.remanente && v.remanente.aviso) h += '<p class="rsii-av">⚠️ ' + esc(v.remanente.aviso) + '</p>';
      filasResumen(v).forEach(function (f, i, arr) { h += '<div class="rsii-fila' + (i === arr.length - 1 ? ' tot' : '') + '"><span>' + esc(f[0]) + chipFuente(f[2]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
      if (v.requiere_remanente_manual) {
        h += '<p class="rsii-av">✍️ ' + esc(v.remanente.mensaje) + '</p>'
          + '<label>Remanente anterior · cód. 77 del F29 de ' + esc(mes((v.entrada && v.entrada.remanente_sii && v.entrada.remanente_sii.periodo) || '')) + ' (en pesos)'
          + '<input id="rsii-cod77" inputmode="numeric" placeholder="0" autocomplete="off"></label>'
          + '<label>Motivo (de dónde sale el monto) · queda registrado con tu nombre<textarea id="rsii-motivo" rows="2" maxlength="500" placeholder="Ej.: F29 septiembre 2026 presentado en papel, cód. 77, folio …"></textarea></label>';
      }
      if (v.requiere_confirmacion_rrhh) h += '<p class="rsii-av">ℹ️ Si el cliente no tuvo trabajadores con sueldo este mes, eso se confirma en «🔒 Cerrar reporte» del Panel (queda registrado con tu nombre).</p>';
      h += '<div class="rsii-err" id="rsii-err" role="alert"></div>';
      cuerpo.innerHTML = h;
      if (v.puede_aplicar) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Pasar al reporte ahora'; pie.appendChild(b);
        b.onclick = function () {
          var err = fondo.querySelector('#rsii-err'), cod = null, mot = null;
          if (v.requiere_remanente_manual) {
            cod = fondo.querySelector('#rsii-cod77').value.trim(); mot = fondo.querySelector('#rsii-motivo').value.trim();
            var m = validarManual(cod, mot); if (m) { err.textContent = m; return; }
          }
          b.disabled = true; b.textContent = 'Guardando…'; err.textContent = '';
          aplicar(o.cliente.id, o.periodo, v.huella, cod, mot).then(function (res) {
            cuerpo.innerHTML = '<p class="rsii-ok">✓ Montos del SII pasados al reporte de ' + esc(mes(o.periodo)) + '.</p>'
              + '<div class="rsii-fila tot"><span>Total F29</span><b>' + esc(fmt(res.montos && res.montos.total_f29)) + '</b></div>'
              + '<div>Remanente anterior: ' + esc(fmt(res.remanente && res.remanente.cod504)) + chipFuente(res.remanente && res.remanente.fuente) + '</div>'
              + (textoObligacion(res.obligacion_f29) ? '<div>' + esc(textoObligacion(res.obligacion_f29)) + '</div>' : '')
              + '<div>Siguiente paso: en el Panel de Control, «🔒 Cerrar reporte».</div>';
            pie.innerHTML = '<button type="button" class="btn" data-rsii="cerrar">Listo</button>';
            if (typeof o.alTerminar === 'function') o.alTerminar(res);
          }).catch(function (e) { b.disabled = false; b.textContent = 'Pasar al reporte ahora'; err.textContent = mensajeError(e && e.message); });
        };
      }
    }).catch(function (e) {
      cuerpo.innerHTML = '<p class="rsii-bl">' + esc(noInstalada(e) ? 'Esta función aún no está instalada en Gestoor.' : mensajeError(e && e.message)) + '</p>';
    });
  }

  var api = { abrir: abrir, vista: vista, aplicar: aplicar, textoObligacion: textoObligacion, chipFuente: chipFuente, validarManual: validarManual, mensajeError: mensajeError, filasResumen: filasResumen, perGuion: perGuion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaReporteSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
