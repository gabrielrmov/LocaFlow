# WA-AKG numa VM grátis do Google Cloud (e2-micro)

Sobe o [WA-AKG](https://github.com/mrifqidaffaaditya/WA-AKG) com MariaDB e HTTPS automático (Caddy)
para o Locarion enviar os avisos pelo WhatsApp (Avisos → Conectar).

> **Custos:** o e2-micro e 30 GB de disco padrão ficam no nível gratuito do Google Cloud
> (regiões `us-west1`, `us-central1` e `us-east1`). O IP público externo **pode ser cobrado**
> (cerca de US$ 3 por mês); confira em Faturamento. Crie um alerta de orçamento de, por exemplo, R$ 10.
>
> **Risco:** o WA-AKG usa uma biblioteca não oficial do WhatsApp. Envio automático em massa pode
> levar o número a ser banido. Comece com poucos envios e use um número que você possa perder.

## 1. Criar a VM (Cloud Shell)

```bash
gcloud config set project locaflow-fc924
gcloud compute addresses create wa-akg-ip --region=us-central1
gcloud compute instances create wa-akg \
  --zone=us-central1-a --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --address=wa-akg-ip --tags=wa-akg-web
gcloud compute firewall-rules create wa-akg-web --allow=tcp:80,tcp:443 --target-tags=wa-akg-web
gcloud compute addresses describe wa-akg-ip --region=us-central1 --format='value(address)'
```

O último comando mostra o IP da VM.

## 2. Apontar um endereço para o IP

No DNS do domínio (Hostinger → Domínios → DNS), crie um registro **A**: nome `wa`, valor = o IP acima.
O endereço fica `wa.locarion.app`. Espere uns minutos até propagar.

## 3. Instalar na VM

```bash
gcloud compute ssh wa-akg --zone=us-central1-a
git clone https://github.com/gabrielrmov/LocaFlow.git
sudo bash LocaFlow/deploy/wa-akg/setup-vm.sh wa.locarion.app seu@email.com
```

O script cria swap, instala o Docker, gera as senhas, sobe tudo e cria o admin. A senha do admin aparece
no final (e fica em `/opt/wa-akg/.env`, só para root). O primeiro build leva de 10 a 25 minutos.

## 4. Conectar o WhatsApp

1. Abra `https://wa.locarion.app`, entre com o e-mail e a senha do admin.
2. Crie uma sessão (por exemplo `locadora`) e leia o QR code com o WhatsApp do número da empresa.
3. Gere uma chave de API no painel.
4. No Locarion: **Avisos → Conectar**, com `https://wa.locarion.app`, o nome da sessão e a chave.

## Manutenção

```bash
cd /opt/wa-akg
docker compose ps                # estado
docker compose logs -f app       # logs
docker compose restart app       # reiniciar
git -C src pull && docker compose up -d --build   # atualizar o WA-AKG
```
