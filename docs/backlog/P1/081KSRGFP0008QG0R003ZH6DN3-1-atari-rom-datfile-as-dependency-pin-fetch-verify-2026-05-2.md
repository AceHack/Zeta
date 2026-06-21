---
id: 081KSRGFP0008QG0R003ZH6DN3
priority: P1
status: open
title: "ROM datfile-as-dependency — pin + fetch + SHA-256 verify + refresh"
created: 2026-05-29
last_updated: 2026-05-29
parent: 081KQ8P5D0008QG0R001590WJ3
depends_on: [081KR2E4K0008QG0R001QZDAMQ]
classification: buildable-now
decomposition: atomic
type: friction-reducer
tags: [roms, atari-2600, tosec, datfile, dep-pin, fetch-verify, otto-247]
---

# 081KSRGFP0008QG0R003ZH6DN3 — ROM datfile-as-dependency

The third slice the parent 081KQ8P5D0008QG0R001590WJ3 acceptance list named but neither closed
sibling covered. 081KR2E4K0008QG0R001QZDAMQ built `canonicalize.ts` (which *consumes*
`--datfile <path>`) and 081KR2E4K0008QG0R001JC6S3N built `split-by-license.ts` + `roms-safe/`.
Neither built the mechanism that *produces* the pinned, verified datfile.

This row operationalizes the parent's **"Datfile-as-dependency"** design
section + the **"Tooling refreshes on TOSEC datfile updates"** acceptance
criterion: pin a datfile version, download it, verify its SHA-256, refresh
on update.

## Pre-start checklist

- [x] Prior-art search: read parent 081KQ8P5D0008QG0R001590WJ3 (algorithm + "Datfile-as-dependency"
  + "Recommended approach"); both children 081KR2E4K0008QG0R001QZDAMQ (closed) + 081KR2E4K0008QG0R001JC6S3N (closed);
  `tools/roms/canonicalize.ts` (`--datfile` consumer) + `split-by-license.ts`;
  grepped `tools/` + `.github/workflows/` for any datfile fetch/pin/refresh
  tooling — none existed.
- [x] Dependency walk: depends on 081KR2E4K0008QG0R001QZDAMQ (the consumer of the fetched datfile,
  already closed). Sibling 081KR2E4K0008QG0R001JC6S3N closed. No other deps.
- [x] Otto-247 / dep-pin: WebSearch'd "TOSEC Atari 2600 datfile latest" —
  latest TOSEC release is **2025-03-13** (no 2026 release as of 2026-05).
  Sources: <https://www.tosecdev.org/news/releases/177-tosec-release-2025-03-13>,
  <https://mail.tosecdev.org/downloads/category/59-2025-03-13>.

## Acceptance criteria

- [x] Structured pin manifest at `tools/roms/manifests/datfiles.json`
  (platform → source/release/datfileName/sourceUrl/downloadUrl/sha256).
- [x] Fetch-and-verify tool at `tools/roms/fetch-datfile.ts`: download the
  pinned datfile, SHA-256-verify against the pin, write to a gitignored
  cache (`roms/.datfiles/`), emit the `canonicalize.ts --datfile` follow-up.
- [x] **Fail-closed** on unverified pins: any `<...>` placeholder
  (`downloadUrl`/`sha256`) is refused (exit 2), never written — per
  `.claude/rules/dep-pin-search-first-authority.md`.
- [x] `--list` surfaces pinned platforms + verification status.
- [x] Tests (`fetch-datfile.test.ts`) for manifest parse, placeholder gate,
  SHA-256 verify, and CLI error paths — no network in tests.
- [x] `atari-2600` pinned to the WebSearch-verified TOSEC 2025-03-13 release,
  with `downloadUrl` + `sha256` as explicit fail-closed placeholders.
- [ ] **Operator action (not code)**: on first network-enabled run, fill the
  verified `downloadUrl` + `sha256` for the atari-2600 datfile in the
  manifest (the tool's refusal message names the exact steps). This is the
  one value that requires a real download to verify and so could not be
  pinned at authoring time.
- [ ] **Optional / deferred**: a scheduled GHA refresh cadence (manual-trigger
  workflow). Out of scope for this slice; the parent marks it "scheduled cron
  optional". File a follow-up if/when a refresh cadence is wanted.

## Why this is the smallest safe slice of 081KQ8P5D0008QG0R001590WJ3

Both decomposed children (081KR2E4K0008QG0R001QZDAMQ, 081KR2E4K0008QG0R001JC6S3N) are closed. The parent's only
genuinely-unbuilt, repo-shippable acceptance criterion was the
datfile-as-dependency mechanism (the "rename all 3461 ROMs" criterion is a
local-data op on gitignored files, and the README cross-ref already landed in
081KR2E4K0008QG0R001JC6S3N). This slice closes that gap with a bounded, tested tool that composes
with the existing `canonicalize.ts --datfile` consumer.

## Composes with

- `tools/roms/canonicalize.ts` (081KR2E4K0008QG0R001QZDAMQ) — consumes the fetched + verified datfile.
- `tools/roms/split-by-license.ts` (081KR2E4K0008QG0R001JC6S3N) — downstream of canonicalization.
- `.claude/rules/dep-pin-search-first-authority.md` — the fail-closed placeholder
  pattern + WebSearch-verified pin discipline.
- `roms/.gitignore` — `roms/.datfiles/` cache is gitignored by the existing
  depth-limited rule (only READMEs tracked).
- Parent 081KQ8P5D0008QG0R001590WJ3 acceptance criterion #6 + "Datfile-as-dependency" design section.
