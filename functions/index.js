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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { summarize, messageFor, hasAccess } = require("./avisos");
const crypto = require("crypto");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const ASAAS_API_KEY = defineSecret("ASAAS_API_KEY");
const ASAAS_WEBHOOK_TOKEN = defineSecret("ASAAS_WEBHOOK_TOKEN");

// Troque se for usar o ambiente de testes (sandbox) do Asaas:
const ASAAS_BASE_URL = "https://api.asaas.com/v3";
const SITE_URL = process.env.SITE_URL || "https://locarion.app";

/* Plano único: todas as funcionalidades, cobrado por mês ou por ano. */
const PLANS = {
  locarion: {
    name: "Locarion",
    cycles: {
      monthly: { value: 127.0, asaasCycle: "MONTHLY", description: "Assinatura mensal do Locarion" },
      yearly: { value: 1397.0, asaasCycle: "YEARLY", description: "Assinatura anual do Locarion" },
    },
  },
};
const ASAAS_CYCLE_TO_OURS = { MONTHLY: "monthly", YEARLY: "yearly" };

/* Limita chamadas por IP (createAsaasCheckout é público, antes do login):
   evita que alguém encha o Firestore e o Asaas de checkouts falsos. */
async function enforceRateLimit(request, key, max, windowMs) {
  const ip = (request.rawRequest && request.rawRequest.ip) || "unknown";
  const id = crypto.createHash("sha256").update(`${key}:${ip}`).digest("hex");
  const ref = db.collection("rateLimits").doc(id);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : null;
    if (d && now - d.windowStart < windowMs) {
      if (d.count >= max) {
        throw new HttpsError("resource-exhausted", "Muitas tentativas. Tente novamente em alguns minutos.");
      }
      tx.update(ref, { count: d.count + 1 });
    } else {
      tx.set(ref, { windowStart: now, count: 1 });
    }
  });
}

