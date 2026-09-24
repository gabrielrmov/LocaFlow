# Locarion — colocando no ar

O sistema tem 3 páginas + Cloud Functions:

- `index.html` — landing page com planos (Profissional e Enterprise)
- `login.html` — login exclusivo com Google
- `dashboard.html` — o sistema em si (só abre para quem está logado **e** com assinatura ativa)
- `functions/` — Cloud Functions que criam o checkout no Asaas e confirmam o pagamento via webhook

Fluxo: `index.html` → clica em "Assinar" → a function `createAsaasCheckout` cria a cobrança no Asaas → cliente paga na página do Asaas → Asaas chama o webhook (`asaasWebhook`) confirmando o pagamento no nosso banco → cliente volta pro `login.html` → entra com Google → a function `confirmSubscription` verifica que o pagamento foi confirmado (nunca confia só na URL) e libera o acesso → `dashboard.html`.

`locaflow.html` (nome antigo) agora só redireciona para `dashboard.html`, pra não quebrar links antigos.

## 1. Criar o projeto Firebase (grátis, ~5 min)

1. Acesse https://console.firebase.google.com e crie um projeto novo.
2. Vá em **Authentication** → **Sign-in method** → ative o provedor **Google**.
3. Vá em **Firestore Database** → **Criar banco de dados** → modo produção → escolha a região (ex: `southamerica-east1`).
4. Em **Configurações do projeto** (ícone de engrenagem) → **Geral** → role até "Seus apps" → clique no ícone `</>` (Web) → registre um app (não precisa de Firebase Hosting agora).
5. Copie o objeto `firebaseConfig` que aparece e cole em `firebase-config.js`, substituindo os valores `COLE_AQUI_...`. Esses valores são públicos (identificam o projeto, não são senhas).
6. Ainda no console, em **Authentication** → **Settings** → **Authorized domains**, adicione o domínio onde o site vai ficar hospedado (localhost já vem liberado para teste).

## 2. Publicar as regras de segurança do Firestore

No console Firebase, vá em **Firestore Database** → **Regras** e cole o conteúdo de `firestore.rules` deste projeto, depois clique em **Publicar**. Isso garante que os dados de uma empresa não aparecem para outra.

## 3. Configurar os planos pagos (Asaas)

O pagamento é feito via **Cloud Functions** (pasta `functions/`), que guardam sua chave do Asaas com segurança no Secret Manager do Firebase — ela nunca fica em nenhum arquivo do projeto.

### 3.1. Colocar o projeto no plano Blaze

As Cloud Functions só funcionam no plano **Blaze** (pago por uso, com uma faixa gratuita generosa — veja o aviso de custo que te passei no chat). No console do Firebase: **Utilização e faturamento** → **Fazer upgrade** → crie ou selecione uma conta de Cloud Billing.

### 3.2. Guardar as chaves do Asaas com segurança

Na pasta do projeto, no seu computador, rode:

```bash
firebase functions:secrets:set ASAAS_API_KEY
```

Cole sua chave de API do Asaas quando for solicitado (Asaas → **Integrações** → **Chaves de API**).

Depois, crie um token qualquer (uma senha longa e aleatória, só você vai saber) pra validar o webhook:

```bash
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
```

### 3.3. Instalar dependências e publicar as functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Ao final, o terminal mostra as URLs públicas das duas functions, algo como:
- `https://southamerica-east1-locaflow-fc924.cloudfunctions.net/createAsaasCheckout`
- `https://southamerica-east1-locaflow-fc924.cloudfunctions.net/asaasWebhook`

### 3.4. Cadastrar o webhook no Asaas

No painel do Asaas: **Integrações** → **Webhooks** → criar novo webhook:
- **URL**: a URL da function `asaasWebhook` (do passo anterior)
- **Token de acesso**: o mesmo valor que você definiu em `ASAAS_WEBHOOK_TOKEN`
- **Eventos**: marque pelo menos `CHECKOUT_PAID`, `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`

### 3.5. Ajustar a URL do site nas functions

Em `functions/index.js`, a constante `SITE_URL` deve apontar pro domínio real onde o `index.html`/`login.html` vão ficar publicados (ex: `https://locaflow-fc924.web.app` ou seu domínio próprio). Depois de mudar, rode `firebase deploy --only functions` de novo.

> Como funciona a segurança: o `index.html` chama `createAsaasCheckout`, que cria um registro temporário no Firestore (`pendingCheckouts`) e devolve o link de pagamento do Asaas. Só quando o Asaas confirma o pagamento pelo webhook (`asaasWebhook`) esse registro passa a `status: "paid"`. No `login.html`, depois do login com Google, a function `confirmSubscription` verifica esse status no servidor antes de liberar `subscriptionStatus: "active"` — ninguém consegue burlar isso só editando a URL.

## 4. Hospedar o site

O jeito mais simples é o Firebase Hosting, já que o `firebase.json` deste projeto já está configurado pra isso:

```bash
firebase deploy --only hosting
```

Isso publica `index.html`, `login.html`, `dashboard.html`, `firebase-config.js` e `locaflow.html` em `https://locaflow-fc924.web.app` (ou no domínio próprio que você configurar em **Hosting** → **Adicionar domínio personalizado**).

Alternativas: Vercel ou Netlify (arraste a pasta no painel deles) ou GitHub Pages — só lembre de manter a constante `SITE_URL` em `functions/index.js` sincronizada com o domínio escolhido.

## 5. Testar

1. Rode `firebase deploy` (hosting + functions) e abra o `index.html` publicado.
2. Clique em "Assinar" num plano → você é redirecionado pra página de pagamento do Asaas.
3. Pague (ou simule, se estiver testando) → o Asaas chama o webhook e confirma o pagamento no Firestore.
4. Você volta pro `login.html` com a mensagem de pagamento recebido.
5. Clique em "Entrar com Google" → a assinatura é confirmada no servidor e o `dashboard.html` abre liberado.
6. Teste o botão de sair (ícone ao lado do seu nome, no rodapé do menu lateral).
7. Pra depurar problemas no checkout ou no webhook, veja os logs em **Firebase Console** → **Functions** → **Registros**.
