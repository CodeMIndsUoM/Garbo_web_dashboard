#!/usr/bin/env bash
# Use Node 20 from .nvmrc when nvm is available, then start dev.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use 2>/dev/null || nvm use 20 2>/dev/null || true
fi

exec node scripts/dev.mjs
