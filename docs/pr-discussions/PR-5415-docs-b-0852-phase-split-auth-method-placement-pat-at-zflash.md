---
pr_number: 5415
title: "docs(081KSKBP80008QG0R003AX2A69): phase-split auth-method placement \u2014 PAT at zflash time + interactive at setup time (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:07:54Z"
merged_at: "2026-05-27T07:26:02Z"
closed_at: "2026-05-27T07:26:02Z"
head_ref: "docs/b-0852-zflash-vs-boot-phase-split-auth-method-aaron-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5415: docs(081KSKBP80008QG0R003AX2A69): phase-split auth-method placement — PAT at zflash time + interactive at setup time (Aaron 2026-05-27)

## PR description

## Summary

081KSKBP80008QG0R003AX2A69 row body refinement per operator: *"i think if we do token we should do at zflash time and human interactive at setup time what do you think?"*

Match each auth method to the operator-UX phase that fits it best.

## Phase split

| Phase | Where | Auth methods |
|---|---|---|
| zflash time | Operator Mac | (optional) PAT inject + passphrase-encrypt + ESP write |
| Boot time | Target console | (1) restore-blob default / (2) device-flow / (3) PAT-paste rare / (4) skip |

## Why better than picker-only-at-install-time

- PAT UX: paste at Mac with clipboard (vs typing long PAT at target console)
- Composes with iter-4.2 ESP-write channel (zflash already writes SSH pubkey at flash time)
- First-boot of target reads blob → zero operator interaction at boot
- Re-boot USB = restore blob; no re-auth

## Edge case explicitly named

"Same USB → multiple machines = same PAT" is a feature for fleet-USB workflows + footgun for per-machine isolation. Phase-split makes the trade-off explicit; operator picks model deliberately at flash time.

## What doesn't change

- 081KSKBP80008QG0R003AX2A69.1 crypto module (PR #5411 landed): same `encrypt(plaintext, usbUuid, passphrase)` primitive
- 081KSKBP80008QG0R003AX2A69.5 cred-manifest schema (PR #5414 in flight): same declarative entries; zflash-time write populates `gh-cli`; boot-time can populate the rest if device-flow chosen

Refinement recorded NOW per Aaron 2026-05-27 separation-of-concerns discipline ("recording row exists is critical for deferring work to reliably happen"); implementation defers to next ISO batch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:10:08Z)

## Pull request overview

Refines backlog row **081KSKBP80008QG0R003AX2A69** to document a **phase-split** between flash-time (operator Mac) and boot/setup-time (target console) GitHub authentication, aligning each auth method with the most ergonomic operator-UX phase.

**Changes:**
- Adds a new “Phase-split” section describing flash-time PAT injection (optional) vs boot-time device-flow / PAT fallback / skip.
- Documents the rationale/tradeoffs of the phase split vs a picker-only-at-install-time approach.
- Explicitly calls out the “same USB → multiple machines = same PAT” fleet-vs-isolation edge case and advises surfacing it in prompts.

## Review threads

### Thread 1: docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md:263 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:10:07Z):

P1: The command path here is incorrect: there is no `tools/zflash.ts` in the repo; the zflash wrapper lives at `full-ai-cluster/tools/zflash.ts` (or is typically run via the `zflash` alias from zflash-setup). As written, this instruction will fail for operators following the backlog row verbatim.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:07:57Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
