#!/usr/bin/env bash
# Set the secret URL token (https://annual-leave.technoir.cloud/m/<token>) without it touching disk or shell history.
# Usage: ./scripts/set-token-key.sh   (generate one with: openssl rand -base64 18 | tr '+/' '-_')
set -euo pipefail
HOST=${HOST:-hoid}
read -rs -p "TOKEN (16+ chars): " KEY; echo
[ ${#KEY} -ge 16 ] || { echo "token too short" >&2; exit 1; }
printf '%s' "$KEY" | ssh "$HOST" "read -r K; docker service update --quiet --env-add TOKEN=\"\$K\" annual-leave"
echo "✓ TOKEN set on annual-leave (the service restarts)"
