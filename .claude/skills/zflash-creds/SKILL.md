---
name: zflash-creds
description: Bake operator credentials into the USB-bound encrypted blob at flash time via zflash --bake-cred flag (PLACEHOLDER — flag not yet implemented; tracked at B-0884 + B-0852.3b). Documents the canonical invocation pattern so the skill is ready when the flag lands.
record_source: "encryption + zflash lane composition, 2026-05-28 cascade"
load_datetime: "2026-05-28"
last_updated: "2026-05-28"
status: placeholder
---

# Bake operator creds into USB-bound encrypted blob via zflash

**Status: PLACEHOLDER.** The `--bake-cred` flag is NOT yet implemented in `zflash.ts`. This skill documents the canonical invocation pattern so it's ready when the flag lands (tracked at B-0884 + B-0852.3b).

Capability skill. No persona. Wear this hat when:

- Operator says "bake my GitHub PAT into the USB" / "include claude creds when flashing" / "ship the USB with creds preloaded"
- Operator wants to skip the install-time picker (Step 6.94/6.95-picker) by pre-baking credentials at flash time
- Multi-USB provisioning: operator wants to flash N USBs with the same cred set without picker-step on each install

## When `--bake-cred` ships

Per B-0884 acceptance criteria + the zflash next-steps plan (`docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md` Track B), the flag's canonical invocation will be:

```bash
bun full-ai-cluster/tools/zflash.ts --agent \
  --bake-cred gh-cli=env:GH_TOKEN \
  --bake-cred claude=file:~/.config/claude/credentials.json \
  --bake-cred codex=file:~/.codex/auth.json \
  --bake-cred gemini=file:~/.gemini/oauth_creds.json \
  --bake-passphrase-file ~/.config/zeta/usb-passphrase.txt
```

Or with prompt-time passphrase (no file):

```bash
bun full-ai-cluster/tools/zflash.ts --agent \
  --bake-cred gh-cli=env:GH_TOKEN \
  --bake-cred claude=file:~/.config/claude/credentials.json
# Prompts for passphrase at flash time; encrypts blob; writes to USB ESP
```

## Source formats supported (per B-0884 design)

- `env:<VAR>` — read from environment variable
- `file:<path>` — read from file (expand `~`)
- `keychain:<account>` — read from macOS Keychain (per `security find-generic-password`)
- `prompt:<label>` — prompt operator interactively (one paste; not echoed)
- `vault:<path>` — read from HashiCorp Vault if configured

Operator chooses per-cred source based on operational convenience + security posture.

## What the flag will do internally

Composes B-0844's `--agent` mode with B-0852's USB-bound credential substrate:

1. zflash flashes the ISO to USB (B-0844 path)
2. iter-4.2 injects SSH pubkey (existing zflash substrate)
3. iter-4.3 (NEW; B-0884) calls `zeta-creds-persist --bake-cred` with collected args:
   - Reads each cred from its declared source
   - Encrypts via HKDF-SHA256 + AES-256-GCM keyed off USB-UUID + passphrase
   - Writes encrypted blob to USB ESP at `/boot/zeta-creds.enc`
   - Runs `--verify` round-trip per B-0852.3a discipline
4. USB ejected; ready to boot
5. On first boot, `zeta-creds-restore.service` (B-0852.4) reads the blob, prompts for passphrase, restores creds — SKIPS the install-time picker entirely

## Composition

- **B-0844** zflash `--agent` flag (RECOMMENDED invocation per `flash-cluster-iso` skill Path C)
- **B-0852** USB-bound credential substrate (encrypted blob format; storage path; restore service)
- **B-0852.3b** zflash CLI cred-override flags (the row tracking the `--bake-cred` flag itself; sketch-only as of 2026-05-28)
- **B-0852.10** per-cred-type handlers (gh-cli / claude / codex / gemini handlers; shipped)
- **B-0884** PQ git-crypt + zflash integration (extends bake to include PQ key material when B-0883 lands)
- **B-0891** zflash done acceptance criteria (5-scenario test matrix; `--bake-cred` validates Scenario 1 "initial format" with pre-baked creds)
- **`flash-cluster-iso`** skill (parent capability; Path C `--agent` flag is the load-bearing prereq)

## Why this skill exists as a placeholder

Per `.claude/rules/honor-those-that-came-before.md` + the substrate-honest framing: the pattern is well-defined (per the zflash next-steps plan Track B); the flag isn't shipped yet. The skill exists so when operator asks "how do I bake creds at flash time" the canonical pattern is documented + the implementation gap is named explicitly.

Skill upgrades from `status: placeholder` to `status: active` when:

1. B-0852.3b `--bake-cred` flag implementation lands in `zflash.ts`
2. B-0884 PQ git-crypt integration extends the bake to include PQ key material
3. Empirical test (B-0891 Scenario 1 with pre-baked creds) validates the round-trip on real USB

Until then: **use the install-time picker (Step 6.94/6.95-picker)** per the existing B-0852.3a substrate. The picker is shipped + tested + provides the same outcome (encrypted blob on USB ESP); the only difference is WHERE the cred-input happens (install-time vs flash-time).

## Substrate-honest framing

POTENTIAL skill per operator standing direction "all extension should be backloged and looked at as potential." Filed at status: placeholder so future-Otto cold-boot sees:

- The pattern is real + planned
- The implementation is not yet shipped
- The canonical invocation is documented for when the flag lands
- The current workaround (install-time picker) is the operator-facing path today

Promoting placeholder → active is a small docs PR when the implementation lands.

## Composes with three-lanes discipline (B-0892)

This skill IS the cross-lane composition between encryption (B-0883 + B-0884 + B-0885) and zflash (B-0844 + B-0852 + B-0891). Per B-0892, advancing the encryption lane in a way that composes with zflash work is high-leverage — both lanes benefit from a single skill landing.

Per operator authorization 2026-05-28 ("we should keep pushing on that and zflash work and encryption if you can dispatch parallel agents") this cross-lane skill is the kind of substrate that advances both lanes simultaneously.