/* Comparação em tempo constante (evita ataque de timing no token do webhook). */
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

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
  { secrets: [ASAAS_API_KEY], region: "southamerica-east1", maxInstances: 10 },
  async (request) => {
    const plan = request.data && request.data.plan;
    const planInfo = typeof plan === "string" && Object.prototype.hasOwnProperty.call(PLANS, plan) ? PLANS[plan] : null;
    const cycleKey = request.data && request.data.cycle === "yearly" ? "yearly" : "monthly";
    const cycleInfo = planInfo ? planInfo.cycles[cycleKey] : null;
    if (!planInfo || !cycleInfo) {
      throw new HttpsError("invalid-argument", "Plano inválido.");
    }

    await enforceRateLimit(request, "checkout", 5, 60 * 60 * 1000);

    const tokenRef = db.collection("pendingCheckouts").doc();
    const token = tokenRef.id;

    await tokenRef.set({
      plan,
      billingCycle: cycleKey,
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
        successUrl: `${SITE_URL}/login.html?checkout_token=${token}&plan=${encodeURIComponent(plan)}`,
        cancelUrl: `${SITE_URL}/index.html?checkout=cancelado`,
        expiredUrl: `${SITE_URL}/index.html?checkout=expirado`,
      },
      items: [
        {
          name: planInfo.name,
          description: cycleInfo.description,
          quantity: 1,
          value: cycleInfo.value,
        },
      ],
      subscription: {
        cycle: cycleInfo.asaasCycle,
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
   sem depender do navegador do cliente e mantém o acesso em dia:
     - pagamento confirmado/recebido  -> libera (e reativa quem já assinou)
     - atraso, estorno, chargeback    -> bloqueia na hora ("inactive")
     - assinatura removida/inativada  -> bloqueia na hora ("canceled")
   ------------------------------------------------------------------------- */
const PAID_EVENTS = ["CHECKOUT_PAID", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
const BLOCK_EVENTS = {
  PAYMENT_OVERDUE: "inactive",
  PAYMENT_REFUNDED: "inactive",
  PAYMENT_CHARGEBACK_REQUESTED: "inactive",
  SUBSCRIPTION_DELETED: "canceled",
  SUBSCRIPTION_INACTIVATED: "canceled",
};

/* Acha o pendingCheckout do evento: pelo externalReference (token), pelo id
   do checkout, ou pelos ids de assinatura/cliente guardados antes. */
async function findPendingCheckout(ids) {
  if (ids.externalReference) {
    const ref = db.collection("pendingCheckouts").doc(ids.externalReference);
    const snap = await ref.get();
    if (snap.exists) return snap;
  }
  const lookups = [
    ["asaasCheckoutId", ids.checkoutId],
    ["asaasSubscriptionId", ids.subscriptionId],
    ["asaasCustomerId", ids.customerId],
  ];
  for (const [field, value] of lookups) {
    if (!value) continue;
    const q = await db.collection("pendingCheckouts").where(field, "==", value).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  return null;
}

/* Fallback: acha o usuário direto pelos ids do Asaas gravados no perfil. */
async function findUserByAsaasIds(ids) {
  const lookups = [
    ["asaasSubscriptionId", ids.subscriptionId],
    ["asaasCustomerId", ids.customerId],
  ];
  for (const [field, value] of lookups) {
    if (!value) continue;
    const q = await db.collection("users").where(field, "==", value).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  return null;
}

async function setUserStatus(userRef, status, extra) {
  const snap = await userRef.get();
  if (snap.exists && snap.data().isAdmin === true) return; // conta admin nunca é bloqueada
  await userRef.set(
    { subscriptionStatus: status, updatedAt: admin.firestore.FieldValue.serverTimestamp(), ...(extra || {}) },
    { merge: true }
  );
}

exports.asaasWebhook = onRequest(
  { secrets: [ASAAS_WEBHOOK_TOKEN], region: "southamerica-east1", maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method-not-allowed");
      return;
    }
    const receivedToken = req.get("asaas-access-token");
    if (!receivedToken || !safeEqual(receivedToken, ASAAS_WEBHOOK_TOKEN.value())) {
      logger.warn("Webhook do Asaas com token inválido");
      res.status(401).send("unauthorized");
      return;
    }

    const event = req.body && req.body.event;
    const isPaid = PAID_EVENTS.includes(event);
    const blockStatus = BLOCK_EVENTS[event];

    if (!isPaid && !blockStatus) {
      res.status(200).send("ignored");
      return;
    }

    const checkout = req.body.checkout || {};
    const payment = req.body.payment || {};
    const subscription = req.body.subscription || {};
    const ids = {
      externalReference: checkout.externalReference || payment.externalReference || subscription.externalReference || null,
      checkoutId: checkout.id || null,
      subscriptionId: (typeof payment.subscription === "string" ? payment.subscription : null) || subscription.id || null,
      customerId: (typeof payment.customer === "string" ? payment.customer : null) || subscription.customer || null,
    };

    try {
      const pendingSnap = await findPendingCheckout(ids);
      const asaasFields = {};
      if (ids.checkoutId) asaasFields.asaasCheckoutId = ids.checkoutId;
      if (ids.subscriptionId) asaasFields.asaasSubscriptionId = ids.subscriptionId;
      if (ids.customerId) asaasFields.asaasCustomerId = ids.customerId;

      let userRef = null;
      if (pendingSnap && pendingSnap.data().consumedBy) {
        userRef = db.collection("users").doc(pendingSnap.data().consumedBy);
      } else if (!pendingSnap || blockStatus) {
        userRef = await findUserByAsaasIds(ids);
      }

      if (!pendingSnap && !userRef) {
        // Não loga o corpo inteiro (traz dados pessoais do pagador).
        logger.warn("Webhook do Asaas sem correspondência", { event, ...ids });
        res.status(200).send("no-match");
        return;
      }

      if (isPaid) {
        if (pendingSnap) {
          const update = { ...asaasFields };
          if (pendingSnap.data().status !== "paid") {
            update.status = "paid";
            update.paidAt = admin.firestore.FieldValue.serverTimestamp();
          }
          await pendingSnap.ref.update(update);
        }
        // Quem já assinou e voltou a pagar (renovação ou regularização) é reativado.
        if (userRef) await setUserStatus(userRef, "active", asaasFields);
        res.status(200).send("ok");
        return;
      }

      // Evento de bloqueio: corta o acesso na hora.
      if (pendingSnap && !pendingSnap.data().consumedBy) {
        await pendingSnap.ref.update({ ...asaasFields, status: "revoked" });
      }
      if (userRef) await setUserStatus(userRef, blockStatus, asaasFields);
      logger.info("Acesso bloqueado pelo Asaas", { event, status: blockStatus });
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

const VALID_PLANS = ["locarion", "profissional", "enterprise"]; // os dois últimos são planos antigos, até a migração
const VALID_STATUSES = ["active", "trialing", "inactive", "canceled"];
const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------
   adminListUsers — lista todas as contas (clientes) cadastradas no Locarion,
   com plano e status de assinatura, pra tela de administração.
   ------------------------------------------------------------------------- */
exports.adminListUsers = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
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
        trialEndsAt: d.trialEndsAt && d.trialEndsAt.toMillis ? d.trialEndsAt.toMillis() : null,
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
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    await assertIsAdmin(request);

    const { targetUid, plan, subscriptionStatus, trialDays } = request.data || {};
    if (typeof targetUid !== "string" || !targetUid || targetUid.length > 128 || targetUid.includes("/")) {
      throw new HttpsError("invalid-argument", "Cliente não informado.");
    }
    if (plan && !VALID_PLANS.includes(plan)) throw new HttpsError("invalid-argument", "Plano inválido.");
    if (subscriptionStatus && !VALID_STATUSES.includes(subscriptionStatus)) {
      throw new HttpsError("invalid-argument", "Status de assinatura inválido.");
    }

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (plan) update.plan = plan;
    if (subscriptionStatus) update.subscriptionStatus = subscriptionStatus;

    const userRef = db.collection("users").doc(targetUid);
    if (subscriptionStatus === "trialing") {
      // "Em teste" precisa de data de fim; sem ela as regras do Firestore bloqueiam a escrita.
      const days = Number.isInteger(trialDays) ? trialDays : TRIAL_DAYS;
      if (days < 1 || days > 365) throw new HttpsError("invalid-argument", "Dias de teste inválidos.");
      update.trialEndsAt = admin.firestore.Timestamp.fromMillis(Date.now() + days * DAY_MS);
      const cur = await userRef.get();
      if (!cur.exists || !cur.data().trialStartedAt) update.trialStartedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(update, { merge: true });
    return { ok: true };
  }
);

/* -------------------------------------------------------------------------
   startTrial — abre o teste de 30 dias, sem cartão. É a ÚNICA forma de um
   cliente ganhar acesso de teste: o navegador não consegue gravar status nem
   datas no próprio perfil (regras do Firestore), então a data de fim é sempre
   decidida aqui, no servidor. Um teste por conta Google; quem já assinou antes
   (ativo, cancelado ou inativo) não ganha novo teste.
   ------------------------------------------------------------------------- */
exports.startTrial = onCall(
  { region: "southamerica-east1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login antes de iniciar o teste.");
    }
    await enforceRateLimit(request, `trial:${request.auth.uid}`, 5, 60 * 60 * 1000);

    const userRef = db.collection("users").doc(request.auth.uid);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const d = snap.exists ? snap.data() : {};

      if (d.isAdmin === true) return { state: "admin" };
      if (d.subscriptionStatus === "active") return { state: "active" };

      if (d.trialStartedAt || d.subscriptionStatus === "trialing") {
        const ends = d.trialEndsAt && d.trialEndsAt.toMillis ? d.trialEndsAt.toMillis() : 0;
        return { state: ends > Date.now() ? "trialing" : "expired", trialEndsAt: ends };
      }
      if (d.subscriptionStatus === "canceled" || d.subscriptionStatus === "inactive") {
        return { state: "blocked" };
      }

      const endsAt = admin.firestore.Timestamp.fromMillis(Date.now() + TRIAL_DAYS * DAY_MS);
      tx.set(
        userRef,
        {
          subscriptionStatus: "trialing",
          plan: "profissional",
          trialStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          trialEndsAt: endsAt,
          email: request.auth.token.email || null,
          name: request.auth.token.name || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { state: "trialing", started: true, trialEndsAt: endsAt.toMillis() };
    });

    return { ok: true, ...result };
  }
);

/* -------------------------------------------------------------------------
   confirmSubscription — chamada pelo login.html DEPOIS que o cliente entra
   com Google. Só ativa a assinatura se o pagamento já tiver sido confirmado
   pelo webhook (nunca confia direto no parâmetro da URL).
   ------------------------------------------------------------------------- */
exports.confirmSubscription = onCall(
  { region: "southamerica-east1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login antes de confirmar a assinatura.");
    }

    const token = request.data && request.data.token;
    if (typeof token !== "string" || !/^[A-Za-z0-9]{20}$/.test(token)) {
      throw new HttpsError("invalid-argument", "Token de checkout inválido.");
    }
    await enforceRateLimit(request, `confirm:${request.auth.uid}`, 10, 60 * 60 * 1000);

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
          ...(data.billingCycle ? { billingCycle: data.billingCycle } : {}),
          ...(data.asaasSubscriptionId ? { asaasSubscriptionId: data.asaasSubscriptionId } : {}),
          ...(data.asaasCustomerId ? { asaasCustomerId: data.asaasCustomerId } : {}),
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

/* -------------------------------------------------------------------------
   Notificações no celular (Firebase Cloud Messaging / Web Push).
   Os aparelhos ficam em companies/{uid}/devices/{id} (gravados pelo próprio
   painel quando a pessoa toca em "Ativar notificações").
   ------------------------------------------------------------------------- */
const PUSH_LINK = `${SITE_URL}/dashboard.html#/avisos`;
const DEAD_TOKEN = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);

async function pushToDevices(deviceDocs, title, body) {
  if (!deviceDocs.length) return 0;
  const tokens = deviceDocs.map((d) => d.data().token).filter(Boolean);
  if (!tokens.length) return 0;
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      headers: { Urgency: "normal", TTL: "43200" },
      notification: { icon: `${SITE_URL}/assets/icon-192.png`, badge: `${SITE_URL}/assets/icon-192.png`, tag: "locarion-avisos" },
      fcmOptions: { link: PUSH_LINK },
    },
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN.has(r.error.code)) dead.push(deviceDocs.find((d) => d.data().token === tokens[i]));
  });
  await Promise.all(dead.filter(Boolean).map((d) => d.ref.delete()));
  return res.successCount;
}

