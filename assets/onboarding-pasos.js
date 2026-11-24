/* ============================================================
   assets/onboarding-pasos.js — ONBOARDING-L2 (19-11-2026): la lista de 15 pasos del onboarding.
   Se usa en Comercial → Onboarding y en la ficha del cliente (clientes/onboarding-ficha.js).
   · Datos SOLO por RPC: onb_pasos / onb_pasos_cliente (leer), onb_paso_marcar (marcar), onb_activar (pasar a activo, solo Master).
   · Casi todos los pasos se marcan solos leyendo Gestoor y el SII; aquí solo se marca lo manual (o «no aplica» / «bloqueado
     por el cliente», con motivo). Cada marca envía su versión (no pisa lo de otra persona).
   · Todo dato de la base se pinta con textContent (nunca innerHTML con datos).
   Uso: OnbPasos.render(elemento, datos, { rpc: fn(nombre, args) → Promise, alCambiar: fn(datosNuevos), compacto: bool, enlaceCaso: bool })
   · ONBOARDING-V2 (23-11-2026): si datos.lista_version === 2 se pinta la lista nueva (renderV2): 10 pasos en DOS TRAMOS con su cuenta
     regresiva (Activación = 3 días corridos · Diagnóstico = 7 días hábiles de Chile), responsable(s) y estado de cada paso; «listo» pide
     la fecha (reunión) o el enlace https (diagnóstico) cuando corresponde, y se marca con onb_paso_marcar_v2. La lista 1 (15 pasos de L2)
     se sigue pintando EXACTAMENTE igual que antes.
   ============================================================ */
