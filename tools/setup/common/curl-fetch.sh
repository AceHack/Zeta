#!/usr/bin/env bash
#
# tools/setup/common/curl-fetch.sh — sourceable helper for
# fetching URLs with uniform retry behaviour during install.
#
# WHY
# ===
# Human maintainer 2026-04-28: external-infra failures
# (upstream package mirrors returning 5xx, transient curl-22
# / network blips) should be absorbed by retry-with-backoff
# inside the install path, not kicked out to a workflow-rerun
# discipline. Quote: *"curl 502 pattern i mean why should a
# PR ever fail for this? our code does not handle the retries
# already?"*
#
# This file centralises the retry policy so every call site
# uses the same flags. Previously the policy was inlined in
# `tools/setup/common/verifiers.sh` and missing entirely from
# `linux.sh` (mise install), `macos.sh` (Homebrew install),
# and `elan.sh` (Lean toolchain install). Follow-up framing:
# *"sounds like a common helper would help too rather than
# copy/paste."*
#
# TWO FUNCTIONS — file-output vs streamed
# =======================================
# Two helpers are exposed because the safe retry policy
# differs by output mode. Code review on the original single-
# function form flagged the partial-output-replay risk for
# pipe-to-shell call sites:
#
#   curl_fetch        — for file-output downloads
#                       (`-o`/`--output` to disk). Uses
#                       `--retry-all-errors` because curl
#                       restarts the file from scratch on
#                       retry, so partial-output replay
#                       cannot happen.
#
#   curl_fetch_stream — for streamed-to-shell installers
#                       (`curl ... | sh`, `bash -c "$(curl
#                       ...)"`). Uses bare `--retry`
#                       (without `--retry-all-errors`) so
#                       curl will only retry on transient
#                       conditions where nothing has been
#                       written yet — avoiding the risk of
#                       a partial install script being
#                       piped, then the retry's full output
#                       appended on top.
#
# USAGE
# =====
# Source this file, then call the appropriate helper:
#
#     # shellcheck source=/dev/null
#     source "$REPO_ROOT/tools/setup/common/curl-fetch.sh"
#
#     # File output (safe with full retries):
#     curl_fetch --output "$path" "$url"
#
#     # Streamed pipe (must use the stream variant):
#     curl_fetch_stream https://example.com/install.sh | sh
#
#     # Command substitution (capture to var first; see
#     # IDEMPOTENCE / SET-E note below):
#     INSTALLER="$(curl_fetch_stream https://example.com/install.sh)"
#     /bin/bash -c "$INSTALLER"
#
# RETRY POLICY (rationale)
# ========================
#   --retry 5            — five attempts total. Empirically
#                          covers the upstream 5xx blips
#                          this install path has hit.
#   --retry-delay 2      — 2-second base delay between retries.
#   --retry-all-errors   — (file-output only) retry on ALL
#                          transient errors including HTTP
#                          5xx without `Retry-After`. Curl's
#                          default `--retry` only retries
#                          connect / DNS / 408 / 429 / 5xx-
#                          with-Retry-After.
#   -fsSL                — original flags preserved:
#                            -f: fail on HTTP errors
#                            -s: silent (no progress meter)
#                            -S: show errors when silent
#                            -L: follow redirects
#
# COMMAND-SUBSTITUTION + SET-E
# ============================
# Calling `bash -c "$(curl_fetch_stream ...)"` directly will
# silently swallow curl failures under `set -e` because the
# outer `bash -c` succeeds with an empty string. The pattern
# we use everywhere is: capture to a named variable first,
# then exec the variable. That way a curl failure aborts the
# variable assignment, which set -e *does* honour.
#
# IDEMPOTENCE
# ===========
# Re-sourcing this file is a no-op once the functions are
# defined: the guard at the top of the function-definition
# block skips redefinition if `curl_fetch` is already in
# the shell. Safe to source from multiple scripts within
# the same install run.

# Guard: only define once per shell to avoid noise on multi-source.
if ! declare -F curl_fetch >/dev/null 2>&1; then

# File-output variant — safe with --retry-all-errors because
# curl restarts the output file from scratch on each retry.
curl_fetch() {
  curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors "$@"
}

# Streamed variant — bare --retry only, no --retry-all-errors,
# to avoid the partial-output-replay risk on pipe-to-shell or
# command-substitution-into-bash use sites.
curl_fetch_stream() {
  curl -fsSL --retry 5 --retry-delay 2 "$@"
}

fi