/* Todo dia às 8h (horário de Brasília): quem tem aparelho cadastrado e algo a avisar recebe o resumo. */
exports.sendDailyAvisos = onSchedule(
  { schedule: "0 8 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1", maxInstances: 1, timeoutSeconds: 300 },
  async () => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const devices = await db.collectionGroup("devices").get();
    const byCompany = new Map();
    for (const d of devices.docs) {
      const uid = d.ref.parent.parent && d.ref.parent.parent.id;
      if (!uid) continue;
      if (!byCompany.has(uid)) byCompany.set(uid, []);
      byCompany.get(uid).push(d);
    }
    let sent = 0;
    for (const [uid, docs] of byCompany) {
      try {
        const user = await db.collection("users").doc(uid).get();
        if (!hasAccess(user.exists ? user.data() : null, Date.now())) continue;
        const co = db.collection("companies").doc(uid);
        const [cs, ps, cl] = await Promise.all([co.collection("contracts").get(), co.collection("payments").get(), co.collection("clients").get()]);
        const s = summarize(
          { contracts: cs.docs.map((x) => x.data()), payments: ps.docs.map((x) => x.data()), clientIds: cl.docs.map((x) => x.id) },
          today
        );
        if (!s.total) continue;
        const m = messageFor(s);
        sent += await pushToDevices(docs, m.title, m.body);
      } catch (err) {
        logger.error("sendDailyAvisos falhou para uma empresa", { uid, error: String(err && err.message) });
      }
    }
    logger.info("sendDailyAvisos concluído", { empresas: byCompany.size, enviadas: sent });
  }
);

