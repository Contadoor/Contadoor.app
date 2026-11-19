/* ============================================================
   assets/onboarding-pasos.js — ONBOARDING-L2 (19-11-2026): la lista de 15 pasos del onboarding.
   Se usa en Comercial → Onboarding y en la ficha del cliente (clientes/onboarding-ficha.js).
   · Datos SOLO por RPC: onb_pasos / onb_pasos_cliente (leer), onb_paso_marcar (marcar), onb_activar (pasar a activo, solo Master).
   · Casi todos los pasos se marcan solos leyendo Gestoor y el SII; aquí solo se marca lo manual (o «no aplica» / «bloqueado
     por el cliente», con motivo). Cada marca envía su versión (no pisa lo de otra persona).
   · Todo dato de la base se pinta con textContent (nunca innerHTML con datos).
   Uso: OnbPasos.render(elemento, datos, { rpc: fn(nombre, args) → Promise, alCambiar: fn(datosNuevos), compacto: bool, enlaceCaso: bool })
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
    CLIENTE_NO_EN_ONBOARDING: 'El cliente ya no está en onboarding.', SIN_PERMISO: 'No tienes acceso a este onboarding.'
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
  window.OnbPasos = { render: render, mensaje: msg };
})();
