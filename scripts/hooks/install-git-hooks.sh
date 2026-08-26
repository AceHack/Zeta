#!/usr/bin/env bash
# install-git-hooks.sh — point this clone at the TRACKED hooks directory via
# `core.hooksPath = scripts/hooks` (081KWN0JKJV). Safe to re-run; no-op outside
# a git checkout. Rationale, measurements and the falsifier: scripts/hooks/README.md.
#
# No symlinks: the previous version linked a WORKTREE-LOCAL source into a
# CLONE-GLOBAL destination, so installing from a throwaway worktree left the
# owning clone with a dangling link — and git skips an unexecutable hook
# silently. A relative core.hooksPath resolves per-worktree and cannot dangle.
set -euo pipefail

HOOKS_REL="scripts/hooks"
# Named individually so no hook basename is ever left as a bare token.
HOOK_A="commit-msg"
HOOK_B="pre-push"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "install-git-hooks: git not on PATH — skip"
  exit 0
fi

if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "install-git-hooks: not a git work tree — skip"
  exit 0
fi

# The stored value is resolved relative to the worktree top level, so ask git
# for it rather than trusting $0's parent.
top_level="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"

for hook in "$HOOK_A" "$HOOK_B"; do
  if [ ! -f "$top_level/$HOOKS_REL/$hook" ]; then
    echo "install-git-hooks: missing $top_level/$HOOKS_REL/$hook" >&2
    echo "  Remedy: git -C '$top_level' checkout -- $HOOKS_REL" >&2
    exit 1
  fi
done

# --- Refuse to clobber a foreign core.hooksPath; name the remedy ------------

# Worktree-scoped config SHADOWS the shared value, so a stale per-worktree
# entry would silently win over anything set below.
if [ "$(git -C "$REPO_ROOT" config --get extensions.worktreeConfig || true)" = "true" ]; then
  wt_val="$(git -C "$REPO_ROOT" config --worktree --get core.hooksPath 2>/dev/null || true)"
  if [ -n "$wt_val" ] && [ "$wt_val" != "$HOOKS_REL" ]; then
    echo "install-git-hooks: refused — worktree-local core.hooksPath ('$wt_val') would" >&2
    echo "  shadow the shared setting, leaving this worktree's hooks disarmed." >&2
    echo "  Remedy: git -C '$REPO_ROOT' config --worktree --unset core.hooksPath" >&2
    exit 1
  fi
fi

local_val="$(git -C "$REPO_ROOT" config --local --get core.hooksPath 2>/dev/null || true)"
if [ -n "$local_val" ] && [ "$local_val" != "$HOOKS_REL" ]; then
  echo "install-git-hooks: refused — core.hooksPath is already '$local_val'." >&2
  echo "  Overwriting it would silently disable hooks this clone deliberately uses." >&2
  echo "  Remedy: add Zeta's hooks to '$local_val', or adopt ours with" >&2
  echo "    git -C '$REPO_ROOT' config --local core.hooksPath $HOOKS_REL" >&2
  exit 1
fi

# --- Arm --------------------------------------------------------------------
for hook in "$HOOK_A" "$HOOK_B"; do
  chmod +x "$top_level/$HOOKS_REL/$hook"
done

# --local writes to the SHARED .git/config even from a linked worktree, so this
# arms every worktree of this clone at once.
git -C "$REPO_ROOT" config --local core.hooksPath "$HOOKS_REL"
echo "install-git-hooks: core.hooksPath = $HOOKS_REL (tracked; resolves per-worktree)"

inherited="$(git -C "$REPO_ROOT" config --global --get core.hooksPath 2>/dev/null || true)"
if [ -n "$inherited" ] && [ "$inherited" != "$HOOKS_REL" ]; then
  echo "install-git-hooks: note — global core.hooksPath ('$inherited') is overridden"
  echo "  for this repository only; other repositories are unaffected."
fi

# --- Retire the symlinks the old installer left ------------------------------
# core.hooksPath makes the legacy dir inert, so stale links there only confuse.
# Remove only links this installer provably created (target ends in
# <...>/scripts/hooks/<same name>); anything else is someone else's.
common_dir="$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"
case "$common_dir" in
  /*) ;;
  *) common_dir="$top_level/$common_dir" ;;
esac
legacy_dir="$common_dir/hooks"
[ -d "$legacy_dir" ] || exit 0

for hook in "$HOOK_A" "$HOOK_B"; do
  link="$legacy_dir/$hook"
  [ -L "$link" ] || continue
  case "$(readlink "$link")" in
    */$HOOKS_REL/"$hook")
      rm -f "$link"
      echo "install-git-hooks: removed superseded symlink $link"
      ;;
  esac
done

# Warn about foreign hooks core.hooksPath now bypasses — silence here would be
# the same class of defect this script exists to fix. A DANGLING symlink counts:
# that is exactly the failure being repaired, so -e alone would miss it.
for entry in "$legacy_dir"/*; do
  { [ -e "$entry" ] || [ -L "$entry" ]; } || continue
  [ -d "$entry" ] && continue
  case "$(basename "$entry")" in *.sample) continue ;; esac
  if [ ! -x "$entry" ] && { [ ! -L "$entry" ] || [ -e "$entry" ]; }; then
    continue
  fi
  echo "install-git-hooks: warning — $entry is no longer run" >&2
  echo "  (core.hooksPath bypasses $legacy_dir entirely)." >&2
  echo "  Remedy: move it into $HOOKS_REL/ so it is tracked, or drop it." >&2
done
