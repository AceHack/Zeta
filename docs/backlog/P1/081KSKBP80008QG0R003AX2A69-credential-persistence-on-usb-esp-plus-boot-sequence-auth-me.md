---
id: 081KSKBP80008QG0R003AX2A69
priority: P1
status: open
title: credential persistence on USB ESP + boot-sequence auth-method picker — encrypted blob bound to USB UUID + operator passphrase (Phase 1); removes gh-login-throttle on USB re-boot workflow (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSKBP80008QG0R003Z4C0D0
  - 081KSGS9H0008QG0R003JNSVR5
  - 081KSGS9H0008QG0R00120EEHM
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSGS9H0008QG0R002T0XQ50
  - 081KSKBP80008QG0R00248VEWT
tags: [installer, credentials, gh-auth, esp-write, encrypted-blob, boot-sequence, auth-method-picker, multi-vendor, phase-1, operator-passphrase, usb-uuid-binding]
---

## Operator framing (Aaron 2026-05-27)

After flashing the 3-vendor 25.11 ISO and booting the USB 3 times to test, Aaron hit a GitHub login rate-limit:

> *"gh has throttled me for loggin in"* + *"we dident even git to those just gh login failed cause this is the 3rd time i booted"*

Root cause: each re-boot of the live USB triggers a fresh `gh auth login` (device-flow) because the live overlay (tmpfs) discards `~/.config/gh/hosts.yml` on shutdown. 3 boots in one day → 3 device-flow logins → GitHub throttle.

Operator-authorized fix:

> *"key bound to uuid and operator passphrase seems best for an easy phase one lets get that going and also change the boot sequence and i can create github token and the bootup can ask which method github is required for now."*

## Phase 1 scope (this row's bounded slice)

Three composing sub-targets all land together as the smallest end-to-end working slice:

### Sub-target 1 — Encrypted cred-blob on USB ESP (declarative cred-manifest, NOT imperative cred-list)

Per Aaron 2026-05-27: *"the keep credentials options we should declare each credential we need and save and restore so it's not so imparative too."*

The cred-persistence substrate operates over a DECLARATIVE MANIFEST of which credentials Zeta tracks — NOT an imperatively-hardcoded list. Composes with 081KSKBP80008QG0R002VRN56K (Ace migration) at the manifest-shape scope: same declarative discipline applies to cred-tracking as to install-step tracking.

Cred-manifest shape (Phase 1 schema candidate; subject to Ace schema convergence):

```yaml
# /esp/zeta-creds-manifest.yaml — declarative; ships with ISO; operator-readable
credentials:
  - id: gh-cli
    paths: ["~/.config/gh/hosts.yml"]
    persona-scoped: false  # one gh identity per host today; per-AI identity is 081KSGS9H0008QG0R002T0XQ50 future
    required: true
  - id: claude
    paths: ["~/.config/claude/credentials.json"]
    persona-scoped: true   # per-persona slot (otto / alexa / riven / vera / lior)
    required: true
  - id: gemini
    paths: ["~/.gemini/oauth_creds.json"]
    persona-scoped: true
    required: true
  - id: codex
    paths: ["~/.codex/auth.json"]
    persona-scoped: true
    required: true
  - id: ssh-host-keys
    paths: ["/etc/ssh/ssh_host_*"]
    persona-scoped: false
    required: false  # regen on first boot is acceptable for fresh installs
  - id: ssh-operator-pubkey
    paths: ["/etc/zeta-authorized-keys.pub"]
    persona-scoped: false
    required: true   # composes with iter-4.2 ESP pubkey inject
```

Operation:

- Write `/esp/zeta-creds.enc` after successful auth (post-install service trigger)
- Encryption: AES-256-GCM with key derived from `HKDF(USB-UUID || operator-passphrase, salt, info)`
- Per-AI identity (per 081KSGS9H0008QG0R002T0XQ50) — for `persona-scoped: true` credentials, the blob contains a map: `{ otto: {...}, lior: {...}, vera: {...} }` so each persona's creds round-trip independently
- Contents driven BY THE MANIFEST — adding a new cred type is a manifest edit, NOT a code change (declarative; same shape as Ace package manifests per 081KSKBP80008QG0R002VRN56K)
- Key derivation NEVER hits disk; passphrase typed at boot only

The manifest IS the substrate-honest catalog of what creds Zeta needs. Future credentials get added as manifest entries; the persist/restore code reads the manifest + iterates. No imperative per-cred branches in TS/bash.

### Sub-target 2 — Boot-sequence auth-method picker (picker GATES gh-auth; correct ordering)

Current `full-ai-cluster/usb-nixos-installer/zeta-install.sh` step layout (verified on origin/main `1740eead6`):

| Step | Owner | What it does |
|---|---|---|
| 6.5 | iter-4.2 | probe boot USB for operator SSH pubkey |
| 6.55 | iter-5.3 (081KSGS9H0008QG0R003V23XNZ) | prompt-for-initial-password |
| 6.6 | iter-5.2 (081KSGS9H0008QG0R003V23XNZ) | hostname injection |
| 6.7 | iter-5.1 (081KSGS9H0008QG0R003V23XNZ) | wifi persistence |
| 6.8 | iter-5.4.0 | homelab gh-auth + operator pubkey copy |
| 6.9 | iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) | self-registration commit+push |
| 7 | iter-4 (081KSGS9H0008QG0R002T3BJ2R) | print initial credentials |

