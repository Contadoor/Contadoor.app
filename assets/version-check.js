/* ============================================================
   version-check.js — Aviso "Hay una versión nueva de Gestoor"
   ------------------------------------------------------------
   Problema que resuelve: GitHub Pages entrega los archivos con
   Cache-Control max-age=600, así que tras publicar el navegador
   puede seguir usando auth.js, supabase.js o la página .html antiguos.

   Cómo detecta una publicación nueva (sin pasos manuales):
   - GitHub Pages marca TODOS los archivos de una publicación con la
     misma cabecera Last-Modified (= hora de la publicación).
   - Al cargar, se mira la Last-Modified de los archivos propios que
     esta página realmente usó (desde la caché del navegador).
   - Cada 5 minutos y al volver a la pestaña se consulta version.json
     con cache:'no-store'. Si su Last-Modified es más nueva (o cambió
     el campo "version"), se muestra el aviso.
   - El botón "Recargar" baja de nuevo los scripts/estilos propios
     (fetch cache:'reload', que reemplaza la copia vieja en la caché)
     y luego recarga. NUNCA recarga solo: podría perderse trabajo.

   Sin dependencias, sin datos personales, silencioso si algo falla.
   No toca la barra superior (.topbar): usa su propio contenedor fijo.
   ============================================================ */
