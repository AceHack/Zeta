#!/usr/bin/env bash
#
# tools/setup/common/mise.sh — trust the repo's .mise.toml and run
# `mise install` to pin dotnet + python to the declared versions.
#
# `.mise.toml` is the single source of truth for language-runtime
# pins. Adding a runtime = editing that file. See
# docs/research/build-machine-setup.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Disable python GitHub artifact attestation checks (CI rate-limit + nixpkgs
# mise 2025.11.x on cluster nodes cannot parse python.github_attestations in
# .mise.toml — v2026.3.18+ only). Env works on all supported mise versions.
export MISE_PYTHON_GITHUB_ATTESTATIONS="${MISE_PYTHON_GITHUB_ATTESTATIONS:-0}"

if [ ! -f "$REPO_ROOT/.mise.toml" ]; then
  echo "error: no .mise.toml at repo root"
  exit 1
fi

# `mise trust` is idempotent and required before `install` will read
# a project-local .mise.toml. Silent on repeat runs.
mise trust "$REPO_ROOT/.mise.toml" >/dev/null

# HOST TIERS (workitem 081KTWQZY7F08QG0R0034KN17T): full-tier hosts also merge
# .mise.full.toml (the k8s set: k3d/kind/kubectl/helm/kubeconform) via MISE_ENV=full.
# Cluster nodes declare full at the zeta-install.sh call site (Aaron 2026-06-12:
# "addison and max and every cluster [node gets] full"); CI k8s lanes declare full
# explicitly; slim/standard hosts skip the set LOUDLY here.
# shellcheck source=tools/setup/common/host-tier.sh disable=SC1091
. "$(cd "$(dirname "$0")" && pwd)/host-tier.sh"
if zeta_tier_allows full; then
  export MISE_ENV=full
  mise trust "$REPO_ROOT/.mise.full.toml" >/dev/null
  echo "↓ mise install (reading .mise.toml + .mise.full.toml — host is full/$ZETA_HOST_TIER_SOURCE)..."
else
  echo "→ .mise.full.toml (k8s set) skipped: requires tier=full, host is $ZETA_HOST_TIER ($ZETA_HOST_TIER_SOURCE)"
  echo "↓ mise install (reading $REPO_ROOT/.mise.toml)..."
fi

# --- CI idempotency guard: stale python minor-version alias dir ---
# Hosted GitHub runner images ship a pre-warmed mise cache in which the
# python *minor* alias path (…/installs/python/3.14) is a REAL directory,
# not a symlink. When `mise install` lays down our pinned patch version
# (python = "3.14.6") it then runs `ln -sf ./3.14.6 …/python/3.14` to
# maintain the minor alias — which fails "File exists (os error 17)"
# because `ln -sf` cannot replace a directory. That aborts the whole
# install step (set -e) BEFORE any lint runs, so every job on the PR goes
# red (observed 2026-06-20 on the `lint (§33 migration xrefs)` job). It is
# a mise/runner-image idempotency violation (discipline #6), not a content
# failure — `apply-N-times` must equal `apply-once`, and the colliding
# alias slot breaks that.
#
# Fix: in CI only, remove a stale NON-SYMLINK python minor-alias dir so
# mise can (re)create it as the symlink it expects. Idempotent — a correct
# symlink (or absent path) is left untouched, and the real patch install
# (3.14.6) is never removed (its name has two dots, so the X.Y filter skips
# it). Scoped to GITHUB_ACTIONS so dev laptops, where a real …/python/3.14
# may be intentional and the collision is unobserved, are never touched.
# REVERT/WIDEN: if the same collision appears on laptops, drop the
# GITHUB_ACTIONS guard. (install.ps1 is unaffected — Windows mise does not
# use POSIX `ln -sf` for the alias.)
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  py_installs="${MISE_DATA_DIR:-$HOME/.local/share/mise}/installs/python"
  if [ -d "$py_installs" ]; then
    for alias_path in "$py_installs"/*; do
      [ -e "$alias_path" ] || continue
      alias_name="$(basename "$alias_path")"
      if [ ! -L "$alias_path" ] && [ -d "$alias_path" ] &&
         printf '%s' "$alias_name" | grep -Eq '^[0-9]+\.[0-9]+$'; then
        echo "↻ removing stale non-symlink python alias dir '$alias_path' (CI idempotency guard; mise recreates it as a symlink)"
        rm -rf "$alias_path"
      fi
    done
  fi
fi

if [ "${GITHUB_ACTIONS:-}" = "true" ] &&
   [ -n "${GITHUB_TOKEN:-}" ] &&
   [ -z "${MISE_GITHUB_TOKEN:-}" ] &&
   [ -z "${GITHUB_API_TOKEN:-}" ]; then
  # CI has only the Actions-default GITHUB_TOKEN. Promote it to
  # MISE_GITHUB_TOKEN — mise's highest-precedence GitHub-auth var
  # (MISE_GITHUB_TOKEN > GITHUB_API_TOKEN > GITHUB_TOKEN; per
  # https://mise.jdx.dev/dev-tools/github-tokens.html) — so mise makes
  # AUTHENTICATED release-metadata calls (1000/hr per-repo) instead of
  # anonymous (60/hr).
  #
  # WHY (2026-05-30): the previous behaviour here was `env -u GITHUB_TOKEN`
  # (drop the token, look up releases anonymously). Under multi-PR load the
  # 60/hr anonymous limit exhausts and every tool-release fetch
  # (semgrep/shellcheck/actionlint/uv) 403s — a recurring flaky CI failure.
  #
  # HISTORY NOTE (honor-those-that-came-before): the anonymous fallback was a
  # deliberate choice to avoid 404s once seen when the *bare* GITHUB_TOKEN was
  # reused for cross-repo release metadata. Routing the token through mise's
  # own MISE_GITHUB_TOKEN auth path (rather than leaking the bare env var) is
  # the supported pattern and reads PUBLIC cross-repo release metadata fine;
  # it trades the worse, recurring 403-rate-limit flake for the standard
  # authenticated path. REVERT/ESCALATION: if cross-repo 404s reappear, set a
  # dedicated fine-grained `MISE_GITHUB_TOKEN` repo secret (still
  # highest-precedence, so this branch becomes a no-op).
  # `env -u GITHUB_TOKEN` removes the bare token from the child env (so no
  # mise plugin / aqua path can read it directly cross-repo — the 404 surface),
  # while MISE_GITHUB_TOKEN (shell-expanded before env runs) carries the value
  # via mise's own auth path. Authenticated AND no bare-token leak.
  (cd "$REPO_ROOT" && env -u GITHUB_TOKEN MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install)
else
  (cd "$REPO_ROOT" && mise install)
fi
echo "✓ mise runtimes installed"

# Put mise shims on PATH for the remainder of this install.sh run
# so downstream scripts (e.g. anything needing python) see the
# mise-managed binaries. `shellenv.sh` (final step) propagates the
# same to subsequent shells and to CI's $GITHUB_PATH.
for shim_dir in \
    "$HOME/.local/share/mise/shims" \
    "/opt/homebrew/opt/mise/shims" \
    "/opt/homebrew/share/mise/shims"; do
  if [ -d "$shim_dir" ]; then
    export PATH="$shim_dir:$PATH"
    echo "✓ mise shims on PATH: $shim_dir"
    break
  fi
done

# Print the resolved versions so the log is useful on a first run.
(cd "$REPO_ROOT" && mise current)