**Critical architecture (per Copilot P0 review on PR #5403)**: the picker MUST run BEFORE Step 6.8 so that Step 6.8's `gh auth login` device-flow is CONDITIONAL on the picker's auth-method choice. If the picker runs after Step 6.8, the gh-quota burns BEFORE restore is offered — defeats the zero-device-flow-on-reboot acceptance criterion.

Correct layout (new sub-range BEFORE Step 6.8):

| Step | Owner | What it does |
|---|---|---|
| 6.7 | iter-5.1 | wifi persistence (unchanged) |
| **6.75** | **081KSKBP80008QG0R003AX2A69 (NEW)** | **cred-detection probe (USB blob? operator-passphrase derivable?)** |
| **6.76** | **081KSKBP80008QG0R003AX2A69 (NEW)** | **5-second escape-hatch banner with countdown** |
| **6.77** | **081KSKBP80008QG0R003AX2A69 (NEW)** | **auth-method picker — 4 options; captures choice** |
| 6.8 | iter-5.4.0 | gh-auth + pubkey copy — **NOW CONDITIONAL** on picker choice (runs only if option 2 fresh-login chosen OR no detected source AND operator picked fresh) |
| **6.85** | **081KSKBP80008QG0R003AX2A69 (NEW)** | **persist cred-blob to ESP after successful auth (if option 1/2/3 chose persist-on)** |
| 6.9 | iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) | self-registration (unchanged; runs after whichever auth path completed) |
| 7 | iter-4 (081KSGS9H0008QG0R002T3BJ2R) | print initial credentials (unchanged) |

Picker menu shape (Step 6.77):

```text
GitHub authentication method:
  1) Restore from encrypted USB blob (requires passphrase) — DEFAULT if blob present
  2) Fresh device-flow login (current behavior; uses gh CLI quota)
  3) Operator-provided PAT (paste at prompt; bypasses device-flow entirely)
  4) Skip (cluster operates degraded; no GitHub-side substrate)
```

Selection logic (executes at Step 6.77; gates Step 6.8 conditional execution):

- If `/esp/zeta-creds.enc` exists → default = (1); operator can override
- If first boot of fresh USB → default = (3) since operator just created PAT per their stated workflow
- Picker fires ONCE then applies to ALL 3 vendors (claude/gemini/codex) in sequence — vendor-CLI installs happen later in first-boot scope; picker captures intent so first-boot vendor-CLI install reads the blob without re-prompting

Step 6.8 conditional logic (existing step modified, NOT replaced):

