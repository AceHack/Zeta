#!/usr/bin/env bash
# install-git-hooks.sh — symlink tracked hooks into this clone's .git/hooks/
# (081KWN0JKJV). Safe to re-run; no-op when not inside a git checkout.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_SRC="$REPO_ROOT/scripts/hooks/commit-msg"

if [ ! -f "$HOOK_SRC" ]; then
  echo "install-git-hooks: missing $HOOK_SRC" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "install-git-hooks: git not on PATH — skip"
  exit 0
fi

if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "install-git-hooks: not a git work tree — skip"
  exit 0
fi

hooks_dir="$(git -C "$REPO_ROOT" rev-parse --git-path hooks)"
# Make absolute when git returns a relative path.
case "$hooks_dir" in
  /*) ;;
  *) hooks_dir="$REPO_ROOT/$hooks_dir" ;;
esac

mkdir -p "$hooks_dir"
chmod +x "$HOOK_SRC"
ln -sfn "$HOOK_SRC" "$hooks_dir/commit-msg"
echo "install-git-hooks: linked $hooks_dir/commit-msg -> $HOOK_SRC"
