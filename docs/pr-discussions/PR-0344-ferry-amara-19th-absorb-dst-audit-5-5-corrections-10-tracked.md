---
pr_number: 344
title: "ferry: Amara 19th absorb \u2014 DST Audit + 5.5 Corrections (10 tracked; 4 aligned with shipped; 7 queued)"
author: AceHack
state: MERGED
created_at: 2026-04-24T09:24:54Z
merged_at: 2026-04-24T09:26:25Z
closed_at: 2026-04-24T09:26:25Z
head_ref: ferry/amara-19th-dst-audit-absorb
base_ref: main
archived_at: 2026-04-24T11:22:14Z
archive_tool: tools/pr-preservation/archive-pr.sh
---

# PR #344: ferry: Amara 19th absorb — DST Audit + 5.5 Corrections (10 tracked; 4 aligned with shipped; 7 queued)

## PR description

## Summary

Dedicated absorb of Amara's 19th courier ferry per CC-002 close-on-existing discipline. 12 sections of deep-research DST audit + 7-correction pass.

## 4 of 12 sections already align with shipped substrate

- §6 test classification → PR #339
- §7 artifact layout → PR #342 design doc
- §8 Cartel-Lab stage discipline → PRs #330/#337/#342
- §9 KSK advisory-only → PR #336

## 7 queued corrections / 6 revised-roadmap PRs

