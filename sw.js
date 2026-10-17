/* Service worker de Gestoor (mismo modelo que la bandeja de CreeSiente).
   Solo recibe avisos push y abre la bandeja al tocarlos. NO cachea nada a propósito:
   Gestoor muestra datos de clientes y siempre deben venir frescos del servidor. */
const VERSION = 'gestoor-sw-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* Aviso enviado desde el servidor (llega aunque Gestoor esté cerrado). El texto viene fijo según el tipo: nunca datos del contacto. */
self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch (e) { d = {}; }
  const url = (typeof d.url === 'string' && d.url.startsWith('/')) ? d.url : '/asistente/';   // solo rutas internas
  evento.waitUntil(self.registration.showNotification(d.titulo || 'Gestoor', {
    body: d.cuerpo || 'Hay algo que requiere tu atención.',
    icon: '/assets/gestoor-app-192.png',
    badge: '/assets/gestoor-app-192.png',
    tag: d.tag || 'gestoor',
    renotify: true,
    data: { url },
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
