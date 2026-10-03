#!/usr/bin/env bash
# Zip the repository with its git history for a GitHub Desktop push: no node_modules, build output,
# screenshots, scratch workspaces or secrets. Usage: scripts/bundle.sh [out.zip]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/../nexus-repo.zip}"
rm -f "$out"
(cd "$root/.." && zip -qr "$out" "$(basename "$root")" \
  -x "*/node_modules/*" "*/dist/*" "*/dist-office/*" "*/.wrangler/*" "*/shots/*" "*/.superpowers/*" "*/.env" "*/.env.*" "*/.dev.vars" "*/.git/objects/pack/tmp_*")
if unzip -l "$out" | grep -qE '\.env($| )|\.dev\.vars($| )'; then echo "refusing: .env or .dev.vars found in the bundle"; rm -f "$out"; exit 1; fi
echo "wrote $out ($(du -h "$out" | cut -f1)); .git included: $(unzip -l "$out" | grep -c '/\.git/' ) entries"
