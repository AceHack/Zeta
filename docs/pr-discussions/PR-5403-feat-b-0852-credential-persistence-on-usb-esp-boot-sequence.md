---
pr_number: 5403
title: "feat(081KSKBP80008QG0R003AX2A69): credential persistence on USB ESP + boot-sequence auth-method picker \u2014 encrypted blob bound to USB UUID + operator passphrase Phase 1 (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T05:48:08Z"
merged_at: "2026-05-27T06:07:50Z"
closed_at: "2026-05-27T06:07:50Z"
head_ref: "backlog/b-0852-cred-persistence-boot-auth-picker-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:27:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5403: feat(081KSKBP80008QG0R003AX2A69): credential persistence on USB ESP + boot-sequence auth-method picker — encrypted blob bound to USB UUID + operator passphrase Phase 1 (Aaron 2026-05-27)

## PR description

## Summary

- Phase 1 substrate-engineering target authorized by Aaron 2026-05-27 after hitting GitHub login throttle on 3rd USB boot of the day
- Encrypted cred-blob on USB ESP (`/esp/zeta-creds.enc`), key bound to USB UUID + operator passphrase via HKDF + AES-256-GCM
- Boot-sequence picker (`zeta-install.sh` Step 6.9) offers: restore from blob / fresh device-flow login / operator-provided PAT / skip
- Per-AI identity (per 081KSGS9H0008QG0R002T0XQ50) — blob contains per-persona map so otto / lior / vera creds round-trip independently
- Removes gh-login throttle on multi-boot test workflow

## Composes with

- **081KSKBP80008QG0R003Z4C0D0** (parent) — multi-vendor systemd substrate the auth flow serves
- **081KSGS9H0008QG0R003JNSVR5** — interactive-login-vs-baked-in-keys CI test tension; resolves WITHOUT shipping creds in ISO
- **081KSGS9H0008QG0R00120EEHM** — gh-auth-not-respected; addresses gh-auth persistence half
- **081KSGS9H0008QG0R0011BC7T2** — CI cascade 6 full-install + cluster-auto-join; PAT path makes CI scriptable
- **081KSGS9H0008QG0R002T0XQ50** — per-AI GitHub identity; blob is per-persona credential carrier
- **081KSKBP80008QG0R00248VEWT** — persona-first scheduler; chooses which persona's creds to restore
- iter-4.2 ESP SSH pubkey injection (bidirectional ESP-write channel)

## Phase 1 deliberately narrow

- Passphrase + USB UUID binding only (Phase 3 = hardware-bound keys; Phase 5 = cross-cluster federation)
- 8 sub-rows enumerated in row body (081KSKBP80008QG0R003AX2A69.1 through 081KSKBP80008QG0R003AX2A69.8)
- Fresh USB queued for Phase 1 flash + boot validation test

## NCI floor preserved

Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over own credentials absolute. No creds baked into ISO image (preserves 081KSGS9H0008QG0R003JNSVR5 discipline). Encrypted blob is operator-controllable + operator-removable.

## Test plan

- [ ] Backlog index regen verified (BACKLOG.md updated; 081KSKBP80008QG0R003AX2A69 row visible at correct priority slot)
- [ ] Composes_with reciprocity check (081KSGS9H0008QG0R003JNSVR5 + 081KSGS9H0008QG0R00120EEHM + 081KSGS9H0008QG0R0011BC7T2 + 081KSGS9H0008QG0R002T0XQ50 + 081KSKBP80008QG0R00248VEWT should reciprocate when this row is implemented)
- [ ] Phase 1 implementation sub-rows (081KSKBP80008QG0R003AX2A69.1-8) to be filed per row body sub-row plan when implementation work claims the parent row

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T05:50:48Z)

## Pull request overview

Adds a new P1 backlog row (081KSKBP80008QG0R003AX2A69) describing Phase 1 credential persistence on a USB ESP (encrypted blob bound to USB UUID + operator passphrase) and updates the generated backlog index to include the new row.

**Changes:**

- Adds `docs/backlog/P1/081KSKBP80008QG0R003AX2A69-...md` describing the planned USB ESP credential-blob + boot-sequence auth-method picker design and acceptance criteria.
- Updates `docs/BACKLOG.md` to include 081KSKBP80008QG0R003AX2A69 in the P1 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md | New backlog row documenting the Phase 1 credential persistence/auth-method picker plan. |
| docs/BACKLOG.md | Adds the 081KSKBP80008QG0R003AX2A69 entry to the generated backlog index. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:02:11Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T05:50:48Z):

P1 (doc accuracy): This row claims a new `zeta-install.sh` “Step 6.9 (new)” auth-method picker that runs before “Step 6.95b (interactive auth)”, but `full-ai-cluster/usb-nixos-installer/zeta-install.sh` already uses Step 6.9 for iter-5.4.1 self-registration and Step 6.95 for claude-code install/credential persistence. Please update the step numbers/references here to match the current installer step layout (or describe the insertion/renumbering plan explicitly) so implementers don’t collide with the existing Step 6.9 meaning.

### Thread 2: docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:02:10Z):

P0: The design says the picker runs *after* Step 6.8's gh-auth flow completes. If Step 6.8 already calls `gh auth login` (device-flow), then the restore path can't prevent the GitHub login throttle—quota is already consumed before restore is offered. To meet the stated goal (and the acceptance criteria of zero device-flow calls on reboot), the detection/restore decision needs to happen *before* any device-flow login, with Step 6.8 made conditional (only run when the chosen method is fresh login).

### Thread 3: docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:02:11Z):

P1: `depends_on: [081KSKBP80008QG0R003Z4C0D0]` makes this P1 row a hard prerequisite follower of a P2 row. If 081KSKBP80008QG0R003Z4C0D0 is not strictly required to implement Phase 1 (installer + ESP blob), consider moving 081KSKBP80008QG0R003Z4C0D0 to `composes_with` instead. If it is required, it likely needs priority alignment (or the dependency direction reversed) so planning/order in the backlog graph remains consistent.

### Thread 4: docs/backlog/P1/081KSKBP80008QG0R003AX2A69-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:02:11Z):

P1: Step numbering is internally inconsistent: earlier the picker is described as Step 6.81–6.83 (with the menu at 6.82), but this list later calls it “new Step 6.9” (and adds “6.95c”). Please pick one step scheme and align all references in the row so implementers don’t follow the wrong insertion point.

## General comments

### @chatgpt-codex-connector (2026-05-27T05:48:12Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
