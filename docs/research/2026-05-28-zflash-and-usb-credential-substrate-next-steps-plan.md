# zflash + USB-credential substrate cluster — Next-Steps Plan

**Status snapshot (origin/main as of 2026-05-28T02:59Z):** the cluster has shipped a remarkable amount in the last 36 hours; the bottleneck has shifted from "build the substrate" to "exercise it end-to-end on the operator's actual USB + actual PC and surface the failure modes." The next-steps gradient is heavily empirical from here, not architectural.

Produced by background research agent dispatched 2026-05-28 per operator standing direction to push on zflash work in parallel.

---

## 1. Per-row audit — shipped vs pending vs sketch-only

### 1.1 081KSE6WT0008QG0R003WZAQKV — zflash Touch ID PAM + short challenge + ISO auto-discovery

**Status: SHIPPED. Operationally exercised.**

| Surface | State |
|---|---|
| `full-ai-cluster/tools/flash-usb.ts` — `--short` flag, `yes <4-hex>` challenge | Shipped, ~19KB |
| `full-ai-cluster/tools/zflash.ts` — wrapper, ISO auto-discovery, iter-4.2/4.3 inject + freshness | Shipped, ~46KB / 1058 lines |
| `full-ai-cluster/tools/zflash-setup.ts` — Touch ID PAM installer, `--install-alias` | Shipped, ~10KB |
| `full-ai-cluster/tools/zflash-lib.ts` + `.test.ts` | Shipped, 113 + 244 lines |
| PR #5010 — landed 2026-05-25 (carry-over from closed #4997); PR #4999 — settings.json permissions |
| **Empirical**: operator has run zflash + Touch ID 3+ times against real USBs in 2026-05-26/27 sessions |

**Gaps (minor):** Touch ID timing-out under certain background-process conditions; Linux equivalent out of scope; `~/Downloads/` hard-coded.

### 1.2 081KSGS9H0008QG0R001EZKNCB — zflash `--agent` flag, native auto-type challenge

**Status: SHIPPED + ratified.** `--agent` flag parsed at zflash.ts line 810; spawn with piped stdin + stdout-tail challenge match at lines 985-1014; glass-halo `[agent-mode]` line shipped.

**Gaps:** No empirical end-to-end test of `--agent` mode in 2026-05-27/28 sessions yet. The row's acceptance bullet "a full re-flash via `bun zflash.ts --agent` completes with 'Flash complete.' visible" is still unchecked. `--bake-cred` flag NOT implemented.

### 1.3 081KSKBP80008QG0R003AX2A69 (parent) — credential persistence on USB ESP

**Status: ~75% SHIPPED. End-to-end USB validation is the gating step.**

Shipped sub-rows: .1 crypto (HKDF + AES-256-GCM); .2a wire-format envelope + CredBundle; .2b persist + restore CLIs; .5 declarative cred-manifest; .10 per-cred-type handlers; .3a interactive picker + Step 6.94 integration; .3a `--verify` post-write; .3c default-ON with 4-path opt-out; .4a NixOS zeta-creds-restore.nix module; .4d wire restore into common.nix; default-ON cred-restore with interactive mode + `/esp → /boot` path fix; provisioning docs.

Pending: **.3b zflash CLI `--bake-cred` override flags** (sketch-only); **.3d empirical USB end-to-end test** (the gate); .4b Mode A interactive systemd-ask-password verification; .4e empirical USB restore loop test; .6 wrong-passphrase fall-through; .7 ISO build + fresh-USB + boot-test; .8 memory-file landing.

### 1.4 081KSKBP80008QG0R003ETGS01 — Step 6.77 cred-picker integration

**Status: SHIPPED for install-time picker; partial for zflash-time CLI override.** Picker landed at Step 6.94 / 6.95-picker (drift from original 6.77 row name). zflash `--bake-cred` NOT implemented. Empirical USB end-to-end test NOT RUN.

### 1.5 081KSNY2Z0008QG0R0011XCT94 — PQ git-crypt + zflash integration

