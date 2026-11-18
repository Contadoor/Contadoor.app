/* ============================================================
   clientes/sii-cartapra.js — Tarjeta "SII" en la ficha del cliente (Cartapra Conecta F1).
   · Habla SOLO con la Edge `cartapra` de Gestoor (JWT del usuario). La llave de Cartapra nunca llega al navegador.
   · Envía solo { accion, cliente_id }: el RUT lo pone el servidor desde la ficha.
   · La ventana de conexión se abre en un IFRAME propio (sin cargar scripts de terceros en Gestoor) y solo
     se aceptan mensajes con origen https://app.cartapra.com, de ese iframe, y con fuente "cartapra-conecta".
   · La clave SII se escribe dentro de la ventana de Cartapra: Gestoor no la ve ni la guarda.
   · Todo dato externo se pinta con textContent (nunca innerHTML con datos).
   · El botón Conectar/Reconectar aparece solo si el servidor responde puede_conectar = true (Master o conector).
   · Si "resumen" responde 403 (p. ej. un conector no asignado), se pide "estado" para mostrar solo la conexión.
     Excepciones: EMPRESA_FUERA_PILOTO y MODO_PILOTO no reintentan con "estado".
   · R3: una sola solicitud en curso por cliente (se reutiliza la promesa) y se respeta Retry-After (reintentarEn):
     "Volver a revisar" queda deshabilitado hasta que pase la espera.
   · R3: estados del F29 por período: declarado, en_plazo, revisar_vencimiento, no_declarado, sin_verificar, no_aplica.
   Uso: GestoorSII.montar(elemento, clienteId) · GestoorSII.desmontar()   (op.esMaster ya no se usa)
   ============================================================ */
