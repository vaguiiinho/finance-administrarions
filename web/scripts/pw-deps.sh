#!/usr/bin/env bash
# Prepara o Chromium do Playwright sem root (ADR 0002 T1): extrai as libs ausentes com `apt-get download` + `dpkg -x`
# num diretorio fora do repositorio e expoe-o so ao processo do Playwright via LD_LIBRARY_PATH.
#
#   pw-deps.sh install        instala o Chromium e extrai as libs ausentes (idempotente)
#   pw-deps.sh check          falha se `ldd` do Chromium ainda acusar `not found`
#   pw-deps.sh run <cmd...>   executa <cmd> com LD_LIBRARY_PATH apontando para as libs extraidas
set -euo pipefail

PW_DEPS_DIR="${PW_DEPS_DIR:-${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}/finance-pw-deps}"
LIB_PATH="$PW_DEPS_DIR/usr/lib/x86_64-linux-gnu:$PW_DEPS_DIR/lib/x86_64-linux-gnu"
# lib (como o ldd a acusa, sem o caminho) -> pacote; "a|b" usa o primeiro disponivel (Ubuntu 24.04 usa libasound2t64).
# So se extrai o pacote da lib que o ldd acusou (nunca uma lista fixa), para nao sombrear libs ja presentes no sistema.
declare -A LIB_PACKAGES=(
  ["libnss3.so"]="libnss3"
  ["libnssutil3.so"]="libnss3"
  ["libsmime3.so"]="libnss3"
  ["libnspr4.so"]="libnspr4"
  ["libasound.so.2"]="libasound2t64|libasound2"
)

usage() {
  echo "uso: $0 <install|check|run> [comando...]" >&2
  echo "  install        instala o Chromium e extrai as libs ausentes em $PW_DEPS_DIR" >&2
  echo "  check          verifica que o Chromium nao tem dependencias ausentes" >&2
  echo "  run <cmd...>   executa <cmd> com LD_LIBRARY_PATH das libs extraidas" >&2
}

with_lib_path() { export LD_LIBRARY_PATH="$LIB_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"; }

chromium_bin() {
  local base="${PLAYWRIGHT_BROWSERS_PATH:-${HOME:-/tmp}/.cache/ms-playwright}" bin
  for bin in "$base"/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell \
             "$base"/chromium-*/chrome-linux64/chrome; do
    [ -x "$bin" ] && { echo "$bin"; return 0; }
  done
  return 1
}

missing_libs() { ldd "$1" 2>/dev/null | awk '/not found/ {print $1}' | sort -u; }

pick_package() {
  local candidate
  local -a options
  IFS='|' read -ra options <<<"$1"
  for candidate in "${options[@]}"; do
    if apt-cache show "$candidate" >/dev/null 2>&1; then echo "$candidate"; return 0; fi
  done
  echo "${options[0]}"
}

# Pacote que fornece a lib: mapa fixo e, sem entrada, o nome sem sufixo (com variante t64).
package_for_lib() {
  local lib="$1" base
  if [ -n "${LIB_PACKAGES[$lib]:-}" ]; then pick_package "${LIB_PACKAGES[$lib]}"; return 0; fi
  base="$(printf '%s' "$lib" | sed -E 's/\.so.*$//')"
  pick_package "$base|${base}t64"
}

# Baixa e extrai um pacote. O marcador so e criado no sucesso; o diretorio temporario e sempre removido.
extract_package() {
  local pkg="$1"
  if [ -f "$PW_DEPS_DIR/.pkgs/$pkg" ]; then echo "ja extraido: $pkg"; return 0; fi
  (
    tmp="$(mktemp -d)" || exit 1
    trap 'rm -rf "$tmp"' EXIT
    cd "$tmp" || exit 1
    apt-get download "$pkg" || exit 1
    shopt -s nullglob
    debs=("$tmp"/*.deb)
    [ "${#debs[@]}" -gt 0 ] || { echo "nenhum .deb baixado para $pkg" >&2; exit 1; }
    for deb in "${debs[@]}"; do dpkg -x "$deb" "$PW_DEPS_DIR" || exit 1; done
    mkdir -p "$PW_DEPS_DIR/.pkgs" || exit 1
    : >"$PW_DEPS_DIR/.pkgs/$pkg" || exit 1
  )
}

cmd_install() {
  npx playwright install chromium
  mkdir -p "$PW_DEPS_DIR"
  local bin lib pkg pass missing previous=""
  bin="$(chromium_bin)" || { echo "Chromium nao encontrado apos a instalacao" >&2; exit 1; }
  with_lib_path
  # Cada passada extrai so o que o ldd acusa; as extraidas podem expor dependencias transitivas (nova passada).
  for pass in 1 2 3 4 5; do
    missing="$(missing_libs "$bin")"
    if [ -z "$missing" ]; then echo "Nenhuma lib ausente."; return 0; fi
    [ "$missing" != "$previous" ] || break # sem progresso: o `check` reporta o que falta
    previous="$missing"
    for lib in $missing; do
      pkg="$(package_for_lib "$lib")"
      extract_package "$pkg" || echo "falha ao extrair $pkg (lib $lib)" >&2
    done
  done
}

cmd_check() {
  local bin missing
  bin="$(chromium_bin)" || { echo "Chromium nao encontrado; rode install" >&2; exit 1; }
  with_lib_path
  missing="$(missing_libs "$bin")"
  if [ -n "$missing" ]; then
    echo "Bibliotecas ausentes para $bin:" >&2
    echo "$missing" >&2
    exit 1
  fi
  echo "ok: Chromium sem dependencias ausentes"
}

cmd_run() {
  [ "$#" -gt 0 ] || { usage; exit 2; }
  with_lib_path
  exec "$@"
}

case "${1:-}" in
  install) cmd_install ;;
  check) cmd_check ;;
  run) shift; cmd_run "$@" ;;
  *) usage; exit 2 ;;
esac
