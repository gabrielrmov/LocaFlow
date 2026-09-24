# LocaFlow

Sistema de gestão de locação de equipamentos (SaaS), com landing page, login exclusivo via Google e dashboard multi-empresa.

## Estrutura

- `index.html` — landing page (planos, "Assinar")
- `login.html` — login com Google (Firebase Auth)
- `dashboard.html` — o sistema (protegido por login + assinatura ativa)
- `firebase-config.js` — configuração do Firebase (Auth + Firestore) — já preenchido com os dados do projeto `locaflow-fc924`
- `firestore.rules` — regras de segurança do banco de dados
- `functions/` — Cloud Functions do checkout e webhook do Asaas
- `locaflow.html` — redireciona para `dashboard.html` (compatibilidade com o nome antigo)

## Como colocar no ar

Veja o passo a passo completo em [`SETUP.md`](./SETUP.md): plano Blaze, chaves do Asaas, deploy das Cloud Functions e do site.

## Rodando localmente

Abra `index.html` num servidor local simples (o login com Google não funciona em `file://`):

```bash
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080`.