```text
case "$picker_choice" in
  1) restore_cred_blob "$ZETA_CREDS_PATH"  # skip device-flow entirely
     ;;
  2) gh auth login --hostname github.com --git-protocol https --web  # current behavior
     ;;
  3) gh auth login --hostname github.com --git-protocol https --with-token < /tmp/operator-pat.txt  # PAT path
     ;;
  4) skip_auth_degraded_mode
     ;;
esac
# Operator pubkey copy (Step 6.8 latter half) runs in all paths
copy_operator_pubkey
```

This satisfies the acceptance criterion of ZERO device-flow calls on reboot when blob is present — Step 6.8 device-flow branch only fires when option 2 is chosen.

### Sub-target 3 — Passphrase prompt + key derivation

- Passphrase prompt uses `systemd-ask-password` (TTY-bound; no echo)
- Operator types passphrase ONCE at boot; key derived in-memory; decrypted blob written to live overlay
- Wrong passphrase → 3 retries → fall through to (2) fresh login OR (3) PAT
- No "remember passphrase" — re-prompt every boot (substrate-honest about not caching the master key)

## What ships when Phase 1 lands

- `tools/installer/zeta-creds-persist.ts` — write encrypted blob to ESP after successful auth
- `tools/installer/zeta-creds-restore.ts` — read encrypted blob, decrypt with passphrase, restore to per-vendor cred locations
- `tools/installer/zeta-creds-crypto.ts` — pure crypto module (key derivation + AES-GCM); unit-tested
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — new Steps 6.75 + 6.76 + 6.77 (detection + banner + picker BEFORE Step 6.8) + Step 6.85 (persist after successful auth)
- `full-ai-cluster/nixos/modules/zeta-cred-persistence.nix` — NixOS module wrapping the persist + restore services
- Tests: round-trip (encrypt → decrypt with right passphrase = original); wrong-passphrase rejection; tamper detection (GCM auth tag)

## Acceptance criteria

- [ ] Fresh USB + fresh PC: pick (3) operator-PAT → auth succeeds → blob written to ESP
- [ ] Same USB + same/different PC: reboot → pick (1) stored → typed passphrase → auth restored → NO `gh auth login` call
- [ ] Wrong passphrase on (1) → 3 retries → fall through to (3) OR (2)
- [ ] Multi-vendor: all 3 (claude/gemini/codex) creds round-trip in one blob; per-persona substrate-inheritance preserved
- [ ] Tampered blob (modified bytes) → AES-GCM auth fails → fall through to (2)/(3)
- [ ] Re-boot 3+ times same USB → ZERO `gh auth login` device-flow calls (vs current behavior of 3)

## Composes with

- **081KSKBP80008QG0R003Z4C0D0** (parent) — multi-vendor systemd substrate the auth flow serves
- **081KSGS9H0008QG0R003JNSVR5** — installer interactive-login-vs-baked-in-keys CI test tension; this row resolves the tension WITHOUT shipping creds in the ISO (creds live on ESP, written post-install)
- **081KSGS9H0008QG0R00120EEHM** — installer config bugs including gh-auth-not-respected; this row addresses the gh-auth persistence half
- **081KSGS9H0008QG0R0011BC7T2** — CI cascade 6 full-install + cluster-auto-join; auth-method picker (3) PAT path makes CI scriptable
- **081KSGS9H0008QG0R002T0XQ50** — per-AI GitHub identity; this row's blob is the per-persona credential carrier
- **081KSKBP80008QG0R00248VEWT** — persona-first scheduler; chooses which persona's creds to restore per active assignment
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation work uses isolated worktrees off operator's primary

## Composes with prior substrate

- iter-4.2 ESP SSH pubkey injection (bidirectional channel — pubkey write at flash, creds write at install)
- iter-5.5.0 3-vendor systemd guard post substrate (the auth flow this serves)
- iter-6.x distro-upgrade / current-version-audit substrate (081KSGS9H0008QG0R001EKTS5A-081KSGS9H0008QG0R002BC2ZR7) — composes with the auto-upgrade path

