#!/usr/bin/env bash
#
# tools/setup/common/sync-prior-art.sh — clones / refreshes upstream
# reference repos into `references/prior-art/<name>/` per the
# manifest at `references/reference-sources.json`.
#
# Shape borrowed from `../SQLSharp/scripts/reference/
# sync-reference-sources.sh` — that script took Aaron hours to
# perfect; the pattern we copy from it:
#
# - Shallow clones (`--depth 1`) for size + speed.
# - Before any destructive fetch+reset, use `git ls-remote` to
#   check whether local HEAD already matches origin. If it does,
#   skip the refresh entirely (sidesteps the shallow-clone
#   fetch edge cases that cause spurious "refresh failed"
#   noise, since `ls-remote` doesn't need local history).
# - Repoint `origin` if the manifest URL changed.
# - Post-fetch `reset --hard` + `clean -fdx` + `checkout -B`
#   to guarantee the worktree matches `origin/<branch>` byte-
#   for-byte regardless of prior state.
# - `references/prior-art/` is gitignored per `references/
#   README.md`; nothing committed here.
# - Deterministic (bash profile §deterministic rule): each
#   upstream gets exactly one sync attempt; failures exit
#   non-zero, no retry loops.
#
# Usage:
#   tools/setup/common/sync-prior-art.sh
#   tools/setup/common/sync-prior-art.sh --name foo,bar
#   tools/setup/common/sync-prior-art.sh --prune
#
# DEBT: this is a bash script, Unix-only. Per VISION.md "post-
# install automation runtime choice" backlog item, the eventual
# plan is to port post-install automation into a cross-platform
# runtime. Until that research round runs, bash stays.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/references/reference-sources.json"
UPSTREAMS_DIR="$REPO_ROOT/references/prior-art"

if [ ! -f "$MANIFEST" ]; then
  echo "error: manifest not found at $MANIFEST" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq required to parse $MANIFEST" >&2
  echo "  mac:   brew install jq" >&2
  echo "  linux: apt-get install -y jq" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "error: git required" >&2
  exit 1
fi

# Parse args.
NAMES_FILTER=""
PRUNE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --name|--names)
      NAMES_FILTER="$2"
      shift 2
      ;;
    --prune)
      PRUNE=1
      shift
      ;;
    -h|--help)
      sed -n '3,40p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$UPSTREAMS_DIR"

# Read manifest entries into parallel arrays (bash 3.2 compatible,
# per `openspec/specs/repo-automation/profiles/bash.md`).
NAMES=()
URLS=()
BRANCHES=()
PATHS=()
while IFS=$'\t' read -r name url branch path; do
  NAMES+=("$name")
  URLS+=("$url")
  BRANCHES+=("$branch")
  PATHS+=("$path")
done < <(jq -r '.[] | [.name, .url, .branch, .path] | @tsv' "$MANIFEST")

echo "=== Zeta upstream sync ==="
echo "Manifest: $MANIFEST"
echo "Upstreams dir: $UPSTREAMS_DIR"
echo "Manifest entries: ${#NAMES[@]}"
echo

