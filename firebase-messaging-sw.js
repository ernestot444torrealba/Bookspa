// Este archivo tiene que vivir en la RAÍZ del sitio (mismo nivel que index.html),
// nunca dentro de una subcarpeta — es un requisito de Firebase Cloud Messaging para
// que el service worker pueda controlar todo el dominio.
//
// Se encarga de mostrar la notificación cuando el navegador/app está en segundo
// plano o cerrada. Cuando la app está abierta y visible, la notificación la muestra
// directamente el JS principal (ver notifyNewAlerts en bookspa.html).

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Mismos datos que STATE.firebaseConfig en index.html. Son públicos (identifican el
// proyecto, no dan acceso a nada) así que no hay problema en que estén acá.
firebase.initializeApp({
  apiKey: "AIzaSyAvV3eCgALJltgv0WPWGQ9PHaOwMHtBsvU",
  authDomain: "bookspa-d6707.firebaseapp.com",
  projectId: "bookspa-d6707",
  storageBucket: "bookspa-d6707.firebasestorage.app",
  messagingSenderId: "1086916389294",
  appId: "1:1086916389294:web:ece17ce8ccd458ddc5803f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'BookSpa';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png' // si no existe, el navegador usa un ícono genérico; no rompe nada
  });
});

// Al tocar la notificación, abre (o enfoca) la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/#admin');
    })
  );
});
