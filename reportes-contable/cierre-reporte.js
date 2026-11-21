/* REPORTE-AUTO B · R3 · «🔒 Cerrar reporte» en el módulo CONTABLE (regla de flujo de Luciano 19-11).
   PRE-IVA = mes en curso, solo estimado: no valida ni pasa nada al reporte. CONTABLE = período contable: ahí se VALIDA el IVA
   («Validar IVA», pre-iva/iva-validacion.js) y DESPUÉS se cierra aquí. El servidor arma la FOTO del reporte (public.reporte_cierre_vista),
   revisa lo que falta y, al confirmar (public.reporte_cerrar con la huella de lo que se vio), la guarda inmutable, deja el reporte OK,
   crea / confirma / reutiliza la obligación F29 de Pagos (paso siguiente) y lo publica en MiContadoor.
   R3: el cierre exige el IVA validado en Contable (CONTABLE_NO_VALIDADO); ya no hay «puente SII → reporte» dentro del cierre ni se
   ingresa el remanente aquí (se registra en Contable, «Ingresar remanente a mano», antes de validar). Empresas conectadas al SII no
   necesitan libros; las no conectadas, libros de ventas y compras validados (LIBROS_PENDIENTES).
   Reglas que siguen: la factura del mes NO bloquea (aviso interno); RR. HH. bloquea solo si el cliente tiene trabajadores con sueldos
   (si no se sabe, quien cierra lo confirma con una casilla); cierran SOLO el Master o el analista contable asignado; reabre SOLO el
   Master, con motivo (public.reporte_reabrir). reportes_cierres es la fuente oficial: cierresVigentes() marca «Publicado» en Contable y
   en el Panel de Control (que solo lo muestra; ya no cierra).
   R4 (dictamen R3): el servidor exige además la evidencia de «Validar IVA» (VALIDACION_REQUERIDA / VALIDACION_VENCIDA / DATOS_CAMBIARON
   llegan como bloqueos con su mensaje) y muestra con qué se validó (SII o libros, quién y cuándo). «Sin trabajadores» no se ofrece si hay
   antecedentes de RR. HH. (RRHH_ANTECEDENTES_PENDIENTES, no confirmable).
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
    [/REMANENTE_NO_CORRESPONDE/, 'El remanente anterior se registra en Contable («Ingresar remanente a mano») antes de validar el IVA, no al cerrar.'],
    [/^CONTABLE_NO_VALIDADO/, 'El IVA del período aún no está validado en Contable: valídalo («Validar IVA») y después cierra el reporte.'],
    [/DATOS_CAMBIARON/, 'El reporte cambió mientras lo revisabas. Vuelve a abrir «Cerrar reporte».'], [/REAPERTURA_SOLO_MASTER/, 'Solo el Master puede reabrir un reporte cerrado.'],
    [/MOTIVO_OBLIGATORIO/, 'El motivo debe tener entre 10 y 500 caracteres.'], [/SIN_SESION/, 'Tu sesión terminó. Vuelve a ingresar a Gestoor.'],
    [/REPORTE_YA_CERRADO/, 'Este reporte ya está cerrado (otra persona lo cerró). Vuelve a abrir «Cerrar reporte».'],
    // R4 (dictamen R3, D5): «sin trabajadores» solo cuando la situación de RR. HH. es desconocida y sin antecedentes.
    [/RRHH_CONFIRMACION_NO_CORRESPONDE/, 'La situación de RR. HH. de este período no admite marcar «sin trabajadores»: recarga «Cerrar reporte».']];
  function mensajeError(m) {
    m = String(m || '').replace(/<[^>]+>/g, ''); for (var i = 0; i < MAPA.length; i++) if (MAPA[i][0].test(m)) return MAPA[i][1];
    // CIERRE_DETENIDO: la obligación F29 o el OK del reporte se detuvieron; se muestra el motivo del servidor, sin los códigos internos.
    if (/^CIERRE_DETENIDO/.test(m)) return 'El cierre se detuvo: ' + m.replace(/^CIERRE_DETENIDO: [^:]*: /, '').replace(/[A-Z0-9_]{6,}: /g, '').replace(/\b[A-Z][A-Z0-9_]{5,} \(([^()]*)\)/g, '$1').slice(0, 380);
    return m.replace(/^[A-Z0-9_]+: /, '').replace(/\b[A-Z][A-Z0-9_]{5,} \(([^()]*)\)/g, '$1').slice(0, 400) || 'No se pudo completar.';
  }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  // Avisos que también ve el cliente (lista blanca del servidor) e internos (solo el equipo; nunca van en la foto).
  var AVISOS = { IU_PENDIENTE_RRHH: 'El impuesto único de RR. HH. aún no está',
    F29_DECLARADO: 'F29 declarados según Cartapra', F29_SIN_DECLARAR: 'Hay F29 sin declarar según Cartapra',
    F29_OBSERVADO: 'F29 observados por el SII', F29_EN_REVISION: 'F29 en revisión en el SII',
    F29_ESTADO_SIN_VERIFICAR: 'F29 declarados con un estado del SII por verificar',
    F29_NO_ENCONTRADO: 'Interno: F29 no encontrados en una lectura anterior a su vencimiento (verificar antes de decírselo al cliente)',
    F29_NO_VERIFICABLE: 'Interno: la lista de F29 de Cartapra no está completa (no se puede acreditar si falta alguno)',
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
    if (a && /^(OBLIGACION_|F29_SII_DIFIERE|CAMBIOS_VS_VERSION_ANTERIOR|IVA_VALIDADO_CON_SII)/.test(a.codigo)) return 'Interno: ' + (a.mensaje || a.codigo);
    return (AVISOS[a.codigo] || a.mensaje || a.codigo) + (a.periodos && a.periodos.length ? ': ' + a.periodos.join(', ') : '') + '.';
  }
  // Resultado de la obligación F29 que el SERVIDOR registró al cerrar (no la crea el navegador). Paso siguiente: Pagos.
  function textoObligacion(o) {
    var r = o && o.resultado;
    if (r === 'creada') return 'Obligación F29 registrada en Pagos (paso siguiente: transferencia del cliente).';
    if (r === 'reutilizada') return 'La obligación F29 ya estaba en Pagos con el mismo monto (se reutilizó, sin duplicar).';
    if (r === 'actualizada') return 'Obligación F29 de Pagos actualizada (no tenía dinero conciliado).';
    if (r === 'sin_obligacion') return 'El F29 no tiene monto a pagar: no hay obligación en Pagos.';
    return '';
  }
  // Cierres vigentes del período (fuente oficial, AUTO-B03): { reporte_id: {version, cerrado_at} }. Si la tabla no existe aún, {}.
  function cierresVigentes(periodo, f) {
    f = f || (typeof sbFetch === 'function' ? sbFetch : null);
    if (!f || !/^\d{4}-\d{2}$/.test(String(periodo || ''))) return Promise.resolve({});
    return f('reportes_cierres?select=reporte_id,version,cerrado_at&estado=eq.VIGENTE&periodo=eq.' + encodeURIComponent(periodo), { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (filas) { var m = {}; (filas || []).forEach(function (x) { m[String(x.reporte_id)] = { version: x.version, cerrado_at: x.cerrado_at }; }); return m; })
      .catch(function () { return {}; });
  }
  // ¿Todos los bloqueos se resuelven con la confirmación «sin trabajadores con sueldo»? (solo RRHH_SITUACION_DESCONOCIDA)
  function soloConfirmable(bl) { return (bl || []).length > 0 && bl.every(function (b) { return b && b.confirmable === true; }); }
  // Filas del resumen de la foto (puras, se prueban aparte)
  function filasFoto(d) {
    var f = [], i = (d && d.impuestos) || {}, r = (d && d.rrhh) || {}, s = (d && d.servicios) || {};
    if (i.estado === 'ok') {
      f.push(['Impuestos F29 (validado en Contable' + (i.fuente === 'sii' ? ', datos del SII' : '') + ')', fmt(i.total_f29)]);
      f.push(['· IVA a pagar', fmt(i.iva_pagar)], ['· PPM', fmt(i.ppm)], ['· Retención honorarios', fmt(i.ret_hon)],
             ['· Impuesto único', i.iu_pendiente ? 'Pendiente RR. HH.' : i.iu_estado === 'no_aplica' ? 'No aplica ($0, sin trabajadores)' : fmt(i.iu)]);
      f.push(['· Remanente anterior (' + ({ sii: 'SII', manual: 'a mano', mes_anterior: 'mes anterior' }[i.remanente_anterior_fuente] || '—') + ')', fmt(i.remanente_anterior)]);
      if (i.vence) f.push(['· Vence', String(i.vence).split('-').reverse().join('-')]);
    } else f.push(['Impuestos F29', i.estado === 'no_aplica' ? 'No aplica' : 'Pendiente (valida el IVA en Contable)']);
    f.push(['RR. HH.', r.estado === 'listo' ? fmt(r.cotizaciones) + ' cotizaciones' : r.estado !== 'no_aplica' ? 'Pendiente'
      : r.confirmacion === 'requerida' ? 'Sin confirmar si hubo trabajadores' : r.confirmacion === 'cierre' ? 'No aplica (confirmado al cerrar)' : 'No aplica (sin trabajadores con sueldo)']);
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
    + '.crep-pie{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #3a2b40}'
    // Distintivos de fuente (AUTO-A02), mismos que el Pre-IVA.
    + '.rsii-f{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;vertical-align:1px}'
    + '.rsii-f-sii{background:rgba(95,211,154,.15);color:#5fd39a;border:1px solid rgba(95,211,154,.45)}'
    + '.rsii-f-man{background:rgba(255,196,0,.14);color:#ffc400;border:1px solid rgba(255,196,0,.5)}'
    + '.rsii-f-ges{background:rgba(200,143,202,.14);color:#d6a5d7;border:1px solid rgba(200,143,202,.45)}';

  function abrir(o) {
    // o = { reporteId, empresa, periodoTxt, alTerminar(estado, fechaEnvio, version) } — lo abre el Reporte Contable (R3)
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
          var dif = v.cierre.cambios_despues_del_cierre || [];
          if (dif.length) h += '<p class="crep-av">🗂️ Interno: el reporte cambió después del cierre (' + esc(dif.map(function (d) { return d.campo; }).join(', ')) + '). La foto publicada no cambia; para corregirla, el Master reabre.</p>';
          if (v.puede_reabrir) h += '<label>Motivo de la reapertura (solo Master, queda registrado)<textarea id="crep-mot" rows="2" maxlength="500"></textarea></label>';
          h += (avisoPost ? '<p class="crep-ok">' + esc(avisoPost) + '</p>' : '') + '<div class="crep-err" id="crep-err" role="alert"></div>'; c.innerHTML = h; avisoPost = '';
          if (v.puede_reabrir) {
            var br = boton('Reabrir reporte cerrado', 'btn-s', function (b) {
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
        var e = v.evaluacion || {}, bl = e.bloqueos || [], conf = soloConfirmable(bl);
        h += '<p class="crep-av">ℹ️ ' + esc(e.conectada_sii ? 'Empresa conectada al SII: el IVA se valida en Contable comparando con el SII (no se piden libros).'
          : 'Empresa no conectada al SII: se exigen los libros de ventas y compras validados en Contable.') + '</p>';
        if (e.validacion_iva) h += '<p class="crep-av">✅ ' + esc('IVA validado con ' + (e.validacion_iva.metodo === 'sii' ? 'los datos del SII' : 'los libros') + ' por '
          + (e.validacion_iva.validado_por || '—') + ' el ' + fecha(e.validacion_iva.validado_at)) + '</p>';
        bl.forEach(function (b) { h += '<p class="crep-bl">⛔ ' + esc(b.mensaje || b.codigo) + '</p>'; });
        (e.avisos || []).forEach(function (a) { h += '<p class="crep-av">⚠️ ' + esc(textoAviso(a)) + '</p>'; });
        (e.avisos_internos || []).forEach(function (a) { h += '<p class="crep-av">🗂️ ' + esc(textoAviso(a)) + '</p>'; });
        filasFoto(e.datos).forEach(function (f) { h += '<div class="crep-f"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; });
        h += '<p style="font-size:11.5px;opacity:.8;margin:0">Al cerrar se guarda esta foto tal cual (no cambia después), el reporte contable queda OK y «enviado», la obligación F29 pasa a Pagos y el cliente lo ve en MiContadoor con «Validado por Contadoor».</p>'
          + '<div class="crep-err" id="crep-err" role="alert"></div>';
        c.innerHTML = h;
        if (!v.puede_cerrar) { c.insertAdjacentHTML('beforeend', '<p class="crep-av">Tu usuario no puede cerrar este reporte (solo el Master o el analista contable asignado).</p>'); return; }
        if (bl.length && !conf) return;
        if (conf) c.insertAdjacentHTML('beforeend', '<label style="flex-direction:row;align-items:flex-start;gap:8px"><input type="checkbox" id="crep-sintrab" style="width:auto;margin-top:2px">'
          + '<span>Confirmo que el cliente <b>no tuvo trabajadores con sueldo</b> en el período (el impuesto único va en $0). Queda registrado con mi nombre.</span></label>');
        var bc = boton('🔒 Cerrar reporte', 'btn-p', function (b) {
          var er = fondo.querySelector('#crep-err'), st = fondo.querySelector('#crep-sintrab');
          if (conf && !(st && st.checked)) { er.textContent = 'Marca la confirmación de que el cliente no tuvo trabajadores con sueldo, o pide a RR. HH. que lo confirme.'; return; }
          b.disabled = true; b.textContent = 'Cerrando…'; er.textContent = '';
          rpc('reporte_cerrar', { p_reporte_id: Number(o.reporteId), p_huella: e.huella, p_rem_cod77: null, p_rem_motivo: null,
                                  p_confirma_sin_trabajadores: !!(conf && st && st.checked) }).then(function (r) {
            if (typeof o.alTerminar === 'function') o.alTerminar('enviado', r.fecha_envio, r.version);
            // La obligación F29 ya quedó en Pagos en el mismo cierre (servidor). Solo se informa.
            avisoPost = textoObligacion(r && r.obligacion_f29);
            cargar();
          }).catch(function (x) { b.disabled = false; b.textContent = '🔒 Cerrar reporte'; er.textContent = mensajeError(x && x.message); });
        }); bc.setAttribute('data-acc', '1');
      }).catch(function (e) { c.innerHTML = '<p class="crep-bl">' + esc(noInstalada(e) ? 'El cierre de reportes aún no está instalado en Gestoor.' : mensajeError(e && e.message)) + '</p>'; });
    }
    cargar();
  }
  var api = { abrir: abrir, filasFoto: filasFoto, textoAviso: textoAviso, mensajeError: mensajeError,
              textoObligacion: textoObligacion, cierresVigentes: cierresVigentes, soloConfirmable: soloConfirmable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.GestoorCierreReporte = api;
})(typeof window !== 'undefined' ? window : globalThis);
