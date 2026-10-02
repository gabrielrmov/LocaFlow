/* Resumo diário de "Avisos de hoje" para a notificação no celular.
   Mesma regra da tela Avisos do painel (dashboard.html → avisosItems):
   devoluções atrasadas/a vencer, retiradas próximas e faturas a vencer/atrasadas. */

function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

function contractState(c, today) {
  if (c.status === "orcamento" || c.status === "cancelado" || c.returnedDate) return null;
  if (!c.startDate || !c.endDate) return null;
  if (c.startDate > today) return "agendado";
  if (c.endDate < today) return "atrasado";
  return "ativo";
}

function summarize({ contracts, payments, clientIds }, today, lead = 3) {
  const known = new Set(clientIds);
  const out = { devolucoes: 0, retiradas: 0, aVencer: 0, atrasadas: 0 };
  for (const c of contracts) {
    if (!known.has(c.clientId)) continue;
    const st = contractState(c, today);
    if (st === "atrasado") out.devolucoes++;
    else if (st === "ativo" && daysBetween(today, c.endDate) <= lead) out.devolucoes++;
    else if (st === "agendado" && daysBetween(today, c.startDate) <= Math.min(lead, 2)) out.retiradas++;
  }
  for (const p of payments) {
    if (p.paidDate || !known.has(p.clientId) || !(Number(p.amount) > 0) || !p.dueDate) continue;
    if (p.dueDate < today) out.atrasadas++;
    else if (daysBetween(today, p.dueDate) <= lead) out.aVencer++;
  }
  out.total = out.devolucoes + out.retiradas + out.aVencer + out.atrasadas;
  return out;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function messageFor(s) {
  const parts = [];
  if (s.devolucoes) parts.push(plural(s.devolucoes, "devolução", "devoluções"));
  if (s.retiradas) parts.push(plural(s.retiradas, "retirada", "retiradas"));
  if (s.aVencer) parts.push(plural(s.aVencer, "fatura a vencer", "faturas a vencer"));
  if (s.atrasadas) parts.push(plural(s.atrasadas, "fatura atrasada", "faturas atrasadas"));
  return {
    title: `Locarion: ${plural(s.total, "aviso", "avisos")} hoje`,
    body: parts.join(" · "),
  };
}

/* Mesma regra de acesso do firestore.rules (hasAccess). */
function hasAccess(u, nowMs) {
  if (!u) return false;
  if (u.subscriptionStatus === "active" || u.isAdmin === true) return true;
  const ends = u.trialEndsAt && u.trialEndsAt.toMillis ? u.trialEndsAt.toMillis() : 0;
  return u.subscriptionStatus === "trialing" && ends > nowMs;
}

module.exports = { summarize, messageFor, hasAccess, daysBetween };
