/* ============================================================
   clientes/historia-sii.js — «Historia SII» de Cartapra Conecta en la ficha del cliente (20-11-2026).
   · Pide de una vez varios años de compras, ventas y honorarios de una empresa conectada (máx. 72 meses, desde ago-2017).
   · Todo pasa por la Edge cartapra-historia (la llave de Cartapra vive SOLO en el servidor; el permiso lo decide la base:
     Master o analista contable asignado). El navegador nunca manda un RUT: solo cliente_id.
   · «Pedir historia» abre el enlace de Cartapra en una pestaña nueva (avance + Excel). El enlace se pide NUEVO cada vez y
     no se guarda (ni en localStorage ni en la base): vive solo en esta ventana mientras el diálogo está abierto.
   · Mientras el diálogo está abierto se consulta el estado cada 60 s; cuando está «lista» se ofrece «Cargar en Gestoor»
     (la Edge baja el JSON y lo carga en el SII de Gestoor; aviso en la campana al terminar).
   · Datos externos SIEMPRE con textContent (innerHTML solo para íconos de gIcon).
   Uso: GestoorHistoriaSII.montar(elemento, {id, razon, rut}, sesion) · GestoorHistoriaSII.abrir(cliente, {desde, hasta})
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document;
  var MES_MINIMO = '2017-08', MAX_MESES = 72, CADA_MS = 60000;

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function icono(n) { var i = el('i', 'ic'); i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function puedeVer(s) { return !!s && (s.esMaster === true || s.rol === 'master' || s.rol === 'contable'); }
  function aInput(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function aAAAAMM(v) { return String(v || '').replace('-', ''); }
  function nMeses(d, h) { var a = d.split('-'), b = h.split('-'); return (Number(b[0]) * 12 + Number(b[1])) - (Number(a[0]) * 12 + Number(a[1])) + 1; }
  function horaChile(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  /** Rango válido: desde ≥ ago-2017, hasta ≤ mes actual, desde ≤ hasta, máx 72 meses. Devuelve el texto del problema o ''. */
  function validarRango(desde, hasta, hoy) {
    var actual = aInput(hoy || new Date());
    if (!/^\d{4}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}$/.test(hasta || '')) return 'Elige el mes «desde» y el mes «hasta».';
    if (desde < MES_MINIMO) return 'El registro de compras y ventas existe desde agosto de 2017.';
    if (hasta > actual) return '«Hasta» no puede ser un mes futuro.';
    if (desde > hasta) return '«Desde» debe ser anterior o igual a «hasta».';
    if (nMeses(desde, hasta) > MAX_MESES) return 'El máximo es de 72 meses (6 años).';
    return '';
  }

  // Misma llamada que edgeFetch de clientes/index.html (JWT de la sesión; la clave anon va solo como apikey).
  function edgeSesion(fn, body) {
    var tok = raiz._gestoorAccessToken;
    if (!tok || typeof raiz.SB_URL !== 'string' || typeof raiz.SB_KEY !== 'string') return Promise.reject({ status: 401, error: 'SIN_SESION' });
    return raiz.fetch(raiz.SB_URL + '/functions/v1/' + fn, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: raiz.SB_KEY, Authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {})
    });
  }
  function llamar(cuerpo) {
    var f = typeof raiz.edgeFetch === 'function' ? raiz.edgeFetch : edgeSesion;
    return f('cartapra-historia', cuerpo).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j || j.ok !== true) throw { status: r.status, error: (j && j.error) || 'ERROR', detalle: j && j.detalle, historia: j && j.historia, resumen: j && j.resumen };
        return j;
      });
    });
  }
  function mensajeError(e) {
    var c = e && e.error;
    if (e && e.status === 401) return 'Tu sesión venció. Vuelve a ingresar.';
    if (c === 'SIN_PERMISO') return 'Solo el Master o el analista contable asignado a esta empresa pueden pedir la Historia SII.';
    if (c === 'EMPRESA_NO_CONECTADA') return 'La empresa no está conectada con el SII: conéctala primero en «Datos del SII».';
    if (c === 'CLAVE_RECHAZADA') return 'La clave del SII de esta empresa cambió: hay que reconectarla en Cartapra.';
    if (c === 'PERIODO_INVALIDO') return 'Revisa el rango: desde agosto de 2017, hasta el mes actual, máximo 72 meses.';
    if (c === 'CARTAPRA_SIN_PERMISO') return 'A la llave de Gestoor en Cartapra le faltan permisos (actualizar, rcv y honorarios). Avisa al Master.';
    if (c === 'CARTAPRA_LIMITE') return 'Cartapra pide esperar un momento. Intenta de nuevo en un minuto.';
    if (c === 'HISTORIA_VENCIDA' || c === 'HISTORIA_NO_EXISTE') return 'El pedido ya venció. Pide la historia de nuevo.';
    if (c === 'NO_INSTALADO' || (e && e.status === 404 && !c)) return 'La Historia SII aún no está instalada en el servidor.';
    return (e && e.detalle) || 'No pudimos hablar con Cartapra ahora. Intenta de nuevo en unos minutos.';
  }

  function estilos() {
    if (doc.getElementById('hsii-css')) return;
    var s = el('style'); s.id = 'hsii-css';
    s.textContent = [
      '.hsii-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;border:1.5px solid transparent;background:linear-gradient(160deg,#A4599C,#803889);color:#fff}',
      '.hsii-btn.sec{background:transparent;border-color:#6B4672;color:#F3E9F4}.hsii-btn[disabled]{opacity:.55;cursor:not-allowed}.hsii-btn .g-ic{width:16px;height:16px}.hsii-btn .ic{display:inline-flex;line-height:0}',
      '.hsii-ficha{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hsii-ficha small{color:#C9A8CC;font-size:12px}',
      '.hsii-velo{position:fixed;inset:0;z-index:440;background:rgba(12,7,14,.82);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}',
      '.hsii-caja{width:620px;max-width:100%;background:#1E1222;color:#F2EAF4;border:1px solid #3A2140;border-radius:18px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6);margin-top:6vh}',
      '.hsii-cab{display:flex;align-items:center;gap:10px}.hsii-cab h3{margin:0;flex:1;font:800 17px var(--g-titulo,Montserrat,sans-serif)}.hsii-cab h3 span{color:#E39BE5;font-weight:700;font-size:13px;display:block;margin-top:2px}',
      '.hsii-x{width:38px;height:38px;border-radius:999px;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer}',
      '.hsii-txt{margin:12px 0 0;font-size:12.5px;line-height:1.5;color:#E9DCEB}',
      '.hsii-ctl{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:14px}.hsii-ctl label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#C9A8CC;letter-spacing:.3px}',
      '.hsii-ctl input{min-height:38px;border-radius:10px;border:1px solid #4A2B50;background:#140B17;color:#F3E9F4;padding:0 10px;font:inherit;font-size:13px}',
      '.hsii-msg{margin-top:12px;font-size:12.5px;line-height:1.45;padding:8px 12px;border-radius:10px;border:1px solid #3A2140;background:rgba(12,7,14,.35)}',
      '.hsii-msg.roj{color:#FF8A7A;border-color:rgba(255,138,122,.55)}.hsii-msg.amb{color:#FFC85A;border-color:rgba(255,200,90,.45)}.hsii-msg.ver{color:#46D69A;border-color:rgba(70,214,154,.4)}',
      '.hsii-barra{margin-top:10px;height:8px;border-radius:999px;background:#33203A;overflow:hidden}.hsii-barra i{display:block;height:100%;background:linear-gradient(90deg,#A4599C,#E39BE5);transition:width .4s}',
      '.hsii-acc{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;align-items:center}.hsii-acc a{color:#E39BE5;font-size:12.5px}',
      '.hsii-res{margin:10px 0 0;padding-left:18px;font-size:12px;color:#E9DCEB;line-height:1.55}',
      '.hsii-nota{margin-top:12px;font-size:11.5px;color:#FFC85A;line-height:1.5}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  function montar(cont, cliente, sesion) {
    if (!cont) return;
    cont.textContent = '';
    if (!cliente || !(Number(cliente.id) > 0) || !puedeVer(sesion)) return;
    estilos();
    var w = el('div', 'hsii-ficha');
    var b = el('button', 'hsii-btn sec'); b.type = 'button'; b.id = 'hsii-abrir';
    b.appendChild(icono('calendario')); b.appendChild(doc.createTextNode('Historia SII'));
    b.addEventListener('click', function () { abrir(cliente); });
    w.appendChild(b); w.appendChild(el('small', null, 'Hasta 6 años de compras, ventas y honorarios del SII (Cartapra), en Excel o cargados en Gestoor.'));
    cont.appendChild(w);
  }

  var vista = null;   // { velo, cliente, historiaId, timer, seq }
  function cerrar() {
    if (vista) { if (vista.timer) raiz.clearInterval(vista.timer); if (vista.velo) vista.velo.remove(); }
    vista = null; doc.removeEventListener('keydown', alEsc);
  }
  function alEsc(ev) { if (ev.key === 'Escape') cerrar(); }

  function abrir(cliente, rango) {
    cerrar(); estilos();
    var hoy = new Date();
    var defDesde = new Date(hoy.getFullYear() - 3, 0, 1);
    var velo = el('div', 'hsii-velo'); velo.id = 'hsii-velo'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true');
    var caja = el('div', 'hsii-caja'); velo.appendChild(caja);
    var cab = el('div', 'hsii-cab'); cab.appendChild(icono('calendario'));
    var h = el('h3', null, 'Historia SII'); h.appendChild(el('span', null, (cliente.razon || 'Cliente') + (cliente.rut ? ' · ' + cliente.rut : ''))); cab.appendChild(h);
    var x = el('button', 'hsii-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrar); cab.appendChild(x);
    caja.appendChild(cab);
    caja.appendChild(el('p', 'hsii-txt', 'Cartapra trae del SII los meses que falten de compras, ventas y honorarios. Se abre una pestaña con el avance y, al llegar al 100 %, el botón para descargar el Excel. También puedes cargarlos aquí en Gestoor.'));

    var ctl = el('div', 'hsii-ctl');
    function campo(etq, valor, id) { var l = el('label', null, etq); var i = el('input'); i.type = 'month'; i.min = MES_MINIMO; i.max = aInput(hoy); i.value = valor; i.id = id; l.appendChild(i); ctl.appendChild(l); return i; }
    var iDesde = campo('Desde', (rango && rango.desde) || aInput(defDesde), 'hsii-desde');
    var iHasta = campo('Hasta', (rango && rango.hasta) || aInput(hoy), 'hsii-hasta');
    var bPedir = el('button', 'hsii-btn'); bPedir.type = 'button'; bPedir.id = 'hsii-pedir'; bPedir.appendChild(icono('descargar')); bPedir.appendChild(doc.createTextNode('Pedir historia'));
    ctl.appendChild(bPedir); caja.appendChild(ctl);
    var msg = el('div', 'hsii-msg', 'Elige desde qué mes (máximo 72 meses, desde agosto de 2017) y presiona «Pedir historia».'); msg.id = 'hsii-msg'; caja.appendChild(msg);
    var barra = el('div', 'hsii-barra'); var relleno = el('i'); relleno.style.width = '0%'; barra.appendChild(relleno); barra.hidden = true; caja.appendChild(barra);
    var acc = el('div', 'hsii-acc'); caja.appendChild(acc);
    var enlace = el('a', null, 'Abrir el avance en Cartapra'); enlace.id = 'hsii-enlace'; enlace.target = '_blank'; enlace.rel = 'noopener noreferrer'; enlace.hidden = true; acc.appendChild(enlace);
    var bCargar = el('button', 'hsii-btn'); bCargar.type = 'button'; bCargar.id = 'hsii-cargar'; bCargar.appendChild(icono('subir')); bCargar.appendChild(doc.createTextNode('Cargar en Gestoor')); bCargar.hidden = true; acc.appendChild(bCargar);
    var res = el('ul', 'hsii-res'); res.id = 'hsii-res'; caja.appendChild(res);
    caja.appendChild(el('div', 'hsii-nota', 'La Historia trae compras, ventas y honorarios; no trae F29. Cartapra entrega montos de F29 solo de los últimos 6 folios. El enlace es privado y vence en 7 días: no lo reenvíes.'));

    vista = { velo: velo, cliente: cliente, historiaId: null, timer: null, seq: 0 };
    var v = vista;
    function aviso(t, c) { msg.className = 'hsii-msg' + (c ? ' ' + c : ''); msg.textContent = t; }
    function pintarEstado(hh) {
      if (!hh) return;
      var p = Number(hh.porcentaje); barra.hidden = false; relleno.style.width = (isNaN(p) ? 0 : Math.max(0, Math.min(100, p))) + '%';
      if (hh.estado === 'lista') {
        aviso('Lista: 100 %. Descarga el Excel en la pestaña de Cartapra o cárgala aquí en Gestoor.', 'ver');
        bCargar.hidden = false; bCargar.disabled = false; parar();
      } else if (hh.estado === 'vencida') {
        aviso('El pedido venció. Pide la historia de nuevo.', 'amb'); bCargar.hidden = true; enlace.hidden = true; parar();
      } else {
        var m = hh.meses || {};
        aviso('Cargando en Cartapra: ' + (isNaN(p) ? '…' : p + ' %') + (m.total ? ' (' + (m.listos || 0) + ' de ' + m.total + ' meses)' : '') +
          (hh.minutosEstimados ? ' · faltan unos ' + hh.minutosEstimados + ' min' : '') + '. Revisamos cada minuto mientras esta ventana esté abierta.', 'amb');
      }
    }
    function parar() { if (v.timer) { raiz.clearInterval(v.timer); v.timer = null; } }
    function consultar() {
      if (vista !== v || !v.historiaId) return;
      llamar({ accion: 'estado', cliente_id: Number(cliente.id), historia_id: v.historiaId })
        .then(function (j) { if (vista === v) pintarEstado(j.historia); })
        .catch(function (e) { if (vista === v && e && (e.error === 'HISTORIA_VENCIDA' || e.status === 401 || e.status === 403)) { parar(); aviso(mensajeError(e), 'roj'); } });
    }

    bPedir.addEventListener('click', function () {
      var problema = validarRango(iDesde.value, iHasta.value, new Date());
      if (problema) { aviso(problema, 'roj'); return; }
      // La pestaña se abre YA (en el clic) para que el navegador no la bloquee; se le pone la dirección al llegar el enlace.
      var pest = null; try { pest = raiz.open('', '_blank'); if (pest) pest.opener = null; } catch (e) { pest = null; }
      var s = ++v.seq; bPedir.disabled = true; bCargar.hidden = true; res.textContent = ''; parar(); aviso('Pidiendo la historia a Cartapra…');
      llamar({ accion: 'pedir', cliente_id: Number(cliente.id), desde: aAAAAMM(iDesde.value), hasta: aAAAAMM(iHasta.value) })
        .then(function (j) {
          if (vista !== v || s !== v.seq) { if (pest) pest.close(); return; }
          bPedir.disabled = false;
          var hh = j.historia || {};
          v.historiaId = hh.id;
          if (typeof hh.enlace === 'string' && hh.enlace.indexOf('https://app.cartapra.com/conecta-historia/') === 0) {
            enlace.href = hh.enlace; enlace.hidden = false;
            enlace.textContent = 'Abrir el avance en Cartapra' + (hh.expiraEn && horaChile(hh.expiraEn) ? ' (vence el ' + horaChile(hh.expiraEn) + ')' : '');
            if (pest) { try { pest.location.href = hh.enlace; } catch (e) { /* */ } }
          } else if (pest) pest.close();
          pintarEstado(hh);
          if (hh.estado === 'cargando') v.timer = raiz.setInterval(consultar, CADA_MS);
        })
        .catch(function (e) { if (pest) pest.close(); if (vista !== v) return; bPedir.disabled = false; aviso(mensajeError(e), 'roj'); });
    });

    bCargar.addEventListener('click', function () {
      if (!v.historiaId) return;
      bCargar.disabled = true; bPedir.disabled = true; res.textContent = ''; aviso('Cargando los datos en Gestoor… (puede tardar un minuto)');
      llamar({ accion: 'cargar', cliente_id: Number(cliente.id), historia_id: v.historiaId })
        .then(function (j) {
          if (vista !== v) return;
          bPedir.disabled = false;
          var t = j.totales || {};
          aviso('Listo: ' + (Number(t.cargados) || 0) + ' meses-libro nuevos y ' + (Number(t.sin_cambio) || 0) + ' que ya estaban iguales.' +
            (Number(t.omitidos_sync) > 0 ? ' ' + t.omitidos_sync + ' se dejaron como estaban (la sincronización diaria tiene datos más nuevos).' : '') +
            (Number(t.parciales) > 0 ? ' ' + t.parciales + ' quedaron parciales.' : '') + ' Vuelve a Calcular el levantamiento de IVA.', Number(t.parciales) > 0 ? 'amb' : 'ver');
          pintarResumen(j.resumen);
        })
        .catch(function (e) {
          if (vista !== v) return;
          bPedir.disabled = false; bCargar.disabled = false;
          if (e && e.error === 'HISTORIA_CARGANDO') { aviso('Cartapra todavía está cargando. Seguimos revisando cada minuto.', 'amb'); bCargar.hidden = true; if (!v.timer) v.timer = raiz.setInterval(consultar, CADA_MS); return; }
          if (e && e.error === 'CARGA_INCOMPLETA') { aviso('Se cargó solo una parte: revisa el detalle. Puedes intentarlo de nuevo (no se duplica nada).', 'amb'); pintarResumen(e.resumen); return; }
          aviso(mensajeError(e), 'roj');
        });
    });
    var NOMBRES = { rcv_ventas: 'Ventas', rcv_compras: 'Compras', honorarios: 'Honorarios recibidos', honorarios_emitidos: 'Honorarios emitidos' };
    var RESULT = { formato_no_reconocido: 'Cartapra entregó columnas que no reconocemos: no se cargó (avisa al Master).', error: 'No se pudo guardar: intenta de nuevo.' };
    function pintarResumen(lista) {
      res.textContent = '';
      (lista || []).forEach(function (z) {
        var t = (NOMBRES[z.tipo] || z.tipo) + ': ';
        if (z.resultado !== 'ok') t += RESULT[z.resultado] || 'No se cargó.';
        else t += (z.meses || 0) + ' meses · ' + (z.cargados || 0) + ' nuevos · ' + (z.sin_cambio || 0) + ' iguales' + (z.omitidos_sync ? ' · ' + z.omitidos_sync + ' ya al día por la sync diaria' : '') + (z.parciales ? ' · ' + z.parciales + ' parciales' : '');
        res.appendChild(el('li', null, t));
      });
    }
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
    doc.addEventListener('keydown', alEsc);
    doc.body.appendChild(velo);
  }

  raiz.GestoorHistoriaSII = { montar: montar, abrir: abrir, cerrar: cerrar, puedeVer: puedeVer, validarRango: validarRango, mensajeError: mensajeError, horaChile: horaChile };
})(window);