(function () {
  'use strict';
  if (window.__gestoorVersionCheck) return;            // evita doble carga
  window.__gestoorVersionCheck = true;
  if (!window.fetch || !window.Promise || !window.URL) return;

  var CADA_MS = 5 * 60 * 1000;     // consulta periódica
  var MIN_ENTRE_MS = 30 * 1000;    // no consultar más de una vez cada 30 s
  var TOLERANCIA_MS = 120 * 1000;  // margen entre archivos de una misma publicación

  var yo = document.currentScript || document.querySelector('script[src*="version-check.js"]');
  var URL_VERSION;
  try { URL_VERSION = new URL('../version.json', yo && yo.src ? yo.src : location.href).href; }
  catch (e) { return; }

  var base = null;          // { v: texto de version.json, t: ms de la versión que corre esta página }
  var ultimaConsulta = 0;
  var avisoMostrado = false;
  var descartadoT = 0;      // si la persona cierra el aviso, vuelve a salir solo con una versión aún más nueva

  function fecha(res) {
    var lm = res && res.headers && res.headers.get('Last-Modified');
    var t = lm ? Date.parse(lm) : NaN;
    return isNaN(t) ? 0 : t;
  }

  /* Archivos propios (mismo origen) que usa esta página: la página misma, scripts y estilos. */
  function propios() {
    var lista = [location.href.split('#')[0]];
    var nodos = document.querySelectorAll('script[src],link[rel="stylesheet"][href]');
    for (var i = 0; i < nodos.length; i++) {
      var u = nodos[i].src || nodos[i].href;
      try {
        var x = new URL(u, location.href);
        if (x.origin === location.origin && lista.indexOf(x.href) < 0) lista.push(x.href);
      } catch (e) {}
    }
    return lista.slice(0, 15);
  }

  function leerVersion() {
    var u = URL_VERSION + (URL_VERSION.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
    return fetch(u, { cache: 'no-store', credentials: 'omit' }).then(function (res) {
      if (!res.ok) return null;
      var t = fecha(res);
      return res.json().catch(function () { return {}; }).then(function (j) {
        return { v: (j && typeof j.version === 'string') ? j.version : '', t: t };
      });
    }).catch(function () { return null; });
  }

  /* Fecha de publicación de lo que esta página está corriendo: la más antigua entre sus archivos propios
     tal como están en la caché del navegador (force-cache = no va a la red si ya los tiene). */
  function fechaDeLoQueCorre() {
    return Promise.all(propios().map(function (u) {
      return fetch(u, { cache: 'force-cache', credentials: 'same-origin' })
        .then(function (r) { return r.ok ? fecha(r) : 0; })
        .catch(function () { return 0; });
    })).then(function (ts) {
      var v = ts.filter(function (t) { return t > 0; });
      return v.length ? Math.min.apply(null, v) : 0;
    });
  }

  function hayNueva(actual) {
    if (!actual || !base) return false;
    if (actual.v && base.v && actual.v !== base.v) return true;
    if (actual.t && base.t && actual.t > base.t + TOLERANCIA_MS && actual.t > descartadoT) return true;
    return false;
  }

  function revisar(forzar) {
    if (avisoMostrado) return;
    var ahora = Date.now();
    if (!forzar && ahora - ultimaConsulta < MIN_ENTRE_MS) return;
    ultimaConsulta = ahora;
    leerVersion().then(function (actual) {
      if (!actual) return;                                   // falló: silencioso
      if (!base) { base = { v: actual.v, t: actual.t }; return; }
      if (hayNueva(actual)) mostrar(actual);
    });
  }

  /* ---------- Aviso visual (estilo Gestoor) ---------- */
  function estilos() {
    if (document.getElementById('gv-estilos')) return;
    var s = document.createElement('style');
    s.id = 'gv-estilos';
    s.textContent =
      '#gv-aviso{position:fixed;right:24px;bottom:84px;z-index:2147483000;display:flex;align-items:center;gap:12px;' +
      'max-width:380px;padding:12px 12px 12px 14px;background:#fff;color:#1A121C;border:1px solid #E7DEE9;' +
      'border-left:4px solid #924893;border-radius:14px;box-shadow:0 2px 6px rgba(26,18,28,.06),0 12px 32px rgba(146,72,147,.18);' +
      'font:500 13.5px/1.35 Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;opacity:0;transform:translateY(12px);' +
      'transition:opacity .25s ease,transform .25s ease}' +
      '#gv-aviso.gv-on{opacity:1;transform:none}' +
      '#gv-aviso .gv-ic{flex:0 0 36px;width:36px;height:36px;border-radius:10px;background:#F5EAF5;color:#924893;display:flex;align-items:center;justify-content:center}' +
      '#gv-aviso .gv-tx{flex:1;min-width:0}' +
      '#gv-aviso .gv-tx b{display:block;font:700 13.5px/1.3 Montserrat,Inter,system-ui,sans-serif;color:#1A121C}' +
      '#gv-aviso .gv-tx span{display:block;font-size:12px;color:#5C4F60;margin-top:2px}' +
      '#gv-aviso .gv-btn{flex:0 0 auto;min-height:40px;padding:0 16px;border:0;border-radius:10px;cursor:pointer;' +
      'background:linear-gradient(160deg,#A4599C,#803889);color:#fff;font:700 13px Montserrat,Inter,system-ui,sans-serif}' +
      '#gv-aviso .gv-btn:disabled{opacity:.75;cursor:progress}' +
      '#gv-aviso .gv-x{flex:0 0 auto;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#8A7C8E;cursor:pointer;font-size:18px;line-height:1}' +
      '#gv-aviso .gv-x:hover{background:#F6F2F8;color:#1A121C}' +
      '#gv-aviso button:focus-visible{outline:2px solid #924893;outline-offset:2px}' +
      '@media (max-width:600px){#gv-aviso{left:12px;right:12px;bottom:76px;max-width:none}}' +
      '@media (prefers-reduced-motion:reduce){#gv-aviso{transition:none}}';
    (document.head || document.documentElement).appendChild(s);
  }

  var ICONO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';

  function mostrar(actual) {
    if (avisoMostrado || !document.body) return;
    avisoMostrado = true;
    estilos();
    var d = document.createElement('div');
    d.id = 'gv-aviso';
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    d.innerHTML =
      '<div class="gv-ic">' + ICONO + '</div>' +
      '<div class="gv-tx"><b>Hay una versión nueva de Gestoor</b><span>Guarda lo que estés haciendo y recarga.</span></div>' +
      '<button type="button" class="gv-btn">Recargar</button>' +
      '<button type="button" class="gv-x" aria-label="Cerrar aviso" title="Cerrar">&times;</button>';
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('gv-on'); });

    d.querySelector('.gv-btn').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      b.textContent = 'Actualizando…';
      recargarFresco();
    });
    d.querySelector('.gv-x').addEventListener('click', function () {
      descartadoT = actual.t || Date.now();
      if (actual.v) base.v = actual.v;
      d.parentNode && d.parentNode.removeChild(d);
      avisoMostrado = false;           // vuelve a revisar: solo avisa si sale otra versión más nueva
    });
  }

  /* Reemplaza en la caché del navegador las copias viejas de los archivos propios y recarga. */
  function recargarFresco() {
    var bajadas = Promise.all(propios().map(function (u) {
      return fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(function () {});
    }));
    var limite = new Promise(function (ok) { setTimeout(ok, 6000); });
    Promise.race([bajadas, limite]).then(function () { location.reload(); }, function () { location.reload(); });
  }

  /* ---------- Arranque ---------- */
  function iniciar() {
    Promise.all([leerVersion(), fechaDeLoQueCorre()]).then(function (r) {
      var v = r[0], corre = r[1];
      ultimaConsulta = Date.now();
      if (!v) return;                                        // sin version.json: se reintenta en la próxima consulta
      base = { v: v.v, t: corre && corre < v.t ? corre : v.t };
      if (hayNueva(v)) mostrar(v);                           // la página abrió con archivos viejos de la caché
    }).catch(function () {});

    setInterval(function () { if (!document.hidden) revisar(false); }, CADA_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) revisar(false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
