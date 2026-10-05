// Gera os PNGs dos posts da Locarion (node marketing/gerar-posts.js)
// Requer: playwright (chromium). Saída: marketing/posts/*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'posts');
const A = (f) => 'file://' + path.join(ROOT, 'assets', f);

const FONTS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const MARK = (sz) => `<svg viewBox="0 0 32 32" width="${sz}" height="${sz}"><rect width="32" height="32" rx="8" fill="#1E3A5F"/><g transform="translate(4 4)"><path d="M8.4 6 L9 6 Q10.4 6 10.4 7.4 L10.4 13.6 L14.8 13.6 Q16.2 13.6 16.2 15 L16.2 15.6 Q16.2 17 14.8 17 L8.4 17 Q7 17 7 15.6 L7 7.4 Q7 6 8.4 6 Z" fill="#fff"/><circle cx="13.3" cy="5.4" r="1.5" fill="#F2994A"/></g></svg>`;

// *negrito*  _negrito laranja_  \n quebra de linha
const fmt = (s) => s.replace(/_([\s\S]+?)_/g, '<b class="o">$1</b>').replace(/\*([\s\S]+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

const CSS = FONTS + `
*{box-sizing:border-box;margin:0;padding:0}
:root{--orange:#F0761C;--orange-d:#D9620F;--blue:#1E3A5F}
body{font-family:Inter,system-ui,sans-serif;width:1080px;-webkit-font-smoothing:antialiased}
.s{position:relative;width:1080px;overflow:hidden;display:flex;flex-direction:column;padding:44px 64px 0}
.dark{--card:rgba(255,255,255,.055);--line:rgba(255,255,255,.12);--mut:#9AA3AF;--sh:0 40px 90px rgba(0,0,0,.55);--acc:#F0761C;background:radial-gradient(800px 600px at 50% 105%,rgba(240,118,28,.26),transparent 62%),radial-gradient(900px 500px at 50% -10%,rgba(30,58,95,.55),transparent 65%),linear-gradient(180deg,#010a14,#000508);color:#fff}
.light{--card:#fff;--line:#E3E6EB;--mut:#6B7280;--sh:0 30px 70px rgba(15,16,19,.13);--acc:#D9620F;background:radial-gradient(900px 500px at 50% 0%,#fff,transparent 70%),linear-gradient(180deg,#F6F7F9,#DCDFE5);color:#0F1013}
.top{order:-2;width:100%;display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding-bottom:16px;border-bottom:1px solid rgba(127,127,127,.4);z-index:3}
.top span{opacity:.75}
.mini{display:flex;align-items:center;gap:10px;font-family:Inter;font-size:22px;font-weight:600;letter-spacing:-.02em;text-transform:none;opacity:1!important}
.txt{display:flex;flex-direction:column;z-index:3;position:relative}
.center .txt{align-items:center;text-align:center}
.logo{display:flex;align-items:center;gap:12px;font-weight:600;font-size:34px;letter-spacing:-.03em;margin-top:56px}
.chip{margin-top:30px;font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:var(--acc)}
.left .chip,.bottom .chip,.split .chip{margin-top:64px}
h1{font-weight:300;font-size:96px;line-height:1.02;letter-spacing:-.055em;margin-top:30px}
h1 b{font-weight:800}
h1 b.o{color:var(--acc)}
.sub{margin-top:24px;font-size:32px;font-weight:300;letter-spacing:-.03em;line-height:1.22;opacity:.9}
.sub b{font-weight:600}
.pill{align-self:flex-start;margin-top:34px;border:1.5px solid currentColor;border-radius:999px;padding:16px 40px;font-size:26px;font-weight:300;letter-spacing:-.02em}
.center .pill{align-self:center}
.pill.fill{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600;box-shadow:0 10px 40px rgba(240,118,28,.45)}
.vis{position:relative;z-index:2;display:flex;justify-content:center;align-items:center;flex:1;padding:40px 0 110px}
.bottom .vis{order:-1;flex:1;padding:50px 0 10px}
.bottom .txt{padding-bottom:110px}
.bottom .chip{margin-top:30px}
.split .main{display:flex;flex:1;gap:30px;align-items:center;padding-bottom:90px}
.split .txt{width:440px;flex:none}
.split .vis{padding:0}
.foot{position:absolute;left:64px;right:64px;bottom:26px;display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding-top:14px;border-top:1px solid rgba(127,127,127,.4);z-index:4}
.foot span{opacity:.85}
.dots{display:flex;gap:8px}
.dots i{width:30px;height:3px;border-radius:2px;background:currentColor;opacity:.28}
.dots i.on{background:var(--orange);opacity:1}
.obj{position:absolute;left:0;right:0;bottom:0;pointer-events:none;z-index:1}
.tile{position:absolute;border-radius:44px;border:2px solid rgba(255,140,60,.75);background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.02) 55%,rgba(240,118,28,.20));box-shadow:0 0 60px rgba(240,118,28,.45),inset 0 0 40px rgba(255,255,255,.07);transform:rotateX(62deg) rotateZ(42deg)}
.phone{position:absolute;border-radius:70px;background:#0b0e13;border:10px solid #1b1f26;box-shadow:0 0 0 2px #3a3f48,0 50px 100px rgba(0,0,0,.55);overflow:hidden}
.phone img{width:100%;display:block}
.icon{position:absolute;border-radius:60px;background:#1E3A5F;box-shadow:0 40px 80px rgba(0,0,0,.45),inset 0 3px 0 rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center}
/* componentes de interface */
.card{background:var(--card);border:1px solid var(--line);border-radius:30px;box-shadow:var(--sh);padding:34px 38px;backdrop-filter:blur(10px)}
.ct{font-size:20px;font-family:'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:14px}
.row{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 0;border-bottom:1px solid var(--line);font-size:28px;letter-spacing:-.02em}
.row:last-child{border-bottom:0}
.row small{display:block;font-size:20px;color:var(--mut);margin-top:4px}
.bd{font-size:20px;font-weight:600;padding:9px 18px;border-radius:999px;white-space:nowrap}
.bd.r{background:rgba(229,72,77,.15);color:#E5484D}.bd.g{background:rgba(45,164,78,.15);color:#2DA44E}.bd.a{background:rgba(232,163,23,.17);color:#D9940F}.bd.n{background:rgba(127,127,127,.15);color:var(--mut)}.bd.o{background:rgba(240,118,28,.15);color:var(--acc)}
.av{width:52px;height:52px;border-radius:50%;background:rgba(30,58,95,.35);color:#7FA6D9;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;margin-right:16px;flex:none}
.light .av{background:#E8ECF2;color:#1E3A5F}
.l{display:flex;align-items:center}
.paper{background:#FDFCFA;color:#1d1d1f;border-radius:18px;box-shadow:0 40px 90px rgba(0,0,0,.4);padding:46px 50px;font-size:22px;line-height:1.6}
.paper h4{font-size:24px;letter-spacing:.12em;text-align:center;margin-bottom:22px}
.f{display:inline-block;background:rgba(240,118,28,.16);color:#B54C06;font-weight:700;border-radius:8px;padding:0 10px}
.ph{display:inline-block;background:#EEF0F3;color:#6B7280;font-family:'JetBrains Mono',monospace;font-size:19px;border-radius:8px;padding:0 10px}
.bar{height:26px;border-radius:13px;background:rgba(127,127,127,.18);overflow:hidden;display:flex;margin-top:14px}
.bar i{display:block;height:100%}
.bubble{max-width:560px;padding:20px 28px;border-radius:28px;font-size:28px;letter-spacing:-.01em;box-shadow:0 20px 40px rgba(0,0,0,.3)}
.bubble small{display:block;font-size:17px;opacity:.6;margin-top:6px;text-align:right}
.opt{display:flex;align-items:center;gap:22px;padding:24px 30px;border-radius:24px;border:1.5px solid var(--line);background:var(--card);font-size:34px;font-weight:500;letter-spacing:-.02em;width:760px}
.opt b{width:54px;height:54px;border-radius:50%;border:2px solid var(--acc);color:var(--acc);display:flex;align-items:center;justify-content:center;font-size:24px;font-family:'JetBrains Mono',monospace}
`;

// ---------- objetos 3D (SVG/CSS) ----------
function fan(W, H, dark) {
  const n = 31, cx = W / 2, cy = H + 140, R = H + 40, parts = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), a = -66 + t * 132, hi = Math.max(0, 1 - Math.abs(a - 16) / 70);
    const mid = `hsl(${22 + hi * 12} 95% ${34 + hi * 26}%)`, bright = `hsl(${28 + hi * 10} 100% ${58 + hi * 30}%)`;
    parts.push(`<linearGradient id="f${k}" x1="0" x2="1"><stop offset="0" stop-color="#2a0c00"/><stop offset=".38" stop-color="${mid}"/><stop offset=".52" stop-color="${bright}"/><stop offset="1" stop-color="#2a0c00"/></linearGradient>
    <rect x="${cx - 24}" y="${cy - R}" width="48" height="${R}" rx="24" fill="url(#f${k})" transform="rotate(${a} ${cx} ${cy})"/>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><filter id="gl"><feGaussianBlur stdDeviation="14"/></filter></defs><g filter="url(#gl)" opacity=".5">${parts[15]}</g>${parts.join('')}</svg>`;
}
function gem(sz) {
  const P = (pts, a, b, op = 1) => `<polygon points="${pts}" fill="url(#g${a}${b})" stroke="rgba(255,255,255,.45)" stroke-width="1.5" opacity="${op}"/>`;
  const gr = (id, c1, c2) => `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  return `<svg viewBox="0 0 600 560" width="${sz}" height="${sz * 560 / 600}"><defs>
  ${gr('aa', '#FFE2C2', '#FF9A4A')}${gr('bb', '#FFB26B', '#C85408')}${gr('cc', '#FF8A2E', '#7A2C00')}${gr('dd', '#FFD2A0', '#E0690F')}${gr('ee', '#B24A06', '#3F1400')}${gr('ff', '#FFC48A', '#D8620C')}
  <filter id="sh"><feGaussianBlur stdDeviation="20"/></filter></defs>
  <ellipse cx="300" cy="540" rx="230" ry="22" fill="#000" opacity=".28" filter="url(#sh)"/>
  ${P('80,220 190,110 190,220', 'a', 'a')}${P('190,110 190,220 300,220', 'd', 'd')}${P('190,110 410,110 300,220', 'a', 'a', .95)}${P('410,110 300,220 410,220', 'f', 'f')}${P('410,110 520,220 410,220', 'b', 'b')}
  ${P('80,220 190,220 300,520', 'c', 'c')}${P('190,220 300,220 300,520', 'b', 'b')}${P('300,220 410,220 300,520', 'd', 'd')}${P('410,220 520,220 300,520', 'e', 'e')}</svg>`;
}
const tiles = () => `<div style="position:absolute;left:0;right:0;bottom:0;height:640px;perspective:1600px;overflow:hidden">
 <div class="tile" style="width:440px;height:440px;left:40px;bottom:60px"></div>
 <div class="tile" style="width:440px;height:440px;left:320px;bottom:170px"></div>
 <div class="tile" style="width:440px;height:440px;left:600px;bottom:50px"></div>
 <div class="tile" style="width:440px;height:440px;left:320px;bottom:-110px;opacity:.75"></div></div>`;
const blob = (c1, c2) => `<svg viewBox="0 0 1080 620" width="1080" height="620" style="position:absolute;left:0;bottom:0"><defs><linearGradient id="bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><path d="M0 330 C140 190 330 210 470 300 C640 410 760 250 920 230 C1010 220 1060 250 1080 270 L1080 620 L0 620Z" fill="url(#bl)"/><path d="M0 470 C180 400 330 430 430 500 C520 560 600 560 700 520 L700 620 L0 620Z" fill="#FFB070" opacity=".5"/></svg>`;


// ---------- visuais por tema ----------
const ck = (c = '#2DA44E') => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`;
const V = {
  fan: (o, H) => `<div class="obj" style="height:${640 + (H > 1400 ? 300 : 0)}px">${fan(1080, 600 + (H > 1400 ? 300 : 0))}</div>`,
  tiles: () => `<div class="obj" style="height:640px">${tiles()}</div>`,
  gem: (o, H) => `<div class="obj" style="height:620px;display:flex;justify-content:center;align-items:flex-end;padding-bottom:95px">${gem(o.size || 520)}</div>`,
  phone: () => `<div class="obj" style="height:760px">${blob('#FF9A4A', '#D9620F')}
      <div class="icon" style="width:190px;height:190px;left:70px;bottom:250px;transform:rotate(-14deg)">${MARK(130)}</div>
      <div class="phone" style="width:460px;height:760px;left:50%;margin-left:-190px;bottom:-190px;transform:rotate(7deg)"><img src="${A('celular-escuro.webp')}"></div></div>`,
  shot: (o) => `<div class="obj" style="height:760px">${blob('#FF9A4A', '#D9620F')}</div>
      <img src="${A(o.img)}" style="position:relative;z-index:2;width:${o.w}px;border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.25),0 0 0 1px rgba(127,127,127,.3)">`,

  // conversa bagunçada de WhatsApp
  chat: () => `<div style="position:relative;width:900px;height:560px">
    ${[['Tem betoneira pra amanhã?', 0, 0, -3], ['Quando vocês buscam o andaime??', 300, 120, 2], ['Já pagou a fatura de setembro?', 40, 250, -2], ['Cadê o contrato assinado?', 330, 370, 3], ['Alguém anotou a devolução?', 60, 470, -1]]
      .map(([t, x, y, r], k) => `<div class="bubble" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg);background:${k % 2 ? '#1F2C34' : '#005C4B'};color:#E9EDEF">${t}<small>${['07:02', '07:05', '07:11', '07:14', '07:20'][k]} ✓✓</small></div>`).join('')}
    <div style="position:absolute;right:0;top:-30px;width:96px;height:96px;border-radius:50%;background:#E5484D;color:#fff;font-size:44px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 40px rgba(229,72,77,.5)">47</div></div>`,

  // item sem estoque
  stockOut: () => `<div class="card" style="width:880px">
    <div class="ct">Disponíveis agora</div>
    <div class="row"><div class="l"><span class="av">BT</span><div><b>Betoneira 400L</b><small>3 unidades no total</small></div></div><span class="bd r">0 disponíveis</span></div>
    <div class="row"><div><small style="margin:0">Unidade 01</small>Construtora Alfa · Obra Centro</div><span class="bd o">Alugada</span></div>
    <div class="row"><div><small style="margin:0">Unidade 02</small>Vega Engenharia · Obra Sul</div><span class="bd o">Alugada</span></div>
    <div class="row"><div><small style="margin:0">Unidade 03</small>Oficina · troca de motor</div><span class="bd a">Manutenção</span></div></div>`,

  // contrato escrito à mão
  handDoc: () => `<div style="position:relative;width:820px;height:600px">
    <div class="paper" style="position:absolute;left:40px;top:20px;width:660px;height:560px;transform:rotate(-5deg);background:#FFFBEA;background-image:repeating-linear-gradient(transparent 0 46px,#C9D6E8 46px 48px)">
      <svg width="560" height="460" viewBox="0 0 560 460" fill="none" stroke="#2B4C9B" stroke-width="3" stroke-linecap="round">
        ${[30, 78, 126, 174, 222, 270, 318, 366].map((y, k) => `<path d="M10 ${y} ${Array.from({ length: 14 }, (_, j) => `q 10 ${j % 2 ? -12 : 12} 20 0 t ${10 + (k * 7 + j * 3) % 18} 0`).join(' ')}"/>`).join('')}
        <path d="M20 420 L300 420" stroke="#1d1d1f"/><path d="M40 410 q 30 -40 60 0 t 60 -10 t 50 5" stroke="#2B4C9B"/>
      </svg></div>
    <div style="position:absolute;right:0;top:40px;background:#E5484D;color:#fff;font-size:30px;font-weight:800;padding:14px 26px;border-radius:14px;transform:rotate(8deg);box-shadow:0 20px 40px rgba(0,0,0,.35)">3ª via rasurada</div></div>`,

  // devolução atrasada
  late: () => `<div class="card" style="width:880px;display:flex;gap:40px;align-items:center">
    <div style="text-align:center;padding:26px 34px;border-radius:24px;background:rgba(229,72,77,.12);border:2px solid #E5484D"><div style="font-size:84px;font-weight:800;letter-spacing:-.05em;line-height:1;color:#E5484D">22</div><div style="font-family:'JetBrains Mono';font-size:22px;letter-spacing:.2em;color:#E5484D">SET</div></div>
    <div style="flex:1"><div class="ct" style="margin-bottom:6px">Devolução prevista</div><div style="font-size:36px;font-weight:700;letter-spacing:-.03em">Compactador de solo</div>
    <div style="font-size:24px;color:var(--mut);margin:6px 0 18px">Obras Ferreira Ltda</div><span class="bd r">Atrasada há 13 dias</span></div></div>`,

  // ninguém sabe quem pagou
  whoPaid: () => `<div class="card" style="width:880px"><div class="ct">Faturas de setembro</div>
    ${[['CA', 'Construtora Alfa', 'R$ 1.140,00'], ['VE', 'Vega Engenharia', 'R$ 860,00'], ['OF', 'Obras Ferreira', 'R$ 220,00'], ['EB', 'Empreiteira Bueno', 'R$ 540,00']]
      .map(([a, n, v]) => `<div class="row"><div class="l"><span class="av">${a}</span><div>${n}<small>${v}</small></div></div><span class="bd n" style="font-size:30px;padding:6px 22px">?</span></div>`).join('')}</div>`,

  // enquete
  poll: () => `<div style="display:flex;flex-direction:column;gap:18px;align-items:center">
    ${['Betoneira', 'Andaime', 'Escora', 'Martelete'].map((t, k) => `<div class="opt"><b>${'ABCD'[k]}</b>${t}</div>`).join('')}</div>`,

  // contrato preenchido
  contract: () => `<div style="position:relative;width:900px;height:640px">
    <div class="paper" style="position:absolute;right:20px;top:0;width:640px;transform:rotate(3deg)">
      <h4>CONTRATO DE LOCAÇÃO</h4>
      <p>Pelo presente, <span class="f">Construtora Alfa Ltda</span>, CNPJ <span class="f">12.345.678/0001-90</span>, loca o equipamento <span class="f">Betoneira 400L</span>, pelo período de <span class="f">14/10 a 28/10/2026</span>, na tarifa <span class="f">quinzenal</span>, no valor de <span class="f">R$ 380,00</span>, para a obra <span class="f">Rua das Flores, 120</span>.</p>
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:18px;color:#6B7280"><span>______________________<br>Locadora</span><span>______________________<br>Locatário</span></div></div>
    <div style="position:absolute;left:0;bottom:30px;background:var(--orange);color:#fff;font-size:28px;font-weight:700;padding:18px 28px;border-radius:18px;box-shadow:0 20px 50px rgba(240,118,28,.5);display:flex;gap:12px;align-items:center">${ck('#fff')} Preenchido em 2s</div></div>`,

  // modelo com variáveis
  template: () => `<div class="paper" style="width:880px">
      <h4>SEU MODELO DE CONTRATO</h4>
      <p>Pelo presente, <span class="ph">{cliente}</span>, CNPJ <span class="ph">{documento}</span>, loca o equipamento <span class="ph">{itens}</span>, pelo período de <span class="ph">{inicio}</span> a <span class="ph">{fim}</span>, no valor de <span class="ph">{valor}</span>.</p>
      <p style="margin-top:16px;color:#6B7280">Cláusula 4ª — As cláusulas são as da sua locadora. A Locarion não muda uma vírgula.</p></div>`,

  // campos entrando
  fields: () => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;width:900px">
    ${[['Cliente', 'Construtora Alfa'], ['Obra', 'Rua das Flores, 120'], ['Itens', 'Betoneira 400L + 2 escoras'], ['Período', '14/10 → 28/10'], ['Tarifa', 'Quinzenal'], ['Valor', 'R$ 380,00']]
      .map(([k, v]) => `<div class="card" style="padding:26px 30px"><div class="ct" style="font-size:16px;margin-bottom:8px">${k}</div><div style="font-size:30px;font-weight:600;letter-spacing:-.02em;display:flex;justify-content:space-between;align-items:center">${v}${ck()}</div></div>`).join('')}</div>`,

  // tarifas por período
  tariffs: () => `<div style="display:flex;gap:18px">
    ${['Diária', 'Semanal', 'Quinzenal', 'Mensal'].map((t, k) => `<div class="card" style="width:210px;height:260px;padding:28px;display:flex;flex-direction:column;justify-content:space-between;${k === 2 ? 'background:var(--orange);color:#fff;border-color:var(--orange);transform:translateY(-24px);box-shadow:0 30px 60px rgba(240,118,28,.45)' : ''}">
      <div style="font-family:'JetBrains Mono';font-size:40px;font-weight:500">${['1', '7', '15', '30'][k]}<span style="font-size:18px"> dias</span></div>
      <div style="font-size:30px;font-weight:700;letter-spacing:-.02em">${t}${k === 2 ? '<div style="font-size:17px;font-weight:500;margin-top:6px">aplicada no contrato</div>' : ''}</div></div>`).join('')}</div>`,

  // barras de estoque
  stockBars: () => `<div class="card" style="width:900px"><div class="ct">Estoque por peça</div>
    ${[['Andaime tubular 1,5m', 340, 160], ['Escora metálica 3m', 210, 290], ['Plataforma de andaime', 95, 45]]
      .map(([n, l, a]) => `<div style="padding:20px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;font-size:28px;letter-spacing:-.02em"><b style="font-weight:600">${n}</b><span><b style="color:#2DA44E">${l}</b> <span style="color:var(--mut);font-size:22px">livres</span> · <b style="color:var(--acc)">${a}</b> <span style="color:var(--mut);font-size:22px">alugadas</span></span></div>
      <div class="bar"><i style="width:${(a / (l + a)) * 100}%;background:var(--orange)"></i><i style="width:${(l / (l + a)) * 100}%;background:#2DA44E;opacity:.75"></i></div></div>`).join('')}</div>`,

  // status financeiro
  status: () => `<div style="display:flex;flex-direction:column;gap:18px;width:900px">
    ${[['g', 'Pagou', 'Construtora Alfa', 'R$ 1.140,00'], ['a', 'Vai pagar', 'Vega Engenharia · vence 30/10', 'R$ 860,00'], ['r', 'Atrasado', 'Obras Ferreira · há 8 dias', 'R$ 220,00']]
      .map(([c, t, n, v]) => `<div class="card" style="padding:26px 34px;display:flex;justify-content:space-between;align-items:center"><div><span class="bd ${c}" style="font-size:22px">${t}</span><div style="font-size:26px;color:var(--mut);margin-top:12px">${n}</div></div><div style="font-size:42px;font-weight:700;letter-spacing:-.03em">${v}</div></div>`).join('')}</div>`,

  // tabela de clientes
  clients: () => `<div class="card" style="width:900px"><div class="ct">Financeiro · por cliente</div>
    ${[['CA', 'Construtora Alfa', 'R$ 3.420,00', 'g', 'Em dia'], ['VE', 'Vega Engenharia', 'R$ 1.860,00', 'a', '1 a vencer'], ['OF', 'Obras Ferreira', 'R$ 640,00', 'r', '1 atrasada'], ['EB', 'Empreiteira Bueno', 'R$ 980,00', 'g', 'Em dia']]
      .map(([a, n, v, c, s]) => `<div class="row"><div class="l"><span class="av">${a}</span><div>${n}<small>${v} no mês</small></div></div><span class="bd ${c}">${s}</span></div>`).join('')}</div>`,

  // alerta na tela inicial
  alert: () => `<div style="position:relative;width:900px">
    <div class="card" style="border:2px solid #E5484D;box-shadow:0 0 80px rgba(229,72,77,.35),var(--sh)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:30px;font-weight:700">Alertas</div><span class="bd r">3 novos</span></div>
      ${[['#E5484D', 'Pagamento atrasado — Obras Ferreira', 'R$ 220,00 · venceu em 27/09'], ['#E8A317', 'Contrato CT-0231 vence amanhã', 'Construtora Alfa'], ['#E8A317', 'Contrato CT-0232 vence em 2 dias', 'Vega Engenharia']]
        .map(([c, t, d]) => `<div class="row" style="justify-content:flex-start"><span style="width:14px;height:14px;border-radius:50%;background:${c};flex:none"></span><div>${t}<small>${d}</small></div></div>`).join('')}</div>
    <div style="position:absolute;right:-20px;top:-34px;width:84px;height:84px;border-radius:50%;background:#E5484D;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 40px rgba(229,72,77,.6)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg></div></div>`,

  // exportação CSV
  csv: () => `<div style="position:relative;width:900px;height:560px">
    <div class="card" style="position:absolute;right:0;top:0;width:700px;padding:0;overflow:hidden">
      <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;font-size:22px">
        ${['Cliente', 'Valor', 'Status', 'Construtora Alfa', 'R$ 1.140,00', 'Pago', 'Vega Engenharia', 'R$ 860,00', 'Aberto', 'Obras Ferreira', 'R$ 220,00', 'Atrasado', 'Empreiteira Bueno', 'R$ 540,00', 'Pago', 'Total', 'R$ 2.760,00', '']
          .map((c, k) => `<div style="padding:20px 24px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);${k < 3 ? 'font-weight:700;background:rgba(45,164,78,.12)' : ''}${k >= 15 ? 'font-weight:700' : ''}">${c}</div>`).join('')}</div></div>
    <div style="position:absolute;left:0;bottom:0;width:260px;height:320px;border-radius:22px;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;transform:rotate(-6deg)">
      <div style="width:150px;height:150px;border-radius:20px;background:#1F7A45;color:#fff;font-weight:800;font-size:46px;display:flex;align-items:center;justify-content:center">CSV</div>
      <div style="font-size:20px;color:#1d1d1f;font-family:'JetBrains Mono'">financeiro-out.csv</div></div></div>`,

  // manutenção
  maint: () => `<div class="card" style="width:480px">
    <div style="height:200px;border-radius:20px;background:linear-gradient(135deg,rgba(232,163,23,.25),rgba(232,163,23,.05));display:flex;align-items:center;justify-content:center;margin-bottom:24px">
      <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#E8A317" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
    <div style="font-size:34px;font-weight:700;letter-spacing:-.03em">Martelete rompedor 10kg</div>
    <div style="margin:14px 0 22px"><span class="bd a">Em manutenção</span></div>
    <div class="row"><span>Disponível p/ locação</span><span style="width:76px;height:42px;border-radius:21px;background:rgba(127,127,127,.3);position:relative"><i style="position:absolute;left:5px;top:5px;width:32px;height:32px;border-radius:50%;background:#fff"></i></span></div>
    <div class="row"><span>Revisão preventiva</span><b style="color:var(--acc)">15/11</b></div></div>`,

  // busca Ctrl+K
  search: () => `<div style="width:920px">
    <div class="card" style="padding:28px 34px;display:flex;align-items:center;gap:20px;font-size:38px;border:2px solid var(--acc);box-shadow:0 0 0 8px rgba(240,118,28,.12),var(--sh)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <span style="flex:1">Constr<span style="border-right:3px solid var(--acc);margin-left:2px"></span></span>
      <span style="font-family:'JetBrains Mono';font-size:22px;border:1px solid var(--line);border-radius:10px;padding:8px 14px;color:var(--mut)">Ctrl K</span></div>
    <div class="card" style="margin-top:18px;padding:14px 34px">
      ${[['Cliente', 'Construtora Alfa', '3 contratos'], ['Contrato', 'CT-0231 · Construtora Alfa', 'vence amanhã'], ['Equipamento', 'Betoneira 400L', 'na Obra Centro']]
        .map(([t, n, d], k) => `<div class="row" ${k === 0 ? 'style="background:rgba(240,118,28,.08);margin:0 -20px;padding:22px 20px;border-radius:16px"' : ''}><div><small style="margin:0 0 4px;font-family:'JetBrains Mono';letter-spacing:.12em;text-transform:uppercase;font-size:16px">${t}</small>${n}</div><span style="color:var(--mut);font-size:22px">${d}</span></div>`).join('')}</div></div>`,

  // aspas gigantes
  quote: () => `<div style="font-size:620px;font-weight:800;line-height:.7;color:var(--orange);letter-spacing:-.05em;margin-top:120px;text-shadow:0 30px 120px rgba(240,118,28,.5)">?</div>`,

  // navegador
  browser: () => `<div style="position:relative;width:920px;height:580px">
    <div class="card" style="position:absolute;left:0;top:0;width:760px;padding:0;overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:18px 22px;border-bottom:1px solid var(--line)"><i style="width:14px;height:14px;border-radius:50%;background:#E5484D"></i><i style="width:14px;height:14px;border-radius:50%;background:#E8A317"></i><i style="width:14px;height:14px;border-radius:50%;background:#2DA44E"></i>
        <div style="margin-left:18px;flex:1;background:rgba(127,127,127,.12);border-radius:10px;padding:8px 16px;font-size:20px;font-family:'JetBrains Mono'">🔒 locarion.app</div></div>
      <img src="${A('painel-claro.webp')}" style="width:100%;display:block"></div>
    <div class="phone" style="position:absolute;right:0;bottom:0;width:230px;height:420px;border-radius:40px;border-width:7px"><img src="${A('celular-escuro.webp')}"></div></div>`,

  // dados isolados
  shield: () => `<div style="display:flex;align-items:center;gap:34px">
    ${['Locadora A', 'Locadora B'].map((t, k) => `<div class="card" style="width:300px;text-align:center;padding:40px 20px ${k ? ';opacity:.45;filter:blur(1.5px)' : ''}"><div style="width:90px;height:90px;border-radius:22px;background:${k ? '#5B626B' : '#1E3A5F'};margin:0 auto 20px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:40px;font-weight:800">${'AB'[k]}</div><div style="font-size:30px;font-weight:700">${t}</div><div style="font-size:22px;color:var(--mut);margin-top:8px">${k ? 'sem acesso' : 'seus contratos'}</div></div>`).join(`<div style="width:120px;height:120px;border-radius:50%;background:var(--orange);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px rgba(240,118,28,.55);flex:none"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>`)}</div>`,

  // sem taxas
  noFee: () => `<div style="display:flex;flex-direction:column;gap:22px;width:820px">
    ${['Fidelidade', 'Multa de cancelamento', 'Taxa de implantação'].map((t) => `<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:30px 40px"><span style="font-size:40px;font-weight:600;letter-spacing:-.03em;text-decoration:line-through;text-decoration-color:var(--orange);text-decoration-thickness:5px">${t}</span><span style="font-size:44px;font-weight:800;color:var(--acc)">R$ 0</span></div>`).join('')}</div>`,

  // cancelar
  cancel: () => `<div class="card" style="width:820px">
    <div class="ct">Assinatura</div>
    <div class="row"><div>Plano Locarion<small>Mensal · sem fidelidade</small></div><span class="bd g">Ativo</span></div>
    <div class="row"><div>Próxima cobrança<small>via Asaas</small></div><b>R$ 127,00</b></div>
    <div style="margin-top:26px;text-align:center;padding:22px;border-radius:18px;border:1.5px solid var(--line);font-size:28px;color:var(--mut)">Cancelar quando quiser</div></div>`,

  // preço + incluso
  included: () => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 40px;width:900px;font-size:30px;letter-spacing:-.02em">
    ${['Contratos', 'Agenda', 'Estoque por peça', 'Manutenção', 'Financeiro', 'Avisos por WhatsApp', 'Notificações no celular', 'Importação de faturas'].map((t) => `<div class="l" style="gap:14px">${ck('#D9620F')}${t}</div>`).join('')}</div>`,

  // 15 dias
  days: () => `<div style="display:grid;grid-template-columns:repeat(5,150px);gap:16px">
    ${Array.from({ length: 15 }, (_, k) => `<div style="height:120px;border-radius:22px;display:flex;flex-direction:column;justify-content:space-between;padding:16px 20px;${k === 14 ? 'background:var(--orange);color:#fff;box-shadow:0 20px 50px rgba(240,118,28,.5)' : 'background:var(--card);border:1px solid var(--line)'}"><span style="font-family:'JetBrains Mono';font-size:16px;opacity:.7">DIA</span><b style="font-size:42px;letter-spacing:-.04em">${k + 1}</b></div>`).join('')}</div>`,
};

function slide(s, i, total) {
  const H = s.h || 1350, lay = s.lay || 'center';
  const dots = total > 1 ? `<div class="dots">${Array.from({ length: total }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : '<span></span>';
  const vis = s.v ? V[s.v](s, H) : '';
  const bleed = ['fan', 'tiles', 'gem', 'phone'].includes(s.v);
  const txt = `<div class="txt">
    ${lay === 'center' ? `<div class="logo">${MARK(44)}Locarion</div>` : ''}
    ${s.chip ? `<div class="chip">${s.chip}</div>` : ''}
    ${s.big ? `<div style="font-weight:800;font-size:220px;letter-spacing:-.07em;line-height:.9;margin-top:30px;color:var(--acc)">${s.big}</div>` : ''}
    <h1 ${s.fs ? `style="font-size:${s.fs}px"` : ''}>${fmt(s.t)}</h1>
    ${s.sub ? `<div class="sub">${fmt(s.sub)}</div>` : ''}
    ${s.cta ? `<div class="pill ${s.fill ? 'fill' : ''}">${s.cta}</div>` : ''}</div>`;
  const visBox = bleed ? vis : `<div class="vis"><div style="zoom:${s.z || 1}">${vis}</div></div>`;
  const body = lay === 'split' ? `<div class="main">${txt}${visBox}</div>` : `${txt}${visBox}`;
  return `<html><head><style>${CSS}</style></head><body><div class="s ${s.theme} ${lay}" style="height:${H}px">
  <div class="top">${lay === 'center' ? '<span>Contratos. Agenda. Estoque. Financeiro. Locarion.</span>' : `<span class="mini">${MARK(30)}Locarion</span>`}<span>Menos papel. Mais locação.</span></div>
  ${body}
  <div class="foot">${dots}<span>${total > 1 ? `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'locarion.app'}</span></div></div></body></html>`;
}

const D = 'dark', L = 'light';
const posts = {
  '01-carrossel-caderno': [
    { theme: D, lay: 'bottom', v: 'chat', t: 'Sua locadora ainda\nroda no _WhatsApp?_', sub: 'Menos improviso. *Mais controle.*' },
    { theme: L, lay: 'left', chip: '01 · Estoque', t: 'Alugou o que\n_não tinha_ no pátio?', v: 'stockOut' },
    { theme: D, lay: 'split', chip: '02 · Contrato', t: 'Contrato\ndigitado\n*na mão,*\n_de novo._', fs: 84, v: 'handDoc', z: .62 },
    { theme: L, lay: 'bottom', chip: '03 · Devolução', t: 'Devolução esquecida =\n_dinheiro parado._', fs: 86, v: 'late' },
    { theme: D, lay: 'left', chip: '04 · Cobrança', t: '_Quem pagou?_\nNinguém sabe.', v: 'whoPaid' },
    { theme: L, t: 'Existe um jeito\n*mais simples.*', sub: 'Contrato, agenda, estoque e financeiro *num lugar só.*', cta: 'Teste grátis por 15 dias', v: 'phone' },
  ],
  '02-pergunta-equipamento': [
    { theme: D, chip: 'Enquete · comente a letra', t: 'Qual equipamento\nmais _some_ do controle?', fs: 84, v: 'poll' },
  ],
  '03-reels-capa': [
    { theme: D, h: 1920, chip: 'Reels', t: 'Um dia na locadora\n_sem sistema._', sub: 'Tem que ser *assim?*', cta: 'Teste grátis · 15 dias', fs: 104, v: 'fan' },
  ],
  '04-agenda': [
    { theme: L, chip: 'Agenda', t: 'O que *sai* hoje.\nO que _volta_ hoje.', sub: 'Retiradas e devoluções *em uma tela.*', v: 'shot', img: 'agenda-preview.png', w: 960 },
  ],
  '05-carrossel-contrato': [
    { theme: D, lay: 'bottom', v: 'contract', t: 'Seu contrato.\n_Preenchido sozinho._', fs: 92 },
    { theme: L, lay: 'left', chip: '01 · Seu modelo', t: 'O texto é *seu.*\nA Locarion _preenche._', fs: 88, v: 'template' },
    { theme: D, lay: 'left', chip: '02 · Automático', t: 'Cliente, itens, datas\ne valores _entram sozinhos._', fs: 76, v: 'fields' },
    { theme: L, chip: '03 · Tarifa', t: 'A tarifa certa,\n_por período._', v: 'tariffs' },
    { theme: D, t: 'Menos digitação.\n_Mais locação._', cta: 'Teste grátis por 15 dias', fill: true, v: 'tiles' },
  ],
  '06-estoque': [
    { theme: L, lay: 'left', chip: 'Estoque por peça', t: 'Andaime e escora\npor _quantidade._', sub: 'Saldo *livre* x *alugado*, na hora.', v: 'stockBars' },
  ],
  '07-carrossel-financeiro': [
    { theme: D, lay: 'left', chip: 'Financeiro', t: 'Quem *pagou.*\nQuem _deve._', v: 'status' },
    { theme: L, lay: 'bottom', chip: '01 · Por cliente', t: '*Cliente por cliente.*\nSem planilha paralela.', fs: 80, v: 'clients' },
    { theme: D, lay: 'bottom', chip: '02 · Alertas', t: 'Atraso vira _alerta_\nna tela inicial.', fs: 84, v: 'alert' },
    { theme: L, lay: 'left', chip: '03 · Exportação', t: 'Um clique.\n_CSV pro contador._', v: 'csv' },
    { theme: D, t: 'Clareza\n_gera caixa._', sub: 'Financeiro organizado é locadora *mais lucrativa.*', cta: 'Teste grátis por 15 dias', fill: true, v: 'gem', size: 440 },
  ],
  '08-manutencao': [
    { theme: D, lay: 'split', chip: 'Manutenção', t: 'Na oficina,\n_fora da\nlocação._', fs: 84, sub: 'O item sai da lista de *disponíveis* sozinho.', v: 'maint' },
  ],
  '09-reels-capa': [
    { theme: L, h: 1920, lay: 'bottom', chip: 'Reels · Ctrl + K', t: 'Achou em\n_3 segundos._', sub: 'Contrato, cliente ou equipamento, de *qualquer tela.*', fs: 120, v: 'search' },
  ],
  '10-carrossel-objecoes': [
    { theme: D, lay: 'split', t: 'Antes de\ntestar, você\n*pergunta…*', fs: 88, sub: 'E a gente responde. *Arrasta →*', v: 'quote' },
    { theme: L, lay: 'bottom', chip: '“Preciso instalar algo?”', t: '*Não.* Abre no _navegador_\ndo computador e do celular.', fs: 72, v: 'browser' },
    { theme: D, chip: '“E meus dados?”', t: 'Cada empresa *só vê*\nos _próprios dados._', fs: 86, v: 'shield' },
    { theme: L, lay: 'left', chip: '“Tem fidelidade?”', t: '*Não.* E nenhuma\n_taxa escondida._', v: 'noFee' },
    { theme: D, lay: 'left', chip: '“E se eu não gostar?”', t: '*Cancele\nquando quiser.*', cta: 'Teste 15 dias grátis', fill: true, v: 'cancel' },
  ],
  '11-preco': [
    { theme: L, lay: 'left', chip: 'Plano único', big: 'R$ 127', t: 'por mês. *Tudo incluso.*', fs: 64, sub: 'Sem fidelidade · Anual: *R$ 1.397* (R$ 116,42/mês)', v: 'included' },
  ],
  '12-chamada-final': [
    { theme: D, t: '*15 dias* para organizar\nsua locadora. _De graça._', fs: 80, sub: 'Sem cartão. Entre com sua conta Google.', cta: 'Começar em locarion.app', fill: true, v: 'days' },
  ],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  let n = 0;
  for (const [name, slides] of Object.entries(posts)) {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      await page.setViewportSize({ width: 1080, height: s.h || 1350 });
      const tmp = path.join(__dirname, '_tmp.html');
      fs.writeFileSync(tmp, slide(s, i, slides.length));
      await page.goto('file://' + tmp, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const file = slides.length > 1 ? `${name}-${String(i + 1).padStart(2, '0')}.png` : `${name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      n++;
    }
  }
  fs.rmSync(path.join(__dirname, '_tmp.html'), { force: true });
  await browser.close();
  console.log('geradas', n, 'imagens em', OUT);
})();
