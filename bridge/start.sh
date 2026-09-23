#!/usr/bin/env sh
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js не найден. Установите с https://nodejs.org"; exit 1; }
export ZV_LOOP=1
while true; do
  node zvukoryad-bridge.mjs "$@"
  code=$?
  [ "$code" -eq 75 ] || exit $code
  export ZV_RESTARTED=1
done
