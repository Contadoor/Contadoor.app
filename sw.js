/* Service worker de Gestoor (mismo modelo que la bandeja de CreeSiente).
   Solo recibe avisos push y abre la bandeja al tocarlos. NO cachea nada a propósito:
   Gestoor muestra datos de clientes y siempre deben venir frescos del servidor.
   (La única caché es 'gestoor-prefs': guarda si el usuario silenció el sonido; nunca datos.) */
const VERSION = 'gestoor-sw-2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* Sonido: un aviso push no puede llevar un sonido propio (el navegador no lo permite); suena el del sistema según `silent`.
   · Gestoor abierto y a la vista → el aviso va sin sonido del sistema y la página toca el sonido de Gestoor (sin sonar doble).
   · Gestoor cerrado o de fondo → suena el sonido del sistema (iPhone, Android, Mac, Windows), salvo que el usuario lo haya silenciado.
   La preferencia la escribe notifications.js en Cache Storage (el service worker no puede leer localStorage). */
function sonidoSilenciado() {
  return caches.open('gestoor-prefs').then((c) => c.match('/__gestoor/sonido')).then((r) => (r ? r.text() : '1'))
    .then((v) => v === '0').catch(() => false);
}

/* Aviso enviado desde el servidor (llega aunque Gestoor esté cerrado). El texto viene fijo según el tipo: nunca datos del contacto. */
self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch (e) { d = {}; }
  const url = (typeof d.url === 'string' && d.url.startsWith('/')) ? d.url : '/asistente/';   // solo rutas internas
  evento.waitUntil(Promise.all([
    sonidoSilenciado(),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
  ]).then(([silenciado, lista]) => {
    const visibles = lista.filter((c) => c.url.startsWith(self.location.origin) && c.visibilityState === 'visible');
    visibles.forEach((c) => c.postMessage({ tipo: 'gestoor-aviso' }));      // la página refresca la campana y toca el sonido de Gestoor
    const sinSonidoSistema = silenciado || visibles.length > 0;
    const opciones = {
      body: d.cuerpo || 'Hay algo que requiere tu atención.',
      icon: '/assets/gestoor-app-192.png',
      badge: '/assets/gestoor-app-192.png',
      tag: d.tag || 'gestoor',
      renotify: true,
      silent: sinSonidoSistema,
      data: { url },
    };
    if (!sinSonidoSistema) opciones.vibrate = [120, 60, 120];   // solo Android; con silent:true el navegador rechaza `vibrate`
    return self.registration.showNotification(d.titulo || 'Gestoor', opciones);
  }));
});

/* Al tocar el aviso: trae Gestoor al frente en la bandeja (o lo abre). */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/asistente/', self.location.origin).href;
  evento.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) { return c.navigate(destino).then((v) => (v || c).focus()); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(destino);
  }));
});
