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
#                       ...)"`). NO --retry. Codex P0 review
#                       on PR #75 confirmed: even bare
#                       `--retry` (without `--retry-all-
#                       errors`) can retry after bytes have
#                       already been written to stdout, and
#                       the consumer cannot un-receive piped
#                       bytes. Streamed installers fail-fast
#                       on transient errors; the user re-runs
#                       install.sh. Proper download-to-temp
#                       hardening tracked as B-0063.
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
# COMMAND-SUBSTITUTION + SET-E (caveat per codex review)
# ======================================================
# bash's `errexit` (`set -e`) is NOT reliably triggered by a
# command substitution that fails without producing output —
# in some bash versions (especially without `inherit_errexit`
# enabled) `VAR="$(failing_cmd)"` leaves `VAR=""` and continues.
# Our macos.sh capture pattern (`HOMEBREW_INSTALLER="$(curl_
# fetch_stream ...)"; /bin/bash -c "$HOMEBREW_INSTALLER"`)
# survives the most common failure mode (curl errors out
# without producing output → empty var → `bash -c ""` runs
# nothing) but it's NOT a defense against partial-byte
# corruption. The proper fix is download-to-temp +
# checksum-verify, tracked as B-0063. The current pattern is
# a small improvement over the prior `bash -c "$(curl ...)"`
# direct form (which silently ran whatever partial output
# survived); it is NOT the structurally safe form.
#
# IDEMPOTENCE
# ===========
# Re-sourcing this file is a no-op once both helpers are
# loaded. The guard uses a file-local sentinel variable
# (`_CURL_FETCH_LOADED`) instead of probing for an
# existing `curl_fetch` function: a function-name probe
# would silently skip BOTH definitions if the caller
# environment already had an unrelated `curl_fetch`
# function, leaving `curl_fetch_stream` undefined and
# breaking the streamed callers (`linux.sh` / `macos.sh`
# / `elan.sh`) at runtime with `curl_fetch_stream:
# command not found`. Sentinel-based guarding ties the
# load decision to "did this file load?" instead of "does
# that name exist?" — collisions in the caller environment
# can no longer accidentally suppress our definitions.

if [[ -z "${_CURL_FETCH_LOADED:-}" ]]; then
_CURL_FETCH_LOADED=1

# File-output variant — safe with --retry-all-errors because
# curl restarts the output file from scratch on each retry.
curl_fetch() {
  curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors "$@"
}

# Streamed variant — NO --retry, NO --retry-all-errors.
#
# Codex P0 review on PR #75 surfaced that even bare `curl
# --retry` (without --retry-all-errors) can still retry after
# bytes have been written to stdout: the connect error happens
# mid-transfer, curl resets the input but the bytes already
# piped into the consumer (`sh`, `bash -c "$(...)"`) cannot be
# un-written. The consumer then sees concatenated partial+full
# script content, which can re-execute commands or run
# truncated halves. There is no curl-flag combination that
# gives both retry-on-transient AND safe-restart-on-streamed-
# stdout — those are mutually exclusive without an
# intermediate buffer.
#
# Therefore this variant ships WITHOUT retries. Streamed
# installer failures (mise.run / Homebrew / elan) bubble up
# as install errors; the user re-runs install.sh.
#
# The proper structural fix — download to a temp file with
# `curl_fetch` (file-output), checksum-verify if available,
# then `bash <tempfile` — is tracked as a backlog item under
# `docs/backlog/P1/B-0063-streamed-installer-download-to-temp-
# pattern-codex-p0-pr-75.md`. Until that lands, this variant
# is fail-fast-no-retry by design.
curl_fetch_stream() {
  curl -fsSL "$@"
}

fi