want_name() {
  local candidate="$1"
  if [ -z "$NAMES_FILTER" ]; then
    return 0
  fi
  case ",$NAMES_FILTER," in
    *",$candidate,"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Fetch remote HEAD for a specific branch without needing local
# history. Works even on shallow clones; sidesteps the
# `git fetch --depth=1` + local-history drift class that caused
# spurious "refresh failed" on second runs.
get_remote_head() {
  local target_path="$1"
  local branch="$2"
  local remote_head
  remote_head="$(git -C "$target_path" ls-remote --exit-code --heads origin "$branch" 2>/dev/null | awk 'NR==1 { print $1 }')"
  if [ -z "$remote_head" ]; then
    return 1
  fi
  printf '%s' "$remote_head"
}

# True if the local mirror's HEAD matches origin/<branch>, the
# current branch matches, AND the worktree is clean. Skips the
# destructive refresh entirely when true — faster on re-runs.
reference_mirror_is_current() {
  local target_path="$1"
  local branch="$2"
  local current_branch
  local local_head
  local remote_head
  local worktree_state

  current_branch="$(git -C "$target_path" branch --show-current 2>/dev/null)"
  if [ "$current_branch" != "$branch" ]; then
    return 1
  fi

  local_head="$(git -C "$target_path" rev-parse HEAD 2>/dev/null)"
  if ! remote_head="$(get_remote_head "$target_path" "$branch")"; then
    return 1
  fi
  if [ "$local_head" != "$remote_head" ]; then
    return 1
  fi

  worktree_state="$(git -C "$target_path" status --porcelain=v1 --untracked-files=all --ignored 2>/dev/null)"
  [ -z "$worktree_state" ]
}

# One-upstream sync. Clone if absent; otherwise check currency
# and skip, else destructively refresh from origin/<branch>.
sync_one() {
  local name="$1"
  local url="$2"
  local branch="$3"
  local target_path="$4"
  local current_origin_url
  local requires_refresh=false

  mkdir -p "$(dirname "$target_path")"

  if [ ! -d "$target_path/.git" ]; then
    if [ -e "$target_path" ]; then
      rm -rf "$target_path"
    fi
    echo "↓ cloning $name from $url ($branch)"
    if git clone --depth 1 --branch "$branch" "$url" "$target_path" >/dev/null 2>&1; then
      echo "  ✓ $name at $(git -C "$target_path" rev-parse --short HEAD)"
      return 0
    else
      echo "  ✗ $name clone failed"
      return 1
    fi
  fi

  if current_origin_url="$(git -C "$target_path" remote get-url origin 2>/dev/null)"; then
    if [ "$current_origin_url" != "$url" ]; then
      echo "↻ repointing $name origin to $url"
      git -C "$target_path" remote set-url origin "$url"
      requires_refresh=true
    fi
  else
    git -C "$target_path" remote add origin "$url"
    requires_refresh=true
  fi

  if [ "$requires_refresh" = false ] && reference_mirror_is_current "$target_path" "$branch"; then
    echo "✓ $name already current at origin/$branch"
    return 0
  fi

  echo "↻ refreshing $name ($branch)"
  if git -C "$target_path" fetch --depth 1 origin "$branch" >/dev/null 2>&1 \
     && git -C "$target_path" reset --hard >/dev/null 2>&1 \
     && git -C "$target_path" clean -fdx >/dev/null 2>&1 \
     && git -C "$target_path" checkout -B "$branch" "origin/$branch" >/dev/null 2>&1 \
     && git -C "$target_path" reset --hard "origin/$branch" >/dev/null 2>&1 \
     && git -C "$target_path" clean -fdx >/dev/null 2>&1; then
    echo "  ✓ $name at $(git -C "$target_path" rev-parse --short HEAD)"
    return 0
  fi
  echo "  ✗ $name refresh failed"
  return 1
}

TOTAL=0
OK=0
SKIPPED_FILTER=0
FAILED=0
FAILURES=()

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  url="${URLS[$i]}"
  branch="${BRANCHES[$i]}"
  rel_path="${PATHS[$i]}"
  dest="$REPO_ROOT/$rel_path"

  if ! want_name "$name"; then
    SKIPPED_FILTER=$((SKIPPED_FILTER+1))
    continue
  fi

  TOTAL=$((TOTAL+1))
  if sync_one "$name" "$url" "$branch" "$dest"; then
    OK=$((OK+1))
  else
    FAILED=$((FAILED+1))
    FAILURES+=("$name")
  fi
done

# --prune: remove upstream dirs that are no longer in the manifest.
if [ "$PRUNE" -eq 1 ]; then
  echo
  echo "=== Prune pass ==="
  if [ -d "$UPSTREAMS_DIR" ]; then
    for existing in "$UPSTREAMS_DIR"/*; do
      [ -d "$existing" ] || continue
      existing_name="$(basename "$existing")"
      found=0
      for n in "${NAMES[@]}"; do
        if [ "$n" = "$existing_name" ]; then
          found=1
          break
        fi
      done
      if [ "$found" -eq 0 ]; then
        echo "  ⚠ orphan: $existing_name — removing"
        rm -rf "$existing"
      fi
    done
  fi
fi

echo
echo "=== Summary ==="
echo "Attempted: $TOTAL"
echo "  OK:       $OK"
echo "  Skipped:  $SKIPPED_FILTER (filter)"
echo "  Failed:   $FAILED"

if [ "$FAILED" -gt 0 ]; then
  echo
  echo "Failures:"
  for n in "${FAILURES[@]}"; do
    echo "  - $n"
  done
  exit 1
fi
