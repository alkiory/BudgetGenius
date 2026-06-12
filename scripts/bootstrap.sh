#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "Bootstrapping BudgetGenius workspace..."

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists node; then
  echo "Node.js is required. Please install Node.js (v18+)."
  exit 1
fi

if ! command_exists npm; then
  echo "npm not found. Please install Node.js which includes npm."
  exit 1
fi

if ! command_exists pnpm; then
  echo "pnpm not found. Installing pnpm globally..."
  npm install -g pnpm
fi

echo "Installing workspace dependencies with pnpm..."
pnpm install

copy_if_missing() {
  src="$1"
  dest="$2"
  if [ -f "$dest" ]; then
    echo "Skipping existing $dest"
  else
    if [ -f "$src" ]; then
      cp "$src" "$dest"
      echo "Created $dest from $src"
    else
      echo "Source $src not found, skipping"
    fi
  fi
}

copy_if_missing "apps/api/.env.example" "apps/api/.env.development"
copy_if_missing "apps/webClient/.env.example" "apps/webClient/.env.development"

# Root .env is deliberately NOT created because:
# 1. docker-compose.dev.yml has all values hardcoded (no ${VAR} substitution used)
# 2. docker compose reads .env by default and injects vars into containers AND host shell,
#    which can override your local .env.development values and cause confusing conflicts.
# All env vars are managed through docker-compose.dev.yml and apps/*/.env.development.
if [ -f ".env" ]; then
  echo "⚠️  Root .env exists — it may leak vars into your shell and conflict with local dev."
  echo "   If you run into issues, rename/remove it: mv .env .env.bak"
fi

# Check for stale env vars that could override the .env.development settings
if [ -n "${DB_HOST+x}" ] || [ -n "${REDIS_HOST+x}" ] || [ -n "${DB_PASSWORD+x}" ]; then
  echo "⚠️  Your shell has stale environment variables that will override local settings:"
  [ -n "${DB_HOST+x}" ] && echo "   DB_HOST=$DB_HOST (should be localhost for local dev)"
  [ -n "${REDIS_HOST+x}" ] && echo "   REDIS_HOST=$REDIS_HOST (should be localhost for local dev)"
  echo "   Run the following to clear them:"
  echo '      unset DB_HOST DB_PORT DB_USER DB_PASSWORD DB_PASS DB_NAME DB_URL'
  echo '      unset REDIS_HOST REDIS_PORT REDIS_URL REDIS_PASSWORD'
fi

read -r -p "Use docker-compose for local services (Postgres/Redis)? [Y/n]: " use_docker
use_docker=${use_docker:-Y}

set_env() {
  file="$1"
  key="$2"
  value="$3"
  if [ ! -f "$file" ]; then
    echo "$file not found, skipping env update for $key"
    return
  fi

  if grep -qE "^$key=" "$file"; then
    awk -v k="$key" -v v="$value" -F= 'BEGIN{OFS=FS} $1==k{$2=v;print;next} {print}' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  else
    echo "$key=$value" >> "$file"
  fi
}

if [[ "$use_docker" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  echo "Docker selected. Setting localhost in .env.development (Docker overrides via docker-compose.dev.yml)."
  set_env "apps/webClient/.env.development" "VITE_API_URL" "http://localhost:3000/api"
else
  echo "Configuring env files for local development."
  set_env "apps/webClient/.env.development" "VITE_API_URL" "http://localhost:5000/api"
fi

# Always use localhost for local dev (pnpm dev runs on host).
# Docker containers override via environment: in docker-compose.dev.yml.
set_env "apps/api/.env.development" "DB_HOST" "localhost"
set_env "apps/api/.env.development" "DB_PORT" "5432"
set_env "apps/api/.env.development" "DB_USER" "postgres_admin_dev"
set_env "apps/api/.env.development" "DB_PASS" "dev_password"
set_env "apps/api/.env.development" "DB_NAME" "budgetgenius_dev"
set_env "apps/api/.env.development" "DB_URL" "postgresql://postgres_admin_dev:dev_password@localhost:5432/budgetgenius_dev"
set_env "apps/api/.env.development" "REDIS_HOST" "localhost"
set_env "apps/api/.env.development" "REDIS_PORT" "6379"
set_env "apps/api/.env.development" "NODE_ENV" "development"
set_env "apps/api/.env.development" "PORT" "5000"
set_env "apps/api/.env.development" "FRONTEND_URL" "http://localhost:3001"

# Ensure JWT secret exists
if grep -qE "^JWT_SECRET=" "apps/api/.env.development"; then
  current=$(grep -E "^JWT_SECRET=" "apps/api/.env.development" | cut -d= -f2-)
  if [ -z "$current" ]; then
    if command_exists openssl; then
      secret=$(openssl rand -hex 32)
    else
      secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    fi
    set_env "apps/api/.env.development" "JWT_SECRET" "$secret"
    echo "Generated JWT_SECRET for apps/api/.env.development"
  fi
else
  if command_exists openssl; then
    secret=$(openssl rand -hex 32)
  else
    secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  fi
  set_env "apps/api/.env.development" "JWT_SECRET" "$secret"
  echo "Added JWT_SECRET to apps/api/.env.development"
fi

if [[ "$use_docker" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  if command_exists docker; then
    echo "Starting Docker Compose services (this may take a while)..."
    echo "Using compose files: docker-compose.yml + docker-compose.dev.yml"
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
    echo "Docker Compose started. Database and Redis should be available shortly."
  else
    echo "Docker not found; skipping docker-compose startup. Install Docker to use this option."
  fi
fi

echo
echo "Bootstrap finished."
echo "Next steps:"
echo "- Start the development workspace: pnpm dev"
echo "- To run only the API: cd apps/api && pnpm run start:dev"
echo "- To run only the frontend dev server: cd apps/webClient && pnpm run dev"
echo "- If you used Docker and need to run migrations: cd apps/api && pnpm run migration:run"
echo
echo "If anything failed, check the output above and re-run this script."
