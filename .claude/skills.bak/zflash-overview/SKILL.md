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
- Composing zflash with encryption substrate (B-0884) or state-machine substrate

## What zflash IS

`bun full-ai-cluster/tools/zflash.ts` is the ultra-short wrapper around `flash-usb.ts` for the AI-cluster installer.

**Canonical end-to-end (after first-time setup)**:

```bash
$ bun full-ai-cluster/tools/zflash.ts
ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
type: yes a3f9
```

**One command + one short challenge + Touch ID + sudo PAM** → fully-flashed USB ready to boot a PC into the Zeta installer, with operator's SSH pubkey already injected.

## First-time setup

```bash
# Once per machine:
bun full-ai-cluster/tools/zflash-setup.ts
# Installs sudo PAM Touch ID hook so zflash can dd without typed password
```

## End-to-end runbook (flash → boot → install → SSH)

1. **Pre-flight**: ensure ISO downloaded (auto-discovers newest `~/Downloads/zeta-installer-*.iso`)
2. **Insert USB**: any 8GB+ USB stick; auto-detects newest plugged-in device
3. **Run zflash**: `bun full-ai-cluster/tools/zflash.ts`
4. **Confirm challenge**: type `yes <4-char-code>` (short challenge format per B-0737)
5. **Touch ID**: PAM gates the dd command via Touch ID
6. **dd runs**: ISO written to USB
7. **SSH pubkey injection** (B-0789 iter-4.2): zflash mounts the freshly-flashed ESP partition + writes operator's pubkey as `/zeta-authorized-keys.pub`
8. **Boot target PC** from the USB
9. **zeta-install.sh runs** on the booted installer; picks up the SSH pubkey + injects into `operator-ssh-keys.nix`
10. **nixos-install completes**; PC reboots into Zeta cluster
11. **Operator SSHes as `zeta` user** with existing SSH key — zero-typing flow

## Substrate-cluster map

Which row solves which problem:

| Row | Substrate-target | Status |
|---|---|---|
| **B-0844** | zflash agent-mode native implementation (`--agent` flag); close doc-vs-implementation gap | Shipped |
| **B-0852** | USB-bound creds substrate (Track B `--bake-cred`; multi-USB provisioning) | In progress per Track B |
| **B-0852.3** | zeta-install.sh Step 6.77 cred-picker integration (interactive bake vs zflash token override) | In progress |
| **B-0884** | Integrate post-quantum git-crypt with zflash USB-bound credential substrate | In progress per encryption lane |
| **B-0891** | zflash done-acceptance-criteria QEMU test harness (5 scenarios: initial-format, cluster-up, reformat-with-retention, reformat-from-scratch, cluster-joining) | 5-scenario substrate landed per PR #5866 |
| **B-0737** | zflash Touch ID + PAM + short-challenge format + ISO auto-discovery | Substrate landed |
| **B-0892** | Three-lanes concurrent operating discipline (encryption + zflash + state-machine; lane definitions + critical-path next-steps) | Discipline substrate |

## Companion skills

When wearing this hat, may compose with:

- `zflash-creds` — bake operator credentials into USB-bound encrypted blob via `--bake-cred` (PLACEHOLDER until B-0884 ships)
- `git-expert` — git operations during ISO build + install
- `dst-substrate-engineer` — deterministic-substrate-engineering substrate (composes with B-0891 5-scenario test acceptance)

## Substrate-anchors

- `full-ai-cluster/tools/zflash.ts` — canonical implementation
- `full-ai-cluster/tools/zflash-lib.ts` — substrate-engineering substrate-engineering substrate library
- `full-ai-cluster/tools/zflash-setup.ts` — first-time PAM substrate setup
- `tools/zflash/test-harness/` — QEMU 5-scenario test harness (B-0891)
- `docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md` — substrate-engineering substrate-engineering substrate next-steps plan

## When this skill does NOT apply

- Implementing new zflash substrate (use row-specific skills + read implementation)
- Debugging dd/PAM issues at substrate-engineering substrate-engineering substrate scope (use `bash-expert` + `macos-expert` + relevant substrate-engineering substrate)
- Designing encryption substrate (compose with encryption agenda + B-0883 substrate cluster instead)
- Picking zflash sub-mechanism without operator-direction (lanes within zflash require operator-direction per B-0892)

## Composes with rules

- `.claude/rules/zeta-ships-with-skills-immediate-value.md` — TS substrate ships first; F# crystallization later
- `.claude/rules/rule-0-no-sh-files.md` — TS-first for cross-platform DST
- `.claude/rules/dep-pin-search-first-authority.md` — version-pinning discipline composes with zflash ISO substrate
- B-0892 three-lanes-concurrent operating discipline — zflash lane substrate-anchor
