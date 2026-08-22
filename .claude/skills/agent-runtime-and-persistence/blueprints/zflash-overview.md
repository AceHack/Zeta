---
name: zflash-overview
description: zflash end-to-end overview + substrate-cluster map + canonical flash-USB-to-install runbook.
record_source: "zflash lane Track C docs/skills push, 2026-05-28 per operator 'feel free to push the three lanes forward'"
load_datetime: "2026-05-28"
last_updated: "2026-05-28"
status: active
---

# zflash overview + substrate-cluster map

Capability skill. No persona. Wear this hat when:

- Newcomer needs to understand the zflash substrate-cluster end-to-end
- Operator asks "what does zflash do" / "how do I flash a USB" / "what's the install runbook"
- Picking which substrate-row solves a specific zflash-substrate-target
- Running zflash end-to-end (flash USB → boot PC → install → first SSH)
- Composing zflash with encryption substrate (081KSNY2Z0008QG0R0011XCT94) or state-machine substrate

## What zflash IS

`zeta flash usb` (F# shell) or `bun src/Core.TypeScript/zflash/zeta-flash.ts usb` routes to the platform zflash CLI (`cli.ts` on macOS, `flash-usb-windows.ts` on Windows).

**Canonical end-to-end (after first-time setup)**:

```bash
$ zeta flash usb
# or: bun src/Core.TypeScript/zflash/zeta-flash.ts usb
ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
type: yes a3f9
```

**One command + one short challenge + Touch ID + sudo PAM** → fully-flashed USB ready to boot a PC into the Zeta installer, with operator's SSH pubkey already injected.

## First-time setup

```bash
# Once per machine (macOS Touch ID + PAM for passwordless dd):
bun src/Core.TypeScript/zflash/cli.ts --setup
# MCP: zeta_flash tool with args ["usb","--help"]
```

## End-to-end runbook (flash → boot → install → SSH)

1. **Pre-flight**: ensure ISO downloaded (auto-discovers newest `~/Downloads/zeta-installer-*.iso`)
2. **Insert USB**: any 8GB+ USB stick; auto-detects newest plugged-in device
3. **Run zflash**: `zeta flash usb` (or `bun src/Core.TypeScript/zflash/cli.ts`)
4. **Confirm challenge**: type `yes <4-char-code>` (short challenge format per 081KSE6WT0008QG0R003WZAQKV)
5. **Touch ID**: PAM gates the dd command via Touch ID
6. **dd runs**: ISO written to USB
7. **SSH pubkey injection** (081KSGS9H0008QG0R002T3BJ2R iter-4.2): zflash mounts the freshly-flashed ESP partition + writes operator's pubkey as `/zeta-authorized-keys.pub`
8. **Boot target PC** from the USB
9. **zeta-install.sh runs** on the booted installer; picks up the SSH pubkey + injects into `operator-ssh-keys.nix`
10. **nixos-install completes**; PC reboots into Zeta cluster
11. **Operator SSHes as `zeta` user** with existing SSH key — zero-typing flow

## Substrate-cluster map

Which row solves which problem:

| Row | Substrate-target | Status |
|---|---|---|
| **081KSGS9H0008QG0R001EZKNCB** | zflash agent-mode native implementation (`--agent` flag); close doc-vs-implementation gap | Shipped |
| **081KSKBP80008QG0R003AX2A69** | USB-bound creds substrate (Track B `--bake-cred`; multi-USB provisioning) | In progress per Track B |
| **081KSKBP80008QG0R003ETGS01** | zeta-install.sh Step 6.77 cred-picker integration (interactive bake vs zflash token override) | In progress |
| **081KSNY2Z0008QG0R0011XCT94** | Integrate post-quantum git-crypt with zflash USB-bound credential substrate | In progress per encryption lane |
| **081KSNY2Z0008QG0R0008PN7RQ** | zflash done-acceptance-criteria QEMU test harness (5 scenarios: initial-format, cluster-up, reformat-with-retention, reformat-from-scratch, cluster-joining) | 5-scenario substrate landed per PR #5866 |
| **081KSE6WT0008QG0R003WZAQKV** | zflash Touch ID + PAM + short-challenge format + ISO auto-discovery | Substrate landed |
| **081KSNY2Z0008QG0R002QA720J** | Three-lanes concurrent operating discipline (encryption + zflash + state-machine; lane definitions + critical-path next-steps) | Discipline substrate |

## Companion skills

When wearing this hat, may compose with:

- `zflash-creds` — bake operator credentials into USB-bound encrypted blob via `--bake-cred` (PLACEHOLDER until 081KSNY2Z0008QG0R0011XCT94 ships)
- `git-expert` — git operations during ISO build + install
- `dst-substrate-engineer` — deterministic-substrate-engineering substrate (composes with 081KSNY2Z0008QG0R0008PN7RQ 5-scenario test acceptance)

## Substrate-anchors

- `src/Core.TypeScript/zflash/zeta-flash.ts` — unified router (`zeta flash`, MCP `zeta_flash`)
- `src/Core.TypeScript/zflash/cli.ts` — macOS zflash CLI
- `src/Core.TypeScript/zflash/flash-usb-windows.ts` — Windows USB flash
- `src/Core.TypeScript/zflash/test-harness/` — QEMU 5-scenario test harness (081KSNY2Z0008QG0R0008PN7RQ)
- `docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md` — substrate-engineering substrate-engineering substrate next-steps plan

## When this skill does NOT apply

- Implementing new zflash substrate (use row-specific skills + read implementation)
- Debugging dd/PAM issues at substrate-engineering substrate-engineering substrate scope (use `bash-expert` + `macos-expert` + relevant substrate-engineering substrate)
- Designing encryption substrate (compose with encryption agenda + 081KSNY2Z0008QG0R002JKH50A substrate cluster instead)
- Picking zflash sub-mechanism without operator-direction (lanes within zflash require operator-direction per 081KSNY2Z0008QG0R002QA720J)

## Composes with rules

- `.claude/rules.bak/zeta-ships-with-skills-immediate-value.md` — TS substrate ships first; F# crystallization later
- `.claude/rules.bak/rule-0-no-sh-files.md` — TS-first for cross-platform DST
- `.claude/rules.bak/dep-pin-search-first-authority.md` — version-pinning discipline composes with zflash ISO substrate
- 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent operating discipline — zflash lane substrate-anchor
