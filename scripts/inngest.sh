#!/usr/bin/env bash

set -Eeuo pipefail

INNGEST_CONFIG=".config/inngest/inngest.yaml"

# Try to store Inngest data in Postgres if it's available. Otherwise, put it in SQLite.
if [[ ! -f  "${INNGEST_CONFIG}" ]]; then
    mkdir -p "$(dirname "${INNGEST_CONFIG}")"
    if [[ -n "${DATABASE_URL}" && "${DATABASE_URL}" == postgres* ]]; then
        printf 'postgres-uri: "%s"\n' "${DATABASE_URL}" > "${INNGEST_CONFIG}"
    else
        # Default to sqlite in workspace-local dir for dev
        printf 'sqlite-dir: ".local/share/inngest"\n' > "${INNGEST_CONFIG}"
    fi
fi

# Prefer local project binary
export PATH="$(pwd)/node_modules/.bin:${PATH}"
INNGEST_BIN="$(command -v inngest || true)"
if [[ -z "${INNGEST_BIN}" ]]; then
  echo "Error: 'inngest' CLI not found. Ensure dependencies are installed (npm i) or install globally: npm i -g inngest-cli" >&2
  exit 127
fi

DEV_PORT="${PORT:-5001}"
exec "${INNGEST_BIN}" dev \
  -u "http://localhost:${DEV_PORT}/api/inngest" \
  --host 127.0.0.1 \
  --port 3000 \
  --config "${INNGEST_CONFIG}"
