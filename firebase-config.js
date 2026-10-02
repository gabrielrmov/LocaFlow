/* =========================================================================
   Locarion — configuração do Firebase (Auth + Firestore)
   -------------------------------------------------------------------------
   1) Crie um projeto gratuito em https://console.firebase.google.com
   2) Em "Authentication" > "Sign-in method", ative o provedor Google.
   3) Em "Firestore Database", crie o banco (modo produção) e depois
      publique as regras do arquivo firestore.rules (veja SETUP.md).
   4) Em "Configurações do projeto" > "Seus apps" > "Web", registre um app
      e cole aqui os valores gerados (são públicos, não são segredos).
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDH6fSpSlBSbRG5m8-3D5i3tYiuYI1X8TM",
  authDomain: "locaflow-fc924.firebaseapp.com",
  projectId: "locaflow-fc924",
  storageBucket: "locaflow-fc924.firebasestorage.app",
  messagingSenderId: "116758780408",
  appId: "1:116758780408:web:14fd89fb422ee141135e0d",
};

/* Chave pública de Web Push (Firebase → Configurações do projeto → Cloud Messaging →
   Certificados push da Web → "Gerar par de chaves"). Não é segredo. Enquanto estiver vazia,
   o botão "Ativar notificações" do painel avisa que ainda falta configurar. */
const FCM_VAPID_KEY = "BK-lVDQdeVY-rKm9M7ERfUF_sKHXOuqQ6hKk6vfEz6LTjncurmKZlYySnjy0rlHNwnd0to0zD6YLnSJWY2cpOuI";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
/* firebase.functions() só existe se o script firebase-functions-compat.js
   também tiver sido carregado na página (index.html e login.html carregam). */

/* Garante que só chega no dashboard quem está autenticado.
   Chame no topo do dashboard: requireAuth(user => { ...boot... }) */
function requireAuth(onReady) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html?v=20261002";
      return;
    }
    onReady(user);
  });
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = "login.html?v=20261002";
  });
}
