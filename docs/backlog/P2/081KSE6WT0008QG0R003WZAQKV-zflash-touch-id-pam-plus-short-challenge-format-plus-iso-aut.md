---
id: 081KSE6WT0008QG0R003WZAQKV
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: zflash — "I execute, you fingerprint" — Touch ID PAM as the irreversible-action consent gate + short `yes <4-hex>` challenge + ISO auto-discovery (~14 keystrokes total for human; agent-driven path uses same Touch ID floor)
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - 081KSE6WT0008QG0R0005XASX2
  - 081KSE6WT0008QG0R002YBWBB1
related_substrate:
  - full-ai-cluster/tools/flash-usb.ts
  - full-ai-cluster/tools/zflash.ts
  - full-ai-cluster/tools/zflash-setup.ts
  - .claude/rules/non-coercion-invariant.md
  - .claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md
tags: [zflash, touch-id, pam, sudo, biometric-gate, short-challenge, iso-auto-discovery, ops-tooling, agent-driven-with-physical-consent-floor]
---

# 081KSE6WT0008QG0R003WZAQKV — zflash: I execute, you fingerprint

## Carved blade

> Touch ID PAM (`pam_tid.so` in `/etc/pam.d/sudo`) is the irreversible-action consent gate; everything else automates. The agent (Otto-VSCode acting on the operator's behalf per the flash-usb.ts authorship contract) invokes `zflash`, auto-types the `yes <4-hex>` runtime challenge per its agent-acting-on-operator's-behalf framing, and the sudo dd fires — at which point the macOS Touch ID prompt appears on the operator's Mac and waits for the operator's actual fingerprint on the actual trackpad. No keystrokes pass through the agent during the gate; biometric proof of physical presence is what unlocks the destructive operation. Result: **1 command + 1 fingerprint** for the operator (no nonce typing, no password typing); ~14 keystrokes for unattended human runs.

## Origin

Aaron 2026-05-25, after the first manual flash-usb run timed out at sudo password prompt:

> *"what's the minimum i can type can we get it down to one line and a challange for me or someting?"*

Then after the design proposal landed:

> *"okay can we do both minimize for humain to easy to type one liners and add sudo via touch and then maybe even you can executie and i have to approve with my fingerprint"*

The phrase "you execute and I approve with my fingerprint" IS the carved-sentence pattern. Touch ID is the consent floor; agent handles everything else.

## What this ships

### Edit — `full-ai-cluster/tools/flash-usb.ts` (+ `--short` flag; otherwise unchanged)

New `--short` flag for the challenge format:

- **Default** (backward-compat): `accept-destroy /dev/disk6 <8-hex>` (~30 chars) — explicit consent + device path + 32-bit nonce
- **`--short`**: `yes <4-hex>` (8 chars) — explicit consent (`yes`) + 16-bit nonce; device implicit (the single-USB sanity rail already ensures only one device can be the target)

Both formats preserve the safety contract:

- Nonce is `randomBytes(N)` per run — not pre-bakeable, requires runtime observation
- Explicit consent token (`accept-destroy` or `yes`) — not a stray Enter keypress

All hardware sanity rails unchanged. All other code unchanged. The flag is purely opt-in.

### New — `full-ai-cluster/tools/zflash.ts` (the runtime wrapper)

Thin Bun wrapper around `flash-usb.ts`:

1. macOS-only check (bails on Linux with pointer to manual flow)
2. Auto-discovers newest `~/Downloads/zeta-installer-*.iso` (or accepts explicit path arg)
3. Invokes `flash-usb.ts --short <iso>` with stdio inheritance (child handles all I/O directly)
4. Propagates child's exit code

### New — `full-ai-cluster/tools/zflash-setup.ts` (the one-time PAM installer)

Idempotent setup script:

1. Reads `/etc/pam.d/sudo` (world-readable on macOS)
2. If `pam_tid.so` already in the auth stack, no-op + reports
3. Otherwise: prepends `auth sufficient pam_tid.so` via `sudo tee` (asks for password ONCE; future sudo invocations use Touch ID)
4. Reports macOS version + biometric-hardware presence via `bioutil -r`
5. With `--install-alias`: appends `alias zflash='bun <path>/zflash.ts'` to `~/.zshrc` (or `$SHELL_RC`); idempotent
6. Reminds user how to test: `sudo -k && sudo true` should now Touch-ID-prompt instead of password-prompt

### Explicitly does NOT add a sudoers `NOPASSWD` rule

A `NOPASSWD: /bin/dd` entry would remove all auth for that command. We keep PAM in the loop so Touch ID is required every run. The runtime nonce gate + Touch ID together form the consent floor; neither alone is sufficient for agent-driven destructive operations.

## The operator's flow after setup

### Human-driven flash (e.g., Aaron at his terminal)

```
$ zflash
ISO: ~/Downloads/zeta-installer-24.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
type: yes a3f9
> yes a3f9          ← human types 8 chars; per-run random
[Touch ID prompt]    ← human touches trackpad (1 finger press)
Flash complete.
```

**Total: ~14 keystrokes + 1 fingerprint.**

### Agent-driven flash (e.g., Otto-VSCode acting on operator's behalf)

```
agent$ bun full-ai-cluster/tools/zflash.ts
[ agent reads runtime stdout, captures `yes a3f9` ]
[ agent writes back `yes a3f9` via stdin / expect script ]
[ sudo dd fires → macOS Touch ID prompt appears on Aaron's Mac ]
operator: [touches trackpad]
[ flash proceeds ]
agent: reports completion
```

**Operator total: 1 fingerprint.** Agent handles invocation + nonce response + result observation; biometric is the irreversible-action floor.

## Safety substrate analysis

### What's preserved

- Per-run random nonce — still not pre-bakeable; still requires runtime observation
- Explicit consent token (`yes`) — not a stray keypress
- Touch ID biometric gate — physical proof of operator presence; cannot be bypassed by an agent regardless of credentials or settings
- All flash-usb hardware sanity rails — USB-only, single-USB, non-internal, non-boot, size-bounds, ISO existence + extension + size + magic
- No sudoers `NOPASSWD` rule — PAM still authenticates each sudo
- No password stored anywhere — Touch ID uses Secure Enclave; no credentials flow through any script

### What changes

- **Substantive shortening of consent challenge** (long form `accept-destroy <device> <8-hex>` → short form `yes <4-hex>`). The trade-off is 16-bit fewer nonce-entropy bits (32→16 bits) but consent-semantic equivalence (`yes` token + nonce still proves both runtime observation + explicit consent). 16-bit nonce gives 65,536 possible values per run — still infeasible to pre-bake against an unknown device + unknown run timing.
- **Device path no longer in challenge text** (long form had `/dev/disk6` explicit; short form does not). Substrate-honest: the single-USB sanity rail already ensures only one candidate device per run; explicitness of device in the challenge text was belt-and-suspenders over an already-enforced invariant.
- **Sudo password → Touch ID** for the dd invocation. Touch ID is the physical-presence proof macOS-standard; substantially stronger floor than a stored password (Secure Enclave; Touch ID itself can't be exfiltrated; PAM line persists across Sequoia 15+ OS updates).

## Composes with .claude/rules/

- `.claude/rules/non-coercion-invariant.md` HC-8 — operator retains authority over destructive operations via biometric gate; agent can never bypass without operator's actual fingerprint
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — `zflash-setup` modifies `/etc/pam.d/sudo` which is a system-PAM-stack change, NOT a classifier-bypass; the change INSTALLS a safety mechanism (biometric) rather than removing one (password)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — the `Bash(bun *)` permission in settings.json already covers zflash + zflash-setup invocation; no new `_*_acceptance` block needed (the PAM edit is a one-time operator-initiated setup, not an ongoing risk-acceptance pattern)
- `.claude/rules/default-to-both.md` — long-form challenge (default) + short-form challenge (zflash path) BOTH first-class; not either-or
- `.claude/rules/glass-halo-bidirectional.md` — Touch ID prompt is system-level UI, visible to operator regardless of which terminal initiated; no opacity in the consent chain
- `.claude/rules/algo-wink-failure-mode.md` — agent invocation does NOT equal authorization to flash; Touch ID is the actual authorization gate

## Composes with backlog substrate

- 081KSE6WT0008QG0R0005XASX2 (destructive-tool authoring contract) — zflash + zflash-setup inherit the contract; the `--short` flag preserves the runtime consent gate; Touch ID adds a complementary physical-presence proof layer
- 081KSE6WT0008QG0R002YBWBB1 (runbook-as-executable-reality leverage class safety substrate) — zflash is an empirical instance of "destructive operation gated by biometric proof"; pattern generalizes to other operator-side destructive tools (Layer 6 `_runbook_leverage_acceptance` discipline composes here)

## Three independently-shippable scope items (already implemented in this PR; future work below)

### Scope item 1 — Edit `flash-usb.ts` for `--short` flag (SHIPPED in this PR)

- [x] `--short` flag parsed
- [x] Short challenge format: `yes <4-hex>` (16-bit nonce; `yes` consent token)
- [x] Long form unchanged (backward-compat)
- [x] Argument parsing supports flags + positional
- [x] Help text updated

### Scope item 2 — Ship `zflash.ts` runtime wrapper (SHIPPED in this PR)

- [x] macOS-only platform gate
- [x] Auto-discovers newest `~/Downloads/zeta-installer-*.iso`
- [x] Accepts explicit ISO path arg (override auto-discovery)
- [x] Invokes flash-usb.ts with `--short`
- [x] Stdio inheritance (child handles all I/O including Touch ID prompt)
- [x] Exit code propagated

### Scope item 3 — Ship `zflash-setup.ts` Touch ID PAM installer (SHIPPED in this PR)

- [x] Idempotent PAM check + insert
- [x] `--install-alias` for shell alias to `~/.zshrc` (or `$SHELL_RC`)
- [x] macOS version + biometric hardware reporting
- [x] Test-recipe in output (`sudo -k && sudo true` to verify Touch ID works)

## Future-scope items (NOT in this PR)

- **Linux equivalent** — zflash + zflash-setup are macOS-only. Linux runners use the manual `dd` flow documented in flash-usb.ts header. Linux equivalent would use `polkit` for biometric/auth gating; out of scope for first pass.
- **Multi-USB picker** — zflash currently inherits flash-usb's "single USB or refuse" semantics. A multi-USB picker (lists USB devices + lets operator pick) is a separate scope; doesn't compose with biometric-only mode (would need additional consent gate on the picker selection).
- **Network ISO fetch** — zflash currently requires the ISO be downloaded to `~/Downloads/`. Future scope: `zflash --pull-latest` triggers a GitHub Actions artifact download, then flashes. Would compose with 081KSE6WT0008QG0R002YBWBB1 Layer 1 provenance chain.
- **Other destructive-tool wrappers using this pattern** — pattern is generalizable: `zformat` (disk format), `zwipe` (secure wipe), etc. Each one-tool-per-row per the no-omnibus discipline.

## Acceptance (overall)

- [x] All three substrate items shipped in this PR (flash-usb edit + zflash + zflash-setup)
- [x] TS files import-execute clean (runtime smoke test passed)
- [x] No `.sh` files added (Rule 0 honored)
- [ ] Operator runs `bun full-ai-cluster/tools/zflash-setup.ts` once and confirms PAM Touch ID works
- [ ] Operator runs `zflash` end-to-end on a real USB stick + ISO + observes Touch ID prompt + fingerprints + flash succeeds
- [ ] First-flash empirical anchor recorded in next backlog row or in this row's "Empirical anchor" section once complete

## Substrate-honest framing

This row SHIPS the substrate. It does NOT:

- Modify `/etc/pam.d/sudo` automatically (zflash-setup is opt-in; operator runs explicitly)
- Add the shell alias automatically (`--install-alias` flag required)
- Remove the long-form challenge from flash-usb.ts (backward-compat preserved; `--short` is opt-in)
- Add sudoers `NOPASSWD` rules (rejected: would remove all auth for the command; Touch ID via PAM is the right floor)
- Configure Touch ID hardware (Mac must already have a TID-enrolled finger)

The substrate is operator-substrate-honestly scoped: agent ships the tools; operator runs setup; operator + agent collaborate via Touch ID gate at flash time.

Per `.claude/rules/no-directives.md`: this row is operator-substrate-honest scoping; Aaron retains authority over when to run zflash-setup + when to flash.

Per `.claude/rules/honor-those-that-came-before.md`: the flash-usb.ts substrate (081KSE6WT0008QG0R0005XASX2 destructive-tool authoring contract) is the foundation; zflash + zflash-setup compose without replacing.
