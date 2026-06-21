#!/usr/bin/env bash
# Shared when= filter for mechanism manifests.
# Format: when=ubuntu-22.04 or when=ubuntu-22.04,amd64 (comma-separated clauses, all must match).
# Empty / omitted when= matches every host.

when_matches () {
  local spec="${1:-}"
  if [ -z "$spec" ]; then
    return 0
  fi

  local id="" version="" arch=""
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    id="${ID:-}"
    version="${VERSION_ID:-}"
  fi
  if command -v dpkg >/dev/null 2>&1; then
    arch="$(dpkg --print-architecture 2>/dev/null || true)"
  else
    case "$(uname -m)" in
      x86_64|amd64) arch="amd64" ;;
      aarch64|arm64) arch="arm64" ;;
      *) arch="$(uname -m)" ;;
    esac
  fi

  local clause
  IFS=',' read -r -a _clauses <<< "$spec"
  for clause in "${_clauses[@]}"; do
    case "$clause" in
      ubuntu-22.04)
        [ "$id" = "ubuntu" ] && [ "$version" = "22.04" ] || return 1
        ;;
      ubuntu-24.04)
        [ "$id" = "ubuntu" ] && [ "$version" = "24.04" ] || return 1
        ;;
      amd64|arm64)
        [ "$arch" = "$clause" ] || return 1
        ;;
      linux)
        [ "$(uname -s)" = "Linux" ] || return 1
        ;;
      darwin)
        [ "$(uname -s)" = "Darwin" ] || return 1
        ;;
      *)
        echo "warn: unknown when= clause '$clause'; treating as non-match" >&2
        return 1
        ;;
    esac
  done
  return 0
}
