// ═══════════════════════════════════════════════════════════
// GESTOOR — AVISOS PUSH AL CELULAR (Web Push, mismo modelo que CreeSiente)
// avisos-push.js — botón "Activar avisos en este celular" (bandeja del asistente y Facturación; cualquier usuario activo).
// Registra /sw.js, pide permiso, suscribe el dispositivo y lo guarda por RPC (gestoor_push_suscribir).
// Requiere supabase.js (sbPost con JWT). En iPhone solo funciona con Gestoor instalado en la pantalla de inicio.
// ═══════════════════════════════════════════════════════════
(function () {
  var VAPID_PUBLICA = 'BL1WhJS8bWYFwrmgmz7CYOeJpcdL9sqPerJjyBBTWpsLp58Am0D4TzKVUdQRrw9G1v6OATehG7HGt8YyByffrqg';

  function bytes(b64) {
    var s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function b64url(buf) {
    var s = String.fromCharCode.apply(null, new Uint8Array(buf));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function soportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function rpc(fn, args) {
    return sbFetch('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('HTTP ' + r.status));
        return j;
      }); });
  }

  function pintar(btn, estado) {
    btn.hidden = false; btn.disabled = false;
    if (estado === 'activos') { btn.textContent = '🔔 Avisos activos · Probar'; btn.dataset.estado = 'activos'; btn.title = 'Te llegará un aviso de prueba a este dispositivo'; }
    else if (estado === 'bloqueados') { btn.textContent = '🔕 Avisos bloqueados'; btn.dataset.estado = 'bloqueados'; btn.title = 'Permite las notificaciones de Gestoor en los ajustes del celular/navegador'; }
    else if (estado === 'instalar') { btn.textContent = '📲 Instala Gestoor para recibir avisos'; btn.dataset.estado = 'instalar'; btn.title = 'En iPhone: Compartir → Agregar a inicio, y abre Gestoor desde ese ícono'; }
    else { btn.textContent = '🔔 Activar avisos en este celular'; btn.dataset.estado = 'activar'; btn.title = 'Recibe en este dispositivo los avisos urgentes de Gestoor (facturas por aprobar, aprobadas, inciertas…)'; }
  }
  function avisar(t) { var a = document.getElementById('as-aviso'); if (a) { a.textContent = t; a.classList.add('on'); setTimeout(function () { a.classList.remove('on'); }, 4500); } else alert(t); }

  function suscripcionActual() {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return { reg: reg, sub: s }; }); });
  }

  function activar(btn) {
    btn.disabled = true;
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { pintar(btn, 'bloqueados'); throw new Error('permiso'); }
      return suscripcionActual();
    }).then(function (x) {
      return x.sub || x.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(VAPID_PUBLICA) });
    }).then(function (sub) {
      return rpc('gestoor_push_suscribir', { p_endpoint: sub.endpoint, p_p256dh: b64url(sub.getKey('p256dh')), p_auth: b64url(sub.getKey('auth')), p_user_agent: navigator.userAgent.slice(0, 300) });
    }).then(function () {
      pintar(btn, 'activos'); avisar('Avisos activados en este dispositivo. Te llegará una prueba.');
      return rpc('gestoor_push_probar').catch(function () {});
    }).catch(function (e) {
      if (e && e.message === 'permiso') { avisar('El celular no dio permiso para notificaciones. Actívalo en Ajustes → Notificaciones → Gestoor.'); return; }
      pintar(btn, 'activar'); avisar('No se pudieron activar los avisos: ' + (e && e.message || e));
    });
  }

  var iniciado = false;
  function iniciar() {
    var btn = document.getElementById('as-avisos'); if (!btn || iniciado) return;
    iniciado = true;
    if (esIOS && !instalada) { pintar(btn, 'instalar'); btn.onclick = function () { avisar('En iPhone: toca Compartir → "Agregar a inicio" y abre Gestoor desde ese ícono. Ahí activas los avisos.'); }; return; }
    if (!soportado()) { btn.hidden = true; return; }
    if (Notification.permission === 'denied') { pintar(btn, 'bloqueados'); btn.onclick = function () { avisar('Las notificaciones están bloqueadas para Gestoor. Actívalas en los ajustes del celular o del navegador.'); }; return; }
    suscripcionActual().then(function (x) {
      if (x.sub && Notification.permission === 'granted') {
        // Re-sincroniza el dispositivo (por si se borró en el servidor o cambió de usuario) sin pedir nada al usuario
        rpc('gestoor_push_suscribir', { p_endpoint: x.sub.endpoint, p_p256dh: b64url(x.sub.getKey('p256dh')), p_auth: b64url(x.sub.getKey('auth')), p_user_agent: navigator.userAgent.slice(0, 300) })
          .then(function () { pintar(btn, 'activos'); }).catch(function () { pintar(btn, 'activar'); });
      } else pintar(btn, 'activar');
    }).catch(function () { pintar(btn, 'activar'); });
    btn.onclick = function () {
      if (btn.dataset.estado === 'activos') {
        btn.disabled = true;
        rpc('gestoor_push_probar').then(function () { avisar('Aviso de prueba enviado. Debería llegar en unos segundos.'); })
          .catch(function (e) { avisar(/ESPERA_UN_MINUTO/.test(e.message) ? 'Espera un minuto entre pruebas.' : 'No se pudo enviar la prueba: ' + e.message); })
          .then(function () { btn.disabled = false; });
      } else if (btn.dataset.estado === 'activar') activar(btn);
    };
  }
  window.addEventListener('gestoor-auth-ready', iniciar);
  // Si la sesión ya estaba lista antes de cargar este archivo, el evento no se repite: iniciar al terminar de cargar la página.
  function siYaLista() { if (window._sbAuthReady === true) iniciar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', siYaLista); else setTimeout(siYaLista, 0);
})();
