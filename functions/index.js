/* =========================================================================
   Locarion — Cloud Functions (checkout e webhook do Asaas)
   -------------------------------------------------------------------------
   Segredos usados (nunca ficam no código, só no Secret Manager do Firebase):
     ASAAS_API_KEY        -> chave de API do Asaas (header "access_token")
     ASAAS_WEBHOOK_TOKEN   -> token que você define no Asaas ao cadastrar o
                              webhook, usado pra validar que a chamada é
                              legítima (header "asaas-access-token")

   Como definir (rode no seu computador, dentro da pasta do projeto):
     firebase functions:secrets:set ASAAS_API_KEY
     firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN

   Configure também, em "Configurações do projeto" (ou via variável de
   ambiente no deploy), a URL pública do site:
     SITE_URL=https://SEU-DOMINIO
   ========================================================================= */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const ASAAS_API_KEY = defineSecret("ASAAS_API_KEY");
const ASAAS_WEBHOOK_TOKEN = defineSecret("ASAAS_WEBHOOK_TOKEN");

// Troque se for usar o ambiente de testes (sandbox) do Asaas:
const ASAAS_BASE_URL = "https://api.asaas.com/v3";
const SITE_URL = process.env.SITE_URL || "https://locaflow-fc924.web.app";

const PLANS = {
  profissional: { name: "Locarion — Profissional", value: 97.0 },
  enterprise: { name: "Locarion — Enterprise", value: 197.0 },
};

function nextDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------
   createAsaasCheckout — chamada pelo botão "Assinar" da landing page,
   ANTES do login (o cliente ainda não tem conta). Cria um registro
   temporário em pendingCheckouts e um checkout no Asaas, e devolve o link
   de pagamento pro navegador redirecionar o cliente.
   ------------------------------------------------------------------------- */
