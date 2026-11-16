/* ============================================================
   clientes/sii-cartapra.js — Tarjeta "SII" en la ficha del cliente (Cartapra Conecta F1).
   · Habla SOLO con la Edge `cartapra` de Gestoor (JWT del usuario). La llave de Cartapra nunca llega al navegador.
   · Envía solo { accion, cliente_id }: el RUT lo pone el servidor desde la ficha.
   · La ventana de conexión se abre en un IFRAME propio (sin cargar scripts de terceros en Gestoor) y solo
     se aceptan mensajes con origen https://app.cartapra.com, de ese iframe, y con fuente "cartapra-conecta".
   · La clave SII se escribe dentro de la ventana de Cartapra: Gestoor no la ve ni la guarda.
   · Todo dato externo se pinta con textContent (nunca innerHTML con datos).
   Uso: GestoorSII.montar(elemento, clienteId, { esMaster: true|false }) · GestoorSII.desmontar()
   ============================================================ */
(function () {
  var CARTAPRA = 'https://app.cartapra.com';
  var seq = 0, actual = null, modal = null, alMensaje = null;

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
      '.sii-det{margin-top:10px;font-size:12px}.sii-det summary{cursor:pointer;color:#E39BE5}.sii-det pre{white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;background:rgba(12,7,14,.5);border-radius:10px;padding:10px;font-size:11px;color:#E9DCEB}',
      '.sii-velo{position:fixed;inset:0;z-index:400;background:rgba(12,7,14,.78);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.sii-velo iframe{width:440px;height:660px;max-width:100%;max-height:calc(100vh - 32px);border:0;border-radius:18px;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.sii-velo .x{position:absolute;top:14px;right:16px;width:40px;height:40px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:18px;cursor:pointer}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Resumen del monitor: tolerante a la forma (la guía no la documenta campo a campo) ──
  var DINERO = /monto|neto|iva|total|venta|compra|debito|credito|remanente|ppm|pagar|exento/i;
  function etiqueta(k) {
    return String(k).replace(/_/g, ' ').replace(/([a-záéíóú])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function valor(k, v) {
    if (typeof v === 'number') return (DINERO.test(k) ? '$' : '') + Math.round(v).toLocaleString('es-CL');
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v).slice(0, 80);
  }
  function datosSimples(obj, prefijo, salida) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.keys(obj).forEach(function (k) {
      if (salida.length >= 12 || /semaforo/i.test(k)) return;
      var v = obj[k];
      if (v == null || v === '') return;
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') salida.push([prefijo ? prefijo + ' · ' + etiqueta(k) : etiqueta(k), valor(k, v)]);
      else if (!Array.isArray(v) && !prefijo) datosSimples(v, etiqueta(k), salida);
      else if (Array.isArray(v) && !prefijo && v.length && typeof v[v.length - 1] === 'object') datosSimples(v[v.length - 1], etiqueta(k) + ' (último)', salida);
    });
  }
  function nivelSemaforo(m) {
    var s = m && m.semaforo; if (s && typeof s === 'object') s = s.nivel || s.estado || s.color || s.valor;
    s = String(s || '').toLowerCase();
    return s === 'ok' || s === 'aviso' || s === 'alerta' ? s : '';
  }
  function cuenta(x) {
    if (Array.isArray(x)) return x.length;
    if (x && typeof x === 'object') { for (var k in x) if (Array.isArray(x[k])) return x[k].length; }
    return null;
  }

  function pintarResumen(card, j) {
    var m = j.monitor;
    if (!m) { card.appendChild(el('div', 'sii-nota', 'Cartapra todavía no entrega el resumen de esta empresa.')); return; }
    var nivel = nivelSemaforo(m);
    if (nivel) {
      var txt = { ok: 'Todo en orden', aviso: 'Hay algo que revisar', alerta: 'Requiere atención' }[nivel];
      var sem = el('div', 'sii-sem ' + nivel, '● ' + txt); sem.style.marginTop = '10px'; card.appendChild(sem);
    }
    var lista = []; datosSimples(m, '', lista);
    var sii = j.sii || {};
    [['sii_cartas', 'Cartas del SII'], ['sii_alertas', 'Alertas del SII']].forEach(function (p) {
      var n = cuenta(sii[p[0]]); if (n != null) lista.push([p[1], String(n)]);
    });
    var cum = sii.sii_cumplimiento;
    if (cum && typeof cum === 'object' && typeof (cum.estado || cum.situacion) === 'string') lista.push(['Cumplimiento tributario', String(cum.estado || cum.situacion).slice(0, 60)]);
    if (lista.length) {
      var g = el('div', 'sii-grid');
      lista.forEach(function (p) { var d = el('div', 'sii-dato'); d.appendChild(el('div', 'l', p[0])); d.appendChild(el('div', 'v', p[1])); g.appendChild(d); });
      card.appendChild(g);
    }
    var det = el('details', 'sii-det'); det.appendChild(el('summary', null, 'Ver todo lo que entrega el SII'));
    det.appendChild(el('pre', null, JSON.stringify({ monitor: m, sii: sii }, null, 2).slice(0, 20000)));
    card.appendChild(det);
  }

  // ── Ventana de conexión (iframe propio + postMessage verificado) ──
  function cerrarVentana() {
    if (alMensaje) { window.removeEventListener('message', alMensaje); alMensaje = null; }
    document.removeEventListener('keydown', alTeclado);
    if (modal) { modal.remove(); modal = null; }
  }
  function alTeclado(e) { if (e.key === 'Escape') { cerrarVentana(); if (actual) cargar(); } }
  function abrirVentana(url) {
    if (typeof url !== 'string' || url.indexOf(CARTAPRA + '/') !== 0) throw new Error('ventana no válida');
    cerrarVentana();
    modal = el('div', 'sii-velo'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Conectar con el SII');
    var fr = el('iframe'); fr.src = url; fr.title = 'Conectar con el SII (Cartapra)';
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    var x = el('button', 'x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar');
    x.onclick = function () { cerrarVentana(); if (actual) cargar(); };
    modal.onclick = function (e) { if (e.target === modal) { cerrarVentana(); if (actual) cargar(); } };
    modal.appendChild(fr); modal.appendChild(x); document.body.appendChild(modal);
    alMensaje = function (ev) {
      if (ev.origin !== CARTAPRA || ev.source !== fr.contentWindow) return;
      var d = ev.data; if (!d || d.fuente !== 'cartapra-conecta') return;
      if (d.evento === 'conectada' && window.toast) window.toast('El SII aceptó la clave. Gestoor ya puede leer los datos.');
      if (d.evento === 'cerrar') { cerrarVentana(); if (actual) cargar(); }
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
    else if (st === 429) { t = 'Cartapra pide esperar un momento'; sub = 'Vuelve a intentar en ' + (Number(e.reintentarEn) || 60) + ' segundos.'; }
    else if (err === 'NO_CONFIGURADO') { t = 'La conexión con Cartapra aún no está activada'; sub = 'Avisa al Master.'; }
    var f = fila(card, 'alerta', st === 403 ? 'sii-mor' : 'sii-roj', t, sub);
    if (st !== 403 && st !== 401) boton(f, 'Volver a revisar', 'repetir', true, function () { cargar(); });
  }
  function pintar(j) {
    var card = nuevaCard(); if (!card) return;
    var c = j.conexion || {}, puede = actual.esMaster === true;
    if (c.estado === 'no_conectada') {
      var f1 = fila(card, 'candado', 'sii-cel', 'Sin conectar con el SII', puede ? 'Se abre una ventana segura de Cartapra con el RUT ya puesto. Ahí se escribe la clave del SII: Gestoor no la ve.' : 'Pídele al Master que la conecte.');
      if (puede) boton(f1, 'Conectar con el SII', 'llave', false, pedirVentana);
    } else if (c.estado === 'clave_rechazada') {
      var f2 = fila(card, 'alerta', 'sii-amb', 'La clave del SII cambió', 'Las lecturas se detuvieron. Hay que volver a conectar con la clave nueva.');
      if (puede) boton(f2, 'Reconectar', 'repetir', false, pedirVentana);
    } else if (c.estado === 'conectada' && (c.actualizando || !c.cargaInicialLista)) {
      var f3 = fila(card, 'reloj', 'sii-ama', 'Leyendo el SII…', c.ultimaActualizacion ? 'Última actualización: ' + horaChile(c.ultimaActualizacion) + ' (hora de Chile)' : 'La primera lectura toma unos minutos.');
      boton(f3, 'Volver a revisar', 'repetir', true, function () { cargar(); });
    } else if (c.estado === 'conectada') {
      fila(card, 'check', 'sii-ver', 'Conectado', 'Última actualización: ' + (c.ultimaActualizacion ? horaChile(c.ultimaActualizacion) + ' (hora de Chile)' : 'No disponible') + ' · se actualiza sola una vez al día');
      pintarResumen(card, j);
    } else {
      pintarError({ status: 502, detalle: 'Cartapra respondió algo inesperado.' }); return;
    }
    if (c.ultimoError && c.estado !== 'no_conectada') card.appendChild(el('div', 'sii-nota', 'Último aviso de Cartapra: ' + c.ultimoError));
    card.appendChild(el('div', 'sii-nota', 'Solo lectura: Cartapra consulta el SII, no presenta declaraciones ni cambia nada.'));
  }
  function cargar() {
    if (!actual) return;
    var mio = actual, n = ++seq;
    var card = nuevaCard(); fila(card, 'reloj', 'sii-cel', 'Revisando la conexión con el SII…', null);
    // "resumen" trae el estado y, si ya hay datos, el monitor: una sola ida al servidor.
    llamar('resumen', mio.clienteId).then(function (j) { if (actual === mio && n === seq) pintar(j); })
      .catch(function (e) { if (actual === mio && n === seq) pintarError(e); });
  }

  window.GestoorSII = {
    montar: function (cont, clienteId, op) {
      if (!cont || !(Number(clienteId) > 0)) return;
      estilos(); cerrarVentana();
      actual = { cont: cont, clienteId: Number(clienteId), esMaster: !!(op && op.esMaster === true) };
      cargar();
    },
    desmontar: function () { cerrarVentana(); seq++; actual = null; }
  };
})();
