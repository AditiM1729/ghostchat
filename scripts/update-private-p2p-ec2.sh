#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run this script with sudo bash.'; exit 1; }
repo=/home/ubuntu/ghostchat
bundle=/home/ubuntu/ghostchat-matrix
[[ -f "$repo/server/runtime/relay.mjs" && -f "$bundle/relay.compose.yaml" ]] || { echo 'Existing relay installation not found.'; exit 1; }
stage=$(mktemp -d /tmp/ghostchat-p2p-update.XXXXXX)
chmod 700 "$stage"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://ghostchat-rho.vercel.app/ops/relay-f3de629e5ce61b2f.tar.gz -o "$stage/update.tar.gz"
printf '%s  %s\n' 'f3de629e5ce61b2f4b55ad3b0e5c293ec2d9fab7339eb86bff3943382cc9be29' "$stage/update.tar.gz" | sha256sum -c -
mkdir "$stage/unpacked"
tar -xzf "$stage/update.tar.gz" -C "$stage/unpacked" --no-same-owner
for file in relay.mjs GhostPayEscrow.json GhostChatTestTrade.json GhostChatArbitratedTrade.json; do
  [[ -f "$stage/unpacked/$file" && ! -L "$stage/unpacked/$file" ]] || exit 1
done
backup="$repo/server/runtime.before-private-p2p.$(date +%Y%m%d%H%M%S)"
cp -a "$repo/server/runtime" "$backup"
for file in relay.mjs GhostPayEscrow.json GhostChatTestTrade.json GhostChatArbitratedTrade.json; do
  install -m 644 "$stage/unpacked/$file" "$repo/server/runtime/$file"
done
compose=(docker compose --project-directory "$bundle" -f "$bundle/compose.yaml" -f "$bundle/relay.compose.yaml")
"${compose[@]}" config --quiet
if ! "${compose[@]}" up -d --wait --wait-timeout 120 --force-recreate --no-deps ghostchat-api; then
  echo "API update failed. Restoring runtime from $backup"
  cp -a "$backup/." "$repo/server/runtime/"
  "${compose[@]}" up -d --wait --wait-timeout 120 --force-recreate --no-deps ghostchat-api
  exit 1
fi
status=$(curl -sS -D "$stage/headers" -o "$stage/check.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{}' https://ghostchat-matrix-pune.duckdns.org/api/account/p2p-details/read)
grep -qi '^x-ghostchat-private-p2p: 1' "$stage/headers" || { echo 'New private P2P service not detected.'; exit 1; }
[[ "$status" == 401 ]] || { echo "Unexpected private endpoint status: $status. Backup: $backup"; exit 1; }
echo "Private P2P API updated. Unauthenticated access correctly rejected (401). Backup: $backup"