/* Botão "Enviar notificação de teste" do painel: manda só para os aparelhos de quem pediu. */
exports.sendTestPush = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Faça login.");
    await enforceRateLimit(request, `testpush:${request.auth.uid}`, 10, 60 * 60 * 1000);
    const docs = (await db.collection("companies").doc(request.auth.uid).collection("devices").get()).docs;
    const sent = await pushToDevices(docs, "Locarion: teste", "As notificações estão funcionando neste aparelho.");
    return { ok: true, devices: docs.length, sent };
  }
);

/* -------------------------------------------------------------------------
   WhatsApp automático (WA-AKG) — cada empresa liga o próprio servidor WA-AKG
   (URL + chave de API + nome da sessão). Os dados ficam em waGateways/{uid},
   que só as Functions leem: a chave nunca volta para o navegador.
   ------------------------------------------------------------------------- */
const dns = require("dns").promises;
const net = require("net");

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/* Evita que alguém aponte o "servidor WhatsApp" para a rede interna do Google (SSRF). */
async function assertPublicHttps(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { throw new HttpsError("invalid-argument", "URL inválida."); }
  if (u.protocol !== "https:") throw new HttpsError("invalid-argument", "Use o endereço com https://.");
  if (u.username || u.password) throw new HttpsError("invalid-argument", "URL inválida.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpsError("invalid-argument", "Informe o endereço público do servidor.");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new HttpsError("invalid-argument", "Não foi possível alcançar esse endereço publicamente.");
  }
  return u.origin;
}

