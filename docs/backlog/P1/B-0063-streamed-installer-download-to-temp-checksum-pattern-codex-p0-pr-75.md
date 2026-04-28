---
id: B-0063
priority: P1
status: open
title: Streamed-installer download-to-temp + checksum-verify pattern — replace pipe-to-shell for upstream installers (Codex P0 on PR #75)
tier: install-path-supply-chain
effort: M
ask: codex P0 review on PR #75 (5 threads on tools/setup/common/curl-fetch.sh, macos.sh, linux.sh, elan.sh) flagging that even bare `curl --retry` can retry after bytes are written to stdout, leaving the shell consumer with partial+full concatenated script content. PR #75 immediate fix: drop --retry from `curl_fetch_stream` entirely. This row tracks the structurally safe replacement.
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0060]
tags: [install-path, supply-chain, upstream-installers, codex-p0, pr-75, streaming-vs-buffered, checksum]
---

# Streamed-installer download-to-temp + checksum-verify pattern

PR #75 landed a `curl_fetch_stream` helper for upstream
installer URLs (`mise.run`, Homebrew install.sh, elan-init.sh)
that originally used bare `curl --retry`. Codex P0 review
correctly identified that **any retry on a streamed-to-shell
pipe is unsafe**: curl can retry after partial bytes have
already been piped to the consumer, and the consumer
(`sh`, `bash -c "$(...)"`) cannot un-receive what it has
read. The retry then concatenates with the partial,
producing corrupted script content that may re-execute
commands or run truncated halves.

The PR #75 immediate fix dropped `--retry` from the stream
variant entirely. Streamed installers now fail-fast on
transient errors; user re-runs `install.sh`. That removes
the unsafe retry behaviour but does **not** add the safety
margin that the file-output variant has via
`--retry-all-errors`.

This row tracks the structurally safe replacement.

## The proper structural fix

For each streamed-installer call site, replace the
`curl_fetch_stream URL | sh` pattern with:

```bash
# 1. Download to a temp file (curl_fetch is safe with retries
#    because the file restarts from scratch on retry).
TEMP="$(mktemp)"
trap 'rm -f "$TEMP"' EXIT
curl_fetch -o "$TEMP" "$URL"

# 2. Verify size + (when upstream publishes one) checksum.
if [ ! -s "$TEMP" ]; then
  echo "error: installer empty after download; refusing to exec" >&2
  exit 1
fi
# (when upstream publishes a SHA256SUMS or .sig:)
EXPECTED_SHA="<pinned>"
# Cross-platform SHA-256: macOS ships `shasum -a 256` (Perl
# script in /usr/bin) but not `sha256sum`; Linux has both;
# `openssl dgst -sha256` works everywhere openssl is
# available. Detect-and-dispatch keeps the install path
# 4-shell-portable per Otto-235.
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA="$(sha256sum "$TEMP" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA="$(shasum -a 256 "$TEMP" | awk '{print $1}')"
else
  ACTUAL_SHA="$(openssl dgst -sha256 "$TEMP" | awk '{print $NF}')"
fi
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "error: installer checksum mismatch; refusing to exec" >&2
  exit 1
fi

# 3. Exec the verified file.
bash "$TEMP"  # or: bash "$TEMP" -- ...args
```

This pattern:

- Gets full retry coverage (file-output variant).
- Buffers the entire installer before exec.
- Allows checksum verification when upstream publishes one.
- Fail-fasts on empty / truncated / corrupted downloads.
- Composes with the existing `curl_fetch` helper without
  introducing new flags.

## Per-call-site work

1. **`tools/setup/macos.sh` Homebrew install.** Currently:
   `HOMEBREW_INSTALLER="$(curl_fetch_stream URL)"; bash -c
   "$HOMEBREW_INSTALLER"`. Convert to download-to-temp +
   exec. Homebrew does NOT publish a SHA256 of install.sh;
   document the size-check-only stance + the upstream
   project as the trust anchor.
2. **`tools/setup/linux.sh` mise install.** Currently:
   `curl_fetch_stream https://mise.run | sh`. Convert.
   mise.run publishes signed releases — investigate
   whether install.sh ships in a verifiable form.
3. **`tools/setup/common/elan.sh` Lean-toolchain install.**
   Currently: `curl_fetch_stream URL | sh -s -- -y
   --default-toolchain none`. Convert. elan-init.sh ships
   from `raw.githubusercontent.com/leanprover/elan/master/`
   — investigate whether tag-pinned versions are available
   (move from `master` to a pinned tag if so).

## Done-criteria

- [ ] All three call sites converted to download-to-temp
      + size-check + exec pattern.
- [ ] For each call site, the upstream's verifiability
      story is documented in the inline comment (signed
      release / SHA256SUMS / project-as-trust-anchor with
      no upstream verification).
- [ ] `tools/setup/common/curl-fetch.sh` doc-comments
      reflect the new pattern; the `curl_fetch_stream`
      function may then be DEPRECATED-WARNING-on-use or
      removed entirely.
- [ ] CI passes on macOS-26, ubuntu-24.04, ubuntu-24.04-arm
      with the new pattern.

## Why P1 (not P0)

The PR #75 fix (`curl_fetch_stream` without `--retry`) closes
the immediate retry-replay hazard. The structural fix here
adds defense-in-depth (checksum verification, size guard,
buffered exec) but the immediate hazard is already gone.
P1 = within 2-3 rounds, not an absolute ship-blocker.

## Composes with

- **PR #75** — the originating thread cluster lives at
  cids 3151434903 / 3151434921 / 3151434929 / 3151434941 /
  3151434956 (now resolved with this row as the concrete
  tracking destination per
  `feedback_bulk_resolve_is_not_answer_recurring_pattern_aaron_2026_04_28.md`).
- **B-0060** — human-lineage / external-anchor backfill
  (the chosen verification mechanisms here should cite
  external prior art / RFCs / vendor docs).
- The original cost-driver memory:
  `feedback_structural_fix_beats_process_discipline_velocity_multiplier_aaron_2026_04_28.md`
  (curl 502 → retry-on-file-output was the structural fix
  that closed the original failure class; this is the
  follow-on hardening that covers the streamed-shell
  pattern that the original fix didn't address).
