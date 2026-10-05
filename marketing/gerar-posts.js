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
const fmt = (s) => s.replace(/_(.+?)_/g, '<b class="o">$1</b>').replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

const CSS = FONTS + `
*{box-sizing:border-box;margin:0;padding:0}
:root{--orange:#F0761C;--orange-d:#D9620F;--blue:#1E3A5F;--deep:#000710}
body{font-family:Inter,system-ui,sans-serif;width:1080px;-webkit-font-smoothing:antialiased}
.s{position:relative;width:1080px;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;padding:44px 64px 0}
.dark{background:radial-gradient(800px 600px at 50% 105%,rgba(240,118,28,.30),transparent 62%),radial-gradient(900px 500px at 50% -10%,rgba(30,58,95,.55),transparent 65%),linear-gradient(180deg,#010a14,#000508);color:#fff}
.light{background:radial-gradient(900px 500px at 50% 0%,#fff,transparent 70%),linear-gradient(180deg,#F6F7F9,#DCDFE5);color:#0F1013}
.top{width:100%;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.75;padding-bottom:16px;border-bottom:1px solid rgba(127,127,127,.4);z-index:3}
.logo{display:flex;align-items:center;gap:12px;font-weight:600;font-size:34px;letter-spacing:-.03em;margin-top:62px;z-index:3}
.chip{margin-top:30px;font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:var(--orange);z-index:3}
.light .chip{color:var(--orange-d)}
h1{font-weight:300;font-size:100px;line-height:1.02;letter-spacing:-.055em;margin-top:36px;z-index:3}
h1 b{font-weight:800}
h1 b.o{color:var(--orange)}
.light h1 b.o{color:var(--orange-d)}
.sub{margin-top:26px;font-size:34px;font-weight:300;letter-spacing:-.03em;line-height:1.2;opacity:.9;z-index:3}
.sub b{font-weight:600}
.pill{margin-top:38px;border:1.5px solid currentColor;border-radius:999px;padding:18px 44px;font-size:28px;font-weight:300;letter-spacing:-.02em;z-index:3}
.pill.fill{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600;box-shadow:0 10px 40px rgba(240,118,28,.45)}
.bigp{font-weight:800;font-size:230px;letter-spacing:-.07em;line-height:.9;margin-top:34px;color:var(--orange);z-index:3}
.light .bigp{color:var(--orange-d)}
.obj{position:absolute;left:0;right:0;bottom:0;pointer-events:none;z-index:1}
.foot{position:absolute;left:64px;right:64px;bottom:26px;display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding-top:14px;border-top:1px solid rgba(127,127,127,.4);opacity:.85;z-index:4}
.dots{display:flex;gap:8px}
.dots i{width:30px;height:3px;border-radius:2px;background:currentColor;opacity:.28}
.dots i.on{background:var(--orange);opacity:1}
.tile{position:absolute;border-radius:44px;border:2px solid rgba(255,140,60,.75);background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.02) 55%,rgba(240,118,28,.20));box-shadow:0 0 60px rgba(240,118,28,.45),inset 0 0 40px rgba(255,255,255,.07);transform:rotateX(62deg) rotateZ(42deg)}
.phone{position:absolute;border-radius:70px;background:#0b0e13;border:10px solid #1b1f26;box-shadow:0 0 0 2px #3a3f48,0 50px 100px rgba(0,0,0,.55);overflow:hidden}
.phone img{width:100%;display:block}
.icon{position:absolute;border-radius:60px;background:#1E3A5F;box-shadow:0 40px 80px rgba(0,0,0,.45),inset 0 3px 0 rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center}
.shotimg{position:absolute;left:50%;transform:translateX(-50%);border-radius:28px 28px 0 0;box-shadow:0 -10px 90px rgba(240,118,28,.25),0 0 0 1px rgba(127,127,127,.35)}
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

function object(kind, o, H, dark) {
  const off = H > 1400 ? 300 : 0;
  switch (kind) {
    case 'fan': return `<div class="obj" style="height:${640 + off}px">${fan(1080, 600 + off, dark)}</div>`;
    case 'gem': return `<div class="obj" style="height:${620 + off}px;display:flex;justify-content:center;align-items:flex-end;padding-bottom:95px">${gem(560 + off / 2)}</div>`;
    case 'tiles': return `<div class="obj" style="height:${640 + off}px">${tiles()}</div>`;
    case 'phone': return `<div class="obj" style="height:${760 + off}px">${blob('#FF9A4A', '#D9620F')}
      <div class="icon" style="width:190px;height:190px;left:70px;bottom:250px;transform:rotate(-14deg)">${MARK(130)}</div>
      <div class="phone" style="width:460px;height:760px;left:50%;margin-left:-190px;bottom:-190px;transform:rotate(7deg)"><img src="${A('celular-escuro.webp')}"></div></div>`;
    case 'shot': return `<div class="obj" style="height:${760 + off}px">${blob('#FF9A4A', '#D9620F').replace('<path d="M0 470', '<path style="display:none" d="M0 470')}
      <img class="shotimg" src="${A(o.img)}" style="width:${o.w || 940}px;bottom:${o.b ?? -20}px"></div>`;
    default: return '';
  }
}

function slide(s, i, total) {
  const H = s.h || 1350, dark = s.theme === 'dark';
  const dots = total > 1 ? `<div class="dots">${Array.from({ length: total }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : '<span></span>';
  const obj = s.obj ? object(s.obj, s, H, dark) : '';
  return `<html><head><style>${CSS}</style></head><body><div class="s ${s.theme}" style="height:${H}px">
  <div class="top"><span>Contratos. Agenda. Estoque. Financeiro. Locarion.</span><span>Menos papel. Mais locação.</span></div>
  <div class="logo">${MARK(44)}Locarion</div>
  ${s.chip ? `<div class="chip">${s.chip}</div>` : ''}
  ${s.big ? `<div class="bigp">${s.big}</div>` : ''}
  <h1 ${s.fs ? `style="font-size:${s.fs}px"` : ''}>${fmt(s.t)}</h1>
  ${s.sub ? `<div class="sub">${fmt(s.sub)}</div>` : ''}
  ${s.cta ? `<div class="pill ${s.fill ? 'fill' : ''}">${s.cta}</div>` : ''}
  ${obj}
  <div class="foot">${dots}<span>${total > 1 ? `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'locarion.app'}</span></div></div></body></html>`;
}

const D = 'dark', L = 'light';
const posts = {
  '01-carrossel-caderno': [
    { theme: D, t: 'Sua locadora ainda roda\nno _caderno_ e no *WhatsApp?*', sub: 'Menos improviso. *Mais controle.*', fs: 84, obj: 'phone' },
    { theme: L, chip: '01', t: 'Quantas vezes você\njá alugou o que\n_não tinha_ no pátio?', fs: 88, obj: 'gem' },
    { theme: D, chip: '02', t: 'Contrato digitado\n*na mão*, de novo.', obj: 'fan' },
    { theme: L, chip: '03', t: 'Devolução esquecida =\n*equipamento parado*\ne _dinheiro perdido._', fs: 84, obj: 'gem' },
    { theme: D, chip: '04', t: 'Cobrança:\n“_quem ainda não pagou?_”\nE ninguém sabe.', fs: 86, obj: 'tiles' },
    { theme: L, t: 'Existe um jeito\n*mais simples.*', sub: 'Contrato, agenda, estoque e financeiro\n*num lugar só.*', cta: 'Teste grátis por 15 dias', obj: 'phone' },
  ],
  '02-pergunta-equipamento': [
    { theme: D, chip: 'Conta pra gente', t: 'Qual equipamento\nmais _some_ do\nseu controle?', sub: '*Betoneira, andaime, escora* ou *martelete?*', cta: 'Responda nos comentários', obj: 'fan' },
  ],
  '03-reels-capa': [
    { theme: D, h: 1920, chip: 'Reels', t: 'Um dia na locadora\n_sem sistema._', sub: 'Tem que ser *assim?*', cta: 'Teste grátis · 15 dias', fs: 104, obj: 'fan' },
  ],
  '04-agenda': [
    { theme: L, chip: 'Agenda', t: 'O que *sai* hoje.\nO que _volta_ hoje.', sub: 'Retiradas e devoluções *em uma tela.*', cta: 'Conheça a agenda', obj: 'shot', img: 'agenda-preview.png', w: 1000, b: 110 },
  ],
  '05-carrossel-contrato': [
    { theme: D, t: 'Seu contrato.\n*Do seu jeito.*\n_Preenchido sozinho._', obj: 'tiles' },
    { theme: L, chip: '01', t: 'Você usa o\n*modelo da sua\nlocadora.*', obj: 'gem' },
    { theme: D, chip: '02', t: '*Cliente, itens, datas\ne valores* entram\n_automáticos._', fs: 88, obj: 'fan' },
    { theme: L, chip: '03', t: 'A tarifa já sai\n*por período.*', sub: 'Diária · Semanal · Quinzenal · Mensal', obj: 'gem' },
    { theme: D, t: 'Menos digitação.\n_Mais locação._', cta: 'Teste grátis por 15 dias', fill: true, obj: 'tiles' },
  ],
  '06-estoque': [
    { theme: L, chip: 'Estoque por peça', t: 'Andaime e escora\npor _quantidade._', sub: 'Saldo *livre* x *alugado*, na hora.', obj: 'shot', img: 'painel-claro.webp', w: 940, b: 100 },
  ],
  '07-carrossel-financeiro': [
    { theme: D, t: 'Quem *pagou.*\nQuem *vai pagar.*\nQuem está _atrasado._', obj: 'fan' },
    { theme: L, chip: '01', t: '*Cliente por cliente.*\nSem planilha\nparalela.', obj: 'gem' },
    { theme: D, chip: '02', t: 'Atraso vira\n_alerta_ na\ntela inicial.', obj: 'tiles' },
    { theme: L, chip: '03', t: 'Exporta em *CSV*\npara o _contador._', obj: 'gem' },
    { theme: D, t: 'Clareza\n_gera caixa._', sub: 'Financeiro organizado é locadora *mais lucrativa.*', cta: 'Teste grátis por 15 dias', fill: true, obj: 'fan' },
  ],
  '08-manutencao': [
    { theme: D, chip: 'Manutenção', t: 'Na oficina,\n*fora da locação.*', sub: 'Registrou a manutenção, o item\nsai da lista de *disponíveis.*', obj: 'shot', img: 'painel-escuro.webp', w: 940, b: 100 },
  ],
  '09-reels-capa': [
    { theme: L, h: 1920, chip: 'Ctrl + K', t: 'Achou em\n_3 segundos._', sub: 'Contrato, cliente ou equipamento,\nde *qualquer tela.*', fs: 120, obj: 'gem' },
  ],
  '10-carrossel-objecoes': [
    { theme: D, t: 'Antes de testar,\nvocê *pergunta…*', obj: 'tiles' },
    { theme: L, chip: '“Preciso instalar algo?”', t: '*Não.* Funciona\nno _navegador_ do\ncomputador e celular.', fs: 86, obj: 'phone' },
    { theme: D, chip: '“E meus dados?”', t: 'Cada empresa\n*só vê* os\n_próprios dados._', obj: 'tiles' },
    { theme: L, chip: '“Tem fidelidade?”', t: '*Não.* Mensal, sem\nmulta e _sem taxa\nde implantação._', fs: 88, obj: 'gem' },
    { theme: D, chip: '“E se eu não gostar?”', t: '*Cancele\nquando quiser.*', sub: '15 dias grátis, sem cartão.', cta: 'locarion.app', fill: true, obj: 'fan' },
  ],
  '11-preco': [
    { theme: L, chip: 'Plano único', big: 'R$ 127', t: 'por mês. *Tudo incluso.*', fs: 64, sub: 'Sem fidelidade · Anual: *R$ 1.397* (R$ 116,42/mês)', cta: 'Teste grátis · 15 dias', fill: true, obj: 'gem' },
  ],
  '12-chamada-final': [
    { theme: D, t: '*15 dias* para\norganizar sua locadora.\n_De graça._', fs: 88, sub: 'Sem cartão. Entre com sua conta Google.', cta: 'Começar em locarion.app', fill: true, obj: 'phone' },
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
