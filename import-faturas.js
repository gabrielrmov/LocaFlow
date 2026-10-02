/* Importação de faturas por planilha (CSV ou XLSX) — Financeiro.
   Tudo roda no navegador: o arquivo não é enviado a lugar nenhum além do Firestore da própria empresa.
   Carregado sob demanda pelo dashboard.html (botão "Importar"). */
(function(){
"use strict";

/* ---------------------------------------------------------------- leitor de XLSX (zip + XML) */
async function inflateRaw(bytes){
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for(let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--){ if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; } }
  if(eocd < 0) throw new Error("Arquivo XLSX inválido.");
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder(), files = {};
  for(let n = 0; n < count; n++){
    if(dv.getUint32(p, true) !== 0x02014b50) throw new Error("Arquivo XLSX inválido.");
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true), name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    const lh = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const raw = u8.subarray(lh, lh + csize);
    files[name] = dec.decode(method === 0 ? raw : await inflateRaw(raw));
  }
  return files;
}
function xmlDoc(s){ return new DOMParser().parseFromString(s, "application/xml"); }
function colIndex(ref){ let n = 0; for(const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }

async function parseXlsx(buf){
  const files = await unzip(buf);
  if(!files["xl/workbook.xml"]) throw new Error("Arquivo XLSX inválido.");
  const wb = xmlDoc(files["xl/workbook.xml"]);
  const sheets = [...wb.getElementsByTagName("sheet")];
  if(!sheets.length) throw new Error("A planilha não tem abas.");
  const pick = sheets.find(s => /fatura/i.test(s.getAttribute("name"))) || sheets[0];
  const rid = pick.getAttribute("r:id") || pick.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  let target = null;
  if(files["xl/_rels/workbook.xml.rels"]){
    for(const r of xmlDoc(files["xl/_rels/workbook.xml.rels"]).getElementsByTagName("Relationship")){
      if(r.getAttribute("Id") === rid) target = r.getAttribute("Target");
    }
  }
  let path = target ? (target.startsWith("/") ? target.slice(1) : "xl/" + target) : "xl/worksheets/sheet1.xml";
  if(!files[path]) path = Object.keys(files).find(k => /worksheets\//.test(k));
  if(!path) throw new Error("Não encontrei os dados da aba.");
  const shared = [];
  if(files["xl/sharedStrings.xml"]){
    for(const si of xmlDoc(files["xl/sharedStrings.xml"]).getElementsByTagName("si")){
      shared.push([...si.getElementsByTagName("t")].map(t => t.textContent).join(""));
    }
  }
  const rows = [];
  for(const row of xmlDoc(files[path]).getElementsByTagName("row")){
    const out = [];
    for(const c of row.getElementsByTagName("c")){
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0];
      let val = null;
      if(t === "inlineStr") val = [...c.getElementsByTagName("t")].map(x => x.textContent).join("");
      else if(v){
        if(t === "s") val = shared[Number(v.textContent)] ?? "";
        else if(t === "str" || t === "e") val = v.textContent;
        else if(t === "b") val = v.textContent === "1";
        else val = Number(v.textContent);
      }
      out[colIndex(c.getAttribute("r") || "A1")] = val;
    }
    rows.push(Array.from(out, x => x === undefined ? null : x));
  }
  return rows;
}

/* ---------------------------------------------------------------- leitor de CSV */
function parseCsv(text){
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] || "";
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    if(q){ if(ch === '"'){ if(text[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if(ch === '"') q = true;
    else if(ch === sep){ row.push(cell); cell = ""; }
    else if(ch === "\n" || ch === "\r"){ if(ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if(cell !== "" || row.length){ row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c === "" ? null : c));
}
async function readFile(file){
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if(u8[0] === 0x50 && u8[1] === 0x4b) return parseXlsx(buf);
  let text;
  try{ text = new TextDecoder("utf-8", { fatal:true }).decode(buf); }catch(e){ text = new TextDecoder("windows-1252").decode(buf); }
  return parseCsv(text);
}

/* ---------------------------------------------------------------- normalização */
const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const digits = (s) => String(s == null ? "" : s).replace(/\D/g, "");
const codeKey = (s) => digits(s).replace(/^0+/, "");

const COLS = {
  number:   ["N FATURA", "NUMERO DA FATURA", "NUMERO FATURA", "FATURA", "N DA FATURA"],
  contract: ["N CONTRATO", "NUMERO DO CONTRATO", "NUMERO CONTRATO", "CONTRATO", "CODIGO DO CONTRATO"],
  client:   ["CLIENTE", "NOME DO CLIENTE", "NOME"],
  doc:      ["CPF CNPJ", "CPF", "CNPJ", "DOCUMENTO"],
  desc:     ["DESCRICAO PERIODO COBERTO", "DESCRICAO", "HISTORICO"],
  issue:    ["DATA DE EMISSAO", "EMISSAO"],
  due:      ["DATA DE VENCIMENTO", "VENCIMENTO"],
  amount:   ["VALOR R", "VALOR", "VALOR R$"],
  status:   ["STATUS", "SITUACAO"],
  paid:     ["DATA DO PAGAMENTO", "DATA DE PAGAMENTO", "PAGAMENTO", "PAGO EM"],
  method:   ["FORMA DE PAGAMENTO", "FORMA PAGAMENTO", "FORMA"],
};
function mapHeader(rows){
  for(let i = 0; i < Math.min(rows.length, 15); i++){
    const names = (rows[i] || []).map(norm), map = {};
    for(const [key, alts] of Object.entries(COLS)){ const j = names.findIndex(n => n && alts.includes(n)); if(j >= 0) map[key] = j; }
    if(map.due != null && map.amount != null && (map.client != null || map.contract != null)) return { map, headerRow:i };
  }
  return null;
}

const pad = (n) => String(n).padStart(2, "0");
function toISO(v){
  if(v == null || v === "") return null;
  if(typeof v === "number"){
    if(v < 20000 || v > 80000) return undefined;
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if(m){ let y = +m[3]; if(y < 100) y += 2000; return valid(y, +m[2], +m[1]); }
  return undefined;
}
function valid(y, mo, d){
  const t = new Date(y, mo - 1, d);
  if(t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d || y < 2000) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
function toMoney(v){
  if(typeof v === "number") return v;
  if(v == null) return NaN;
  let s = String(v).replace(/[R$\s]/g, "");
  if(!s) return NaN;
  if(s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}
function mapMethod(v){
  const n = norm(v);
  if(!n) return "";
  if(n.includes("PIX")) return "pix";
  if(n.includes("BOLETO")) return "boleto";
  if(n.includes("CARTAO") || n.includes("CREDITO") || n.includes("DEBITO")) return "cartao";
  if(n.includes("DINHEIRO") || n.includes("ESPECIE")) return "dinheiro";
  if(n.includes("TRANSFER") || n === "TED" || n === "DOC") return "transferencia";
  return "";
}

/* ---------------------------------------------------------------- análise (sem gravar nada) */
function analyze(rows, ctx){
  const h = mapHeader(rows);
  if(!h) return { error:"Não encontrei as colunas. A primeira linha precisa ter pelo menos: cliente (ou contrato), vencimento e valor." };
  const { map, headerRow } = h, get = (r, k) => map[k] == null ? null : r[map[k]];
  const clientsByName = new Map(), clientsByDoc = new Map(), contractsByKey = new Map(), clientNames = [];
  for(const c of ctx.clients){
    const n = norm(c.name); if(n){ if(!clientsByName.has(n)) clientsByName.set(n, c); clientNames.push([n, c]); }
    const d = digits(c.document); if(d.length >= 11) clientsByDoc.set(d, c);
  }
  for(const k of ctx.contracts){ const key = codeKey(k.code); if(key){ const a = contractsByKey.get(key) || []; a.push(k); contractsByKey.set(key, a); } }
  const existing = new Set(ctx.payments.map(p => p.number).filter(Boolean).map(x => String(x).trim().toUpperCase()));
  const seen = new Set(), out = [];

  const findClient = (name, doc) => {
    const d = digits(doc); if(d.length >= 11 && clientsByDoc.has(d)) return clientsByDoc.get(d);
    const n = norm(name); if(!n) return null;
    if(clientsByName.has(n)) return clientsByName.get(n);
    if(n.length >= 8){ /* nomes cortados/estendidos: aceita só se houver um único candidato */
      const hits = clientNames.filter(([cn]) => cn.length >= 8 && (cn.startsWith(n) || n.startsWith(cn)));
      if(hits.length === 1) return hits[0][1];
    }
    return null;
  };

  for(let i = headerRow + 1; i < rows.length; i++){
    const r = rows[i] || [];
    if(r.every(c => c == null || c === "")) continue;
    const line = i + 1;
    const rec = { line, number:String(get(r, "number") ?? "").trim(), clientText:String(get(r, "client") ?? "").trim() };
    const status = norm(get(r, "status")), amount = toMoney(get(r, "amount"));
    const due = toISO(get(r, "due")), issue = toISO(get(r, "issue")), paid = toISO(get(r, "paid"));
    const contractText = String(get(r, "contract") ?? "").trim();
    rec.amount = amount; rec.due = due; rec.status = status;
    const skip = (reason, kind) => { rec.result = kind || "erro"; rec.reason = reason; out.push(rec); };

    if(rec.number){
      const key = rec.number.toUpperCase();
      if(existing.has(key)) { skip("Fatura já cadastrada", "duplicada"); continue; }
      if(seen.has(key)) { skip("Número repetido na planilha", "duplicada"); continue; }
      seen.add(key);
    }
    if(/CANCEL/.test(status)){ skip("Fatura cancelada (não importada)", "ignorada"); continue; }
    if(!due){ skip("Vencimento ausente ou inválido"); continue; }
    if(!(amount > 0)){ skip("Valor zerado ou inválido", amount === 0 ? "ignorada" : "erro"); continue; }
    if(issue === undefined){ skip("Data de emissão inválida"); continue; }
    if(paid === undefined){ skip("Data do pagamento inválida"); continue; }

    let isPaid = /^PAG/.test(status) || /QUITAD|RECEBID/.test(status);
    if(!status && paid) isPaid = true;
    if(isPaid && !paid){ skip("Fatura paga sem data do pagamento"); continue; }
    if(isPaid && paid > ctx.today){ skip("Data do pagamento no futuro"); continue; }
    if(status && !isPaid && !/PEND|ATRAS|ABERT|VENC/.test(status)){ skip(`Status não reconhecido: ${get(r, "status")}`); continue; }

    let contract = null, client = null;
    if(contractText){
      const hits = contractsByKey.get(codeKey(contractText)) || [];
      if(hits.length === 1) contract = hits[0];
    }
    const named = findClient(rec.clientText, get(r, "doc"));
    if(contract){ client = ctx.clients.find(c => c.id === contract.clientId) || named; }
    else client = named;
    if(!client){ skip(contractText && !contract ? `Contrato ${contractText} e cliente não encontrados` : `Cliente não encontrado: ${rec.clientText || "—"}`, "erro"); continue; }

    rec.result = "ok";
    rec.clientId = client.id; rec.clientName = client.name; rec.contractId = contract ? contract.id : null;
    rec.note = contractText && !contract ? "contrato não encontrado; ligada só ao cliente" : "";
    rec.data = {
      clientId:client.id, contractId:contract ? contract.id : null,
      description:String(get(r, "desc") ?? "").trim().slice(0, 300) || (contract ? `Contrato ${contract.code}` : ""),
      amount:Math.round(amount * 100) / 100, dueDate:due, issueDate:issue || null,
      method:mapMethod(get(r, "method")), paidDate:isPaid ? paid : null,
      number:rec.number || null, imported:true,
    };
    out.push(rec);
  }
  const count = (k) => out.filter(x => x.result === k).length;
  return { rows:out, total:out.length, ok:count("ok"), duplicada:count("duplicada"), ignorada:count("ignorada"), erro:count("erro") };
}

window.FaturasImport = { parseXlsx, parseCsv, readFile, analyze, norm, toISO, toMoney, mapMethod };
})();
