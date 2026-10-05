// Gera os PNGs dos posts da Locarion (node marketing/gerar-posts.js)
// Requer: playwright (chromium). Saída: marketing/posts/*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'posts');
const A = (f) => 'file://' + path.join(ROOT, 'assets', f);

const MARK = `<svg viewBox="0 0 32 32" width="38" height="38"><rect width="32" height="32" rx="8" fill="#1E3A5F"/><g transform="translate(4 4)"><path d="M8.4 6 L9 6 Q10.4 6 10.4 7.4 L10.4 13.6 L14.8 13.6 Q16.2 13.6 16.2 15 L16.2 15.6 Q16.2 17 14.8 17 L8.4 17 Q7 17 7 15.6 L7 7.4 Q7 6 8.4 6 Z" fill="#fff"/><circle cx="13.3" cy="5.4" r="1.5" fill="#F2994A"/></g></svg>`;

// *negrito*  _negrito laranja_  \n quebra de linha
const fmt = (s) => s.replace(/_(.+?)_/g, '<b class="o">$1</b>').replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

const FONTS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const CSS = FONTS + `
*{box-sizing:border-box;margin:0;padding:0}
:root{--orange:#F0761C;--orange-d:#D9620F;--blue:#1E3A5F;--deep:#000710;--ink:#0F1013}
body{font-family:Inter,system-ui,sans-serif;width:1080px;-webkit-font-smoothing:antialiased}
.s{position:relative;width:1080px;overflow:hidden;display:flex;flex-direction:column;padding:56px 72px}
.dark{background:radial-gradient(900px 700px at 85% 100%,rgba(240,118,28,.28),transparent 60%),radial-gradient(700px 500px at 0% 0%,rgba(30,58,95,.45),transparent 60%),var(--deep);color:#fff}
.light{background:radial-gradient(900px 600px at 90% 105%,rgba(240,118,28,.16),transparent 60%),linear-gradient(180deg,#fff,#EEF0F4);color:var(--ink)}
.hd{display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.95;padding-bottom:22px;border-bottom:1px solid;border-color:rgba(127,127,127,.35)}
.brand{display:flex;align-items:center;gap:12px;font-family:Inter;font-weight:600;font-size:26px;letter-spacing:-.02em;text-transform:none}
.hd small{font-size:12px;opacity:.7;text-align:right;line-height:1.5}
.ft{margin-top:auto;position:relative;z-index:2;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding-top:20px;border-top:1px solid rgba(127,127,127,.35);opacity:.8}
.body{flex:1;display:flex;flex-direction:column;position:relative;padding:56px 0 36px}
h1{font-weight:300;font-size:92px;line-height:1.02;letter-spacing:-.045em}
h1 b{font-weight:800}
h1 b.o{color:var(--orange)}
.light h1 b.o{color:var(--orange-d)}
.sub{margin-top:30px;font-size:34px;font-weight:400;letter-spacing:-.02em;opacity:.8;line-height:1.25}
.sub b{font-weight:600}
.pill{display:inline-flex;align-self:flex-start;margin-top:44px;border:1.5px solid;border-color:currentColor;border-radius:999px;padding:20px 40px;font-size:28px;font-weight:400;letter-spacing:-.01em}
.pill.fill{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600;box-shadow:0 10px 40px rgba(240,118,28,.45)}
.chip{display:inline-block;align-self:flex-start;font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);border:1px solid var(--orange);border-radius:999px;padding:8px 16px;margin-bottom:30px}
.light .chip{color:var(--orange-d);border-color:var(--orange-d)}
.shot{position:absolute;border-radius:22px;box-shadow:0 40px 90px rgba(0,0,0,.45),0 0 0 1px rgba(127,127,127,.25)}
.num{font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.14em;color:var(--orange);margin-bottom:24px}
.big{font-weight:800;font-size:250px;letter-spacing:-.06em;line-height:.9;color:var(--orange)}
.light .big{color:var(--orange-d)}
.dots{display:flex;gap:10px;margin-top:40px}
.dots i{width:46px;height:5px;border-radius:3px;background:currentColor;opacity:.25}
.dots i.on{background:var(--orange);opacity:1}
.orb{position:absolute;border-radius:50%;background:radial-gradient(circle at 30% 28%,#FFB070,#F0761C 45%,#B9480A 100%);box-shadow:0 40px 90px rgba(240,118,28,.45)}
.light .orb{opacity:.95}
`;

