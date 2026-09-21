#!/usr/bin/env bash
# Démarrage idempotent de l'environnement Cloud Agent :
#   - démarre le cluster PostgreSQL local,
#   - crée la base + applique les migrations Prisma,
#   - génère un .env de développement local si absent,
#   - crée un compte administrateur de démonstration.
# Les serveurs (API + web) sont lancés séparément via `terminals`.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

PGVER="$(ls /etc/postgresql 2>/dev/null | sort -n | tail -1 || echo 16)"
DB_NAME="gestion_biens"
DB_USER="postgres"
DB_PASS="postgres"

echo "[start] Démarrage du cluster PostgreSQL ${PGVER}/main…"
sudo pg_ctlcluster "${PGVER}" main start 2>/dev/null || true

# Attente que Postgres accepte les connexions.
for i in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "[start] Configuration du rôle et de la base…"
sudo -u postgres psql -tqc "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null
if ! sudo -u postgres psql -tqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" | grep -q 1; then
  sudo -u postgres createdb "${DB_NAME}"
  echo "[start] Base ${DB_NAME} créée."
fi

# Génère un .env de développement local si absent (valeurs locales, pas de secret prod).
if [ ! -f .env ]; then
  echo "[start] Création de .env (développement local)…"
  JWT="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))" 2>/dev/null || echo 'dev-local-cloud-agent-secret-at-least-32-characters-long-0000')"
  cat > .env <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
JWT_SECRET="${JWT}"
PUBLIC_SIGNUP=true
EOF
fi

echo "[start] Application des migrations Prisma…"
npx prisma migrate deploy

echo "[start] Création/mise à jour de l'administrateur de démonstration…"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}" \
  node scripts/bootstrap-admin.mjs || true

echo "[start] Environnement prêt. Lancez les serveurs via les terminaux (api, web)."