**Status: ROW FILED PR #5679; NO CODE.** Composes 081KSNY2Z0008QG0R002JKH50A with the zflash cluster. 081KSNY2Z0008QG0R002JKH50A also row-only (no PR yet). Operator's WHY is 081KSNY2Z0008QG0R0030V5ZVS ("agent private encrypted state — Otto first, then other AIs; ASAP").

### 1.6 081KSNY2Z0008QG0R002CR38D8 — two-priority-axes correction (USB top on operator-personal)

**Status: ROW FILED PR #5683. Framing-correction.** USB is FIRST on operator-personal-day-to-day axis (DevOps iteration + word-of-mouth evangelism). This is the operationally load-bearing framing for this plan — bumps urgency of 081KSKBP80008QG0R003AX2A69.3d empirical test + 081KSNY2Z0008QG0R0011XCT94 wiring.

### 1.7 081KSNY2Z0008QG0R003FR5TVG — symbiotic cross-track self-healing

**Status: ROW FILED PR #5683. L effort; touches multiple substrate clusters.** Cross-track recovery (cloud KVMs control local boot; local restarts GitHub workflows; firmware updates via shared KVM). Composes with 081KRQ1AB0008QG0R002G93CM7 fleet-replication + 081KSE6WT0008QG0R0029S1D5Z GL-iNet Comet Pro KVM + 081KSE6WT0008QG0R0004AP0ZA commodity-KVM-finger + 081KSNY2Z0008QG0R003X1QWYG GitHub Actions recursion.

---

## 2. Critical-path next steps

The cluster has reached a state where the bottleneck is **empirical validation on real hardware**, not architectural work.

### Critical-path sequence (each step gates the next)

| # | Step | Effort | Gates |
|---|---|---|---|
| **CP-1** | Build fresh ISO from current `origin/main` | S (CI workflow exists) | CP-2..CP-6 |
| **CP-2** | Operator runs `bun zflash.ts --agent` end-to-end on fresh USB + fresh ISO | S (operator-runtime) | CP-3 |
| **CP-3** | First boot on target PC: hit picker; select option 3 PAT; complete install | M (~15-30min) | CP-4 |
| **CP-4** | Second boot same USB same PC: restore service fires; passphrase-prompted; per-cred files restored; ZERO `gh auth login` device-flow | M (~5min) | CP-5 |
| **CP-5** | Reboot 3+ times same USB: validate ZERO gh-quota burn across N boots | S (~10min) | CP-6 |
| **CP-6** | Demo walkthrough rehearsed on operator's actual Mac + actual USB | S | operator-personal-axis priority |

**Effort estimate, CP-1 → CP-6 end-to-end: ~1 operator-day** (3-4 hours mostly-waiting punctuated by ~30 min active typing/fingerprinting). The substrate is built; what's left is exercise + bug-fix-on-empirical-failure loops.

### What probably fails on first empirical run

1. **Step-ordering drift** in `zeta-install.sh` — picker at 6.94/6.95-picker not 6.77 as documented; composes_with may have skipped a Before/After. Symptom: picker fires AFTER gh-device-flow runs.
2. **Boot-time passphrase prompt UX** — systemd-ask-password tty1 binding context-dependent.
3. **`/boot` vs `/esp` path** — PR #5644 fixed `/esp → /boot`; verify no residual `/esp` reference.
4. **USB-UUID capture timing** — install-time `/etc/zeta/usb-uuid` may not match boot-time mount path.
5. **`mise activate` inside `bash -c`** — PATH propagation under sudo intermittent failure class.

Each is 15-60 minute fix-fwd ticket.

---

## 3. Sequenced steps with parallel-tracks

### Track A — Empirical USB validation (operator-driven; critical path)

Single-threaded; gates the rest. CP-1 → CP-2 → CP-3 → CP-4 → CP-5 → CP-6 as above.

### Track B — zflash CLI cred-override (`--bake-cred`)

