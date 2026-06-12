#!/bin/sh
# Local-dev only: collapse awilix to a SINGLE instance shared with the host app.
#
# medusa-plugins and the consuming app (leuzma) are separate pnpm installs linked
# with `link:`, so each loads its own awilix. awilix's ROLL_UP_REGISTRATIONS is a
# per-copy Symbol(), so a Medusa DI container built by the app's awilix is unusable
# by plugin code running on its own awilix (workflow createScope() throws
# "parentContainer[ROLL_UP_REGISTRATIONS] is not a function"). Pointing the plugins'
# awilix at the host's copy makes it one instance and the error goes away.
#
# Not needed in production: there the plugins install normally inside the app and
# their @medusajs/framework peer dep already resolves to the host's single copy.
#
# Usage:
#   sh scripts/link-host-awilix.sh                 # link to ../../leuzma
#   sh scripts/link-host-awilix.sh /path/to/app    # link to a specific host app
#   sh scripts/link-host-awilix.sh --revert        # restore the original awilix
#
# Re-run after any `pnpm install` in medusa-plugins (install recreates the store).
set -e

HERE="$(cd "$(dirname "$0")/.." && pwd)"     # medusa-plugins root
REVERT=""
HOST="$HERE/../leuzma"
[ "$1" = "--revert" ] && REVERT=1
[ -n "$1" ] && [ "$1" != "--revert" ] && HOST="$1"

for STORE in "$HERE"/node_modules/.pnpm/awilix@*/node_modules/awilix; do
  [ -e "$STORE" ] || continue
  if [ -n "$REVERT" ]; then
    if [ -L "$STORE" ] && [ -d "$STORE.orig" ]; then
      rm -f "$STORE"; mv "$STORE.orig" "$STORE"
      echo "reverted: $STORE"
    fi
    continue
  fi
  HOST_AWILIX="$(cd "$HOST/node_modules/awilix" 2>/dev/null && pwd -P || true)"
  if [ -z "$HOST_AWILIX" ]; then
    echo "host awilix not found at $HOST/node_modules/awilix" >&2; exit 1
  fi
  if [ -L "$STORE" ]; then
    echo "already linked: $STORE -> $(readlink "$STORE")"
  else
    mv "$STORE" "$STORE.orig"
    ln -s "$HOST_AWILIX" "$STORE"
    echo "linked: $STORE -> $HOST_AWILIX"
  fi
done
echo "done."
