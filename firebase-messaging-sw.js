/* Service worker das notificações do Locarion (Firebase Cloud Messaging).
   Precisa ficar na raiz do site. Quando a notificação chega com o painel fechado,
   o próprio FCM a exibe; tocar nela abre a tela "Avisos de hoje". */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDH6fSpSlBSbRG5m8-3D5i3tYiuYI1X8TM",
  authDomain: "locaflow-fc924.firebaseapp.com",
  projectId: "locaflow-fc924",
  storageBucket: "locaflow-fc924.firebasestorage.app",
  messagingSenderId: "116758780408",
  appId: "1:116758780408:web:14fd89fb422ee141135e0d",
});
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/dashboard.html#/avisos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("/dashboard.html") && "focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
