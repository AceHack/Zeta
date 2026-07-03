---
pr_number: 5621
title: "fix(injection-points): KDF chain markdown rendering + work-factor-not-entropy wording (supersedes #5608)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T19:43:12Z"
merged_at: "2026-05-27T19:50:13Z"
closed_at: "2026-05-27T19:50:14Z"
head_ref: "fix/pr-5608-markdown-rendering-entropy-wording-copilot-findings-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T20:03:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5621: fix(injection-points): KDF chain markdown rendering + work-factor-not-entropy wording (supersedes #5608)

## PR description

## Summary

Supersedes [#5608](https://github.com/Lucent-Financial-Group/Zeta/pull/5608). Two valid Copilot findings on that PR addressed by restructuring the KDF documentation away from inline-code-in-table-cell into a sub-section with proper code blocks below the table.

## Findings + fixes

### Finding 1 (line 116) — markdown rendering

**Was**: \`HKDF(USB-UUID \\|\\| operator-passphrase, salt, info)\` inside a table cell with backslash-escaped pipes that render literally in markdown code spans (readers saw \"\\|\\|\" instead of \"||\").

**Fixed**: Table cell simplified to point at a sub-section below. KDF mechanism documented in code blocks (no pipe-escaping issue inline code in table cells has).

### Finding 2 (line 116) — entropy wording misleading

**Was**: \"stretches low-entropy passphrase into high-entropy intermediate\" — implies scrypt increases entropy of weak passphrases.

**Fixed**: Corrected to substrate-honest wording: scrypt does NOT increase entropy of weak passphrases (information-theoretically); it provides tunable **work-factor cost** per guess, making brute-force memory-prohibitively expensive on GPU/ASIC. Per OWASP guidance + the 2026-05-27 security-review HIGH finding rationale documented in \`zeta-creds-crypto.ts\`.

## Why new-branch path (not force-push)

Same as PR #5620 superseding PR #5606: force-push restricted by autonomous-loop discipline; new-branch path is policy-respected alternative.

## Copilot threads on PR #5608 to resolve when closing

- \`PRRT_kwDOSF9kNM6FNUvq\` (line 116, backslash escaping)
- \`PRRT_kwDOSF9kNM6FNUwj\` (line 116, entropy wording)

## Test plan

- [x] Branch guard checked before commit
- [x] Tree-count canary 61 (no corruption)
- [x] KDF mechanism + parameters preserved verbatim from `tools/installer/zeta-creds-crypto.ts:80-125`
- [x] Operator-named threat verbatim preserved (\"we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid\")

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T19:45:23Z)

## Pull request overview

Updates the credential-blob “Encryption” entry in `full-ai-cluster/INJECTION-POINTS.md` to avoid Markdown rendering pitfalls in table inline-code and to describe the intended scrypt → HKDF key-derivation chain using a dedicated subsection.

**Changes:**

- Replaces the table-cell inline KDF expression with a pointer to a new “KDF chain detail” subsection.
- Adds a clearer two-layer derivation description (scrypt work-factor + HKDF USB-UUID binding) with pseudocode blocks.
- Adjusts wording to avoid implying that scrypt “increases entropy” of weak passphrases.

## Review threads

### Thread 1: full-ai-cluster/INJECTION-POINTS.md:124 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:45:22Z):

P1: The reference `tools/installer/zeta-creds-crypto.ts:80-125` is brittle (line numbers drift) and also doesn’t clearly cover where the parameters are defined (constants like `SCRYPT_N`, `SCRYPT_MAXMEM`). Prefer linking to the file + `deriveKey` symbol, or widen the cited range to include the constants block so readers can verify the parameters without hunting.

### Thread 2: full-ai-cluster/INJECTION-POINTS.md:134 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:45:22Z):

P1: The text asserts specific operational costs ("~1-2 seconds" per derivation) and "OWASP 2026 recommended parameters" without an external citation. To keep this doc substrate-honest, either (a) add a concrete reference (exact OWASP document + section/version/link) and clarify hardware-dependence for timing, or (b) remove/soften the timing and "recommended" language to avoid presenting an unverifiable guarantee.

## General comments

### @chatgpt-codex-connector (2026-05-27T19:43:17Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
