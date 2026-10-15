#!/usr/bin/env bash
# Web export used by ops/ux-previews.cjs (same public variables as the beta web; API origin only, the app adds /api).
# Usage (Git Bash, from the repo root): ops/ux-export-web.sh <output-dir>
set -euo pipefail
cd "$(dirname "$0")/../apps/mobile"
MSYS_NO_PATHCONV=1 EXPO_PUBLIC_API_URL=${JUNTO_EXPORT_API:-https://junto.lunalav.pe} EXPO_PUBLIC_WEB_URL=https://junto.lunalav.pe/app/ \
  EXPO_PUBLIC_PRIVACY_URL=https://junto.lunalav.pe/privacidad EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://junto.lunalav.pe/eliminar-cuenta \
  EXPO_PUBLIC_SUPPORT_EMAIL=soporte@lunalav.pe EXPO_PUBLIC_APP_ENV=${JUNTO_EXPORT_ENV:-preview} JUNTO_WEB_BASE_PATH=/app JUNTO_QA_KEYSTORE_PATH= \
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID= npx expo export --platform web --clear --output-dir "$1"
