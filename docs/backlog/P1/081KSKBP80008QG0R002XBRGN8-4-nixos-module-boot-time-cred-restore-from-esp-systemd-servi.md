---
id: B-0852.4
zetaid: 081KSKBP80008QG0R002XBRGN8
priority: P1
status: open
title: NixOS module — boot-time cred-restore from ESP via systemd service (interactive prompt OR env-injected passphrase); consumes B-0852.2b restore CLI + B-0852.3a picker's blob
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - B-0852.1
  - B-0852.2a
  - B-0852.2b
  - B-0852.5
  - B-0852.10
  - B-0852.3a
composes_with:
  - B-0852.3b
  - B-0855
  - B-0857
tags: [b-0852-sub-row, cred-persistence, nixos-module, systemd, boot-time, esp-restore, interactive-passphrase, env-passphrase, end-to-end-usb-test-gate]
---

## Why this is the gate for end-to-end USB test

The B-0852.3a picker (PR #5450) writes `/esp/zeta-creds.enc` at install
time. That blob just sits there until a boot-time consumer reads it +
restores per-cred files onto the installed system. **This row IS that
consumer.**

Without B-0852.4: operator's USB test cycle gets picker → write-blob,
then reboot → blob ignored. With B-0852.4: operator's USB test exercises
the full persist → restore → use chain on real hardware.

## Operator framing

Composes with operator's 2026-05-27 USB push:

> *"lets keep pushing forward and get cred persistance any anthing else
> we can make it in before i test again"*

The picker (3a) was the bake-in side; this row is the restore side. Both
needed for empirical end-to-end USB validation.

## Substrate-honest scope

NixOS module file (new): `full-ai-cluster/nixos-modules/zeta-creds-restore.nix`

Provides a systemd service `zeta-creds-restore.service` that:

1. **Fires AFTER `multi-user.target` reaches partial-ready BUT BEFORE
   user-facing services that need creds** (e.g., before any agent loop
   starts). Ordering: `Before=zeta-self-register.service` (B-0855),
   `After=local-fs.target`, `Wants=local-fs.target`.

2. **Locates the cred-blob**: `/esp/zeta-creds.enc` (FAT32 ESP from
   Step 6 format). Conditional on `ConditionPathExists=/esp/zeta-creds.enc`
   — service does nothing if blob absent (clean degradation for installs
   without picker bake-in).

3. **Resolves passphrase via two modes (operator picks at module config)**:
   - **Mode A — interactive prompt**: systemd-ask-password (TTY prompt
     on `tty1` at first boot; operator types passphrase; suitable for
     first-boot homelab/open-claw scope per B-0857 Turn 5 spectrum)
   - **Mode B — env-injected**: read from `/run/zeta-creds-passphrase`
     (operator-prepared file with 0600 mode + zeta:root; suitable for
     non-interactive automated installs; deleted post-restore by service
     ExecStopPost)

4. **Invokes restore CLI** (B-0852.2b PR #5425) as the zeta user:
   ```bash
   sudo -u zeta bun /home/zeta/Zeta/tools/installer/zeta-creds-restore.ts \
     --usb-uuid "$(cat /etc/zeta/usb-uuid)" \
     --input /esp/zeta-creds.enc \
     --passphrase-file /run/zeta-creds-passphrase \
     --target-root /
   ```
   (Optionally `--persona <name>` if per-persona scope is required by
   the installed system's persona configuration.)

5. **Failure handling**: required-cred restore failure surfaces in
   `journalctl -u zeta-creds-restore` AND blocks `zeta-self-register.service`
   (operator must investigate before cluster join completes). Optional-cred
   failures warn-and-continue per `.claude/rules/non-coercion-invariant.md`
   HC-8.

## Sub-rows

- **B-0852.4a** — Nix module file + systemd unit (declarative substrate)
- **B-0852.4b** — Mode A (interactive systemd-ask-password integration)
- **B-0852.4c** — Mode B (file-based passphrase + auto-cleanup)
- **B-0852.4d** — Wiring into the cluster-node NixOS config (`full-ai-cluster/nixos-modules/common.nix` import + enable)
- **B-0852.4e** — Empirical USB end-to-end test: flash USB → install with picker → reboot → verify restore populated `~/.config/{gh,claude}` etc + journalctl clean

Order: 4a → 4c (env-injected first; simpler than interactive prompt) → 4d (wire in) → 4e (USB test) → 4b (interactive last; nicer UX but not blocking USB test if 4c works)

## Composes with substrate

- **B-0852.1** crypto (PR #5413) — decrypt at boot
- **B-0852.2a** envelope (PR #5421) — parse blob
- **B-0852.2b** restore CLI (PR #5425) — the actual binary this service wraps
- **B-0852.3a** picker (PR #5450 pending merge) — produces the blob this row consumes
- **B-0852.5** manifest — drives per-cred path restoration
- **B-0852.10** handlers — value-source resolution at restore time
- **B-0855** self-register architectural fix — fires AFTER cred-restore; ordering enforced via systemd Before/After
- **B-0857** install.sh universal entry — composes at install-time; this row is the boot-time companion
- **B-0833** installer interactive-login — deferred-creds branch (operator declined bake at picker) still go through B-0833 device-flow at first user login

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: NixOS boot-time cred-restore service

Searched:

- `docs/backlog/` — B-0852.* family; no existing row covers boot-time restore module
- `full-ai-cluster/nixos-modules/` — no zeta-creds-restore.nix yet; common.nix imports list checked
- `tools/installer/` — restore CLI ready (zeta-creds-restore.ts, PR #5425)
- `memory/` — no prior memory on boot-time restore module specifically
- `.claude/rules/` — agent-worktree-hygiene + non-coercion-invariant apply

Conclusion: no existing row; this row fills the gap; composes with all upstream sub-rows merged + the just-armed B-0852.3a picker.

## Why P1

- Gates operator's empirical end-to-end USB test (no restore = blob written but never used)
- All upstream substrate merged (5413/5414/5418/5421/5425) + picker armed (5450)
- Operator-named USB push: "anything else we can make it in before i test again" — this is the next anything
- Bounded scope (M effort): single Nix module + systemd unit + config wiring + USB test

## What this is NOT

- NOT a replacement for B-0833 device-flow (composes; declined creds at picker go to device-flow at user login)
- NOT a replacement for B-0852.3b zflash CLI override (those are install-time flags; this is boot-time consumer)
- NOT a hardware-token-only path (Mode B file-passphrase works for automated/CI scope; Mode A interactive for operator-driven boot)
- NOT a Rule 0 violation (Nix module is declarative .nix; systemd unit is Nix-generated; the restore CLI it wraps is .ts; the install-graph carve-out preserved)

## Heartbeat per CLAUDE.md "Heartbeat-via-commit" discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` condition #3 ("file a candidate B-NNNN"). The picker PR #5450 is the named bounded-wait dependency; while build-iso runs, decomposing the NEXT substrate gate IS the substrate-honest forward motion the operator's USB-push direction calls for.

## Full reasoning

Operator 2026-05-27 USB push (preserved verbatim above). Filed in same operator-direction window as B-0852.3 row (PR #5449) + B-0852.3a picker (PR #5450) + CLAUDE.md heartbeat discipline (PR #5451). The B-0852.* chain compounds: each landed sub-row enables the next; this row is the boot-time companion to the just-shipped install-time picker; together they unlock empirical USB validation.