async function requireAccess(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login.");
  const user = await db.collection("users").doc(request.auth.uid).get();
  if (!hasAccess(user.exists ? user.data() : null, Date.now())) {
    throw new HttpsError("permission-denied", "Assinatura inativa.");
  }
}

exports.getWhatsAppGateway = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Faça login.");
    const snap = await db.collection("waGateways").doc(request.auth.uid).get();
    if (!snap.exists) return { configured: false };
    const d = snap.data();
    return { configured: true, url: d.url, sessionId: d.sessionId };
  }
);

exports.saveWhatsAppGateway = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    await requireAccess(request);
    await enforceRateLimit(request, `wasave:${request.auth.uid}`, 20, 60 * 60 * 1000);
    const ref = db.collection("waGateways").doc(request.auth.uid);
    if (request.data && request.data.remove === true) {
      await ref.delete();
      return { ok: true, configured: false };
    }
    const sessionId = String((request.data && request.data.sessionId) || "").trim();
    const apiKey = String((request.data && request.data.apiKey) || "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
      throw new HttpsError("invalid-argument", "Nome da sessão inválido (letras, números, - e _).");
    }
    const origin = await assertPublicHttps(String((request.data && request.data.url) || "").trim());
    const prev = await ref.get();
    const key = apiKey || (prev.exists ? prev.data().apiKey : "");
    if (!key) throw new HttpsError("invalid-argument", "Informe a chave de API.");
    await ref.set({ url: origin, sessionId, apiKey: key, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true, configured: true, url: origin, sessionId };
  }
);

/* Números do Brasil: contas de DDD 31 em diante costumam existir no WhatsApp sem o 9 extra, e
   uma mensagem para o formato errado é aceita pelo servidor mas nunca entregue. Pergunta ao
   WA-AKG qual variante existe (com e sem o 9) e usa o JID que ele devolver. Se a checagem não
   estiver disponível, cai no número como foi cadastrado. */
async function resolveWhatsAppJid(url, sessionId, apiKey, phone) {
  const fallback = `${phone}@s.whatsapp.net`;
  const candidates = [phone];
  const m = phone.match(/^55(\d{2})(9?)(\d{8})$/);
  if (m) candidates.push(m[2] ? `55${m[1]}${m[3]}` : `55${m[1]}9${m[3]}`);
  try {
    const res = await fetch(`${url}/api/chat/${encodeURIComponent(sessionId)}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ numbers: candidates }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const results = (json && ((json.data && json.data.results) || json.results)) || [];
    for (const c of candidates) {
      const hit = results.find((r) => r.number === c && r.exists && r.jid);
      if (hit) return hit.jid;
    }
    return results.length ? null : fallback;
  } catch (e) {
    logger.warn("resolveWhatsAppJid: checagem indisponível", e && e.message);
    return fallback;
  }
}

exports.sendWhatsApp = onCall(
  { region: "southamerica-east1", maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    await requireAccess(request);
    await enforceRateLimit(request, `wasend:${request.auth.uid}`, 120, 60 * 60 * 1000);
    const phone = String((request.data && request.data.phone) || "").replace(/\D/g, "");
    const text = String((request.data && request.data.text) || "").trim();
    if (phone.length < 12 || phone.length > 15) throw new HttpsError("invalid-argument", "Telefone inválido.");
    if (!text || text.length > 4000) throw new HttpsError("invalid-argument", "Mensagem inválida.");
    const snap = await db.collection("waGateways").doc(request.auth.uid).get();
    if (!snap.exists) throw new HttpsError("failed-precondition", "WhatsApp automático não configurado.");
    const { url, sessionId, apiKey } = snap.data();
    await assertPublicHttps(url);
    const rawJid = await resolveWhatsAppJid(url, sessionId, apiKey, phone);
    if (!rawJid) throw new HttpsError("failed-precondition", "Este número não tem WhatsApp. Confira o telefone do cliente.");
    const jid = encodeURIComponent(rawJid);
    let res;
    try {
      res = await fetch(`${url}/api/messages/${encodeURIComponent(sessionId)}/${jid}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ message: { text } }),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      logger.warn("sendWhatsApp: falha de rede", e && e.message);
      throw new HttpsError("unavailable", "Não foi possível falar com o servidor do WhatsApp.");
    }
    if (!res.ok) {
      logger.warn("sendWhatsApp: gateway respondeu", res.status);
      const msg = res.status === 401 || res.status === 403 ? "Chave de API recusada pelo servidor."
        : res.status === 404 || res.status === 503 ? "Sessão do WhatsApp desconectada ou não encontrada."
        : "O servidor do WhatsApp recusou o envio.";
      throw new HttpsError("failed-precondition", msg);
    }
    return { ok: true };
  }
);

