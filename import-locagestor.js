/* Importação da exportação do LocaGestor (abas Clientes, Equipamentos, Contratos e Itens_Contratos).
   Tudo roda no navegador. Esta parte só ANALISA e monta um plano; quem grava é o painel, depois que
   a pessoa confirma. Regra geral: nunca apaga nada e, por padrão, só PREENCHE o que está vazio. */
(function(){
"use strict";

const F = () => window.FaturasImport;
const norm = (s) => F().norm(s);
const digits = (s) => String(s == null ? "" : s).replace(/\D/g, "");
const str = (v) => v == null ? "" : String(v).trim();
const num = (v) => { if(v == null || v === "") return null; const n = typeof v === "number" ? v : F().toMoney(v); return Number.isFinite(n) ? n : null; };
const empty = (v) => v == null || v === "" || v === 0 || (Array.isArray(v) && !v.length);

function fmtDoc(d){ d = digits(d); if(d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); if(d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); return str(d); }
function fmtPhone(v){ const d = digits(v); if(d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3"); if(d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3"); return str(v); }
function fmtCep(v){ const d = digits(v); return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : str(v); }

/* linhas -> objetos pelo cabeçalho (acha a coluna por pedaço do nome, sem acento nem caixa) */
function table(rows){
  if(!rows || !rows.length) return [];
  const head = rows[0].map(h => norm(h));
  /* "=chave" pede o nome exato da coluna (evita "n" casar com "nome") */
  const idx = (...keys) => { for(const k of keys){ const exact = k[0] === "="; const kk = norm(exact ? k.slice(1) : k); const i = head.findIndex(h => h && (exact ? h === kk : h.includes(kk))); if(i >= 0) return i; } return -1; };
  return { head, idx, rows: rows.slice(1).filter(r => r && r.some(c => c != null && c !== "")) };
}
const cell = (t, r, ...keys) => { const i = t.idx(...keys); return i >= 0 ? r[i] : null; };

function originOf(v){ const n = norm(v); if(n.includes("GOOGLE")) return "Google"; if(n.includes("INDICA")) return "Indicação"; if(n.includes("REDE") || n.includes("INSTA") || n.includes("FACE")) return "Redes Sociais"; if(n.includes("OUTDOOR") || n.includes("FACHADA")) return "Outdoor/Fachada"; return n ? "Outro" : ""; }

function bestRate(eq, days){
  const d = (x) => Number(x) || 0;
  if(days >= 28 && d(eq.monthlyRate)) return d(eq.monthlyRate) * Math.ceil(days / 30);
  if(days >= 14 && d(eq.biweeklyRate)) return d(eq.biweeklyRate) * Math.ceil(days / 15);
  if(days >= 7 && d(eq.weeklyRate)) return d(eq.weeklyRate) * Math.ceil(days / 7);
  return d(eq.dailyRate) * days;
}
const daysBetween = (a, b) => Math.max(Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000), 1);

function analyze(sheets, ctx, opts){
  opts = opts || {};
  const find = (re) => { const k = Object.keys(sheets).find(n => re.test(n)); return k ? sheets[k] : null; };
  const sClients = find(/^clientes/i), sEquip = find(/^equipamentos/i), sContracts = find(/^contratos/i), sItems = find(/^itens/i);
  if(!sClients && !sEquip && !sContracts) return { error:"Não encontrei as abas Clientes, Equipamentos e Contratos nessa planilha." };
  const warnings = [];
  const plan = { clients:{ create:[], update:[], same:0, total:0 }, equipment:{ create:[], update:[], same:0, total:0 }, contracts:{ create:[], update:[], same:0, skipped:[], total:0 }, warnings, activate:[] };

  /* ---------------- clientes ---------------- */
  const byDoc = new Map(), byName = new Map(), clientRef = new Map(); /* chave -> id (existente) ou tmp */
  for(const c of ctx.clients){ const d = digits(c.document); if(d.length >= 11) byDoc.set(d, c); const n = norm(c.name); if(n && !byName.has(n)) byName.set(n, c); }
  let tmpN = 0;
  if(sClients){
    const t = table(sClients);
    for(const r of t.rows){
      const name = str(cell(t, r, "nome / razao", "nome")); if(!name) continue;
      plan.clients.total++;
      const doc = digits(cell(t, r, "cpf / cnpj", "cpf"));
      const type = norm(cell(t, r, "=tipo")) === "PJ" || doc.length === 14 ? "PJ" : "PF";
      const street = str(cell(t, r, "endereco")), nr = str(cell(t, r, "=nº", "=n")), comp = str(cell(t, r, "complemento"));
      const address = [street, nr].filter(Boolean).join(", ") + (comp ? ` - ${comp}` : "");
      const place = str(cell(t, r, "locais de entrega")).replace(/\s*\(padr[aã]o\)\s*$/i, "");
      const credit = num(cell(t, r, "limite"));
      const data = {
        name, type, status:"ativo", document:fmtDoc(doc), ie:str(cell(t, r, "=ie")), rg:str(cell(t, r, "=rg")),
        tradeName:str(cell(t, r, "nome fantasia")), legalContact:str(cell(t, r, "responsavel legal")),
        phone:fmtPhone(cell(t, r, "telefone 1")), whatsapp:fmtPhone(cell(t, r, "whatsapp")), email:str(cell(t, r, "e-mail")),
        origin:originOf(cell(t, r, "origem")), creditLimit:credit ? credit : null,
        address, cep:fmtCep(cell(t, r, "=cep")), bairro:str(cell(t, r, "=bairro")), cidade:str(cell(t, r, "=cidade")), uf:str(cell(t, r, "=uf")).toUpperCase().slice(0, 2),
        billingSameAsMain:true, billingContact:str(cell(t, r, "contato (cobranca)")), billingEmail:str(cell(t, r, "e-mail cobranca")), billingPhone:fmtPhone(cell(t, r, "telefone cobranca")),
        notes:str(cell(t, r, "observacao")), deliveryLocations: place ? [{ label:place, address:place }] : [],
      };
      let ex = (doc.length >= 11 && byDoc.get(doc)) || byName.get(norm(name));
      if(!ex){ /* nomes cortados ou com pequenas diferenças: aceita só se houver um único candidato */
        const n = norm(name); const hits = n.length >= 10 ? ctx.clients.filter(c => { const cn = norm(c.name); return cn.length >= 10 && (cn.startsWith(n) || n.startsWith(cn)); }) : [];
        if(hits.length === 1) ex = hits[0];
      }
      if(ex){
        const patch = {};
        for(const k of Object.keys(data)){
          if(k === "name" || k === "type" || k === "status" || k === "billingSameAsMain") continue;
          if(k === "deliveryLocations"){ if(!empty(data[k]) && empty(ex[k])) patch[k] = data[k]; continue; }
          if(empty(data[k])) continue;
          if(empty(ex[k]) || (opts.mirror && ex[k] !== data[k])) patch[k] = data[k];
        }
        if(Object.keys(patch).length) plan.clients.update.push({ id:ex.id, name:ex.name, patch }); else plan.clients.same++;
        clientRef.set(doc || norm(name), ex.id); clientRef.set("n:" + norm(name), ex.id);
      }else{
        const tmp = "new-client-" + (++tmpN);
        Object.keys(data).forEach(k => { if(data[k] === "" || data[k] == null) delete data[k]; });
        plan.clients.create.push({ tmp, data });
        if(doc) byDoc.set(doc, { id:tmp, name }); byName.set(norm(name), { id:tmp, name });
        clientRef.set(doc || norm(name), tmp); clientRef.set("n:" + norm(name), tmp);
      }
    }
  }

  /* ---------------- equipamentos ---------------- */
  const eqByName = new Map(); for(const e of ctx.equipment){ const n = norm(e.name); if(!eqByName.has(n)) eqByName.set(n, []); eqByName.get(n).push(e); }
  const eqKey = new Map(); /* "nome|Tipo" -> id (existente ou tmp) */
  const eqRates = new Map(); /* id -> tarifas (para estimar valor de contrato ativo) */
  const usedEq = new Set(); tmpN = 0;
  if(sEquip){
    const t = table(sEquip);
    for(const r of t.rows){
      const kind0 = str(cell(t, r, "=tipo")); const name = str(cell(t, r, "=nome"));
      if(!name || !/^(patrimoniado|nao patrimoniado|servico)/i.test(norm(kind0))) continue;
      plan.equipment.total++;
      const isService = /^SERVICO/.test(norm(kind0)), isPatr = /^PATRIMONIADO/.test(norm(kind0));
      const qty = num(cell(t, r, "qtd. total")) || 0;
      const codes = str(cell(t, r, "codigos de patrimonio"));
      const data = {
        name, kind:isService ? "servico" : "equipamento", category:str(cell(t, r, "categoria")),
        dailyRate:num(cell(t, r, isService ? "valor do servico" : "diaria")) || 0,
        weeklyRate:num(cell(t, r, "semana")), biweeklyRate:num(cell(t, r, "quinzena")), monthlyRate:num(cell(t, r, "mes (r$)", "mes")),
        indemnityValue:num(cell(t, r, "indenizacao por uni", "indenizacao por")),
        maintenanceIntervalMonths:num(cell(t, r, "intervalo de manutencao")),
      };
      if(codes) data.code = codes.split(/\s*,\s*/).join(", ");
      const cand = (eqByName.get(norm(name)) || []).filter(e => !usedEq.has(e.id));
      let ex = null;
      if(cand.length === 1) ex = cand[0];
      else if(cand.length > 1) ex = cand.find(e => Number(e.stockQty) === qty) || cand.find(e => (isPatr ? !!e.code : !e.code)) || cand[0];
      const key = norm(name) + "|" + (isService ? "S" : isPatr ? "P" : "N");
      if(ex){
        usedEq.add(ex.id);
        const patch = {};
        const fill = (k, v) => { if(v == null || v === "" || v === 0) return; if(empty(ex[k])) patch[k] = v; else if((opts.overwrite || opts.mirror) && ex[k] !== v && ["indemnityValue", "dailyRate", "weeklyRate", "biweeklyRate", "monthlyRate"].includes(k)) patch[k] = v; };
        ["indemnityValue", "dailyRate", "weeklyRate", "biweeklyRate", "monthlyRate", "category", "code", "maintenanceIntervalMonths"].forEach(k => fill(k, data[k]));
        if(Object.keys(patch).length) plan.equipment.update.push({ id:ex.id, name:ex.name, patch }); else plan.equipment.same++;
        eqKey.set(key, ex.id); eqRates.set(ex.id, { ...ex, ...patch });
      }else{
        const tmp = "new-eq-" + (++tmpN);
        const stock = !isService && (qty > 1 || !isPatr);
        const d = { ...data, trackMode:isService ? "unidade" : (stock ? "estoque" : "unidade"), status:"disponivel", stockQty:stock ? qty : null };
        Object.keys(d).forEach(k => { if(d[k] === "" || d[k] == null) delete d[k]; });
        plan.equipment.create.push({ tmp, data:d });
        eqKey.set(key, tmp); eqRates.set(tmp, d);
      }
    }
  }
  const eqIsUnit = new Map(); ctx.equipment.forEach(e => eqIsUnit.set(e.id, (e.kind || "equipamento") === "equipamento" && (e.trackMode || "unidade") !== "estoque"));
  plan.equipment.create.forEach(x => eqIsUnit.set(x.tmp, x.data.kind === "equipamento" && x.data.trackMode !== "estoque"));
  const eqStatus = new Map(ctx.equipment.map(e => [e.id, e.status]));

  /* ---------------- contratos ---------------- */
  const itemsBy = new Map();
  if(sItems){
    const t = table(sItems);
    for(const r of t.rows){
      const code = str(cell(t, r, "n contrato", "no contrato", "contrato")); if(!code) continue;
      const tipo = norm(cell(t, r, "=tipo")); const name = str(cell(t, r, "equipamento / servico", "equipamento"));
      const key = norm(name) + "|" + (/^SERVICO/.test(tipo) ? "S" : /^NAO/.test(tipo) ? "N" : "P");
      let id = eqKey.get(key);
      if(!id){ const alt = ["P", "N", "S"].map(x => eqKey.get(norm(name) + "|" + x)).find(Boolean); id = alt; }
      const line = { id, name, qty:Math.max(Math.round(num(cell(t, r, "quantidade")) || 1), 1), status:norm(cell(t, r, "status do item")), start:F().toISO(cell(t, r, "data locacao")) || null, end:F().toISO(cell(t, r, "data devolucao")) || null, ind:num(cell(t, r, "indenizacao unitaria")) };
      if(!itemsBy.has(code)) itemsBy.set(code, []); itemsBy.get(code).push(line);
    }
  }
  const ctByCode = new Map(); const codeKey = (c) => { const s = String(c).trim().toUpperCase(); return /^\d+$/.test(s) ? "#" + s.replace(/^0+/, "") : s; };
  ctx.contracts.forEach(c => ctByCode.set(codeKey(c.code), c));
  const inUse = new Set(), closing = new Map(); /* equipamentos (unidade) em uso depois da importação / contratos que passam a devolvidos */
  const isActive = (c) => !c.returnedDate && c.status !== "cancelado" && c.status !== "orcamento" && c.status !== "devolvido";
  const seenCodes = new Set();
  if(sContracts){
    const t = table(sContracts);
    for(const r of t.rows){
      const code = str(cell(t, r, "n contrato", "no contrato")); const clientName = str(cell(t, r, "=cliente"));
      if(!code || !clientName) continue; /* linha de observação no fim */
      plan.contracts.total++;
      if(/^N\/?A$/i.test(code)){ plan.contracts.skipped.push({ code, why:"número N/A (sem número de contrato)" }); continue; }
      seenCodes.add(codeKey(code));
      const lines = itemsBy.get(code) || [];
      const ex = ctByCode.get(codeKey(code));
      const indemnity = {}; lines.forEach(l => { if(l.id && l.ind != null && indemnity[l.id] == null) indemnity[l.id] = l.ind; });
      const unmatched = lines.filter(l => !l.id).map(l => l.name);
      if(unmatched.length) warnings.push(`Contrato ${code}: item sem equipamento cadastrado (${[...new Set(unmatched)].join(", ")}).`);
      const start = F().toISO(cell(t, r, "data inicio")), end0 = F().toISO(cell(t, r, "data encerramento", "prev. fim"));
      const end = start && end0 && end0 >= start ? end0 : start;
      const situ = norm(cell(t, r, "=situacao"));
      const closed = /ENCERR/.test(situ);
      const used = lines.filter(l => l.id);
      const open = closed ? used : (used.filter(l => /USO/.test(l.status)).length ? used.filter(l => /USO/.test(l.status)) : used);
      const equipmentIds = []; open.forEach(l => { for(let i = 0; i < l.qty; i++) equipmentIds.push(l.id); });
      const itemDates = {}; open.forEach(l => { if(start && l.start && l.end && (l.start !== start || l.end !== end) && !itemDates[l.id]) itemDates[l.id] = { start:l.start, end:l.end }; });
      const sheetValue = num(cell(t, r, "valor total faturado")) || 0;
      const place = str(cell(t, r, "local de entrega"));
      const returnedOn = end && end <= ctx.today ? end : ctx.today;
      if(ex){
        const patch = {};
        const hasEvents = (ex.events || []).length > 0;
        if(Object.keys(indemnity).length && (opts.mirror || !ex.indemnity || !Object.keys(ex.indemnity).length)) patch.indemnity = indemnity;
        if(place && (empty(ex.location) || (opts.mirror && ex.location !== place))) patch.location = place;
        if(sheetValue && (empty(ex.value) || (opts.mirror && closed && Number(ex.value) !== sheetValue))) patch.value = sheetValue;
        const change = [];
        if(opts.mirror && !hasEvents && start && ex.status !== "cancelado" && ex.status !== "orcamento"){
          if(start !== ex.startDate){ patch.startDate = start; }
          if(closed){
            if(!(ex.returnedDate || ex.status === "devolvido")){ patch.status = "devolvido"; patch.returnedDate = returnedOn; change.push("encerrado"); if(equipmentIds.length) patch.equipmentIds = equipmentIds; closing.set(ex.id, (ex.equipmentIds || []).concat(equipmentIds)); }
            if(end !== ex.endDate) patch.endDate = end;
          }else{
            if(ex.returnedDate || ex.status === "devolvido"){ patch.status = "ativo"; patch.returnedDate = null; change.push("reaberto"); }
            if(end !== ex.endDate){ patch.endDate = end; change.push(`prazo ${ex.endDate} → ${end}`); }
            if(equipmentIds.length){ patch.equipmentIds = equipmentIds; patch.itemDates = itemDates; }
            (equipmentIds.length ? equipmentIds : ex.equipmentIds || []).forEach(id => inUse.add(id));
            open.forEach(l => { if(eqIsUnit.get(l.id) && eqStatus.get(l.id) !== "alugado" && !plan.activate.includes(l.id)) plan.activate.push(l.id); });
          }
        }else if(isActive(ex)){ (ex.equipmentIds || []).forEach(id => inUse.add(id)); }
        if(Object.keys(patch).length) plan.contracts.update.push({ id:ex.id, code, patch, change:change.join(", ") || (patch.indemnity ? "indenização" : "complemento") });
        else plan.contracts.same++;
        if(opts.mirror && hasEvents) warnings.push(`Contrato ${code}: já tem devolução/renovação registrada no Locarion, então a situação e as datas foram mantidas.`);
        continue;
      }
      const doc = digits(cell(t, r, "cpf / cnpj", "cpf"));
      const clientId = (doc && clientRef.get(doc)) || clientRef.get("n:" + norm(clientName)) || (byName.get(norm(clientName)) || {}).id;
      if(!clientId){ plan.contracts.skipped.push({ code, why:`cliente não encontrado (${clientName})` }); continue; }
      if(!start){ plan.contracts.skipped.push({ code, why:"sem data de início" }); continue; }
      let value = sheetValue, estimated = false;
      if(!value && open.length){ value = open.reduce((s, l) => { const eq = eqRates.get(l.id); return s + (eq ? bestRate(eq, daysBetween(l.start || start, l.end || end)) * l.qty : 0); }, 0); estimated = value > 0; }
      const data = { code, clientId, equipmentIds, startDate:start, endDate:end, value:Math.round(value * 100) / 100, location:place, notes:`Importado do LocaGestor${estimated ? " (valor estimado pelas tarifas)" : ""}.`, signed:false, imported:true, source:"locagestor" };
      if(Object.keys(itemDates).length) data.itemDates = itemDates;
      if(Object.keys(indemnity).length) data.indemnity = indemnity;
      if(closed){ data.status = "devolvido"; data.returnedDate = returnedOn; }
      else{ data.status = "ativo"; open.forEach(l => { inUse.add(l.id); if(eqIsUnit.get(l.id) && eqStatus.get(l.id) !== "alugado" && !plan.activate.includes(l.id)) plan.activate.push(l.id); }); }
      plan.contracts.create.push({ data, label:`${code} · ${clientName}`, estimated });
    }
  }
  /* contratos do Locarion que NÃO estão na planilha continuam como estão (e seguem ocupando seus equipamentos) */
  ctx.contracts.forEach(c => { if(!seenCodes.has(codeKey(c.code)) && isActive(c)) (c.equipmentIds || []).forEach(id => inUse.add(id)); });
  /* equipamentos de contratos que passaram a devolvidos e não estão mais em nenhum contrato aberto voltam a ficar disponíveis */
  plan.release = [];
  closing.forEach(ids => ids.forEach(id => { if(eqIsUnit.get(id) && eqStatus.get(id) === "alugado" && !inUse.has(id) && !plan.release.includes(id)) plan.release.push(id); }));
  plan.counts = { clients:plan.clients.total, equipment:plan.equipment.total, contracts:plan.contracts.total };
  return plan;
}

async function readSheets(file){
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if(!(u8[0] === 0x50 && u8[1] === 0x4b)) throw new Error("Use o arquivo .xlsx exportado do LocaGestor.");
  return F().parseXlsxSheets(buf);
}

window.LocaGestorImport = { analyze, readSheets };
})();
