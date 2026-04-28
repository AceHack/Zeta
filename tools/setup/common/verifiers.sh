#!/usr/bin/env bash
#
# tools/setup/common/verifiers.sh — downloads formal-verifier jars
# (TLC, Alloy) to `tools/tla/` and `tools/alloy/` respectively.
#
# Manifest format: `<target-dir>/<target-file>  <url>` per line,
# comments starting with `#`. Per Aaron's round-29 call we do not
# verify checksums (trust-on-first-use); when upstream provides a
# published SHA256SUMS we may revisit.
#
# This replaces the legacy tools/install-verifiers.sh in the same
# commit (greenfield — no alias per GOVERNANCE.md §24 fallout).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/verifiers"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no verifiers manifest; skipping"
  exit 0
fi

# Assert the JVM is present — TLC + Alloy both need it. The manifest
# has nothing to do unless Java is available.
if ! command -v java >/dev/null 2>&1; then
  echo "error: java not on PATH; install JDK 21 (brew openjdk@21 or apt openjdk-21-jdk)"
  exit 1
fi

grep -vE '^(#|$)' "$MANIFEST" | while IFS= read -r line; do
  target="$(echo "$line" | awk '{print $1}')"
  url="$(echo "$line" | awk '{print $2}')"
  dest="$REPO_ROOT/$target"
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ]; then
    # Trust-on-first-use: if the file exists we assume it's intact.
    # Per Aaron's round-29 call we do not re-verify content.
    echo "✓ $target already present"
  else
    # Download to a .part suffix then atomic-rename. Protects against
    # partial downloads (network flap, Ctrl-C, OOM) becoming
    # permanently trusted by the TOFU check above.
    #
    # Retries: GitHub's release-asset CDN occasionally returns
    # transient 502 / 5xx responses (most recent observed: 2026-04-25
    # ~13:52 UTC, hit PR #481 CodeQL csharp + PR #482 markdownlint
    # CI runs). Per Otto-285 (don't use determinism to avoid
    # edge-case handling — handle the network-non-determinism
    # algorithmically), curl handles the retry: `--retry 5` attempts,
    # exponential backoff (2/4/8/16/32 s default), `--retry-all-errors`
    # so 4xx/5xx server errors retry too (curl's default only retries
    # connect / dns / 408 / 429 / 5xx-with-Retry-After). Keeps
    # `-fsSL` semantics — fail at the end if all 5 attempts hit
    # the same transient.
    echo "↓ downloading $target from $url"
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors \
      -o "$dest.part" "$url"
    mv "$dest.part" "$dest"
    echo "✓ $target"
  fi
done
