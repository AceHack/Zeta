#!/usr/bin/env bash
#
# tools/setup/common/curl-fetch.sh — sourceable helper for
# fetching URLs with uniform retry behaviour during install.
#
# WHY
# ===
# Aaron 2026-04-28: *"curl 502 pattern i mean why should a PR
# ever fail for this? our code does not handle the retries
# already?"* — exactly: external-infra failures (upstream
# package mirrors returning 5xx, transient curl-22 / network
# blips) should be absorbed by retry-with-backoff inside the
# install path, not kicked out to a workflow-rerun discipline.
#
# This file centralises the retry policy so every call site
# uses the same flags. Previously the policy was inlined in
# `tools/setup/common/verifiers.sh` and missing entirely from
# `linux.sh` (mise install), `macos.sh` (Homebrew install),
# and `elan.sh` (Lean toolchain install). Aaron 2026-04-28
# follow-up: *"sounds like a common helper would help too
# rather than copy/paste."*
#
# USAGE
# =====
# Source this file, then call `curl_fetch` with the same
# args you'd pass to curl. The function prepends the retry
# flags transparently:
#
#     # shellcheck source=/dev/null
#     source "$REPO_ROOT/tools/setup/common/curl-fetch.sh"
#     curl_fetch https://mise.run | sh
#     /bin/bash -c "$(curl_fetch https://example.com/install.sh)"
#     curl_fetch --output "$path" "$url"
#
# RETRY POLICY (rationale)
# ========================
#   --retry 5            — five attempts total. Empirically
#                          covers all transient upstream blips
#                          this install path has hit during
#                          2026-04 sessions.
#   --retry-delay 2      — 2-second base delay between retries.
#                          Short enough to not penalise CI when
#                          the retry succeeds; long enough to
#                          let upstream recover from a brief
#                          surge.
#   --retry-all-errors   — retry on ALL transient errors,
#                          including HTTP 4xx that curl
#                          would otherwise pass through.
#                          (Default `--retry` only retries on
#                          select transient errors; setup
#                          installers benefit from the broader
#                          surface.)
#   -fsSL                — original flags preserved:
#                            -f: fail on HTTP errors
#                            -s: silent (no progress meter)
#                            -S: show errors when silent
#                            -L: follow redirects
#
# IDEMPOTENCE
# ===========
# Repeated source of this file overwrites the function body
# (no append, no accumulation). Safe to source from multiple
# scripts within the same install run.

# Guard: only define once per shell to avoid noise on multi-source.
if ! declare -F curl_fetch >/dev/null 2>&1; then

curl_fetch() {
  curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors "$@"
}

fi