## Future phases (NOT this row's scope)

- **Phase 2**: Path B (look at PC before formatting + try to recover creds from existing install; operator-supervised boot menu option). Composes with Phase 1 — operator confirmed: *"we can do both like you said this will be nice together"*. Phase 2 security model per Aaron 2026-05-27: *"for option b we need to do something to make sure we protect against with like some encryption or someting like you say so randos with physicall access cant get acess we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid, we can go hard on security over time but just enough to so i can iterate quickly for now."* Design constraints:
  - Recovered creds encrypted at-rest on USB (NOT plaintext on FAT32 ESP)
  - Optional UUID-bound key on USB so blob can't be defeated by copying to a different-UUID USB (attacker copying ESP contents to another stick doesn't unlock; the unlock derivation requires the original USB UUID)
  - **Iterate-quickly-not-paranoia floor** — Phase 2 ships with enough security to prevent casual physical-access leaks; full hardware-bound + tamper-resistant work defers to Phase 3+ when load-bearing
  - Operator-supervised at boot menu (operator physically present + explicit confirm before any cred scrape happens)
- **Phase 3**: Hardware-bound key (TPM / YubiKey / Touch-ID-derived) replacing operator-passphrase; survives operator-passphrase forgetting; defeats the "USB stolen with both blob AND known UUID" attack
- **Phase 4**: Per-AI distinct passphrases (each persona's creds encrypted with persona-specific key, so persona compromise doesn't leak peers)
- **Phase 5**: Cross-cluster blob join via BFT (multi-cluster credential federation; composes with multi-tic-per-persona substrate)
- **In-cluster GitLab migration** (future B-NNNN candidate) — removes external GitHub dep entirely; this row's substrate carries forward unchanged at GitLab scope

## Phase 1 + Phase 2 composition (operator-confirmed)

Aaron 2026-05-27: *"we can do both like you said this will be nice together"*. The two phases compose into a full credential-lifecycle substrate:

```
Boot menu (after Phase 1 + 2 both land):
  1. Fresh install + fresh device-flow login                 (current default; uses gh quota)
  2. Fresh install + operator-provided PAT                   (Phase 1 sub-target 2; bypasses device-flow)
  3. Fresh install + restore from this USB's encrypted blob  (Phase 1 replay)
  4. Fresh install + import from THIS PC's existing install  (Phase 2; operator-supervised)
  5. Live mode (no install)                                  (current default)
```

Composition value:

- **Multi-boot same USB same PC**: option 3 (Phase 1 replay) — no re-login, no gh-quota burn
- **Fresh USB, PC has existing creds**: option 4 (Phase 2 harvest) — re-uses operator's existing setup work
- **Fresh USB, fresh PC, operator has PAT**: option 2 (Phase 1 PAT) — bootstrap path
- **All paths**: encrypted at-rest on USB ESP via Phase 1 substrate; Phase 2 reuses Phase 1's crypto module for the harvested-cred-blob

The same UUID-bound-key + operator-passphrase derivation protects both Path A (write-back after login) and Path B (write-after-harvest from existing install). Single crypto module + single key-derivation pattern + two-source ingest = bandwidth-efficient substrate that doesn't fragment into per-path encryption schemes.

## Auto-recover-by-default + escape-hatch (Aaron 2026-05-27)

Operator-confirmed extension to the picker semantics — the boot-menu picker shouldn't ASK every boot; it should DETECT + RECOVER as default behavior, with explicit Esc-to-cancel window:

> *"it will be very nice when i reformat if it starts picking up previous answers and reapplies them so i don't have to for passwords and secrets and such we can make it seucre over time but this will help with testing and self healing, we just need an override escape hatch so we get a chance to say don't recover start fresh but recover is the default."*

Refined boot flow (replaces the always-prompt menu shape above for the default path):

