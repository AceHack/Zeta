#!/usr/bin/env bash
#
# Mechanism: from-url — fetch HTTPS URL to a declared destination path.
# Manifest: tools/setup/manifests/from-url
#
# Format per line:
#   <dest>  <url>  [requires=java]  [requires=java,other]
#
# <dest> is repo-root-relative (tools/tla/foo.jar) unless it starts with ~ or /.

set -euo pipefail

# shellcheck source=../common/curl-fetch.sh
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/.." && pwd)/common/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-url"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-url: no manifest; skipping"
  exit 0
fi

resolve_dest () {
  local dest="$1"
  case "$dest" in
    ~/*)
      printf '%s\n' "${dest/#\~/$HOME}" ;;
    /*)    printf '%s\n' "$dest" ;;
    *)     printf '%s\n' "$REPO_ROOT/$dest" ;;
  esac
}

check_requires () {
  local req_list="$1"
  local req
  IFS=',' read -r -a _reqs <<< "$req_list"
  for req in "${_reqs[@]}"; do
    req="$(printf '%s' "$req" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$req" ] && continue
    case "$req" in
      java)
        if ! command -v java >/dev/null 2>&1; then
          echo "error: from-url entry requires java on PATH" >&2
          exit 1
        fi
        ;;
      *)
        echo "warn: unknown requires=$req; skipping check" >&2
        ;;
    esac
  done
}

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$line" ] && continue

  # shellcheck disable=SC2086
  set -- $line
  dest_rel="${1:-}"
  url="${2:-}"
  shift 2 || true
  [ -z "$dest_rel" ] || [ -z "$url" ] && continue

  for tok in "$@"; do
    case "$tok" in
      requires=*) check_requires "${tok#requires=}" ;;
    esac
  done

  dest="$(resolve_dest "$dest_rel")"
  mkdir -p "$(dirname "$dest")"

  if [ -f "$dest" ]; then
    echo "✓ $dest_rel already present"
    continue
  fi

  case "$url" in
    https://*) ;;
    *)
      echo "error: from-url requires HTTPS for $dest_rel ($url)" >&2
      exit 1
      ;;
  esac

  echo "↓ from-url: $dest_rel ← $url"
  attempt=1
  max_attempts=4
  until curl_fetch -o "$dest.part" "$url"; do
    rm -f "$dest.part"
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "error: failed to download $dest_rel after $max_attempts attempts" >&2
      exit 1
    fi
    sleep_s=$(( attempt * 30 ))
    echo "  attempt $attempt/$max_attempts failed; retrying in ${sleep_s}s" >&2
    attempt=$(( attempt + 1 ))
    sleep "$sleep_s"
  done
  mv "$dest.part" "$dest"
  echo "✓ $dest_rel"
done < "$MANIFEST"

echo "✓ from-url complete"
