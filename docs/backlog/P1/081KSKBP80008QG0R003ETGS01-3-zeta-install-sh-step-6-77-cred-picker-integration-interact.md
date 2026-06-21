---
id: 081KSKBP80008QG0R003ETGS01
priority: P1
status: open
title: zeta-install.sh Step 6.77 cred-picker integration — interactive bake-in at setup time + zflash CLI token-override per declared cred (Aaron 2026-05-27 device-flow-at-setup vs token-at-zflash framing)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSKBP80008QG0R003AX2A69.1
  - 081KSKBP80008QG0R003AX2A69.2a
  - 081KSKBP80008QG0R003AX2A69.2b
  - 081KSKBP80008QG0R003AX2A69.5
  - 081KSKBP80008QG0R003AX2A69.10
composes_with:
  - 081KSKBP80008QG0R002XBRGN8
  - 081KSKBP80008QG0R002J03WGA
tags: [b-0852-sub-row, cred-persistence, zeta-install-sh, step-6-77, picker, interactive-setup, zflash-cli-override, device-flow-at-setup-time, token-at-zflash-time]
---

## Operator framing (Aaron 2026-05-27)

Three messages establishing the device-flow-vs-token split:

### Message 1

> *"i think if we do token we should do at zflash time and human interactive at setup time what do you think?"*

### Message 2

> *"Yes i like that frameing lets do it that way and then zflash script and/or skill can make sure it asks what declared creds you want to bake in vs go through device flow."*

### Message 3 (refinement)

> *"maybe instead of loop in zflash you just allow command line override of any declared cred as token well at least the ones we support that way, might need custom code per cred type for this idk. the would probably be easier for the ai to call."*

## Substrate-honest reading

Two distinct integration points emerge from the operator framing:

| Phase | Where | Mode | What |
|---|---|---|---|
| **Setup time** (install / first-boot) | zeta-install.sh Step 6.77 | Interactive | Picker asks operator: for each declared cred in the manifest, bake-in (via persist CLI + --bake-cred) OR defer to device-flow at runtime OR skip |
| **zflash time** (re-flash / re-bake) | zflash script | Non-interactive (CLI-override) | Per-cred command-line flag like `--bake-cred <id>=<value-source>` allows AI-driven re-baking without an interactive loop |

The setup-time interactive picker matches the operator's stated preference ("human interactive at setup time"). The zflash-time CLI override matches the refinement ("easier for the ai to call").