(function () {
  'use strict';
  var RESP = { comercial: 'Comercial', master: 'Master', contable: 'Contable', rrhh: 'RR. HH.', pagos: 'Pagos', facturacion: 'Facturación' };
  var EST = {
    listo: ['✓', 'Listo', 'onbp-ok'], no_aplica: ['–', 'No aplica', 'onbp-na'], en_curso: ['◐', 'En curso', 'onbp-cur'],
    pendiente: ['○', 'Pendiente', 'onbp-pen'], bloqueado_cliente: ['⏸', 'Esperando al cliente', 'onbp-blo']
  };
  var MSJ = {
    SIN_PERMISO_PASO: 'Ese paso lo marca otra área.', PASO_AUTOMATICO: 'Ese paso se marca solo cuando Gestoor detecta el dato.',
    NO_APLICA_NO_PERMITIDO: 'Ese paso no se puede marcar como «no aplica».', MOTIVO_OBLIGATORIO: 'Escribe el motivo (mínimo 5 letras).',
    CLAVE_PROHIBIDA: 'No anotes claves aquí.', PASO_YA_LISTO: 'Ese paso ya está listo.', VERSION_CONFLICTO: 'Otra persona cambió este paso recién. Recargamos.',
    CASO_CERRADO: 'Este onboarding ya terminó.', SOLO_MASTER: 'Solo el Master pasa el cliente a activo.', FALTAN_PASOS: 'Aún faltan pasos obligatorios.',
    CLIENTE_NO_EN_ONBOARDING: 'El cliente ya no está en onboarding.', SIN_PERMISO: 'No tienes acceso a este onboarding.',
    FALTA_FECHA: 'Indica la fecha de la reunión.', FECHA_INVALIDA: 'La fecha no corresponde (no puede ser antes de la aceptación ni, si ya se realizó, en el futuro).',
    FALTA_ENLACE: 'Pega el enlace del diagnóstico emitido.', ENLACE_INVALIDO: 'El enlace debe empezar con https:// y no llevar espacios.',
    FALTA_REQUISITO: 'Todavía falta el requisito de ese paso (míralo en el detalle).', DATOS_INVALIDOS: 'Hay un dato que no corresponde a ese paso.'
  };
  function msg(e) { var m = String(e && e.message || e || ''); for (var k in MSJ) if (m.indexOf(k) >= 0) return MSJ[k]; return 'No se pudo guardar. Intenta de nuevo.'; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fecha(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '-' + p[1] : ''; }
  function estilos() {
    if (document.getElementById('onbp-css')) return;
    var s = el('style'); s.id = 'onbp-css';
    s.textContent = [
      '.onbp{margin-top:14px;border:1px solid #4A2B50;border-radius:18px;background:rgba(42,20,48,.72);padding:14px 16px;color:#F3E9F4}',
      '.onbp-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.onbp-hd h3{font:800 15px var(--g-titulo,Montserrat,sans-serif);margin:0;flex:1}',
      '.onbp-hd h3 span{color:#E39BE5}.onbp-cnt{font-size:13px;color:#C9A8CC}.onbp-cnt b{color:#F3E9F4}',
      '.onbp-bar{height:8px;border-radius:99px;background:#2A1430;margin:10px 0 4px;overflow:hidden}.onbp-bar i{display:block;height:100%;background:#46D69A;border-radius:99px}',
      '.onbp-aviso{font-size:12.5px;margin:6px 0 2px;color:#FFC85A}.onbp-aviso.ok{color:#46D69A}',
      '.onbp-l{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}',
      '.onbp-p{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:4px 10px;align-items:start;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.18)}',
      '.onbp-i{width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}',
      '.onbp-ok .onbp-i{color:#46D69A;background:rgba(70,214,154,.16)}.onbp-na .onbp-i{color:#C9A8CC;background:rgba(201,168,204,.14)}',
      '.onbp-cur .onbp-i{color:#5CC8FF;background:rgba(92,200,255,.16)}.onbp-pen .onbp-i{color:#C9A8CC;background:rgba(255,255,255,.06)}',
      '.onbp-blo .onbp-i{color:#FFC85A;background:rgba(255,200,90,.16)}.onbp-p.atraso{box-shadow:inset 3px 0 0 #FF8A7A}',
      '.onbp-t{font-size:13.5px;font-weight:600;min-width:0}.onbp-t small{display:block;font-weight:400;color:#C9A8CC;font-size:12px;margin-top:2px;overflow-wrap:anywhere}',
      '.onbp-t em{font-style:normal;color:#FF8A7A}.onbp-r{justify-self:start;align-self:start;font-size:11px;color:#E39BE5;background:rgba(227,155,229,.12);border-radius:99px;padding:2px 8px;white-space:nowrap;text-decoration:none}',
      '.onbp-acc{grid-column:2/4;display:flex;gap:6px;flex-wrap:wrap}.onbp-acc button{font:600 12px Inter,sans-serif;border:1px solid #4A2B50;background:transparent;color:#F3E9F4;border-radius:99px;padding:4px 10px;cursor:pointer;min-height:28px}',
      '.onbp-acc button:hover{background:#3a1d40}.onbp-acc button.p{border-color:#46D69A;color:#46D69A}',
      '.onbp-mot{grid-column:2/4;display:flex;gap:6px}.onbp-mot input{flex:1;min-width:0;font-size:13px;border-radius:10px;border:1px solid #4A2B50;background:#1b0d1f;color:#F3E9F4;padding:6px 10px}',
      '.onbp-pie{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.onbp-msg{font-size:12.5px;color:#C9A8CC}.onbp-msg.err{color:#FF8A7A}.onbp-msg.ok{color:#46D69A}',
      '.onbp-act{font:700 13px Inter,sans-serif;border:0;border-radius:12px;background:#46D69A;color:#0d2a1e;padding:9px 14px;cursor:pointer}',
      '.onbp-act[disabled]{opacity:.45;cursor:not-allowed}',
      '@media (max-width:620px){.onbp-p{grid-template-columns:26px minmax(0,1fr)}.onbp-r{grid-column:2}.onbp-acc,.onbp-mot{grid-column:1/3}}'
    ].join('');
    document.head.appendChild(s);
  }

  function render(cont, d, op) {
    op = op || {}; estilos(); cont.textContent = '';
    if (!d) return;
    if (d.lista_version === 2) return renderV2(cont, d, op);
    var abierto = d.estado_caso === 'cliente_creado' && !d.activado_at, areas = (d.yo && d.yo.areas) || [];
    var box = el('div', 'onbp'), hd = el('div', 'onbp-hd'), h3 = el('h3');
    h3.appendChild(document.createTextNode('🚀 Onboarding ')); h3.appendChild(el('span', null, d.activado_at ? 'terminado' : 'en curso'));
    hd.appendChild(h3);
    var cnt = el('span', 'onbp-cnt'); cnt.appendChild(el('b', null, String(d.resumen.listos))); cnt.appendChild(document.createTextNode(' de 15 listos'));
    hd.appendChild(cnt);
    if (op.enlaceCaso) { var a = el('a', 'onbp-r', 'Abrir en Onboarding'); a.href = '../prospectos/onboarding.html?caso=' + Number(d.caso_id); hd.appendChild(a); }
    box.appendChild(hd);
    var bar = el('div', 'onbp-bar'), bi = el('i'); bi.style.width = Math.round(100 * d.resumen.listos / 15) + '%'; bar.appendChild(bi); box.appendChild(bar);
    if (d.activado_at) box.appendChild(el('p', 'onbp-aviso ok', '✅ Cliente activo desde el ' + fecha(d.activado_at) + (d.activado_por ? ' · lo activó ' + d.activado_por : '')));
    else if (d.resumen.vencidos > 0) box.appendChild(el('p', 'onbp-aviso', '⏰ ' + d.resumen.vencidos + (d.resumen.vencidos === 1 ? ' paso atrasado' : ' pasos atrasados')));
    else if (d.listo_para_activar) box.appendChild(el('p', 'onbp-aviso ok', 'Todo lo obligatorio está listo: el Master puede pasarlo a activo.'));

    var ul = el('ol', 'onbp-l');
    (d.pasos || []).forEach(function (p) {
      if (op.compacto && (p.estado === 'listo' || p.estado === 'no_aplica')) return;
      var e = EST[p.estado] || EST.pendiente, li = el('li', 'onbp-p ' + e[2] + (p.dias_atraso > 0 ? ' atraso' : ''));
      var ic = el('span', 'onbp-i', e[0]); ic.title = e[1]; li.appendChild(ic);
      var t = el('div', 'onbp-t'); t.appendChild(document.createTextNode(p.paso + '. ' + p.titulo + (p.obligatorio ? '' : ' (opcional)')));
      var sub = [e[1]];
      if (p.evidencia) sub.push(p.evidencia);
      if (p.marca && p.marca.motivo) sub.push('«' + p.marca.motivo + '»' + (p.marca.por ? ' · ' + p.marca.por : ''));
      var sm = el('small', null, sub.join(' · '));
      if (p.dias_atraso > 0) { sm.appendChild(document.createTextNode(' · ')); sm.appendChild(el('em', null, 'atrasado ' + p.dias_atraso + ' día' + (p.dias_atraso === 1 ? '' : 's'))); }
      else if (abierto && p.estado !== 'listo' && p.estado !== 'no_aplica') sm.appendChild(document.createTextNode(' · vence el ' + fecha(p.vence)));
      t.appendChild(sm); li.appendChild(t);
      li.appendChild(el('span', 'onbp-r', RESP[p.responsable] || p.responsable));
      var puede = abierto && areas.indexOf(p.responsable) >= 0 && p.estado_auto !== 'listo' && p.estado_auto !== 'no_aplica' && typeof op.rpc === 'function';
      if (puede) {
        var acc = el('div', 'onbp-acc');
        function boton(txt, estado, motivo, cls) {
          var b = el('button', cls || null, txt); b.type = 'button';
          b.onclick = function () {
            if (!motivo) return marcar(p, estado, null);
            var f = el('div', 'onbp-mot'), inp = el('input'); inp.maxLength = 500; inp.placeholder = 'Motivo (obligatorio)';
            inp.setAttribute('aria-label', 'Motivo para ' + p.titulo);
            var g = el('button', 'p', 'Guardar'); g.type = 'button'; g.onclick = function () { marcar(p, estado, inp.value); };
            f.appendChild(inp); f.appendChild(g); if (li.querySelector('.onbp-mot')) li.removeChild(li.querySelector('.onbp-mot')); li.appendChild(f); inp.focus();
          };
          acc.appendChild(b);
        }
        if (p.manual_listo && p.estado !== 'listo') boton('✓ Marcar listo', 'listo', false, 'p');
        if (p.estado !== 'bloqueado_cliente') boton('⏸ Esperando al cliente', 'bloqueado_cliente', true);
        if (p.permite_no_aplica && p.estado !== 'no_aplica') boton('No aplica', 'no_aplica', true);
        if (p.marca) boton('Quitar marca', 'pendiente', false);
        li.appendChild(acc);
      }
      ul.appendChild(li);
    });
    if (op.compacto && !ul.children.length) ul.appendChild(el('li', 'onbp-aviso ok', 'Todos los pasos están listos.'));
    box.appendChild(ul);

    var pie = el('div', 'onbp-pie'), msgEl = el('span', 'onbp-msg'); msgEl.setAttribute('role', 'status');
    if (abierto && d.yo && d.yo.master && typeof op.rpc === 'function') {
      var act = el('button', 'onbp-act', '✅ Pasar a activo'); act.type = 'button'; act.disabled = !d.puede_activar;
      if (!d.puede_activar) act.title = 'Faltan pasos obligatorios';
      act.onclick = function () {
        if (!window.confirm('¿Pasar a ' + (d.razon_social || 'este cliente') + ' a «activo»?\n\nTermina su onboarding y queda en el ciclo mensual normal.')) return;
        act.disabled = true; aviso('Activando…');
        op.rpc('onb_activar', { p_caso_id: Number(d.caso_id), p_actualizado: d.actualizado }).then(function (n) {
          render(cont, n, op); if (op.alCambiar) op.alCambiar(n);
        }).catch(function (e) { act.disabled = false; aviso(msg(e), 'err'); if (/VERSION_CONFLICTO/.test(String(e && e.message)) && op.recargar) op.recargar(); });
      };
      pie.appendChild(act);
    }
    pie.appendChild(msgEl); box.appendChild(pie); cont.appendChild(box);

    function aviso(t, cls) { msgEl.className = 'onbp-msg ' + (cls || ''); msgEl.textContent = t; }
    function marcar(p, estado, motivo) {
      aviso('Guardando…');
      op.rpc('onb_paso_marcar', { p_caso_id: Number(d.caso_id), p_paso: Number(p.paso), p_estado: estado, p_motivo: motivo,
        p_version: p.marca ? p.marca.actualizado : null }).then(function (n) {
        render(cont, n, op); if (op.alCambiar) op.alCambiar(n);
      }).catch(function (e) { aviso(msg(e), 'err'); if (/VERSION_CONFLICTO/.test(String(e && e.message)) && op.recargar) op.recargar(); });
    }
  }

  // ───────────────────────── ONBOARDING-V2: dos tramos ─────────────────────────
  // Íconos de línea (mismos trazos que gIcon) creados con createElementNS: nada de innerHTML. Van dentro de <i class="ic ic-…"> con su matiz.
  var ICO = {
    reloj: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 6v6l4 2'],
    diag: ['M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'm9 14 2 2 4-4'],
    alerta: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 8v4', 'M12 16h.01'],
    enlace: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']
  };
  function icono(nombre, matiz) {
    var i = el('i', 'ic ic-' + (matiz || nombre));
    if (!document.createElementNS) return i;
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    (ICO[nombre] || []).forEach(function (dd) { var p = document.createElementNS(ns, 'path'); p.setAttribute('d', dd); s.appendChild(p); });
    i.appendChild(s); return i;
  }
  function fechaLarga(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function estilosV2() {
    if (document.getElementById('onbp2-css')) return;
    var s = el('style'); s.id = 'onbp2-css';
    s.textContent = [
      '.onbp-tramos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 4px}',
      '.onbp-tr{border:1px solid #4A2B50;border-radius:14px;background:rgba(0,0,0,.2);padding:10px 12px;display:grid;grid-template-columns:34px minmax(0,1fr);gap:2px 10px;align-items:center}',
      '.onbp-tr .ic{grid-row:1/3;width:30px;height:30px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center}',
      '.onbp-tr .ic svg{width:17px;height:17px}.ic-reloj{color:#5CC8FF;background:rgba(92,200,255,.16)}.ic-diag{color:#E39BE5;background:rgba(227,155,229,.16)}',
      '.ic-alerta{color:#FFC85A;background:rgba(255,200,90,.16)}.ic-enlace{color:#5CC8FF}',
      '.onbp-tr b{font:800 13.5px var(--g-titulo,Montserrat,sans-serif)}.onbp-tr b small{font:400 12px Inter,sans-serif;color:#C9A8CC;margin-left:6px}',
      '.onbp-cd{font-size:12.5px;color:#F3E9F4;font-weight:600}.onbp-cd.ok{color:#46D69A}.onbp-cd.mal{color:#FF8A7A}.onbp-cd.pronto{color:#FFC85A}',
      '.onbp-tr .onbp-bar{grid-column:1/3;margin:6px 0 0;height:6px}.onbp-tr.cumplido{border-color:#2f6b52}',
      '.onbp-grp{font:700 12px Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#C9A8CC;margin:14px 0 -2px}',
      '.onbp-t em.cli{color:#FFC85A}.onbp-t a{color:#5CC8FF;text-decoration:none;display:inline-flex;align-items:center;gap:4px}.onbp-t a .ic{width:auto;height:auto;padding:0;margin:0;background:none;border:0;display:inline-flex}.onbp-t a .ic svg{width:13px;height:13px}',
      '.onbp-falta{color:#FFC85A!important}.onbp-cal{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#FFC85A;margin:6px 0 0}',
      '.onbp-cal .ic{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center}.onbp-cal .ic svg{width:14px;height:14px}',
      '.onbp-acc button[disabled]{opacity:.45;cursor:not-allowed}',
      '.onbp-mot input[type=date]{flex:0 0 auto;color-scheme:dark}',
      '@media (max-width:620px){.onbp-tramos{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(s);
  }
  function cuenta(t) {
    if (t.estado === 'cumplido') return ['Cumplido ✓', 'ok'];
    if (t.estado === 'cerrado') return ['—', ''];
    if (t.estado === 'vencido') return ['Venció el ' + fecha(t.vence) + ' (hace ' + plural(-t.dias_restantes, 'día', 'días') + ')', 'mal'];
    if (t.tramo === 2 && t.habiles_restantes != null) {
      if (t.habiles_restantes === 0) return ['Vence hoy (' + fecha(t.vence) + ')', 'pronto'];
      return ['Quedan ' + plural(t.habiles_restantes, 'día hábil', 'días hábiles') + ' · vence el ' + fecha(t.vence), t.habiles_restantes <= 2 ? 'pronto' : ''];
    }
    if (t.dias_restantes === 0) return ['Vence hoy (' + fecha(t.vence) + ')', 'pronto'];
    return ['Quedan ' + plural(t.dias_restantes, 'día', 'días') + ' · vence el ' + fecha(t.vence), t.dias_restantes <= 1 ? 'pronto' : ''];
  }

  function renderV2(cont, d, op) {
    estilosV2();
    var abierto = d.estado_caso !== 'descartado' && !d.activado_at, areas = (d.yo && d.yo.areas) || [], total = (d.resumen && d.resumen.total) || 10;
    var box = el('div', 'onbp'), hd = el('div', 'onbp-hd'), h3 = el('h3');
    h3.appendChild(document.createTextNode('🚀 Onboarding ')); h3.appendChild(el('span', null, d.activado_at ? 'terminado' : 'en curso'));
    hd.appendChild(h3);
    var cnt = el('span', 'onbp-cnt'); cnt.appendChild(el('b', null, String(d.resumen.listos))); cnt.appendChild(document.createTextNode(' de ' + total + ' listos'));
    hd.appendChild(cnt);
    if (op.enlaceCaso) { var a = el('a', 'onbp-r', 'Abrir en Onboarding'); a.href = '../prospectos/onboarding.html?caso=' + Number(d.caso_id); hd.appendChild(a); }
    box.appendChild(hd);
    box.appendChild(el('p', 'onbp-cnt', 'Desde que aceptó la propuesta el ' + fechaLarga(d.inicio) + ' hasta la reunión de entrega del diagnóstico.'));

    var tr = el('div', 'onbp-tramos');
    (d.tramos || []).forEach(function (t) {
      var c = el('div', 'onbp-tr' + (t.estado === 'cumplido' ? ' cumplido' : ''));
      c.appendChild(icono(t.tramo === 1 ? 'reloj' : 'diag'));
      var b = el('b', null, t.tramo + ' · ' + t.nombre); b.appendChild(el('small', null, t.plazo + ' · ' + t.listos + ' de ' + t.total)); c.appendChild(b);
      var cu = cuenta(t); c.appendChild(el('span', 'onbp-cd ' + cu[1], cu[0]));
      var bar = el('div', 'onbp-bar'), bi = el('i'); bi.style.width = Math.round(100 * t.listos / Math.max(t.total, 1)) + '%'; bar.appendChild(bi); c.appendChild(bar);
      tr.appendChild(c);
    });
    box.appendChild(tr);
    if (d.calendario_ok === false) {
      var cal = el('p', 'onbp-cal'); cal.appendChild(icono('alerta'));
      cal.appendChild(document.createTextNode('El calendario de feriados no tiene cargado el año de este plazo: los días hábiles solo descuentan fines de semana.'));
      box.appendChild(cal);
    }
    if (d.activado_at) box.appendChild(el('p', 'onbp-aviso ok', '✅ Cliente activo desde el ' + fecha(d.activado_at) + (d.activado_por ? ' · lo activó ' + d.activado_por : '')));
    else if (d.listo_para_activar) box.appendChild(el('p', 'onbp-aviso ok', 'Se realizó la reunión de entrega y todo está listo: el Master puede pasarlo a activo.'));
    else if (d.resumen.vencidos > 0 || d.resumen.vencidos_cliente > 0) {
      var txt = [];
      if (d.resumen.vencidos > 0) txt.push(plural(d.resumen.vencidos, 'paso atrasado', 'pasos atrasados'));
      if (d.resumen.vencidos_cliente > 0) txt.push(plural(d.resumen.vencidos_cliente, 'paso esperando al cliente', 'pasos esperando al cliente') + ' fuera de plazo');
      box.appendChild(el('p', 'onbp-aviso', '⏰ ' + txt.join(' · ')));
    }

    var ul = el('ol', 'onbp-l'), tramoActual = 0;
    (d.pasos || []).forEach(function (p) {
      if (op.compacto && (p.estado === 'listo' || p.estado === 'no_aplica')) return;
      if (p.tramo !== tramoActual) {
        tramoActual = p.tramo; var tt = (d.tramos || []).filter(function (x) { return x.tramo === p.tramo; })[0];
        ul.appendChild(el('li', 'onbp-grp', 'Tramo ' + p.tramo + ' · ' + (tt ? tt.nombre + ' (' + tt.plazo + ')' : '')));
      }
      var e = EST[p.estado] || EST.pendiente, li = el('li', 'onbp-p ' + e[2] + (p.dias_atraso > 0 && !p.atraso_cliente ? ' atraso' : ''));
      var ic = el('span', 'onbp-i', e[0]); ic.title = e[1]; li.appendChild(ic);
      var t = el('div', 'onbp-t'); t.appendChild(document.createTextNode(p.paso + '. ' + p.titulo));
      var sub = [e[1]];
      if (p.evidencia) sub.push(p.evidencia);
      if (p.marca && p.marca.motivo) sub.push('«' + p.marca.motivo + '»' + (p.marca.por ? ' · ' + p.marca.por : ''));
      else if (p.marca && p.marca.por && p.estado === 'listo') sub.push('marcó ' + p.marca.por);
      if (p.marca && p.marca.fecha && p.paso !== 3 && p.paso !== 10) sub.push('Fecha: ' + fechaLarga(p.marca.fecha));
      var sm = el('small', null, sub.join(' · '));
      if (p.marca && p.marca.enlace && /^https:\/\//.test(p.marca.enlace)) {
        sm.appendChild(document.createTextNode(' · '));
        var lk = el('a'); lk.href = p.marca.enlace; lk.target = '_blank'; lk.rel = 'noopener noreferrer'; lk.appendChild(icono('enlace')); lk.appendChild(document.createTextNode('Ver diagnóstico'));
        sm.appendChild(lk);
      }
      if (p.dias_atraso > 0 && p.atraso_cliente) { sm.appendChild(document.createTextNode(' · ')); sm.appendChild(el('em', 'cli', 'esperando al cliente · ' + plural(p.dias_atraso, 'día', 'días') + ' fuera de plazo')); }
      else if (p.dias_atraso > 0) { sm.appendChild(document.createTextNode(' · ')); sm.appendChild(el('em', null, 'atrasado ' + plural(p.dias_atraso, 'día', 'días'))); }
      else if (abierto && p.estado !== 'listo' && p.estado !== 'no_aplica') sm.appendChild(document.createTextNode(' · vence el ' + fecha(p.vence) + (p.plazo_tipo === 'habiles' ? ' (día hábil ' + p.plazo_dias + ')' : '')));
      t.appendChild(sm);
      if (abierto && p.falta_para_listo && p.estado !== 'listo' && p.estado !== 'no_aplica') t.appendChild(el('small', 'onbp-falta', p.falta_para_listo));
      li.appendChild(t);
      li.appendChild(el('span', 'onbp-r', p.responsable_txt || RESP[p.responsable] || p.responsable));
      var mias = (p.responsables || [p.responsable]).some(function (r) { return areas.indexOf(r) >= 0; });
      var puede = abierto && mias && p.estado_auto !== 'listo' && p.estado_auto !== 'no_aplica' && typeof op.rpc === 'function';
      if (puede) {
        var acc = el('div', 'onbp-acc');
        function formulario(campo, guardarTxt, alGuardar) {
          if (li.querySelector('.onbp-mot')) li.removeChild(li.querySelector('.onbp-mot'));
          var f = el('div', 'onbp-mot'); f.appendChild(campo);
          var g = el('button', 'p', guardarTxt); g.type = 'button'; g.onclick = function () { alGuardar(campo.value); };
          f.appendChild(g); li.appendChild(f); if (campo.focus) campo.focus();
        }
        function boton(txt, fn, cls, desactivado, titulo) {
          var b = el('button', cls || null, txt); b.type = 'button'; if (desactivado) { b.disabled = true; b.title = titulo || ''; } else b.onclick = fn; acc.appendChild(b);
        }
        if (p.manual_listo && p.estado !== 'listo') {
          boton('✓ Marcar listo', function () {
            if (p.requiere === 'fecha') {
              var inp = el('input'); inp.type = 'date'; inp.setAttribute('aria-label', 'Fecha de ' + p.titulo);
              if (p.paso === 10) inp.max = new Date().toLocaleDateString('en-CA');
              return formulario(inp, 'Guardar fecha', function (v) { marcar(p, 'listo', null, v || null, null); });
            }
            if (p.requiere === 'enlace') {
              var u = el('input'); u.type = 'url'; u.maxLength = 500; u.placeholder = 'https://… (enlace del diagnóstico emitido)'; u.setAttribute('aria-label', 'Enlace de ' + p.titulo);
              return formulario(u, 'Guardar enlace', function (v) { marcar(p, 'listo', null, null, String(v || '').trim() || null); });
            }
            marcar(p, 'listo', null, null, null);
          }, 'p', p.puede_listo === false, p.falta_para_listo);
        }
        function conMotivo(estado) {
          return function () { var inp = el('input'); inp.maxLength = 500; inp.placeholder = 'Motivo (obligatorio)'; inp.setAttribute('aria-label', 'Motivo para ' + p.titulo);
            formulario(inp, 'Guardar', function (v) { marcar(p, estado, v, null, null); }); };
        }
        if (p.estado !== 'bloqueado_cliente') boton('⏸ Esperando al cliente', conMotivo('bloqueado_cliente'));
        if (p.permite_no_aplica && p.estado !== 'no_aplica') boton('No aplica', conMotivo('no_aplica'));
        if (p.marca) boton('Quitar marca', function () { marcar(p, 'pendiente', null, null, null); });
        li.appendChild(acc);
      }
      ul.appendChild(li);
    });
    if (op.compacto && !ul.children.length) ul.appendChild(el('li', 'onbp-aviso ok', 'Todos los pasos están listos.'));
    box.appendChild(ul);

    var pie = el('div', 'onbp-pie'), msgEl = el('span', 'onbp-msg'); msgEl.setAttribute('role', 'status');
    if (abierto && d.estado_caso === 'cliente_creado' && d.yo && d.yo.master && typeof op.rpc === 'function') {
      var act = el('button', 'onbp-act', '✅ Pasar a activo'); act.type = 'button'; act.disabled = !d.puede_activar;
      if (!d.puede_activar) act.title = 'Falta la reunión de entrega del diagnóstico u otro paso';
      act.onclick = function () {
        if (!window.confirm('¿Pasar a ' + (d.razon_social || 'este cliente') + ' a «activo»?\n\nTermina su onboarding y queda en el ciclo mensual normal (los analistas siguen con PPM, saldos, Previred y regularizaciones).')) return;
        act.disabled = true; aviso('Activando…');
        op.rpc('onb_activar', { p_caso_id: Number(d.caso_id), p_actualizado: d.actualizado }).then(function (n) {
          render(cont, n, op); if (op.alCambiar) op.alCambiar(n);
        }).catch(function (e) { act.disabled = false; aviso(msg(e), 'err'); if (/VERSION_CONFLICTO/.test(String(e && e.message)) && op.recargar) op.recargar(); });
      };
      pie.appendChild(act);
    }
    pie.appendChild(msgEl); box.appendChild(pie); cont.appendChild(box);

    function aviso(t, cls) { msgEl.className = 'onbp-msg ' + (cls || ''); msgEl.textContent = t; }
    function marcar(p, estado, motivo, fechaV, enlace) {
      aviso('Guardando…');
      op.rpc('onb_paso_marcar_v2', { p_caso_id: Number(d.caso_id), p_paso: Number(p.paso), p_estado: estado, p_motivo: motivo,
        p_version: p.marca ? p.marca.actualizado : null, p_fecha: fechaV, p_enlace: enlace }).then(function (n) {
        render(cont, n, op); if (op.alCambiar) op.alCambiar(n);
      }).catch(function (e) { aviso(msg(e), 'err'); if (/VERSION_CONFLICTO/.test(String(e && e.message)) && op.recargar) op.recargar(); });
    }
  }
  window.OnbPasos = { render: render, mensaje: msg };
})();
