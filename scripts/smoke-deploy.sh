#!/usr/bin/env bash
# Post-deploy smoke test: the deployed URL answers 200 with cross-origin isolation headers,
# a CSP, the app shell, and the manifest + service worker. Usage: smoke-deploy.sh <url>
set -euo pipefail

url="${1:?usage: smoke-deploy.sh <url>}"
url="${url%/}"
fail=0

check_header() {
  local name="$1" expected="$2" headers="$3"
  if grep -iq "^${name}: .*${expected}" <<<"$headers"; then
    echo "PASS  ${name}: ${expected}"
  else
    echo "FAIL  ${name} does not contain '${expected}'"
    fail=1
  fi
}

# A fresh deploy can take a few seconds to propagate.
for attempt in 1 2 3 4 5 6; do
  status="$(curl -s -o /dev/null -w '%{http_code}' "$url/" || true)"
  [ "$status" = "200" ] && break
  echo "attempt ${attempt}: got ${status}, retrying"
  sleep 5
done
if [ "$status" = "200" ]; then echo "PASS  GET / -> 200"; else echo "FAIL  GET / -> ${status}"; exit 1; fi

headers="$(curl -sI "$url/" | tr -d '\r')"
check_header "Cross-Origin-Opener-Policy" "same-origin" "$headers"
check_header "Cross-Origin-Embedder-Policy" "require-corp" "$headers"
check_header "Content-Security-Policy" "default-src 'self'" "$headers"

if curl -s "$url/" | grep -q '<div id="root">'; then
  echo "PASS  app shell served"
else
  echo "FAIL  index.html has no #root"
  fail=1
fi

for asset in /manifest.webmanifest /sw.js /engine/stockfish-19-lite.wasm; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${url}${asset}")"
  if [ "$code" = "200" ]; then echo "PASS  ${asset} -> 200"; else echo "FAIL  ${asset} -> ${code}"; fail=1; fi
done

exit "$fail"