Both consume the just-landed 081KSKBP80008QG0R003AX2A69.2b persist CLI (PR #5425); zflash-time mode is essentially `bun tools/installer/zeta-creds-persist.ts --bake-cred <id>=...` with the operator's cred sources resolved by the per-cred handlers (081KSKBP80008QG0R003AX2A69.10).

## Scope

### 081KSKBP80008QG0R003AX2A69.3a — Step 6.77 interactive picker

Add a new step in `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (positioned before Step 6.8 reboot or wherever appropriate per the inventory in 081KSKBP80008QG0R002VRN56K.1):

1. Read the declarative cred-manifest (`tools/installer/zeta-creds-manifest.ts` DEFAULT_MANIFEST)
2. For each cred entry: prompt operator with 3-option choice:
   - **Bake-in now** — sub-prompt for value-source (literal / @file path / env:VAR); call `zeta-creds-persist --bake-cred <id>=<source>` to add to the cred-blob
   - **Defer to device-flow** — skip; runtime will handle via interactive OAuth or equivalent (per 081KSGS9H0008QG0R003JNSVR5 installer interactive-login + OAuth substrate)
   - **Skip** — operator does not want this cred on this install at all
3. After loop completes, finalize the cred-blob: persist to ESP at `/esp/zeta-creds.enc` with operator-provided passphrase
4. Composes with the persona section (per-persona-scoped creds picked when --persona is set; same loop variant)

### 081KSKBP80008QG0R003AX2A69.3b — zflash CLI override flags

Extend the zflash script (location TBD — likely `tools/installer/zflash.ts` or skill) so EVERY cred in the declared manifest can be overridden via CLI:

```bash
zflash --bake-cred gh-cli=ghp_xxx --bake-cred claude=@/path/to/claude-creds.json --bake-cred ssh-operator-pubkey=env:SSH_PUBKEY ...
```

- Non-interactive (no operator prompt loop)
- Same `--bake-cred` arg shape as `zeta-creds-persist --bake-cred` (already supports literal / @file / env:VAR via 081KSKBP80008QG0R003AX2A69.10 handlers)
- For creds NOT supplied on the CLI: defer to device-flow at runtime (same as picker's "defer" option)
- AI-callable: a peer agent (Otto / Alexa / Vera) can drive zflash with declarative arg list without sitting in an interactive loop

### 081KSKBP80008QG0R003AX2A69.3c — passphrase-source policy

Both modes need passphrase resolution. Options preserved per default-to-both:

- Interactive prompt (setup-time only; operator types at terminal)
- `--passphrase-file <path>` (already supported by persist CLI)
- `--passphrase-env <VAR>` (already supported by persist CLI)
- Hardware-backed (Touch ID / YubiKey / etc.) — DEFERRED to later sub-row

## Composes with substrate

- **081KSKBP80008QG0R003AX2A69.1** (crypto) — encrypt to ESP
- **081KSKBP80008QG0R003AX2A69.2a** (envelope) — wire format
- **081KSKBP80008QG0R003AX2A69.2b** (persist + restore CLIs) — the actual binary this row wraps
- **081KSKBP80008QG0R003AX2A69.5** (declarative manifest) — drives the loop iteration
- **081KSKBP80008QG0R003AX2A69.10** (per-cred handlers) — value-source resolution (literal/@file/env:VAR)
- **081KSKBP80008QG0R002XBRGN8** (NixOS module) — runtime decrypt at boot consumes what this row produces at install
- **081KSKBP80008QG0R002J03WGA** (install.sh universal entry) — composes at routing scope; picker fires at install-time across all environment routes per Turn 5 spectrum
- **081KSGS9H0008QG0R003JNSVR5** (installer interactive-login-vs-baked-in-keys) — "defer to device-flow" branch of the picker
- **081KSKBP80008QG0R000GPC0TB** (self-register architectural fix) — fires AFTER cred-persistence completes; same ordering as the rest of Step 6.x

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: cred-picker integration at install-time + zflash-time

Searched surfaces:

- `docs/backlog/` — 081KSGS9H0008QG0R003JNSVR5 (installer interactive-login substrate) + 081KSGS9H0008QG0R001JNKBFD (cred-persistence parent) + 081KSKBP80008QG0R003AX2A69.* family + 081KSKBP80008QG0R002VRN56K.1 (install.sh inventory) — none cover the Step 6.77 picker integration specifically
- `tools/installer/` — persist + restore CLIs ready (PR #5425); no picker wrapper yet
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — Step 6.95a invokes install.sh (081KSKBP80008QG0R002EKF67B audit confirms); no Step 6.77 picker yet
- `memory/` — no prior memory on Step 6.77 specifically

Read top hits:

- Operator's verbatim three messages 2026-05-27 establishing the split (above)
- 081KSKBP80008QG0R003AX2A69.2b PR #5425 (the CLIs this row consumes)
- 081KSKBP80008QG0R003AX2A69.10 PR #5418 (the handlers this row's value-source resolution composes with)
- 081KSKBP80008QG0R002VRN56K.1 PR #5420 (the inventory this row's Step 6.77 positioning composes with)

Conclusion: no existing row covers Step 6.77 picker integration; this row fills the gap; composes cleanly with adjacent landed substrate.

Authoring action: mint new sub-row 081KSKBP80008QG0R003ETGS01 (next subdecimal after .2b in the 081KSKBP80008QG0R003AX2A69.* family).

## Why P1 not P2

- Directly blocks operator's USB cred-persistence test (gap named explicitly by operator 2026-05-27 USB question)
- All four upstream sub-rows (.1 / .2a / .2b / .5 / .10) merged; this is the operator-facing integration that unblocks empirical USB validation
- Operator-named: "device-flow at setup, token at zflash" was the explicit operator framing in three messages on 2026-05-27
- Bounded scope (M-effort): one new Step in zeta-install.sh + zflash CLI flag extension + passphrase-source policy

## Sub-rows to file when implementing

- **081KSKBP80008QG0R003AX2A69.3a** — Step 6.77 interactive picker in zeta-install.sh (consumes persist CLI)
- **081KSKBP80008QG0R003AX2A69.3b** — zflash CLI override flags (per-cred non-interactive)
- **081KSKBP80008QG0R003AX2A69.3c** — passphrase-source policy (interactive + file + env; hardware-backed deferred)
- **081KSKBP80008QG0R003AX2A69.3d** — empirical USB test of the full picker → persist → restore → use chain (test on freshly-flashed USB)

Order: 3a (picker) → 3c (passphrase) → 3b (zflash CLI) → 3d (empirical test). Each ships small + independent.

## What this is NOT

- NOT a replacement for 081KSGS9H0008QG0R003JNSVR5 device-flow substrate (composes; "defer to device-flow" IS one branch of the picker)
- NOT a replacement for 081KSKBP80008QG0R002XBRGN8 NixOS module (composes; this row produces the blob at install; .4 consumes it at boot)
- NOT a hardware-token-only flow (operator framing explicitly says "human interactive at setup time")
- NOT a Rule 0 violation (TS-first; the persist CLI is already .ts; the picker can be a .ts called from zeta-install.sh's existing install-graph carve-out at tools/setup/)

## Composes with rules

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — filing this row IS counter-reset condition #3 ("file a candidate B-NNNN"); this row's filing closes the 100-tick brief-ack cascade caught by operator 2026-05-27 ("it keeps happening more than before")
- `.claude/rules/no-directives.md` — operator authority over cred-persistence flow; picker preserves choice (bake / defer / skip)
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator authority over own creds; passphrase NEVER logged; required-cred write failure surfaces the failure rather than silently degrading
- `.claude/rules/verify-existing-substrate-before-authoring.md` — substrate-inventory pass cited inline above

## Full reasoning

Operator 2026-05-27 verbatim three-message framing (preserved above). Filed 2026-05-27 in response to operator's USB-state question + operator's substrate-honest naming of the recurring brief-ack failure mode ("it keeps happening more than before"). Filing IS the substrate-honest counter-reset move per the rule the agent's been violating.