/* -------------------------------------------------------------------------
   adminMigrateSubscriptions — leva as assinaturas dos planos antigos
   (Profissional R$ 97 e Enterprise R$ 197) para o plano único (R$ 127 por mês
   ou R$ 1.397 por ano), alterando o valor da assinatura no Asaas.
   - Só admin chama. Por padrão roda em SIMULAÇÃO (dryRun): só lista o que mudaria.
   - Para aplicar, chame com { dryRun: false }.
   - O novo valor vale a partir da PRÓXIMA cobrança (não altera cobrança já emitida).
   ------------------------------------------------------------------------- */
exports.adminMigrateSubscriptions = onCall(
  { secrets: [ASAAS_API_KEY], region: "southamerica-east1", maxInstances: 1, timeoutSeconds: 300 },
  async (request) => {
    await assertIsAdmin(request);
    const dryRun = !(request.data && request.data.dryRun === false);
    const snap = await db.collection("users").where("plan", "in", ["profissional", "enterprise"]).get();
    const report = [];
    for (const doc of snap.docs) {
      const u = doc.data();
      const row = { uid: doc.id, email: u.email || null, plan: u.plan, status: u.subscriptionStatus || null };
      if (!u.asaasSubscriptionId) { report.push({ ...row, result: "sem assinatura no Asaas (ignorado)" }); continue; }
      try {
        const get = await fetch(`${ASAAS_BASE_URL}/subscriptions/${encodeURIComponent(u.asaasSubscriptionId)}`, { headers: { access_token: ASAAS_API_KEY.value() } });
        const sub = await get.json();
        if (!get.ok) { report.push({ ...row, result: "erro ao ler no Asaas" }); continue; }
        const ours = ASAAS_CYCLE_TO_OURS[sub.cycle];
        if (!ours || sub.status !== "ACTIVE") { report.push({ ...row, result: `ignorado (ciclo ${sub.cycle}, situação ${sub.status})`, currentValue: sub.value }); continue; }
        const target = PLANS.locarion.cycles[ours].value;
        row.cycle = ours; row.currentValue = sub.value; row.newValue = target;
        if (sub.value === target) { report.push({ ...row, result: "já está no valor novo" }); }
        else if (dryRun) { report.push({ ...row, result: "mudaria (simulação)" }); continue; }
        else {
          const put = await fetch(`${ASAAS_BASE_URL}/subscriptions/${encodeURIComponent(u.asaasSubscriptionId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY.value() },
            body: JSON.stringify({ value: target, updatePendingPayments: false }),
          });
          if (!put.ok) { report.push({ ...row, result: "erro ao atualizar no Asaas" }); continue; }
          report.push({ ...row, result: "migrada" });
        }
        if (!dryRun) {
          await doc.ref.set({ plan: "locarion", billingCycle: ours, previousPlan: u.plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      } catch (err) {
        logger.error("Falha ao migrar assinatura", { uid: doc.id, error: String(err && err.message) });
        report.push({ ...row, result: "erro inesperado" });
      }
    }
    logger.info("adminMigrateSubscriptions", { dryRun, total: report.length });
    return { dryRun, total: report.length, report };
  }
);