Can run in parallel with Track A; recommended start after CP-2 succeeds.

- **B-T1** Implement `--bake-cred <id>=<source>` flag parsing (S, 4-6h)
- **B-T2** Implement `--bake-passphrase-file` / `--bake-passphrase-env` flag parsing (XS)
- **B-T3** Pipe `--bake-cred` args into `zeta-creds-persist --bake-cred` invocation (S)
- **B-T4** Unit tests for arg parsing + integration test (S)
- **B-T5** Update zflash `--help` text (XS)
- **B-T6** Empirical test (S)

**Total Track B: ~1-2 dev-days.**

### Track C — Documentation + skill surface

Can run fully in parallel.

- **C-T1** Update `.claude/skills/flash-cluster-iso/SKILL.md` to reference `--agent` + `--bake-cred`
- **C-T2** Create `.claude/skills/zflash-creds/SKILL.md` generating canonical zflash bake-cred command
- **C-T3** Write 1-page operator-runbook `docs/runbooks/zflash-end-to-end.md` documenting CP-1..CP-6
- **C-T4** Update `full-ai-cluster/PROVISIONING.md` for new picker flow

### Track D — Boot-time restore robustness (post-empirical)

Defer until CP-4 surfaces actual failures, then fix-fwd. Targets: D-T1 wrong-passphrase fall-through (081KSKBP80008QG0R003AX2A69.6); D-T2 tamper detection UX; D-T3 interactive-mode systemd-ask-password TTY-binding; D-T4 multi-vendor cred round-trip test; D-T5 per-persona substrate round-trip.

### Track E — PQ git-crypt + zflash integration (081KSNY2Z0008QG0R0011XCT94)

**Gated on 081KSNY2Z0008QG0R002JKH50A reaching prototype maturity.** E-T1 wait for 081KSNY2Z0008QG0R002JKH50A prototype; E-T2 design memo `docs/zflash/pq-gitcrypt-integration.md`; E-T3 implement `tools/zflash/pq-gitcrypt-integration/`; E-T4 extend zeta-install.sh picker for PQ git-crypt key bake; E-T5 round-trip test; E-T6 compatibility test with non-PQ creds in same blob.

**Effort estimate: L (2-4 dev-days)** once 081KSNY2Z0008QG0R002JKH50A prototype is available.

### Track F — Symbiotic self-healing (081KSNY2Z0008QG0R003FR5TVG)

**Gated on basic cluster being up + at least one local node USB-bootable.** F-T1 wait for CP-6; F-T2 procure/verify GL-iNet Comet Pro KVM OR commodity-KVM-finger; F-T3 build `tools/cross-track-self-healing/cloud-controls-local/`; F-T4 build `tools/cross-track-self-healing/local-controls-cloud/`; F-T5 integration test cloud-only-down; F-T6 integration test local-cluster-down; F-T7 firmware-update playbook.

**Effort estimate: L (3-5 dev-days)** once cluster substrate validated AND KVM hardware available. Hardware procurement may dominate timeline.

### Sequencing diagram

```text
Track A (critical path):  CP-1 ── CP-2 ── CP-3 ── CP-4 ── CP-5 ── CP-6
                            \      \
Track B (--bake-cred):       ─────B-T1..B-T6 (start after CP-2)
Track C (docs/skills):       ─────────────── (parallel throughout)
Track D (boot robustness):                  D-T1..D-T5 (start after CP-4 failures)
Track E (PQ git-crypt):     (blocked on 081KSNY2Z0008QG0R002JKH50A prototype) ─── E-T1..E-T6
Track F (cross-track heal): ─────────────── CP-6 ── F-T1..F-T7 (blocked on hardware)
```

---

## 4. Compose-points with 081KSNY2Z0008QG0R0011XCT94 PQ git-crypt + 081KSNY2Z0008QG0R003FR5TVG symbiotic self-healing

### 4.1 With 081KSNY2Z0008QG0R0011XCT94 — when relative to zflash work?