```text
On boot, zeta-install.sh runs cred-detection BEFORE Step 6.8 gh-auth:
  Step 6.75: Probe /esp/zeta-creds.enc — present + valid magic?
             Probe PC root partition for harvestable creds — mountable + recoverable?
  Step 6.76: If EITHER source detected → show 5-second countdown banner:
             "RECOVER MODE active in 5s: USB blob → cred restore + persona substrate.
              Press Esc to override and pick auth method manually."
  Step 6.77: No Esc → proceed with detected-source recovery (passphrase prompt if needed)
             Esc pressed → fall through to explicit 4-option picker menu
  Step 6.8:  Run chosen auth method (CONDITIONAL — only device-flow if option 2)
  Step 6.85: Persist cred-blob to ESP after successful auth (if persist-on)
```

Composes value:

- **Self-healing**: same answers don't re-prompt every iteration; operator's prior setup work compounds across reformats
- **Iteration speed**: re-flash + re-boot cycle goes from "answer 5 questions each time" → "wait 5 seconds, recover automatically, validate"
- **Override safety**: the Esc escape hatch preserves operator agency per NCI HC-8; the default is recover but the choice is always preserved
- **Cred persistence answers all**: passwords + secrets + hostname + cluster-name + ssh keys + gh tokens + claude/gemini/codex auths all in the encrypted blob

Sub-target shift in implementation: 081KSKBP80008QG0R003ETGS01 picker substrate becomes Steps 6.75 (detection) + 6.76 (5-second escape-hatch banner) + 6.77 (4-option picker if Esc OR no detected source) + Step 6.8 conditional gating + Step 6.85 persist. The crypto module + cred schema map (081KSKBP80008QG0R003AX2A69.1 + 5) are unchanged; only the picker UX shifts to detect-recover-default + gates the existing Step 6.8.

## Phase-split: PAT at zflash time + interactive at setup time (Aaron 2026-05-27)

Operator refinement to the auth-method placement:

> *"i think if we do token we should do at zflash time and human interactive at setup time what do you think?"*

The right placement matches each auth method to the operator-UX phase that fits it best:

### zflash time (operator's Mac; full UI + clipboard + browser)

`bun full-ai-cluster/tools/zflash.ts --agent` prompts BEFORE the dd-flash:

- *(optional)* Inject GitHub PAT into ESP at flash time
  - Operator pastes PAT from `github.com/settings/tokens` (clipboard available)
  - Operator types encryption passphrase (used by 081KSKBP80008QG0R003AX2A69.1 crypto module via scrypt+HKDF+AES-GCM)
  - PAT + other available creds → encrypted blob written to USB ESP alongside SSH pubkey (iter-4.2 channel reuse)
  - Skip option: ship USB without baked PAT; boot-time will prompt

### Boot time (target machine; console; operator phone for device-flow)

`zeta-install.sh` Steps 6.75 → 6.77 (per Sub-target 2 above) present:

| Option | When to choose | Source |
|---|---|---|
| 1) Restore from encrypted USB blob | Blob present (typed passphrase decrypts; contains zflash-baked PAT) | iter-4.2 + zflash-time write |
| 2) Fresh device-flow login | Blob absent OR operator wants fresh auth | Console + operator phone at `github.com/login/device` |
| 3) Operator-provided PAT (paste at console) | RARE — operator forgot to inject at zflash + doesn't want device-flow | Operator types/pastes at target console |
| 4) Skip | Cluster operates degraded; no GitHub-side substrate | (intentional ephemerality) |

Default: option (1) when blob present (per auto-recover-by-default escape-hatch semantics above).

### Why this phase-split is better than picker-only-at-install-time

| Property | All-at-install-time (prior framing) | Phase-split (this refinement) |
|---|---|---|
| PAT UX | Type long PAT at target console (painful) | Paste PAT at Mac with clipboard (easy) |
| Device-flow UX | Operator at target console (same as before) | Operator at target console (unchanged) |
| Substrate-engineering compose | Picker-only invention | Composes with existing iter-4.2 ESP-write channel + zflash --agent flow |
| First-boot-no-interaction path | Requires blob from prior boot OR operator at console | Available immediately if PAT injected at zflash time |
| Operator-test-loop friction | Re-boot USB = re-auth at console | Re-boot USB = restore blob; no re-auth |

