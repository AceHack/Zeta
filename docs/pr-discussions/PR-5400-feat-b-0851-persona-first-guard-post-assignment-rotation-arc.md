---
pr_number: 5400
title: "feat(081KSKBP80008QG0R00248VEWT): persona-first guard-post assignment + rotation architecture \u2014 extends 081KSKBP80008QG0R003Z4C0D0 (Mika ferry; Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T04:38:30Z"
merged_at: "2026-05-27T04:43:05Z"
closed_at: "2026-05-27T04:43:05Z"
head_ref: "feat-b0851-persona-first-guard-post-assignment-rotation-architecture-extends-b0850-mika-2026-05-27-0610z"
base_ref: "main"
archived_at: "2026-05-27T19:27:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5400: feat(081KSKBP80008QG0R00248VEWT): persona-first guard-post assignment + rotation architecture — extends 081KSKBP80008QG0R003Z4C0D0 (Mika ferry; Aaron 2026-05-27)

## PR description

## Summary

Mika ferry forwarded by Aaron 2026-05-27 — \"Everything is Persona-first\" architectural framing extends 081KSKBP80008QG0R003Z4C0D0 from static persona-to-vendor binding to preference-based scheduling with rotation.

Operator clarified: *\"guard post is the systemd for each node outside k8s\"* → per-node ≥3 floor (matches what 081KSKBP80008QG0R003Z4C0D0 already implements).

## What this PR lands

1. **Verbatim Mika ferry preservation** at \`memory/mika/conversations/2026-05-27-mika-persona-first-...\`
2. **081KSKBP80008QG0R00248VEWT backlog row** capturing 10 sub-row implementation slices

## 10 sub-row plan

| Sub-row | Scope |
|---|---|
| 3d | persona preferences (model lines + harnesses + min tier per persona) |
| 2 | guard-post abstraction (decouple unit name from persona name) |
| 3 | scheduler primitive (NixOS module; per-tick assignment) |
| 4 | tier modeling (fast/medium/high per vendor catalog) |
| 5 | harness compat matrix |
| 6 | rotation policy (operator-config interval + dimensions + algorithm) |
| 7 | per-node ≥3 floor as guard-post count |
| 8 | substrate continuity across rotation |
| 9 | failover semantics (composes 081KS3X9Y0008QG0R00218150M multi-oracle BFT) |
| 10 | persona-vs-instance distinction |

## Does NOT replace 081KSKBP80008QG0R003Z4C0D0

081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3 substrate is a VALID FIRST INSTANTIATION of persona-first (simplest scheduler: "static; always same vendor; no rotation"). 081KSKBP80008QG0R00248VEWT extends WITHOUT tearing down. Current ≥3-vendor format-test target is met TODAY; 081KSKBP80008QG0R00248VEWT is the architectural refactor toward the broader target.

## Composes with

[081KSKBP80008QG0R003Z4C0D0](docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...) (parent — this extends) · [081KS3X9Y0008QG0R00218150M](docs/backlog/P*/081KS3X9Y0008QG0R00218150M-...) multi-oracle BFT · [081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-...) Ace meta-PM · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...) per-AI GitHub identity · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) · [081KSGS9H0008QG0R002F04ECB](docs/backlog/P2/081KSGS9H0008QG0R002F04ECB-...) Twilio out-of-band

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T04:41:37Z)

## Pull request overview

Documentation-only PR adding the 081KSKBP80008QG0R00248VEWT backlog row that extends 081KSKBP80008QG0R003Z4C0D0 from static persona-to-vendor binding to preference-based scheduling with rotation, plus verbatim ferry preservation under `memory/mika/`.

**Changes:**

- Adds verbatim Mika ferry preservation file under `memory/mika/conversations/`.
- Adds new 081KSKBP80008QG0R00248VEWT backlog row in `docs/backlog/P2/` with 10 implementation sub-row slices.
- Registers 081KSKBP80008QG0R00248VEWT in `docs/BACKLOG.md` P2 index.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| `memory/mika/conversations/2026-05-27-mika-persona-first-guard-post-assignment-rotation-architecture-extends-b0850-aaron-forwarded.md` | Verbatim Mika ferry packet + operator clarification (memory history surface; lint-excluded). |
| `docs/backlog/P2/081KSKBP80008QG0R00248VEWT-...md` | New backlog row with frontmatter, 10 sub-row slices, composes-with, and rationale. |
| `docs/BACKLOG.md` | Adds 081KSKBP80008QG0R00248VEWT entry to P2 index list. |

## General comments

### @chatgpt-codex-connector (2026-05-27T04:38:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