(function () {
  var CARTAPRA = 'https://app.cartapra.com';
  var seq = 0, actual = null, modal = null, alMensaje = null;
  var enCurso = null;          // { clienteId, promesa } — evita solicitudes duplicadas (R3 F1-10)
  var esperaHasta = 0, relojEspera = null; // Retry-After de Cartapra (ms epoch)

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function icono(nombre, color) {
    var i = el('i', 'ic sii-ic ' + color); i.innerHTML = (window.gIcon ? window.gIcon(nombre) : ''); return i;
  }
  function horaChile(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return 'No disponible';
    return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function llamar(accion, clienteId) {
    var f = window.edgeFetch;
    if (typeof f !== 'function') return Promise.reject({ status: 0, error: 'SIN_CONEXION' });
    var cuerpo = accion === 'cartera' ? { accion: accion } : { accion: accion, cliente_id: Number(clienteId) };
    return f('cartapra', cuerpo).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j || j.ok !== true) throw { status: r.status, error: (j && j.error) || 'ERROR', detalle: j && j.detalle, reintentarEn: j && j.reintentarEn };
        return j;
      });
    });
  }

  // ── Estilos (tema noche de Gestoor; íconos con color propio) ──
  function estilos() {
    if (document.getElementById('sii-cartapra-css')) return;
    var s = el('style'); s.id = 'sii-cartapra-css';
    s.textContent = [
      '.sii-card{margin-top:14px;border:1px solid #4A2B50;border-radius:18px;background:rgba(42,20,48,.72);padding:14px 16px;color:#F3E9F4}',
      '.sii-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
      '.sii-hd h3{font:800 15px var(--g-titulo,Montserrat,sans-serif);margin:0;flex:1}.sii-hd h3 span{color:#E39BE5}',
      '.sii-ic{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;flex:0 0 30px}',
      '.sii-ic .g-ic{width:17px;height:17px}',
      '.sii-cel{color:#5CC8FF;background:rgba(92,200,255,.16)}.sii-amb{color:#FFC85A;background:rgba(255,200,90,.16)}',
      '.sii-ver{color:#46D69A;background:rgba(70,214,154,.16)}.sii-mor{color:#E39BE5;background:rgba(227,155,229,.16)}',
      '.sii-roj{color:#FF8A7A;background:rgba(255,138,122,.16)}.sii-ama{color:#FFD24D;background:rgba(255,210,77,.16)}',
      '.sii-estado{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.sii-estado .txt{flex:1;min-width:180px}.sii-estado b{display:block;font-size:14px}.sii-estado small{color:#C9A8CC;font-size:12px}',
      '.sii-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;border:1.5px solid transparent;background:linear-gradient(160deg,#A4599C,#803889);color:#fff}',
      '.sii-btn.sec{background:transparent;border-color:#6B4672;color:#F3E9F4}.sii-btn[disabled]{opacity:.55;cursor:wait}',
      '.sii-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px}',
      '.sii-dato{background:rgba(12,7,14,.35);border:1px solid #3A2140;border-radius:12px;padding:8px 10px}',
      '.sii-dato .l{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC}.sii-dato .v{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px;word-break:break-word}',
      '.sii-sem{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700}',
      '.sii-sem.ok{background:rgba(70,214,154,.16);color:#46D69A}.sii-sem.aviso{background:rgba(255,200,90,.16);color:#FFC85A}.sii-sem.alerta{background:rgba(255,138,122,.16);color:#FF8A7A}',
      '.sii-nota{font-size:11.5px;color:#C9A8CC;margin-top:10px;line-height:1.45}',
      '.sii-dato .n{font-size:10.5px;color:#FFC85A;margin-top:2px}',
      '.sii-linea{margin-top:10px;font-size:12px;font-weight:600;color:#E9DCEB;line-height:1.45}',
      '.sii-f29{display:flex;align-items:flex-start;gap:10px;margin-top:10px;border-radius:14px;padding:10px 12px;border:1px solid}',
      '.sii-f29.mal{background:rgba(255,138,122,.12);border-color:rgba(255,138,122,.55)}.sii-f29.bien{background:rgba(70,214,154,.10);border-color:rgba(70,214,154,.45)}',
      '.sii-f29 .txt{flex:1}.sii-f29 b{display:block;font-size:14px}.sii-f29.mal b{color:#FF8A7A}.sii-f29.bien b{color:#46D69A}.sii-f29 small{display:block;color:#E9DCEB;font-size:12px;margin-top:2px}',
      '.sii-sec{margin-top:12px}.sii-sec-t{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC;margin-bottom:6px}',
      '.sii-lista{margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.5}.sii-lista li.amb::marker{color:#FFC85A}.sii-lista li.roj::marker{color:#FF8A7A}',
      '.sii-lista.cartas{list-style:none;padding-left:0}.sii-lista.cartas li{padding:6px 0;border-top:1px solid #3A2140}.sii-lista.cartas li:first-child{border-top:0}',
      '.sii-lista.cartas b{font-weight:700;color:#E39BE5}.sii-lista.cartas li.notif b{color:#FFC85A}.sii-lista.cartas small{display:block;color:#FFC85A;font-size:11.5px}',
      '.sii-nota.roj{color:#FF8A7A}',
      '.sii-f29.dudoso{background:rgba(255,200,90,.10);border-color:rgba(255,200,90,.5)}.sii-f29 b.roj{color:#FF8A7A}.sii-f29 b.amb{color:#FFC85A}.sii-f29 b.ver{color:#46D69A}.sii-f29 b+b{margin-top:4px}',
      '.sii-meses{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.sii-mes{display:inline-flex;flex-direction:column;min-width:74px;padding:5px 8px;border-radius:10px;font-size:10.5px;line-height:1.25;border:1px solid}',
      '.sii-mes b{font-size:11.5px;text-transform:capitalize}',
      '.sii-mes.ok{background:rgba(70,214,154,.10);border-color:rgba(70,214,154,.35);color:#46D69A}.sii-mes.plazo{background:rgba(92,200,255,.10);border-color:rgba(92,200,255,.35);color:#5CC8FF}',
      '.sii-mes.amb{background:rgba(255,200,90,.12);border-color:rgba(255,200,90,.45);color:#FFC85A}.sii-mes.roj{background:rgba(255,138,122,.14);border-color:rgba(255,138,122,.55);color:#FF8A7A}',
      '.sii-mes.gris{background:rgba(201,168,204,.08);border-color:rgba(201,168,204,.3);color:#C9A8CC}.sii-mes.tenue{opacity:.5;color:#9a849b;border-color:#3A2140}',
      '.sii-piloto{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(92,200,255,.14);color:#5CC8FF}',
      '.sii-btn[disabled].espera{cursor:not-allowed}',
      '.sii-velo{position:fixed;inset:0;z-index:400;background:rgba(12,7,14,.78);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.sii-velo iframe{width:440px;height:660px;max-width:100%;max-height:calc(100vh - 32px);border:0;border-radius:18px;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.sii-velo .x{position:absolute;top:14px;right:16px;width:40px;height:40px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:18px;cursor:pointer}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Resumen (R2): forma compacta que arma el servidor (ficha, f29, monitor reducido, sii). Todo con textContent. ──
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var CATEGORIA = { carta: 'Carta', notificacion: 'Notificación' };
  function esTxt(v) { return typeof v === 'string' && v.trim() !== ''; }
  function nombreMes(p) { var m = Number(String(p).slice(4, 6)); return MESES[m - 1] || String(p); }
  function unir(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
  function ddmm(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '-' + m[2] : ''; }
  function ddmmaaaa(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
  function pesos(v) { return typeof v === 'number' && isFinite(v) ? '$' + Math.round(v).toLocaleString('es-CL') : '—'; }
  function capital(s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function dato(g, l, v, nota) {
    var d = el('div', 'sii-dato'); d.appendChild(el('div', 'l', l)); d.appendChild(el('div', 'v', v));
    if (nota) d.appendChild(el('div', 'n', nota)); g.appendChild(d); return d;
  }
  function seccion(card, titulo) { var s = el('div', 'sii-sec'); s.appendChild(el('div', 'sii-sec-t', titulo)); card.appendChild(s); return s; }

  var ESTADO_F29 = {
    declarado: ['Declarado', 'ok'], en_plazo: ['En plazo', 'plazo'], revisar_vencimiento: ['Revisar vencimiento', 'amb'],
    no_declarado: ['No declarado', 'roj'], sin_verificar: ['Sin verificar', 'gris'], no_aplica: ['No aplica', 'tenue']
  };
  // "marzo, abril y septiembre 2026" / "diciembre 2025, marzo y abril 2026"
  function mesesConAnio(ps) {
    var grupos = [], porAnio = {};
    ps.slice().sort().forEach(function (p) {
      var a = String(p).slice(0, 4);
      if (!porAnio[a]) { porAnio[a] = []; grupos.push(a); }
      porAnio[a].push(nombreMes(p));
    });
    return unir(grupos.map(function (a) { return unir(porAnio[a]) + ' ' + a; }));
  }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function pintarF29(card, f) {
    if (!f || !Array.isArray(f.periodos)) { card.appendChild(el('div', 'sii-nota', 'No se pudo revisar el F29 (Cartapra no entregó las declaraciones).')); return; }
    var nd = arr(f.no_declarados), sv = arr(f.sin_verificar), rv = arr(f.revisar_vencimiento), ep = arr(f.en_plazo);
    var nivel = nd.length ? 'mal' : (sv.length || rv.length) ? 'dudoso' : 'bien';
    var caja = el('div', 'sii-f29 ' + nivel);
    caja.setAttribute('data-f29', nd.length ? 'no_declarados' : sv.length ? 'sin_verificar' : rv.length ? 'revisar_vencimiento' : 'al_dia');
    caja.appendChild(icono(nivel === 'bien' ? 'check' : 'alerta', nivel === 'mal' ? 'sii-roj' : nivel === 'dudoso' ? 'sii-amb' : 'sii-ver'));
    var t = el('div', 'txt');
    var venceDe = {}; f.periodos.forEach(function (p) { if (p && p.periodo) venceDe[p.periodo] = p.vence; });
    if (nd.length) t.appendChild(el('b', 'roj', 'F29 no declarados: ' + mesesConAnio(nd)));
    if (sv.length) {
      t.appendChild(el('b', 'amb', 'F29 no encontrados en el SII (pendiente de verificar): ' + mesesConAnio(sv)));
      t.appendChild(el('small', null, 'Sin verificar: Cartapra aún no confirma que la información esté completa.'));
    }
    if (rv.length) {
      t.appendChild(el('b', 'amb', 'Revisar vencimiento: ' + mesesConAnio(rv)));
      t.appendChild(el('small', null, 'Venció la fecha estimada; confirmar vencimiento.'));
    }
    if (!nd.length && !sv.length && !rv.length) {
      var hay = f.periodos.some(function (p) { return p && p.estado !== 'no_aplica'; });
      t.appendChild(el('b', 'ver', hay ? 'F29 al día (últimos 12 meses)' : 'Aún no hay F29 por revisar'));
    }
    if (ep.length) t.appendChild(el('small', null, 'En plazo: ' + unir(ep.map(function (p) { var v = ddmm(venceDe[p]); return nombreMes(p) + (v ? ' (vence ' + v + ')' : ''); }))));
    var rect = f.periodos.filter(function (p) { return p && p.rectificado === true; }).map(function (p) { return nombreMes(p.periodo); });
    if (rect.length) t.appendChild(el('small', null, 'Con más de una declaración (rectificado): ' + unir(rect)));
    if (nd.length) t.appendChild(el('small', null, 'Período vencido sin F29 en el SII = no declarado.'));
    caja.appendChild(t); card.appendChild(caja);
    // Período a período (No aplica no se muestra)
    var fila12 = el('div', 'sii-meses');
    f.periodos.forEach(function (p) {
      if (!p || p.estado === 'no_aplica') return;
      var e = ESTADO_F29[p.estado] || ['Sin verificar', 'gris'];
      var c = el('span', 'sii-mes ' + e[1]);
      c.setAttribute('data-estado', p.estado);
      c.title = e[0] + (p.vence ? ' · vence ' + ddmmaaaa(p.vence) + (p.vence_confirmado ? '' : ' (estimado)') : '');
      c.appendChild(el('b', null, nombreMes(p.periodo).slice(0, 3) + ' ' + String(p.periodo).slice(2, 4)));
      c.appendChild(el('span', null, e[0]));
      fila12.appendChild(c);
    });
    if (fila12.childNodes.length) card.appendChild(fila12);
  }

  function pintarResumen(card, j) {
    var fi = j.ficha, m = j.monitor, sii = j.sii || {};
    if (!fi && !j.f29 && !m && !Object.keys(sii).length) { card.appendChild(el('div', 'sii-nota', 'Cartapra todavía no entrega el resumen de esta empresa.')); return; }
    // Línea superior: régimen · contabilidad · IVA
    if (fi) {
      var partes = [];
      if (esTxt(fi.regimen)) partes.push(fi.regimen);
      if (esTxt(fi.contabilidad)) partes.push('Contabilidad ' + String(fi.contabilidad).toLowerCase());
      if (fi.afecta_iva === false) partes.push('Exenta de IVA');
      else if (fi.iva_mixto === true) partes.push('IVA mixto (actividades afectas y exentas)');
      else if (fi.afecta_iva === true) partes.push('Afecta a IVA');
      if (partes.length) card.appendChild(el('div', 'sii-linea', partes.join(' · ')));
    }
    pintarF29(card, j.f29);

    // Cumplimiento, socios y representante
    var g = el('div', 'sii-grid');
    var cum = sii.sii_cumplimiento;
    if (cum && esTxt(cum.estado)) dato(g, 'Cumplimiento tributario', cum.estado);
    if (fi && Array.isArray(fi.socios) && fi.socios.length) {
      dato(g, fi.socios.length > 1 ? 'Socios vigentes' : 'Socio vigente', fi.socios.map(function (s) {
        var pc = typeof s.participacionCapital === 'number' ? s.participacionCapital + '%' : '';
        var pu = typeof s.participacionUtilidades === 'number' && s.participacionUtilidades !== s.participacionCapital ? ' (utilidades ' + s.participacionUtilidades + '%)' : '';
        return (s.nombre || 'Sin nombre') + (esTxt(s.rut) ? ' (' + s.rut + ')' : '') + (pc ? ' · ' + pc + pu : '');
      }).join(' — '));
    }
    if (fi && Array.isArray(fi.representantes) && fi.representantes.length) {
      dato(g, 'Representante vigente', fi.representantes.map(function (r) { return (r.nombre || 'Sin nombre') + (esTxt(r.rut) ? ' (' + r.rut + ')' : ''); }).join(' — '));
    }
    if (g.childNodes.length) card.appendChild(g);

    // Semáforo (ya filtrado en el servidor), IVA proyectado, totales del año
    if (m) {
      var s = m.semaforo, nivel = s && (s.tono === 'ok' || s.tono === 'aviso' || s.tono === 'alerta') ? s.tono : '';
      if (nivel) {
        var sec = seccion(card, 'Semáforo de Cartapra');
        sec.appendChild(el('div', 'sii-sem ' + nivel, '● ' + { ok: 'Todo en orden', aviso: 'Hay algo que revisar', alerta: 'Requiere atención' }[nivel]));
        var ul = el('ul', 'sii-lista');
        (Array.isArray(s.puntos) ? s.puntos : []).forEach(function (p) { if (p && esTxt(p.texto)) ul.appendChild(el('li', p.tono === 'alerta' ? 'roj' : p.tono === 'aviso' ? 'amb' : '', p.texto)); });
        if (ul.childNodes.length) sec.appendChild(ul);
        if (m.exenta === true) sec.appendChild(el('div', 'sii-nota', 'Empresa exenta de IVA: no se compara el crédito fiscal del RCV con el F29.'));
      }
      var g2 = el('div', 'sii-grid');
      var ip = m.ivaProyectado;
      if (ip && typeof ip.totalEstimado === 'number') {
        dato(g2, 'F29 estimado de ' + (ip.periodo ? nombreMes(ip.periodo) : 'este mes'), pesos(ip.totalEstimado), ip.provisorio === false ? null : 'Provisorio: el mes aún no cierra');
      }
      var anio = j.f29 && j.f29.anio, an = Array.isArray(m.anual) ? m.anual : [];
      var a = an.filter(function (x) { return x && x.anio === anio; })[0] || an[0];
      if (a && a.totales) {
        dato(g2, 'Ventas ' + a.anio, pesos(a.totales.ventasTotal));
        dato(g2, 'Compras ' + a.anio, pesos(a.totales.comprasTotal));
      }
      if (g2.childNodes.length) card.appendChild(g2);
    }

    // Últimas cartas y notificaciones del SII (máx. 5)
    var ca = sii.sii_cartas;
    if (ca && Array.isArray(ca.cartas) && ca.cartas.length) {
      var sc = seccion(card, 'Cartas y notificaciones del SII' + (ca.total > ca.cartas.length ? ' · últimas ' + ca.cartas.length + ' de ' + ca.total : ''));
      var ul2 = el('ul', 'sii-lista cartas');
      ca.cartas.slice(0, 5).forEach(function (c) {
        if (!c) return;
        var li = el('li', c.categoria === 'notificacion' ? 'notif' : '');
        var cuando = ddmmaaaa(c.fecha) || (esTxt(c.periodo) ? 'Período ' + c.periodo : 'Sin fecha');
        li.appendChild(el('b', null, cuando + ' · ' + (CATEGORIA[c.categoria] || 'Documento')));
        li.appendChild(el('span', null, ' ' + (c.titulo || '')));
        if (Array.isArray(c.plazos) && c.plazos.length) li.appendChild(el('small', null, 'Plazo: ' + c.plazos.join(' · ')));
        ul2.appendChild(li);
      });
      sc.appendChild(ul2);
    } else if (ca) {
      card.appendChild(el('div', 'sii-nota', 'Sin cartas ni notificaciones del SII.'));
    }
    var al = sii.sii_alertas;
    if (al && al.total > 0) card.appendChild(el('div', 'sii-nota roj', 'Alertas del SII: ' + al.total));
  }

  // ── Ventana de conexión (iframe propio + postMessage verificado) ──
  function cerrarVentana() {
    if (alMensaje) { window.removeEventListener('message', alMensaje); alMensaje = null; }
    document.removeEventListener('keydown', alTeclado);
    if (modal) { modal.remove(); modal = null; }
  }
  var ventanaCb = null; // lista de clientes: refrescar su estado al cerrar la ventana
  function trasCerrar() { var f = ventanaCb; ventanaCb = null; if (actual) cargar(); if (f) f(); }
  function alTeclado(e) { if (e.key === 'Escape') { cerrarVentana(); trasCerrar(); } }
  function abrirVentana(url) {
    if (typeof url !== 'string' || url.indexOf(CARTAPRA + '/') !== 0) throw new Error('ventana no válida');
    cerrarVentana();
    modal = el('div', 'sii-velo'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Conectar con el SII');
    var fr = el('iframe'); fr.src = url; fr.title = 'Conectar con el SII (Cartapra)';
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    var x = el('button', 'x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar');
    x.onclick = function () { cerrarVentana(); trasCerrar(); };
    modal.onclick = function (e) { if (e.target === modal) { cerrarVentana(); trasCerrar(); } };
    modal.appendChild(fr); modal.appendChild(x); document.body.appendChild(modal);
    alMensaje = function (ev) {
      if (ev.origin !== CARTAPRA || ev.source !== fr.contentWindow) return;
      var d = ev.data; if (!d || d.fuente !== 'cartapra-conecta') return;
      if (d.evento === 'conectada' && window.toast) window.toast('El SII aceptó la clave. Gestoor ya puede leer los datos.');
      if (d.evento === 'cerrar') { cerrarVentana(); trasCerrar(); }
    };
    window.addEventListener('message', alMensaje);
    document.addEventListener('keydown', alTeclado);
  }
  function pedirVentana(btn) {
    if (!actual) return;
    btn.disabled = true; btn.lastChild.textContent = 'Abriendo…';
    var mio = actual;
    llamar('ventana', mio.clienteId).then(function (j) {
      if (actual !== mio) return;
      abrirVentana(j.widget && j.widget.url);
    }).catch(function (e) {
      if (actual !== mio) return;
      pintarError(e);
    });
  }

  // ── Pintado de la tarjeta ──
  function cabecera(card) {
    var hd = el('div', 'sii-hd'); hd.appendChild(icono('edificio', 'sii-amb'));
    var h = el('h3'); h.appendChild(document.createTextNode('Datos del ')); h.appendChild(el('span', null, 'SII')); hd.appendChild(h);
    card.appendChild(hd);
  }
  function fila(card, ic, color, titulo, sub) {
    var f = el('div', 'sii-estado'); f.appendChild(icono(ic, color));
    var t = el('div', 'txt'); t.appendChild(el('b', null, titulo)); if (sub) t.appendChild(el('small', null, sub));
    f.appendChild(t); card.appendChild(f); return f;
  }
  function boton(f, texto, ic, sec, fn) {
    var b = el('button', 'sii-btn' + (sec ? ' sec' : '')); b.type = 'button';
    if (window.gIcon) { var s = el('span'); s.innerHTML = window.gIcon(ic); b.appendChild(s); }
    b.appendChild(el('span', null, texto)); b.onclick = function () { fn(b); }; f.appendChild(b); return b;
  }
  function nuevaCard() {
    if (!actual) return null;
    actual.cont.textContent = '';
    var card = el('div', 'sii-card'); card.setAttribute('data-sii', ''); cabecera(card); actual.cont.appendChild(card); return card;
  }
  function pintarError(e) {
    var card = nuevaCard(); if (!card) return;
    var st = e && e.status, err = (e && e.error) || '';
    var t = 'No pudimos revisar el SII ahora', sub = (e && e.detalle) || 'Intenta de nuevo en unos minutos.';
    if (st === 403) { t = 'Sin acceso a los datos del SII de este cliente'; sub = (e && e.detalle) || 'Los ve el Master y el equipo asignado al cliente.'; }
    else if (st === 401) { t = 'Tu sesión venció'; sub = 'Vuelve a entrar a Gestoor.'; }
    else if (st === 429) { t = 'Cartapra pide esperar un momento'; sub = 'Vuelve a intentar en ' + segundosEspera() + ' segundos.'; }
    else if (err === 'NO_CONFIGURADO') { t = 'La conexión con Cartapra aún no está activada'; sub = 'Avisa al Master.'; }
    if (err === 'EMPRESA_FUERA_PILOTO') { t = 'Piloto: solo lectura de empresas propias'; sub = 'Esta empresa aún no está habilitada para leer el SII con Cartapra.'; }
    else if (err === 'MODO_PILOTO') { t = 'Piloto: solo lectura de empresas propias'; sub = (e && e.detalle) || 'Esta acción no está disponible durante el piloto.'; }
    var f = fila(card, 'alerta', st === 403 ? 'sii-mor' : 'sii-roj', t, sub);
    if (st !== 403 && st !== 401) botonRevisar(f);
  }
  function pintar(j) {
    var card = nuevaCard(); if (!card) return;
    var c = j.conexion || {}, puede = j.puede_conectar === true && j.piloto !== true;
    var subNo = j.piloto === true ? 'Piloto: solo lectura de empresas propias. La conexión la hace el proveedor por ahora.'
      : puede ? 'Se abre una ventana segura de Cartapra con el RUT ya puesto. Ahí se escribe la clave del SII: Gestoor no la ve.'
        : 'Pídele al Master o a quien conecta empresas con el SII que la conecte.';
    if (c.estado === 'no_conectada') {
      var f1 = fila(card, 'candado', 'sii-cel', 'Sin conectar con el SII', subNo);
      if (puede) boton(f1, 'Conectar con el SII', 'llave', false, pedirVentana);
    } else if (c.estado === 'clave_rechazada') {
      var f2 = fila(card, 'alerta', 'sii-amb', 'La clave del SII cambió', 'Las lecturas se detuvieron. Hay que volver a conectar con la clave nueva.');
      if (puede) boton(f2, 'Reconectar', 'repetir', false, pedirVentana);
    } else if (c.estado === 'conectada' && (c.actualizando || !c.cargaInicialLista)) {
      var f3 = fila(card, 'reloj', 'sii-ama', 'Leyendo el SII…', c.ultimaActualizacion ? 'Última actualización: ' + horaChile(c.ultimaActualizacion) + ' (hora de Chile)' : 'La primera lectura toma unos minutos.');
      botonRevisar(f3);
    } else if (c.estado === 'conectada') {
      fila(card, 'check', 'sii-ver', 'Conectado', 'Última actualización: ' + (c.ultimaActualizacion ? horaChile(c.ultimaActualizacion) + ' (hora de Chile)' : 'No disponible') + ' · se actualiza sola una vez al día');
      if (j.soloEstado) card.appendChild(el('div', 'sii-nota', 'Los datos del SII de este cliente los ve el Master y el equipo asignado.'));
      else pintarResumen(card, j);
    } else {
      pintarError({ status: 502, detalle: 'Cartapra respondió algo inesperado.' }); return;
    }
    if (c.ultimoError && c.estado !== 'no_conectada') card.appendChild(el('div', 'sii-nota', 'Último aviso de Cartapra: ' + c.ultimoError));
    if (j.piloto === true) card.appendChild(el('div', 'sii-piloto', 'Piloto: solo lectura de empresas propias'));
    card.appendChild(el('div', 'sii-nota', 'Solo lectura: Cartapra consulta el SII, no presenta declaraciones ni cambia nada.'));
  }
  // ── Espera por Retry-After (R3 F1-10) ──
  function segundosEspera() { return Math.max(1, Math.ceil((esperaHasta - Date.now()) / 1000)); }
  function enEspera() { return Date.now() < esperaHasta; }
  function botonRevisar(f) {
    var b = boton(f, 'Volver a revisar', 'repetir', true, function () { if (!enEspera()) cargar(); });
    if (enEspera()) {
      b.disabled = true; b.className += ' espera'; b.title = 'Cartapra pidió esperar ' + segundosEspera() + ' s';
      if (relojEspera) clearTimeout(relojEspera);
      relojEspera = setTimeout(function () { relojEspera = null; if (b.isConnected) { b.disabled = false; b.className = b.className.replace(' espera', ''); b.title = ''; } }, esperaHasta - Date.now() + 50);
    }
    return b;
  }
  // ── Una sola solicitud por cliente (R3 F1-10): si hay una en curso, se reutiliza su promesa ──
  function obtener(clienteId) {
    if (enCurso && enCurso.clienteId === clienteId) return enCurso.promesa;
    // "resumen" trae el estado y, si ya hay datos, el resumen: una sola ida al servidor.
    // Sin permiso de resumen (403 SIN_PERMISO) → se intenta "estado" (conectores): solo la conexión.
    var p = llamar('resumen', clienteId).catch(function (e) {
      if (!e || e.status !== 403 || e.error === 'EMPRESA_FUERA_PILOTO' || e.error === 'MODO_PILOTO') throw e;
      return llamar('estado', clienteId).then(function (j) { j.soloEstado = true; return j; }, function () { throw e; });
    }).catch(function (e) {
      if (e && e.status === 429) esperaHasta = Date.now() + (Number(e.reintentarEn) > 0 ? Number(e.reintentarEn) : 60) * 1000;
      throw e;
    });
    var reg = { clienteId: clienteId, promesa: p };
    enCurso = reg;
    var fin = function () { if (enCurso === reg) enCurso = null; };
    p.then(fin, fin);
    return p;
  }
  function cargar() {
    if (!actual) return;
    var mio = actual, n = ++seq;
    if (enEspera()) { pintarError({ status: 429, error: 'CARTAPRA_LIMITE' }); return; } // no se consulta mientras dure la espera
    var card = nuevaCard(); fila(card, 'reloj', 'sii-cel', 'Revisando la conexión con el SII…', null);
    obtener(mio.clienteId).then(function (j) { if (actual === mio && n === seq) pintar(j); })
      .catch(function (e) { if (actual === mio && n === seq) pintarError(e); });
  }

  // ── Lista de clientes (18-11, pedido de Luciano): botón «Conectar con el SII» junto a las claves ──
  // Una sola consulta al cargar: Master → "cartera" (estado de conexión de todas las empresas por RUT);
  // otros → "estado" de un cliente para saber si puede conectar (conectores). Sin permiso → sin botón.
  var lista = null, listaEnCurso = null;
  function rutNorm(r) { return String(r || '').replace(/[^0-9kK]/g, '').toUpperCase(); }
  function prepararLista(primerClienteId, esMaster) {
    if (lista) return Promise.resolve(lista);
    if (listaEnCurso) return listaEnCurso;
    function porEstado() {
      return (Number(primerClienteId) > 0 ? llamar('estado', Number(primerClienteId)) : Promise.reject())
        .then(function (j) { return { puede: j.puede_conectar === true && j.piloto !== true, conexiones: null }; }, function () { return { puede: false, conexiones: null }; });
    }
    var p = esMaster
      ? llamar('cartera', 0).then(function (j) {
          var m = {};
          arr(j.cartera && j.cartera.empresas).forEach(function (x) { var e = x && x.empresa; if (e && esTxt(e.rut)) m[rutNorm(e.rut)] = String(e.conexion || ''); });
          return { puede: true, conexiones: m };
        }, porEstado)
      : porEstado();
    listaEnCurso = p.then(function (r) { lista = r; listaEnCurso = null; return r; });
    return listaEnCurso;
  }
  function estadoRut(rut) { return lista && lista.conexiones ? (lista.conexiones[rutNorm(rut)] || 'no_conectada') : null; }
  function conectarDesdeLista(clienteId, btn, alTerminar) {
    if (btn) btn.disabled = true;
    llamar('ventana', Number(clienteId)).then(function (j) {
      if (btn) btn.disabled = false;
      ventanaCb = function () { lista = null; if (alTerminar) alTerminar(); };
      estilos(); abrirVentana(j.widget && j.widget.url);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      var msg = (e && e.detalle) || (e && e.status === 429 ? 'Cartapra pide esperar un momento.' : 'No se pudo abrir la ventana de Cartapra.');
      if (window.toast) window.toast(msg); else alert(msg);
    });
  }

  window.GestoorSII = {
    prepararLista: prepararLista,
    lista: function () { return lista; },
    estadoRut: estadoRut,
    conectar: conectarDesdeLista,
    montar: function (cont, clienteId, op) {
      if (!cont || !(Number(clienteId) > 0)) return;
      estilos(); cerrarVentana();
      actual = { cont: cont, clienteId: Number(clienteId) };
      cargar();
    },
    desmontar: function () { cerrarVentana(); seq++; actual = null; if (relojEspera) { clearTimeout(relojEspera); relojEspera = null; } }
  };
})();