function slide(s, i, total) {
  const H = s.h || 1350;
  const counter = total > 1 ? `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'locarion.app';
  const dots = total > 1 ? `<div class="dots">${Array.from({ length: total }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : '';
  let inner = '';
  const head = `${s.chip ? `<div class="chip">${s.chip}</div>` : ''}${s.num ? `<div class="num">${s.num}</div>` : ''}<h1 ${s.fs ? `style="font-size:${s.fs}px"` : ''}>${fmt(s.t)}</h1>${s.sub ? `<div class="sub">${fmt(s.sub)}</div>` : ''}${s.cta ? `<div class="pill ${s.fill ? 'fill' : ''}">${s.cta}</div>` : ''}`;
  if (s.kind === 'shot') {
    inner = `${head}<img class="shot" src="${A(s.img)}" style="${s.pos}">`;
  } else if (s.kind === 'phone') {
    inner = `<div style="max-width:560px">${head}</div><img class="shot" src="${A('celular-escuro.webp')}" style="width:340px;right:70px;bottom:96px;transform:rotate(4deg);border-radius:40px;border:8px solid #15191E">`;
  } else if (s.kind === 'big') {
    inner = `${s.chip ? `<div class="chip">${s.chip}</div>` : ''}<div class="big">${s.big}</div>${head.replace(/<div class="chip">.*?<\/div>/, '')}`;
  } else {
    inner = `<div style="margin-top:${s.mt ?? 60}px">${head}</div>${s.orb ? `<div class="orb" style="${s.orb}"></div>` : ''}`;
  }
  return `<html><head><style>${CSS}</style></head><body><div class="s ${s.theme}" style="height:${H}px">
  <div class="hd"><div class="brand">${MARK}Locarion</div><small>Contratos · Agenda · Estoque<br>Financeiro · Manutenção</small></div>
  <div class="body">${inner}${s.nodots ? '' : dots}</div>
  <div class="ft"><span>Menos papel. Mais locação.</span><span>${counter}</span></div></div></body></html>`;
}

const D = 'dark', L = 'light';
const posts = {
  '01-carrossel-caderno': [
    { theme: D, chip: 'Para donos de locadora', t: 'Sua locadora ainda roda no _caderno_ e no *WhatsApp?*', sub: 'Menos improviso. *Mais controle.*', orb: 'width:420px;height:420px;right:-130px;bottom:60px', mt: 30 },
    { theme: L, num: '01', t: 'Quantas vezes você já alugou o que _não tinha_ no pátio?', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '02', t: 'Contrato digitado *na mão*, de novo.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: L, num: '03', t: 'Devolução esquecida = equipamento parado e _dinheiro perdido._', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '04', t: 'Cobrança: “_quem ainda não pagou?_” e ninguém sabe.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: L, t: 'Existe um jeito *mais simples.*', sub: 'Contrato, agenda, estoque e financeiro num lugar só.', cta: 'Teste grátis por 15 dias', fill: true },
  ],
  '02-pergunta-equipamento': [
    { theme: D, chip: 'Conta pra gente', t: 'Qual equipamento mais _some_ do seu controle?', sub: '*Betoneira*, *andaime*, *escora* ou *martelete?*', cta: 'Responda nos comentários', orb: 'width:380px;height:380px;right:-110px;bottom:140px' },
  ],
  '03-reels-capa': [
    { theme: D, h: 1920, chip: 'Reels', t: 'Um dia na locadora _sem sistema._', sub: 'Tem que ser *assim?*', cta: 'Teste grátis · 15 dias', fill: true, mt: 220, fs: 110, orb: 'width:560px;height:560px;right:-180px;bottom:200px' },
  ],
  '04-agenda': [
    { theme: L, chip: 'Agenda', t: 'O que *sai* hoje.\nO que _volta_ hoje.\nEm *uma tela.*', kind: 'shot', img: 'agenda-preview.png', pos: 'width:1500px;left:72px;bottom:96px;border-radius:22px 0 0 22px', fs: 82 },
  ],
  '05-carrossel-contrato': [
    { theme: D, chip: 'Contratos', t: 'Seu contrato. *Do seu jeito.* _Preenchido sozinho._', mt: 30, orb: 'width:420px;height:420px;right:-130px;bottom:60px' },
    { theme: L, num: '01', t: 'Você usa o *modelo da sua locadora.*', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '02', t: '*Cliente, itens, datas e valores* entram _automáticos._', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: L, num: '03', t: 'A tarifa já sai por período.', sub: '*Diária · Semanal · Quinzenal · Mensal*', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, t: 'Acabou a digitação *repetida.*', cta: 'Teste grátis por 15 dias', fill: true },
  ],
  '06-estoque': [
    { theme: L, chip: 'Estoque por peça', t: 'Andaime e escora por _quantidade._', sub: 'Saldo *livre* x *alugado*, na hora.', kind: 'big', big: '', orb: 'width:420px;height:420px;right:-120px;bottom:100px' },
  ],
  '07-carrossel-financeiro': [
    { theme: D, chip: 'Financeiro', t: 'Financeiro *sem susto.*', sub: 'Quem *pagou.* Quem *vai pagar.* Quem está _atrasado._', mt: 30, orb: 'width:420px;height:420px;right:-130px;bottom:60px' },
    { theme: L, num: '01', t: '*Cliente por cliente.* Sem planilha paralela.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '02', t: 'Atraso vira _alerta_ na tela inicial.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: L, num: '03', t: 'Exporta em *CSV* para o contador.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, t: 'Coloque o atraso *na frente* dos seus olhos.', cta: 'Teste grátis por 15 dias', fill: true },
  ],
  '08-manutencao': [
    { theme: D, chip: 'Manutenção', t: 'Equipamento na oficina *não pode ser alugado* _por engano._', sub: 'Registrou a manutenção, o item sai da lista de disponíveis.', fs: 84, orb: 'width:380px;height:380px;right:-110px;bottom:120px' },
  ],
  '09-reels-capa': [
    { theme: L, h: 1920, chip: 'Ctrl + K', t: 'Achou em _3 segundos._', sub: 'Contrato, cliente ou equipamento, de *qualquer tela.*', mt: 220, fs: 120, orb: 'width:560px;height:560px;right:-180px;bottom:200px' },
  ],
  '10-carrossel-objecoes': [
    { theme: D, chip: 'Perguntas que a gente ouve', t: 'Antes de testar, você *pergunta…*', mt: 30, orb: 'width:420px;height:420px;right:-130px;bottom:60px' },
    { theme: L, num: '“Preciso instalar algo?”', t: '*Não.* Funciona no _navegador_ do computador e do celular.', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '“E meus dados?”', t: 'Cada empresa *só vê* os _próprios dados._', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: L, num: '“Tem fidelidade?”', t: '*Não.* Mensal, sem multa e _sem taxa de implantação._', orb: 'width:300px;height:300px;right:-80px;bottom:80px' },
    { theme: D, num: '“E se eu não gostar?”', t: '*Cancele quando quiser.*', sub: 'Comece com 15 dias grátis, sem cartão.', cta: 'locarion.app', fill: true },
  ],
  '11-preco': [
    { theme: L, chip: 'Plano único', kind: 'big', big: 'R$ 127', t: 'por mês. *Tudo incluso.* Sem _fidelidade._', sub: 'No plano anual: *R$ 1.397* (equivale a R$ 116,42/mês).', fs: 72 },
  ],
  '12-chamada-final': [
    { theme: D, t: '*15 dias* para organizar sua locadora. _De graça._', sub: 'Sem cartão. Entre com sua conta Google.', cta: 'Começar em locarion.app', fill: true, mt: 40, orb: 'width:440px;height:440px;right:-140px;bottom:120px' },
  ],
};
// ajustes visuais específicos
posts['06-estoque'][0] = { theme: L, chip: 'Estoque por peça', t: 'Andaime e escora por _quantidade._', sub: 'Saldo *livre* x *alugado*, na hora.', kind: 'shot', img: 'painel-claro.webp', pos: 'width:1000px;left:72px;bottom:96px;border-radius:22px 0 0 22px', fs: 84 };
posts['08-manutencao'][0] = { theme: D, chip: 'Manutenção', t: 'Equipamento na oficina *não pode ser alugado* _por engano._', kind: 'shot', img: 'painel-escuro.webp', pos: 'width:1000px;left:72px;bottom:96px;border-radius:22px 0 0 22px', fs: 74 };
posts['01-carrossel-caderno'][0] = { theme: D, chip: 'Para donos de locadora', t: 'Sua locadora ainda roda no _caderno_ e no *WhatsApp?*', sub: 'Menos improviso. *Mais controle.*', kind: 'phone', fs: 76 };
posts['11-preco'][0] = { theme: L, chip: 'Plano único', kind: 'big', big: 'R$ 127', t: 'por mês.\n*Tudo incluso.*\n_Sem fidelidade._', sub: 'Plano anual: *R$ 1.397* (R$ 116,42/mês).', fs: 76, cta: 'Teste grátis · 15 dias', fill: true };

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