exports.createAsaasCheckout = onCall(
  { secrets: [ASAAS_API_KEY], region: "southamerica-east1" },
  async (request) => {
    const plan = request.data && request.data.plan;
    const planInfo = PLANS[plan];
    if (!planInfo) {
      throw new HttpsError("invalid-argument", "Plano inválido.");
    }

    const tokenRef = db.collection("pendingCheckouts").doc();
    const token = tokenRef.id;

    await tokenRef.set({
      plan,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const body = {
      // Assinatura recorrente no Asaas só aceita cartão de crédito
      // (Pix exige chargeType "DETACHED", que é só cobrança avulsa).
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      externalReference: token,
      callback: {
        successUrl: `${SITE_URL}/login.html?checkout_token=${token}&plan=${plan}`,
        cancelUrl: `${SITE_URL}/index.html?checkout=cancelado`,
        expiredUrl: `${SITE_URL}/index.html?checkout=expirado`,
      },
      items: [
        {
          name: planInfo.name,
          description: "Assinatura mensal do Locarion",
          quantity: 1,
          value: planInfo.value,
        },
      ],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate: nextDueDate(),
      },
    };

    let resp;
    try {
      resp = await fetch(`${ASAAS_BASE_URL}/checkouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: ASAAS_API_KEY.value(),
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.error("Falha ao chamar o Asaas", err);
      throw new HttpsError("internal", "Não foi possível iniciar o pagamento.");
    }

    const data = await resp.json();
    if (!resp.ok) {
      logger.error("Asaas retornou erro ao criar checkout", data);
      throw new HttpsError("internal", "Não foi possível iniciar o pagamento.");
    }

    await tokenRef.update({ asaasCheckoutId: data.id || null });

    return { url: data.link };
  }
);

/* -------------------------------------------------------------------------
   asaasWebhook — recebe eventos do Asaas (configure em Integrações >
   Webhooks, apontando para a URL desta function, com o mesmo token
   cadastrado em ASAAS_WEBHOOK_TOKEN). Confirma o pagamento no nosso banco
   sem depender do navegador do cliente.
   ------------------------------------------------------------------------- */
exports.asaasWebhook = onRequest(
  { secrets: [ASAAS_WEBHOOK_TOKEN], region: "southamerica-east1" },
  async (req, res) => {
    const receivedToken = req.get("asaas-access-token");
    if (!receivedToken || receivedToken !== ASAAS_WEBHOOK_TOKEN.value()) {
      logger.warn("Webhook do Asaas com token inválido");
      res.status(401).send("unauthorized");
      return;
    }

    const event = req.body && req.body.event;
    const paidEvents = ["CHECKOUT_PAID", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];

    if (!paidEvents.includes(event)) {
      res.status(200).send("ignored");
      return;
    }

    const checkout = req.body.checkout || {};
    const payment = req.body.payment || {};
    const externalReference = checkout.externalReference || payment.externalReference;
    const asaasCheckoutId = checkout.id;

    try {
      let docRef = null;

      if (externalReference) {
        docRef = db.collection("pendingCheckouts").doc(externalReference);
        const snap = await docRef.get();
        if (!snap.exists) docRef = null;
      }

      if (!docRef && asaasCheckoutId) {
        const query = await db
          .collection("pendingCheckouts")
          .where("asaasCheckoutId", "==", asaasCheckoutId)
          .limit(1)
          .get();
        if (!query.empty) docRef = query.docs[0].ref;
      }

      if (!docRef) {
        logger.warn("Webhook do Asaas sem pendingCheckout correspondente", req.body);
        res.status(200).send("no-match");
        return;
      }

      await docRef.update({
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send("ok");
    } catch (err) {
      logger.error("Erro ao processar webhook do Asaas", err);
      res.status(500).send("error");
    }
  }
);

/* -------------------------------------------------------------------------
   Helpers de administração — só contas com users/{uid}.isAdmin === true
   (definido manualmente no Firestore) podem chamar as functions abaixo.
   A checagem acontece no servidor (Admin SDK), então não dá pra burlar
   editando o app no navegador.
   ------------------------------------------------------------------------- */
async function assertIsAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login antes de continuar.");
  }
  const snap = await db.collection("users").doc(request.auth.uid).get();
  if (!snap.exists || snap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Só a administração do Locarion pode fazer isso.");
  }
}

const VALID_PLANS = ["profissional", "enterprise"];
const VALID_STATUSES = ["active", "inactive", "canceled"];

/* -------------------------------------------------------------------------
   adminListUsers — lista todas as contas (clientes) cadastradas no Locarion,
   com plano e status de assinatura, pra tela de administração.
   ------------------------------------------------------------------------- */
exports.adminListUsers = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    await assertIsAdmin(request);
    const snap = await db.collection("users").get();
    const users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        email: d.email || null,
        name: d.name || null,
        plan: d.plan || null,
        subscriptionStatus: d.subscriptionStatus || null,
        isAdmin: d.isAdmin === true,
      };
    });
    return { users };
  }
);

/* -------------------------------------------------------------------------
   adminSetUserAccess — a administração muda manualmente o plano e/ou o
   status de assinatura de qualquer cliente (ex.: ativar sem cobrar, suspender
   por inadimplência, etc). Grava direto via Admin SDK (ignora as regras do
   Firestore, que travam escrita de terceiros nesse documento).
   ------------------------------------------------------------------------- */
exports.adminSetUserAccess = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    await assertIsAdmin(request);

    const { targetUid, plan, subscriptionStatus } = request.data || {};
    if (!targetUid) throw new HttpsError("invalid-argument", "Cliente não informado.");
    if (plan && !VALID_PLANS.includes(plan)) throw new HttpsError("invalid-argument", "Plano inválido.");
    if (subscriptionStatus && !VALID_STATUSES.includes(subscriptionStatus)) {
      throw new HttpsError("invalid-argument", "Status de assinatura inválido.");
    }

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (plan) update.plan = plan;
    if (subscriptionStatus) update.subscriptionStatus = subscriptionStatus;

    await db.collection("users").doc(targetUid).set(update, { merge: true });
    return { ok: true };
  }
);

/* -------------------------------------------------------------------------
   confirmSubscription — chamada pelo login.html DEPOIS que o cliente entra
   com Google. Só ativa a assinatura se o pagamento já tiver sido confirmado
   pelo webhook (nunca confia direto no parâmetro da URL).
   ------------------------------------------------------------------------- */
exports.confirmSubscription = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login antes de confirmar a assinatura.");
    }

    const token = request.data && request.data.token;
    if (!token) {
      throw new HttpsError("invalid-argument", "Token de checkout ausente.");
    }

    const tokenRef = db.collection("pendingCheckouts").doc(token);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Checkout não encontrado.");
      }
      const data = snap.data();
      if (data.consumed) {
        throw new HttpsError("failed-precondition", "Este checkout já foi utilizado.");
      }
      if (data.status !== "paid") {
        throw new HttpsError("failed-precondition", "Pagamento ainda não confirmado.");
      }

      tx.update(tokenRef, { consumed: true, consumedBy: request.auth.uid });

      const userRef = db.collection("users").doc(request.auth.uid);
      tx.set(
        userRef,
        {
          subscriptionStatus: "active",
          plan: data.plan,
          email: request.auth.token.email || null,
          name: request.auth.token.name || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { plan: data.plan };
    });

    return { ok: true, plan: result.plan };
  }
);
