#!/usr/bin/env bash
#
# The complete local verification suite.
#
# Runs everything: migrations, seed, database parity, the data layer, the
# storefront build from both sources, and the catalog and API tests. Exits
# non-zero if any of it fails.
#
# Local only. Nothing here reaches a network, a domain, or a hosted service.
#
#   ./verify.sh          run everything
#   ./verify.sh --quick  skip the JSON comparison build

set -euo pipefail

cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; OFF=$'\033[0m'
step() { printf '\n%s%s%s\n' "$BOLD" "$1" "$OFF"; }

# PostgreSQL is a local service that does not always survive between sessions.
# Starting it here means the suite is one command, not two.
if ! pg_isready -h 127.0.0.1 -q 2>/dev/null; then
  step "starting PostgreSQL"
  pg_ctlcluster 16 main start 2>&1 | sed 's/^/  /' || true
  for _ in $(seq 1 10); do
    pg_isready -h 127.0.0.1 -q 2>/dev/null && break
    sleep 1
  done
fi
pg_isready -h 127.0.0.1 >/dev/null || { echo "PostgreSQL is not accepting connections"; exit 1; }

step "1. migrations"
node db/migrate.ts | sed 's/^/  /'

step "2. seed the catalog"
node db/seed.ts | tail -20 | sed 's/^/  /'

step "3. seed brand and collection content"
# The full list of unresolved curated handles is long and unchanging; the count
# is what matters on a routine run. `node db/seed-presentation.ts` shows them all.
node db/seed-presentation.ts | sed -n '/seeded/,/^$/p;/curated handle/p' | sed 's/^/  /'

step "4. database matches the catalog record"
node db/verify.ts | tail -3 | sed 's/^/  /'

# The data-layer check inspects the rendered site as well as the database, so
# the site has to be current when it runs. Reading a dist/ left over from an
# earlier build makes that half of the check meaningless.
step "5. storefront build from PostgreSQL"
rm -rf dist
node src/build.ts | sed 's/^/  /'

step "6. data layer, JSON vs PostgreSQL"
node db/verify-data-layer.ts | tail -3 | sed 's/^/  /'

step "7. catalog and management API tests"
node tests/catalog.test.ts | tail -8 | sed 's/^/  /'

step "8. admin dashboard tests"
node tests/admin.test.ts | tail -10 | sed 's/^/  /'

if [[ "${1:-}" != "--quick" ]]; then
  step "9. storefront build from the JSON export, and the difference"
  SNAP="$(mktemp -d)"
  trap 'rm -rf "$SNAP"' EXIT
  # The tests above create and remove products, so the build from step 5 is no
  # longer what the database says. Rebuild both sides for the comparison.
  rm -rf dist
  node src/build.ts >/dev/null
  cp -r dist "$SNAP/pg"
  rm -rf dist
  EARTHTRADE_CATALOG_SOURCE=json node src/build.ts >/dev/null
  cp -r dist "$SNAP/json"
  rm -rf dist
  node src/build.ts >/dev/null

  # diff exits non-zero when files differ, which is the normal case here, so
  # its status is captured rather than allowed to end the script.
  DIFFS="$(diff -rq "$SNAP/json" "$SNAP/pg" 2>/dev/null || true)"
  COUNT="$(printf '%s' "$DIFFS" | grep -c . || true)"
  TOTAL="$(find "$SNAP/pg" -type f | wc -l | tr -d ' ')"

  printf '  %s of %s files differ\n' "$COUNT" "$TOTAL"
  printf '%s' "$DIFFS" | sed "s|.*/json/||;s| and .*||;s|^|    |"
  printf '  %sExpected: 5 product pages where the source CSV names one image twice.%s\n' "$DIM" "$OFF"

  if [[ "$COUNT" != "5" ]]; then
    printf '\n  %sExpected 5 differing files, found %s.%s\n\n' "$BOLD" "$COUNT" "$OFF"
    exit 1
  fi
fi

printf '\n%sall checks passed%s\n\n' "$BOLD" "$OFF"