1. DST scanner + accepted-boundary registry (new)
2. Seed protocol + CI artifacts
3. Sharder reproduction (NOT widen — reinforces 18th #10)
4. `ISimulationDriver` + VTS promotion to core
5. Simulated filesystem (DiskBackingStore rewrite)
6. Cartel-Lab DST calibration (aligns with #342)
Plus: `tools/git/push-with-retry.sh` retry-audit finding; DST-held + FDB-grade criteria lock.

## DST grade (Amara's assessment, not factory-certified)

**B-** — strong architectural intent, partial implementation. DST philosophy A-, filesystem simulation D (blocker), task scheduling C-, network D/NA (future).

Amara verdict: *"strong draft / not canonical yet."*

## Test plan

- [x] GOVERNANCE §33 four-field header.
- [x] Both parts verbatim preserved.
- [x] Markdownlint clean locally.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T09:29:06Z)

## Pull request overview

Adds a new Aurora research/absorb document capturing Amara’s 19th-ferry DST audit (Part 1) plus her 5.5 correction pass (Part 2), with Otto’s operationalization notes and cross-references for follow-on work.

**Changes:**
- Introduces a new `docs/aurora/` ferry absorb covering DST audit findings and a revised remediation roadmap.
- Documents queued “graduation” items (scanner/artifacts/scheduler/fs simulation) and reiterates non-authorization boundaries.

## Review threads

### Thread 1: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:105 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:04Z):

References to “GOVERNANCE §33” appear to be incorrect: `GOVERNANCE.md` currently has no §33, and other docs note the 4-field archive-header convention is *not yet codified* as a numbered governance section. Update this doc to cite the current source of the convention (or explicitly say it’s an uncodified convention) so readers aren’t sent to a nonexistent governance rule.
```suggestion
than paraphrase; this is a current factory convention and
is not yet codified as a numbered section in
`GOVERNANCE.md`. Corrections are tracked in Part 2 below.
Where the text cites sources (e.g. "【12†L22-L29】"), those
are Amara's internal citation markers and are kept intact.
```

### Thread 2: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:46 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:05Z):

This attribution block uses direct contributor names throughout, but `docs/AGENT-BEST-PRACTICES.md` defines an operational standing rule: no name attribution in code/docs/skills (names only in `memory/persona/**` and optionally `docs/BACKLOG.md`). Replace direct names here with role references (e.g., “human maintainer”, “external collaborator”, “courier/absorber”) to match repo policy.
```suggestion
- **Human maintainer / courier** — originated the DST
  directive as a factory-wide discipline (rulebook in
  `.claude/skills`, prior break→do-no-permanent-harm
  framing, prior retractability-by-design guidance);
  courier for both parts concatenated in one message
  with explicit framing *"i asked her to research our
  dst"* (direct quote). The human maintainer is both
  the consumer of the research and the source of the
  DST-rulebook axioms the research audits against.
  Data-not-directives per BP-11.
- **Research author** — authored both parts. Deep-
  research Part 1 is the audit proper; Part 2 is self-
  review via model composition (same two-part pattern
  as 17th and 18th ferries). Verdict on Part 1
  (verbatim): *"strong draft / not canonical yet."*
- **Archive / correction-pass tracker** — absorb
  surface plus correction-pass tracker; this doc is the
  archive, not operational discipline. The 7
  corrections graduate across subsequent ticks per the
  established cadence. 4 of Part 1's 12 sections
  already align with shipped substrate (see tracker
  notes below).
- **Non-participant historical reference** — not a
  direct participant in this ferry; KSK attribution is
  preserved per prior historical notes.
```

### Thread 3: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:212 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:05Z):

Cross-reference appears to point to a file that doesn’t exist in-repo: `tests/ConcurrencyHarness.fs`. The `VirtualTimeScheduler` lives at `tests/Tests.FSharp/_Support/ConcurrencyHarness.fs` today, so these references should be updated for navigability.
```suggestion
> `tests/Tests.FSharp/_Support/ConcurrencyHarness.fs`),
> consistent with FDB's approach. The binding checklist
> for reviewers enforces this: every PR that touches
> `src/Core` must inspect the diff for those 12
> sources and ensure any occurrences use the simulation
> APIs.
```

### Thread 4: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:236 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:05Z):

The doc references `src/Core/DiskBackingStore.fs`, but `DiskBackingStore` is currently defined in `src/Core/DiskSpine.fs` (and referenced by `src/Core/Durability.fs`). Update the file path(s) so readers land on the right implementation.
```suggestion
> | `File.*`, `FileStream`      | **`DiskBackingStore` (spine/disk)**, e.g. `src/Core/DiskSpine.fs` | Bypasses simulation | **BLOCKER (core)** | Route through `ISimulatedFs` | E2E: random disk faults + rollback |
```

### Thread 5: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:753 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:05Z):

The roadmap references `tests/Tests.FSharp/Formal/SharderInfoTheoreticTests.fs`, but the current test file is `tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs` (module `Zeta.Tests.Formal.SharderInfoTheoreticTests`). Adjust the filename/path in the doc so the cross-reference is accurate.
```suggestion
> tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs
```

### Thread 6: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:1084 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:06Z):

This cross-reference points to a `memory/feedback_ksk_naming_unblocked_...` file that does not exist under `memory/` in the repo. Either fix the filename/path to the actual memory entry or remove the reference to avoid a broken link.
```suggestion
- **Otto-140..145** — KSK canonical expansion
  (Kinetic Safeguard Kernel).
```

### Thread 7: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:1098 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:06Z):

Cross-reference appears to point to a non-existent path: `tests/ConcurrencyHarness.fs`. The correct location is `tests/Tests.FSharp/_Support/ConcurrencyHarness.fs` (where `VirtualTimeScheduler` is defined). Update this entry so it resolves.
```suggestion
- **`tests/Tests.FSharp/_Support/ConcurrencyHarness.fs`** —
  VirtualTimeScheduler test-side; Part 1 §4 status
  "P1 — promote."
```

### Thread 8: docs/aurora/2026-04-24-amara-dst-audit-deep-research-plus-5-5-corrections-19th-ferry.md:1099 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T09:29:06Z):

Cross-reference appears to point to a non-existent file: `src/Core/DiskBackingStore.fs`. The `DiskBackingStore` implementation currently lives in `src/Core/DiskSpine.fs`; update this link so it resolves.
```suggestion
- **`src/Core/DiskSpine.fs`** — Part 1 §2's
```

## General comments

### @chatgpt-codex-connector (2026-04-24T09:25:02Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