**Substrate-honest:** 081KSNY2Z0008QG0R002JKH50A + 081KSNY2Z0008QG0R0011XCT94 should NOT block CP-1..CP-6. Operator's USB-iteration-speed priority needs current 081KSKBP80008QG0R003AX2A69 substrate empirically demonstrable FIRST. Then 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0011XCT94 lands as additive.

| Phase | What ships | What's deferred |
|---|---|---|
| **Phase A (now → ~1 week)** | CP-1..CP-6 demo-ready | 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0011XCT94; cluster substrate; PQ key material |
| **Phase B (after A)** | Track B (`--bake-cred`), Track C (docs), Track D (boot robustness) | 081KSNY2Z0008QG0R0011XCT94 still deferred until 081KSNY2Z0008QG0R002JKH50A prototype |
| **Phase C (after 081KSNY2Z0008QG0R002JKH50A prototype)** | 081KSNY2Z0008QG0R0011XCT94 integration: USB-bound credential substrate becomes KEY-STORE for PQ git-crypt; PQ key just becomes one more manifest entry | Hardware-bound key; per-AI distinct passphrases; cross-cluster federation |
| **Phase D (after C + operator validation)** | 081KSNY2Z0008QG0R0030V5ZVS agent-private-encrypted-state Otto-first goes live | Other AI personas' private state |

**Architectural property preserved:** ONE credential substrate primitive (USB-bound encrypted blob with operator passphrase + USB-UUID derivation). 081KSNY2Z0008QG0R002JKH50A adds a CIPHER + USE-CASE; 081KSNY2Z0008QG0R0011XCT94 wires that cipher into existing primitive WITHOUT inventing parallel primitive. Declarative manifest accommodates new cred types — that's the design's load-bearing property.

### 4.2 With 081KSNY2Z0008QG0R003FR5TVG — implications for zflash cluster

081KSNY2Z0008QG0R003FR5TVG turns zflash substrate from "initial-provisioning" into "ongoing-recovery." Implications: USB cluster nodes need addressable BIOS/boot (hardware procurement constraint per 081KSE6WT0008QG0R0029S1D5Z/081KSE6WT0008QG0R0004AP0ZA); cloud-side needs per-node USB-UUID metadata (composes with iter-4.2 capture); local-restart-GitHub-workflow needs PAT in operator's USB-bound blob (already in 081KSKBP80008QG0R003AX2A69.5 manifest); cross-node BIOS firmware update needs firmware-image distribution (composes with 081KRQ1AB0008QG0R002G93CM7); recovery flow must respect NCI HC-8.

**Sequencing:** 081KSNY2Z0008QG0R003FR5TVG should NOT start until Phase A is empirically validated. Otherwise risk building cross-track-recovery atop unproven primitive.

---

## 5. Operator-facing demo walkthrough (the MVP demo)

10-minute story, ~5 min spoken + ~10 min physical interaction.

### Pre-conditions

macOS with Touch ID; `zflash-setup` Touch ID PAM installed; `zflash` alias installed; fresh USB stick; fresh Zeta-installer ISO under `~/Downloads/`; GitHub PAT in password manager; target PC with USB-bootable BIOS.

### Act 1 — Flash USB (Mac side, ~2 min)

```text
$ zflash
ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
type: yes a3f9
> yes a3f9                ← operator types 8 chars
[Touch ID prompt]          ← operator touches trackpad
Flash complete.
iter-4.2: pubkey written; USB ejected. Safe to remove.
```

Operator narration: "One command. Eight characters typed. One fingerprint. The fingerprint is the consent floor — no agent can bypass biometric proof of physical presence."

### Act 2 — Boot target PC + interactive picker (~5 min)

