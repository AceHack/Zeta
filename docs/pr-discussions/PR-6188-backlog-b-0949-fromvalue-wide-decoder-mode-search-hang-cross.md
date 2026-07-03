---
pr_number: 6188
title: "backlog(081KSV2WD0008QG0R002K85NP0): FromValue wide-decoder mode-search hang \u2014 cross-language hardening (Codex P2 on #6186)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-31T02:54:16Z"
merged_at: "2026-05-31T03:00:19Z"
closed_at: "2026-05-31T03:00:19Z"
head_ref: "otto-cli/b0949-fromvalue-wide-decoder-mode-search-hardening-2026-05-30"
base_ref: "main"
archived_at: "2026-05-31T03:35:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #6188: backlog(081KSV2WD0008QG0R002K85NP0): FromValue wide-decoder mode-search hang — cross-language hardening (Codex P2 on #6186)

## PR description

## 081KSV2WD0008QG0R002K85NP0 — Tri-boolean float `FromValue` wide-decoder mode-search hang (cross-language hardening)

Tracks the **Codex P2** finding on [#6186](https://github.com/Lucent-Financial-Group/Zeta/pull/6186): `FromValue` scans decoder mode `0..2^decoderWidth-1` linearly, so wide decoders (decoderWidth ≥ ~20 → bias ~2³¹) scan **billions of iterations** before finding ordinary values — an effective hang instead of `Result` feedback, for arbitrary public `FloatShape`/`FromTrits` widths.

**Not a parity divergence:** the same linear scan is in F# (`int64`) / C# (`long`) / Rust (`u64`); the 2026-05-30 width-widening made the integer types *consistent*, it didn't create the hang. So the fix must land **identically across all four** (a C#-only point-fix would introduce divergence — backwards for a BFT-parity primitive).

**Fix options** (operator/design decision on policy): (1) analytic mode-window — derive `mode_lo` from `log2(value)`, scan only the ~`valueBits`-wide window, break when `V < 1` (parity-preserving; same results, no hang); (2) cap f64-non-meaningful widths with feedback before the loop (simpler; narrows the contract). Either way + a slice-6 conformance vector exercising a wide-decoder shape.

**P3** — pathological public shapes only; default decoderWidth=3 unaffected; v0 is a design-starter. The companion Copilot P1 (untested past 31 bits of *value* width) was fixed directly in #6186; this row is the separate *decoder*-width hang.

Docs-only (backlog row + index regen). 🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-31T02:56:00Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `de4800fb40`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-31T02:58:09Z)

## Pull request overview

Adds a P3 backlog row tracking the Codex P2 finding from PR #6186: tri-boolean float `FromValue` linearly scans decoder modes `0..2^decoderWidth-1`, which becomes an effective hang for wide decoders (≥~20). The row documents the cross-language scope (TS/F#/C#/Rust must land the same fix) and lists two policy options (analytic mode-window vs. width-cap) plus a slice-6 conformance vector.

**Changes:**

- New backlog row `docs/backlog/P3/081KSV2WD0008QG0R002K85NP0-...md` with frontmatter and full write-up.
- Regenerated `docs/BACKLOG.md` index entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KSV2WD0008QG0R002K85NP0-…2026-05-30.md | New P3 backlog row tracking the wide-decoder mode-search hang. |
| docs/BACKLOG.md | Regenerated index entry for 081KSV2WD0008QG0R002K85NP0. |

### COMMENTED — @chatgpt-codex-connector (2026-05-31T03:00:54Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1052b45928`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/backlog/P3/081KSV2WD0008QG0R002K85NP0-fromvalue-wide-decoder-mode-search-hangs-bound-analytically-or-cap-widths-cross-language-parity-aaron-2026-05-30.md:40 (resolved)

**@chatgpt-codex-connector** (2026-05-31T02:56:00Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct the cross-language FromValue diagnosis**

This backlog item says the same wide-decoder hang is present in all four implementations and that C# is already using `long`, but the inspected code does not match that premise: TypeScript's `fromValue` uses radix-point scaling and returns immediately for `value = 1`, while C# still computes `maxMode`/`bias` with `int` shifts (`var maxMode = (1 << shape.DecoderWidth) - 1`). As written, a future implementer following this row can apply a uniform hang fix and miss the actual TS/C# parity failures around wide decoder widths, so the issue should separate the biased-exponent F#/Rust behavior from the TS radix-point and C# integer-width behavior.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P3/081KSV2WD0008QG0R002K85NP0-fromvalue-wide-decoder-mode-search-hangs-bound-analytically-or-cap-widths-cross-language-parity-aaron-2026-05-30.md:39 (unresolved)

**@chatgpt-codex-connector** (2026-05-31T03:00:54Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Separate C# width overflow from the hang**

Fresh evidence in this version: this row still says C# is a `long`/uniform biased-exponent implementation, but the reviewed tree's `src/Core.CSharp.TriBoolean/FloatOps.cs` still computes `maxMode`, `maxV`, and `bias` with 32-bit `int` shifts (`1 << shape.DecoderWidth`). For decoder widths around 31/32, C# therefore overflows or masks the shift instead of sharing the F#/Rust multi-billion-iteration behavior, so an implementer following this backlog item can fix only the loop hang and leave the actual C# parity failure untracked.

Useful? React with 👍 / 👎.

## General comments

### @AceHack (2026-05-31T02:58:40Z)

Corrected in 1052b4592 — you're right. TS's `fromValue` is radix-point (`V = value·2^mode`): mode 0 = smallest scaling, so a normal value is found immediately at mode 0 and returns — TS does **not** hang. The hang is specific to **biased-exponent** (mode 0 = largest scaling `value·2^bias`, skipped; ordinary values not found until mode ≈ bias), shared by F#/C#/Rust. Reframed the row: title, diagnosis section, fix-scope, and acceptance now say the fix lands across the three biased-exponent impls (+ TS only if/when it adopts biased-exponent canonical), not 'all four' unconditionally.
