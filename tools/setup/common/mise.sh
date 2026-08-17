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

# DST-boundary resilience (081KSV2WD0008QG0R002A3QJ5Q): GitHub releases / python-build-standalone CDN
# 5xx flakes are outside the deterministic boundary — bounded retries belong here.
# mise defaults to 3 internal HTTP retries (~200ms–15s backoff); too tight for
# multi-minute GitHub outages. CI gate.yml + install_with_retry below add outer
# loops; this raises per-request retries so a single mise install attempt survives
# short bursts without burning an outer attempt. Override via MISE_HTTP_RETRIES.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  export MISE_HTTP_RETRIES="${MISE_HTTP_RETRIES:-8}"
fi

if [ ! -f "$REPO_ROOT/.mise.toml" ]; then
  echo "error: no .mise.toml at repo root"
  exit 1
fi

# Trust before any config read. MISE_TRUSTED_CONFIG_PATHS is exported by install.sh
# (parent shell) so post-mise steps (python-tools, agent-clis) inherit it — exports
# in this child script alone do not propagate upward or sideways.
if ! (cd "$REPO_ROOT" && mise trust --all --yes); then
  echo "error: mise trust --all --yes failed for $REPO_ROOT" >&2
  exit 1
fi

# HOST TIERS (workitem 081KTWQZY7F08QG0R0034KN17T): full-tier hosts also merge
# .mise.full.toml (the k8s set: k3d/kind/kubectl/helm/kubeconform) via MISE_ENV=full.
# Cluster nodes declare full at the zeta-install.sh call site (Aaron 2026-06-12:
# "addison and max and every cluster [node gets] full"); CI k8s lanes declare full
# explicitly; slim/standard hosts skip the set LOUDLY here.
# shellcheck source=tools/setup/common/host-tier.sh disable=SC1091
. "$(cd "$(dirname "$0")" && pwd)/host-tier.sh"
if zeta_tier_allows full; then
  export MISE_ENV=full
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

install_with_retry() {
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    local attempt
    for attempt in 1 2 3 4 5; do
      if "$@"; then
        return 0
      fi
      if [ "$attempt" -eq 5 ]; then
        echo "error: Command '$*' failed after 5 attempts." >&2
        return 1
      fi
      local backoff=10
      case "$attempt" in
        1) backoff=10 ;;
        2) backoff=30 ;;
        3) backoff=60 ;;
        4) backoff=120 ;;
      esac
      echo "Warning: Command '$*' failed (attempt $attempt/5); retrying in ${backoff}s..." >&2
      sleep "$backoff"
    done
  else
    "$@"
  fi
}

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
  (cd "$REPO_ROOT" && install_with_retry env -u GITHUB_TOKEN MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install --yes)
else
  (cd "$REPO_ROOT" && install_with_retry mise install --yes)
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

# The mise Rust backend installs an exact rustup toolchain, but exporting only
# its shim directory does not carry mise's RUSTUP_TOOLCHAIN selection into this
# child shell. Without the exact selection, rustc/rustup may refresh the channel
# manifest before using an already-installed compiler, making an offline cache
# depend on static.rust-lang.org. Pin the resolved mise version for every Rust
# probe below; exact installed toolchains remain usable while the CDN is down.
#
# HALF A GUARD UNTIL 2026-08-16: this selection only helps if an offline copy of
# ~/.rustup/toolchains actually exists, and on CI it did not — no workflow cached
# any rustup path, so every job re-synced the channel and three PRs died on a CDN
# blip (#10903, #10930, #10963). The missing half now lives in the
# `install-v2-*` / `full-verify-v2-*` cache path lists (gate.yml,
# installer-unit-tests.yml). Do not remove those paths without also removing
# this comment's claim: measured 2026-08-16, with them restored and
# static.rust-lang.org blackholed, the then-current
# `ensure-rust-components.sh` printed "component rustfmt is up to date" and
# install.sh completed offline; without them it printed "syncing channel
# updates" and exited 1.
#
# 081M05X126V087G0R0014GR9KQ (2026-08-16) retired that script: `rustfmt`,
# `clippy` and `wasm32-unknown-unknown` are now DECLARED on the rust entry in
# `.mise.toml`, so the `mise install` above provisions them and nothing tops
# them up here. The measurement above is left standing as the cache-path
# guard's stated reason, but note what carries the offline property NOW: mise
# skips an already-installed `rust@<version>` outright. Measured on mise
# 2026.6.14 against an isolated install: the second `mise install rust` returned
# in 0.04s with no output — no rustup invocation and no channel sync at all,
# which is a stronger offline property than the probe-first script it replaces.
# Honest limit: the /etc/hosts blackhole falsifier has NOT been re-run against
# this shape, so the end-to-end CDN-down claim is inherited, not re-measured.
rustup_toolchain="$(cd "$REPO_ROOT" && mise current rust 2>/dev/null || true)"
if [ -n "$rustup_toolchain" ]; then
  export RUSTUP_TOOLCHAIN="$rustup_toolchain"
  echo "✓ rustup exact toolchain selected: $RUSTUP_TOOLCHAIN"
fi

# Print the resolved versions so the log is useful on a first run.
(cd "$REPO_ROOT" && mise current)