```text
Step 6.94: 081KSKBP80008QG0R003AX2A69.3a cred-picker (DEFAULT-ON)
═══════════════════════════════════════════════════════════════
GitHub authentication method:
  1) Restore from encrypted USB blob (requires passphrase) — N/A
  2) Fresh device-flow login (uses gh CLI quota)
  3) Operator-provided PAT (paste at prompt; bypasses device-flow)
  4) Skip (cluster degraded; no GitHub-side substrate)
═══════════════════════════════════════════════════════════════
> 3
Paste PAT: ********************
Confirm passphrase for encryption: ********
Re-enter passphrase: ********

[zeta-creds-picker.ts]: writing encrypted blob to /mnt/boot/zeta-creds.enc
[zeta-creds-picker.ts]: --verify mode active — re-decrypting + dry-run-restoring...
[zeta-creds-picker.ts]: ✓ blob round-trip verified
```

Operator narration: "Picker shows up. I pick option 3 because I have a PAT. Type it once, set a passphrase, done. The blob is HKDF-SHA256 + AES-256-GCM keyed off USB-UUID + my passphrase — neither one alone unlocks it. `--verify` re-decrypts immediately to catch bad-blob at install time."

### Act 3 — Reboot + automatic restore (~3 min)

```text
[zeta-creds-restore]: /boot/zeta-creds.enc detected
[zeta-creds-restore]: passphrase prompt (systemd-ask-password)
> ********
[zeta-creds-restore]: ✓ decrypted
[zeta-creds-restore]: restoring ~/.config/gh/hosts.yml
[zeta-creds-restore]: restoring ~/.config/claude/credentials.json
[zeta-creds-restore]: restoring ~/.codex/auth.json
[zeta-creds-restore]: restoring ~/.gemini/oauth_creds.json
[zeta-creds-restore]: ✓ 4 creds restored

$ gh auth status
✓ Logged in to github.com as Lucent-Financial-Group
```

Operator punchline: "Second boot. I typed my passphrase ONCE. All credentials restored. ZERO `gh auth login` device-flow. ZERO 'go to github.com/login/device on your phone' tax. This is the substrate the cluster runs on. Each reboot in dev iteration is just my passphrase, not the device-flow."

### Why this demo lands

| Operator-personal-priority axis evidence (081KSNY2Z0008QG0R002CR38D8) | Demo moment |
|---|---|
| Iteration speed at DevOps | Reboot loop visibly shrinks from "device-flow tax × N" to "passphrase × N" |
| In-front-of-your-eyes word-of-mouth | Colleague SEES USB + Touch ID + cred-restore log scroll past — visceral demonstrability |
| Composes with 081KSKBP80008QG0R003RFX32N marketing strategy | Short story, small technical lift, immediately legible value |

---

## 6. Risk register

### High-impact

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| **R1** | Step-ordering bug: picker fires AFTER `gh auth login` | Medium | Verify positioning BEFORE `gh auth login` on dry-run; regression test |
| **R2** | USB-UUID mismatch install-time vs boot-time | Medium-High | Test CP-3 → CP-4 immediately; fallback "operator types USB-UUID at boot" |
| **R3** | Touch ID PAM line clobbered by macOS update | Low | Re-run `zflash-setup`; idempotent |
| **R4** | `mise activate` inside `bash -c` PATH propagation under sudo | Medium | Document explicit `bun` path fallback in zeta-install.sh |
| **R5** | Fresh ISO build fails CI | Medium | Verify `build-ai-cluster-iso.yml` green BEFORE CP-1 |
| **R6** | Target PC BIOS doesn't recognize USB as bootable | Low-Medium | Operator tests on actual target; document BIOS settings |
| **R7** | Operator runs CP-2..CP-6 under dotgit-saturation | Medium | Have known-good ISO already in `~/Downloads/` |

### Medium-impact

R8 `--bake-cred` regression in default mode (all behind flag; tests both modes). R9 wrong-passphrase fall-through loops (retry-cap; drop to console). R10 multi-vendor silent vendor drop (Track D-T4 tests all 3). R11 081KSNY2Z0008QG0R0011XCT94 tries to refactor 081KSKBP80008QG0R003AX2A69 (hold line: PQ key is one manifest entry).

