#!/usr/bin/env bash
# Instala o WA-AKG numa VM Ubuntu (ex.: e2-micro do Google Cloud) com HTTPS automático.
# Uso:  sudo bash setup-vm.sh wa.seudominio.com.br seu@email.com
# Antes: o DNS de wa.seudominio.com.br precisa apontar (registro A) para o IP desta VM.
set -euo pipefail

DOMAIN="${1:-}"; ADMIN_EMAIL="${2:-}"
if [ -z "$DOMAIN" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "Uso: sudo bash setup-vm.sh <dominio> <email-do-admin>"; exit 1
fi
[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }

APP_DIR=/opt/wa-akg
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$APP_DIR"

echo "[1/5] Swap de 3 GB (a VM tem pouca memória e o build do Next.js precisa)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 3G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "[2/5] Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "[3/5] Código do WA-AKG"
if [ -d "$APP_DIR/src/.git" ]; then git -C "$APP_DIR/src" pull --ff-only
else git clone --depth 1 https://github.com/mrifqidaffaaditya/WA-AKG.git "$APP_DIR/src"; fi
cp "$HERE/docker-compose.yml" "$HERE/Caddyfile" "$APP_DIR/"

echo "[4/5] Segredos"
if [ ! -f "$APP_DIR/.env" ]; then
  rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  ADMIN_PASSWORD="$(rand 20)"
  cat > "$APP_DIR/.env" <<ENV
WA_DOMAIN=$DOMAIN
DB_PASSWORD=$(rand 32)
AUTH_SECRET=$(rand 48)
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV
  chmod 600 "$APP_DIR/.env"
  echo "  Senha do admin gerada: $ADMIN_PASSWORD  (também está em $APP_DIR/.env)"
else
  echo "  $APP_DIR/.env já existe, mantido."
fi

echo "[5/5] Build e start (o primeiro build demora, 10 a 25 minutos nesta VM)"
cd "$APP_DIR"
docker compose up -d --build

# O Dockerfile do WA-AKG tem um erro de sintaxe ("[ -n \"$X\"]") que impede a criação do admin
# automática; criamos aqui (o comando também promove o usuário se ele já existir).
echo "Criando o usuário admin..."
set -a; . "$APP_DIR/.env"; set +a
for i in $(seq 1 30); do
  if docker compose exec -T app node scripts/setup-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>/dev/null | grep -qi "success\|promoted"; then
    echo "  Admin pronto."; break
  fi
  sleep 10
done
echo
echo "Pronto. Abra https://$DOMAIN (o certificado HTTPS pode levar alguns minutos)."
echo "Logs: cd $APP_DIR && docker compose logs -f app"