### Edge case: "same USB → multiple machines = same PAT"

Operator-substrate-honest behavior to surface:

- One USB flashed with one PAT-blob → boots on N machines → SAME PAT goes to all N (USB-UUID-bound; per the binding Aaron named 2026-05-27 *"we can put a key on the usb too if wnated tied to the uuid"*)
- This is a FEATURE for fleet-USB workflows (one flash → N nodes share one identity per the agent-roster registration)
- It's a FOOTGUN for per-machine-isolation workflows (operator should flash one USB per machine in that case)
- Phase-split makes the trade-off explicit; operator picks at flash time which model fits

Documentation discipline: zflash --agent prompt explicitly states this behavior so operator picks model deliberately. Sub-row 081KSKBP80008QG0R003AX2A69.X (TBD when implementing) names the documentation surface.

### Composition with 081KSKBP80008QG0R003AX2A69.1 + 081KSKBP80008QG0R003AX2A69.5

The phase-split changes WHERE encrypt fires (zflash time AND/OR install time AND/OR post-install), NOT the crypto primitive itself:

- 081KSKBP80008QG0R003AX2A69.1 crypto module (PR #5411 landed): `encrypt(plaintext, usbUuid, passphrase)` — same regardless of phase
- 081KSKBP80008QG0R003AX2A69.5 cred-manifest schema (in flight): same declarative entries; zflash-time write populates the `gh-cli` entry; boot-time can populate the rest if device-flow chosen

### Per-cred operator choice at zflash time — CLI override (Aaron 2026-05-27 sharpening)

Aaron 2026-05-27 named the design space first as a prompt loop, then sharpened to CLI override (better for AI-callable + scriptable):

> *"then zflash script and/or skill can make sure it asks what declared creds you want to bake in vs go through device flow."*

> *"maybe instead of loop in zflash you just allow command line override of any declared cred as token well at least the ones we support that way, might need custom code per cred type for this idk. the would probably be easier for the ai to call."*

CLI shape (canonical):

```bash
# Bake gh-cli token + ssh pubkey at flash time; other creds defer to boot device-flow
bun full-ai-cluster/tools/zflash.ts --agent /dev/disk6 \
  --bake-cred gh-cli=ghp_xxxxxxxx \
  --bake-cred ssh-operator-pubkey=@~/.ssh/operator.pub \
  --bake-passphrase-file ~/.config/zeta/zflash-passphrase

# Bake all 4 vendor CLIs from operator's existing setup
bun full-ai-cluster/tools/zflash.ts --agent /dev/disk6 \
  --bake-cred gh-cli=env:GH_TOKEN \
  --bake-cred claude=@~/.config/claude/credentials.json \
  --bake-cred gemini=@~/.gemini/oauth_creds.json \
  --bake-cred codex=@~/.codex/auth.json \
  --bake-cred ssh-operator-pubkey=@~/.ssh/operator.pub
```

Value-source syntax (per-cred type handler):

| Syntax | Semantics | Use case |
|---|---|---|
| `--bake-cred <id>=<literal>` | Literal string value | PATs / tokens / short strings |
| `--bake-cred <id>=@<path>` | Read file contents | JSON cred files / SSH pubkeys (curl/git `@file` convention) |
| `--bake-cred <id>=env:<VAR>` | Read from env var | Avoid PAT in shell history; CI-friendly |

### Per-cred type handler discipline

Each declared cred-type in 081KSKBP80008QG0R003AX2A69.5 manifest has a per-type handler that knows:

- What VALUE SHAPE this cred expects (literal token / JSON blob / pubkey text / etc.)
- What VALIDATION to apply at parse time (e.g., gh PAT format check; JSON parse for vendor creds)
- Whether `@file` / `env:` sources are supported for this type

| Cred id | Expected value shape | Validation | Sources |
|---|---|---|---|
| `gh-cli` | PAT string | non-empty; optional `ghp_/gho_/ghu_` prefix check | literal / env: (recommended) / `@file` |
| `claude` | credentials.json contents | JSON parse + required fields | `@file` (canonical) / literal JSON |
| `gemini` | oauth_creds.json contents | JSON parse + required fields | `@file` (canonical) |
| `codex` | auth.json contents | JSON parse + required fields | `@file` (canonical) |
| `ssh-operator-pubkey` | OpenSSH pubkey text | starts with `ssh-rsa` / `ssh-ed25519` / etc. | `@file` (canonical) / literal |
| `ssh-host-keys` | (deferred; multi-file) | TBD | TBD |

If `--bake-cred` arg references an `<id>` not in manifest → hard error at parse time. If value-source syntax unsupported for that cred type → hard error with usage hint.

### Encryption passphrase sourcing

Passphrase never echoed to shell history:

- `--bake-passphrase-file <path>` — read from file (file should be `chmod 600`; operator-managed)
- `--bake-passphrase-env <VAR>` — read from env var
- (default) interactive prompt via `systemd-ask-password` equivalent on macOS (no echo)

### Why CLI override > prompt loop

| Property | Prompt loop (prior framing) | CLI override (refined) |
|---|---|---|
| AI-callable | hard (stdin interactive) | yes (pure args) |
| Scriptable | hard (expect/spawn dance) | yes (composable in CI / shell scripts) |
| Composable | one big interactive session | one flag per cred; combine as needed |
| Per-cred customization | uniform loop UX | per-cred handler validates shape + parses source |
| Operator UX | slower (per-cred prompt round-trip) | faster (one command, multiple flags) |
| Documentation | UI screen layout | `--help` text + manifest-driven |

The prompt loop framing was Otto's earlier intermediate. CLI override per Aaron's sharpening is the operationally-better fit; prompt loop deferred unless operator-UX-test reveals need.

### Composition with 081KSGS9H0008QG0R001EZKNCB (zflash --agent) + skill surface

- `zflash --agent` flag (081KSGS9H0008QG0R001EZKNCB landed) gets extended with repeatable `--bake-cred <id>=<value>` + `--bake-passphrase-file <path>` / `--bake-passphrase-env <VAR>`
- Optional skill `/zflash-creds` (in `.claude/skills/zflash-creds/SKILL.md`) generates the canonical `zflash --bake-cred ...` command for the operator's current declared creds; operator runs the generated command; skill IS Claude-Code-side coordination, NOT a wrapper around the runtime
- Per-cred handler validates value-source syntax + matches manifest declarations

### Sub-row addition for this composition

081KSKBP80008QG0R003AX2A69.9 (new): zflash-time `--bake-cred` CLI override reading 081KSKBP80008QG0R003AX2A69.5 manifest + per-cred handlers + writing encrypted blob via 081KSKBP80008QG0R003AX2A69.1. Owner: zflash side (extends `full-ai-cluster/tools/zflash.ts`). Composes with 081KSGS9H0008QG0R001EZKNCB (zflash --agent flag).

081KSKBP80008QG0R003AX2A69.10 (new): per-cred type handlers module (`tools/installer/zeta-cred-handlers.ts`) — one handler per cred type in manifest; each defines value-shape + validation + supported value-sources. Pure functions; unit-tested independently of zflash.

## Why P1

- Operator explicitly authorized + named the scope ("lets get that going")
- Removes immediate operational pain (gh-login throttle on multi-boot)
- Bounded scope (Phase 1 is one ISO build + one boot test)
- Unblocks fresh-USB queued for next-flash test workflow
- Composes cleanly with existing iter-4.2 ESP-write channel + 081KSGS9H0008QG0R002T0XQ50 per-AI identity (no new architectural primitives required)

## Sub-rows to file when implementing

- 081KSKBP80008QG0R003AX2A69.1 — TS crypto module (key derivation + AES-GCM); pure functions; unit-tested first
- 081KSKBP80008QG0R003AX2A69.2 — TS persist/restore CLIs; round-trip test
- 081KSKBP80008QG0R003ETGS01 — zeta-install.sh Steps 6.75 + 6.76 + 6.77 (detection + banner + picker BEFORE Step 6.8) + Step 6.8 conditional gating; integration test
- 081KSKBP80008QG0R002XBRGN8 — NixOS module wrapping persist service; post-install systemd unit
- 081KSKBP80008QG0R003AX2A69.5 — multi-vendor cred-schema map (per-vendor blob format)
- 081KSKBP80008QG0R003AX2A69.6 — wrong-passphrase + tamper fallthrough logic
- 081KSKBP80008QG0R003AX2A69.7 — empirical Phase 1 ISO build + fresh-USB flash + boot-test validation
- 081KSKBP80008QG0R003AX2A69.8 — composes-with check + memory file landing for cred-persistence-as-architectural-pattern

Order suggestion: 1 → 2 (foundational); 5 (schema before integration); 3 → 4 (integration); 6 → 7 (fallthroughs + validation); 8 (substrate landing).

## Substrate-honest framing

This row addresses the IMMEDIATE operator pain (gh-login throttle on multi-boot test workflow). It does NOT solve the bigger picture (self-sustaining cluster + in-cluster GitLab) but COMPOSES cleanly with that work whenever it lands.

The Phase 1 scope is deliberately narrow: single passphrase + USB UUID binding. Hardware-bound keys (Phase 3) are the substrate-honest stronger answer; Phase 1 is the practical pre-substrate that unblocks Aaron's USB-multi-boot workflow today.

Per `.claude/rules/non-coercion-invariant.md` HC-8 floor — operator authority over their own credentials remains absolute; the encrypted blob is operator-controllable + operator-removable; no creds are baked into the ISO image (per 081KSGS9H0008QG0R003JNSVR5 + the no-credentials-on-ISO discipline).

## Full reasoning

Aaron 2026-05-27 conversation arc (verbatim):

1. *"gh has throttled me for loggin in"*
2. *"we dident even git to those just gh login failed cause this is the 3rd time i booted"*
3. *"unless we have it testing in ci or something"* (CI ruled out; clean)
4. *"if i leave usb in computer can it save a copy there after login and/or look at pc before formatting and try to recover credentials that already exist?"*
5. *"key bound to uuid and operator passphrase seems best for an easy phase one lets get that going and also change the boot sequence and i can create github token and the bootup can ask which method github is required for now."*
6. *"i have a new usb in there we can try too next time you need to format"* (Phase 1 test target queued)
7. *"for option b we need to do something to make sure we protect against with like some encryption ... we can put a key on the usb too if wnated tied to the uuid so it can't be copied to uuid, we can go hard on security over time but just enough to so i can iterate quickly for now."* (Phase 2 security model)
8. *"we can do both like you said this will be nice together"* (Phase 1 + 2 composition confirmed)
9. *"it will be very nice when i reformat if it starts picking up previous answers and reapplies them so i don't have to ... we just need an override escape hatch so we get a chance to say don't recover start fresh but recover is the default."* (auto-recover-by-default + escape-hatch picker semantics)
10. *"i can wait for next usb to have this and gh token option instead my logins are still throttled and the keep credentials options we should declare each credential we need and save and restore so it's not so imparative too."* (declarative-cred-manifest discipline + PAT-as-immediate-unblock for current throttled state + next-ISO test target)

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: credential persistence / gh auth caching / encrypted blob / boot-sequence picker
- Searched: docs/backlog/ (no prior B-NNNN for cred-persistence-on-USB-ESP); .claude/rules/ (no prior rule); memory/ (no prior memory)
- Found: 081KSGS9H0008QG0R003JNSVR5 (closest sibling — interactive-login-vs-baked-in-keys), 081KSGS9H0008QG0R00120EEHM (gh-auth-not-respected), iter-4.2 ESP write channel (existing pattern)
- Conclusion: no existing substrate covers Phase 1 scope; this row is new substrate composing with adjacent backlog