### Hardware-dependent

R12 USB controller compat (flash-usb sanity rails). R13 SecureBoot + unsigned ISO (081KSKBP80008QG0R000Y2B7HC sigstore filed; disable SecureBoot one-time). R14 Operator doesn't yet own GL-iNet KVM (Track F gated). R15 Target PC no IPMI (consumer motherboards rarely; that's what 081KSE6WT0008QG0R0029S1D5Z+081KSE6WT0008QG0R0004AP0ZA substrate addresses).

### Substrate-honest compose-with

R16 081KSKBP80008QG0R000GPC0TB self-registration may run BEFORE Step 6.95-picker (verify systemd `Before=zeta-self-register.service` in zeta-creds-restore.nix). R17 081KSKBP80008QG0R002J03WGA install.sh consolidation in-flight (coordinate if it moves). R18 081KSKBP80008QG0R00146WEX1 post-boot AI-as-home-owner blocks if cred-restore breaks (CP-1..CP-6 de-risks).

---

## 7. Operational discipline notes

1. **Honor what came before** — don't refactor step numbering (drift to 6.94/6.95-picker is substrate-honest; document drift in 081KSKBP80008QG0R003ETGS01 rather than rename).
2. `--bake-cred` work goes behind a flag; default zflash unchanged per 081KSGS9H0008QG0R001EZKNCB acceptance.
3. All net-new code is TS per Rule 0; NixOS `.nix` is declarative; install-graph `.sh` carve-out does NOT extend to zflash cluster.
4. Empirical anchor every fix-fwd commit per codeql-canary discipline.
5. Substrate-or-it-didn't-happen — demo walkthrough is NOT substrate until it's a runbook (Track C-T3); writing surfaces gaps.
6. All work through isolated worktrees off `origin/main` per agent-worktree-hygiene.

---

## 8. TL;DR

- **The substrate is built.** ~75% of 081KSKBP80008QG0R003AX2A69 shipped; 081KSE6WT0008QG0R003WZAQKV + 081KSGS9H0008QG0R001EZKNCB done; 081KSKBP80008QG0R002XBRGN8 restore module + common.nix wiring landed last night.
- **Bottleneck is now empirical, not architectural.** One operator-day of CP-1..CP-6 against queued fresh USB validates the "ZERO gh-device-flow on reboot" acceptance bullet.
- **Critical path is 6 steps; parallel tracks well-defined.** Track B (`--bake-cred`) starts after CP-2; Tracks C/D fill around it.
- **081KSNY2Z0008QG0R0011XCT94 PQ git-crypt intentionally deferred** until 081KSNY2Z0008QG0R002JKH50A prototype; existing 081KSKBP80008QG0R003AX2A69 substrate accommodates PQ key as one more manifest entry.
- **081KSNY2Z0008QG0R003FR5TVG symbiotic self-healing gated on hardware** (KVM); not next-cycle scope; design notes for when it comes.
- **Demo walkthrough lands operator-personal-axis priority** — 10 minutes, 1 colleague, 2 reboots, visible-zero-device-flow.

---

## Key file paths referenced

- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/tools/zflash.ts` (46KB, 1058 lines; `--agent` shipped at lines 985-1014)
- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/tools/flash-usb.ts` (19KB)
- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/tools/zflash-setup.ts`
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-picker.ts` (303 lines)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-persist.ts` (174)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-restore.ts` (275)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-crypto.ts` (187)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-envelope.ts` (245)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-creds-manifest.ts` (180)
- `/Users/acehack/Documents/src/repos/Zeta/tools/installer/zeta-cred-handlers.ts` (258)
- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/nixos/modules/zeta-creds-restore.nix` (233)
- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/nixos/modules/common.nix` (cred-restore wired at line 67)
- `/Users/acehack/Documents/src/repos/Zeta/full-ai-cluster/usb-nixos-installer/zeta-install.sh` (Step 6.94/6.95-picker at lines 1264, 1389, 1440)
