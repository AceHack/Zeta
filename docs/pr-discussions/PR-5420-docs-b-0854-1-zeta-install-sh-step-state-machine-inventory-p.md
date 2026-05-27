---
pr_number: 5420
title: "docs(B-0854.1): zeta-install.sh step-state-machine inventory \u2014 Phase 0 substrate for Ace migration trajectory (14 sub-steps; 12 declarative-input categories; substrate-anchor for B-0852/0853/0855/0856 cross-refs)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:34:33Z"
merged_at: "2026-05-27T07:42:24Z"
closed_at: "2026-05-27T07:42:24Z"
head_ref: "docs/b-0854-1-zeta-install-step-state-machine-inventory"
base_ref: "main"
archived_at: "2026-05-27T19:25:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5420: docs(B-0854.1): zeta-install.sh step-state-machine inventory — Phase 0 substrate for Ace migration trajectory (14 sub-steps; 12 declarative-input categories; substrate-anchor for B-0852/0853/0855/0856 cross-refs)

## PR description

## Summary

B-0854 sub-row .1 — Phase 0 substrate for the Ace migration trajectory. Pure analysis; no code change; doesn't touch ISO substrate.

Documents the EXISTING imperative bash state-machine in \`zeta-install.sh\` (1,352 lines on origin/main \`70596a8db\`) so the B-0854 Phase 2 declarative-Ace-manifest schema can express the same surface without losing any step's behavior.

## What's inventoried

| Category | Count | Purpose |
|---|---|---|
| Sub-steps documented | 14 (Steps 1, 2, 3, 4, 5, 6, 6.5, 6.55, 6.6, 6.7, 6.8, 6.9, 6.95, 7) | inputs/outputs/side-effects/failure-modes/declarative-equivalent per step |
| Operator-prompt accumulation | 7 today → 1 passphrase post-B-0852 | informs B-0852 phase-split UX claim |
| Idempotency surface rows | Per-step yes/no/partial | informs B-0855 architectural-fix scope |
| Declarative-input categories | 12 | informs B-0854 Phase 2 manifest schema |
| Files-generated table | 9 files → mapped to B-0852.5 manifest entries | identifies 3 candidate-expansion items |

## Composes with already-landed substrate

- **B-0852** + sub-rows (cred persistence) — PR #5403/#5411/#5414
- **B-0853.1** (cosign signing) — PR #5417 + fix-fwd #5419
- **B-0855** (self-register architectural fix) — PR #5412
- **B-0856** Path A (deferred /tmp coordination) — PR #5413
- **B-0854** parent (Ace migration trajectory) — PR #5405

## Next phases (NOT this row's scope)

- B-0854.2: ship \`package.json\` + \`bunfig.toml\` + \`bun.lock\` stub at Zeta repo root (mirrors \`../scratch\` + \`../SQLSharp\`)
- B-0854.3: Ace manifest schema covering the 12 categories
- B-0854.4: author \`ace.yaml\` (or equivalent) for Zeta at repo root
- B-0854.5: live-USB Ace bootstrap
- B-0854.6: \`ace install zeta\` smoke test against fresh USB
- B-0854.7-8: zeta-install.sh thin-bootstrap reduction → retirement

## Test plan

- [ ] Markdownlint clean
- [ ] Step counts + line refs verifiable against origin/main \`70596a8db\` (anchor commit named in doc)
- [ ] Cross-refs to PR #5403/#5411/#5412/#5413/#5414/#5417/#5419 all resolve

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:38:04Z)

## Pull request overview

This PR adds a Phase 0 documentation substrate for B-0854.1 by inventorying the existing `full-ai-cluster/usb-nixos-installer/zeta-install.sh` step/state-machine so later Ace-manifest work can mirror the current imperative behavior.

**Changes:**
- Introduces a new installer inventory document capturing step inputs/outputs/side-effects/failure modes and proposed declarative equivalents.
- Adds cross-cutting summaries (prompt accumulation, idempotency surface, declarative input categories, generated files mapping).

## Review threads

### Thread 1: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:01Z):

Named attribution ("Per Aaron …") is used in this current-state doc. Repo convention is to use role references (e.g., “the human maintainer”) outside history surfaces so docs stay durable and don’t encode individual names.

### Thread 2: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:02Z):

The referenced `zeta-install.sh` line count is off by one in the current tree (the file is 1,353 lines). Since this doc is used as a snapshot anchor, the count should match the repository content exactly.

### Thread 3: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:28 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:02Z):

Step 1’s “Inputs” command doesn’t match the script. `zeta-install.sh` builds `ALL_DISKS` from `lsblk -d -p -n -o NAME,TYPE,RM,RO,TRAN` plus an awk filter; it does not use the `NAME,SIZE,MODEL,TRAN,ROTA` projection shown here.

### Thread 4: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:80 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:02Z):

Step 6’s `nixos-generate-config` flags don’t match the script. The current implementation runs `sudo nixos-generate-config --root /mnt --force` (no `--no-filesystems`).

### Thread 5: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:129 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:02Z):

Step 6.8 “Outputs” says SSH keys are appended to `/etc/zeta/operator-authorized-keys`, but the installer writes them to the target root at `/mnt/etc/zeta/operator-authorized-keys` during install.

### Thread 6: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:61 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:03Z):

Step 4’s partitioning implementation is documented as `parted`, but the script uses `sgdisk` (including whole-disk longhorn partitions for `DATA_DISKS`). This mismatch makes the inventory harder to verify against the source.

### Thread 7: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:03Z):

Step 6.5 currently describes a `MAGIC_NUMBER` fallback and writing to `/mnt/etc/zeta/operator-authorized-keys`, but `zeta-install.sh` doesn’t define `MAGIC_NUMBER` at all and writes the injected key material to `/mnt/etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.txt` (with `INJECT_OK`/`PUBKEY_FILE` state). The inventory should reflect the real output/paths so later declarative work targets the right surfaces.

### Thread 8: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:169 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:03Z):

Step 7 references `MAGIC_NUMBER` and a “magic-number-fallback”, but the script’s Step 7 banner is driven by `GH_AUTH_OK`, `GH_KEY_COUNT`, `INJECT_OK`, `SELF_REG_OK`, and the presence of `/mnt/etc/zeta/initial-hashedpassword`—there is no `MAGIC_NUMBER` flow in `zeta-install.sh`.

### Thread 9: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:162 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:04Z):

The Step 6.95+ section describes `nixos-install` as occurring after Step 6.95 and gives a line range of 1096–1340, but in `zeta-install.sh` the `sudo nixos-install ...` block is around lines 974–1011 and *precedes* Step 6.95. If this doc is meant to be verifiable against specific line ranges, this step boundary/order needs to be reconciled with the source script.

### Thread 10: docs/installer/zeta-install-step-state-machine-inventory-2026-05-27.md:164 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:38:04Z):

Step 7’s cited line range (1341–1352) doesn’t match the source script: the "Step 7: print initial credentials" banner starts at ~1261 and ends before the log-copy block at 1337. Since line ranges are used as verification anchors, this range should be updated.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:34:39Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
