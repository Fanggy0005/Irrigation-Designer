#!/bin/sh
# Installs npm packages into the node_modules volume when package-lock.json changes,
# then runs the given command (the Vite dev server by default).
set -e
cd /app

lock_hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f node_modules/.lock-hash ] || [ "$(cat node_modules/.lock-hash)" != "$lock_hash" ]; then
    echo "[vite] Installing npm packages..."
    npm ci --no-audit --no-fund
    echo "$lock_hash" > node_modules/.lock-hash
fi

exec "$@"
