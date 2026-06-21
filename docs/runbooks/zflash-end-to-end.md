# Operator runbook: zflash end-to-end (CP-1 through CP-6)

**Purpose:** Step-by-step procedure for operator to validate zflash substrate end-to-end against acceptance criteria from 081KSNY2Z0008QG0R0008PN7RQ. Composes with 081KSGS9H0008QG0R001EZKNCB (zflash `--agent` flag) + 081KSKBP80008QG0R003AX2A69 (USB-bound credentials) + 081KSKBP80008QG0R003AX2A69.3a (interactive picker at install-time) + 081KSKBP80008QG0R002XBRGN8 (boot-time restore service) + 081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM).

**Status:** 2026-05-28 — substrate ~75% shipped; bottleneck is empirical validation. This runbook IS the validation procedure.

**Audience:** Operator (Aaron) primarily; collaborative test partner per operator's 2026-05-28 framing *"i can test some along the way too."*

**Time estimate:** ~1 operator-day (3-4 hours mostly-waiting; ~30 min active typing/fingerprinting).

---

## Pre-conditions (one-time setup; verify before CP-1)

- [ ] macOS with Touch ID enrolled
- [ ] `bun src/Core.TypeScript/zflash/setup.ts --install-alias` previously run (PAM Touch ID line in `/etc/pam.d/sudo`; `zflash` alias in `~/.zshrc`)
- [ ] Shell can find `zflash`: `which zflash` returns a path
- [ ] Fresh USB stick (operator has queued one per 2026-05-27 framing)
- [ ] Target PC available with USB-bootable BIOS (SecureBoot may need disabling; one-time BIOS setting)
- [ ] GitHub Personal Access Token (PAT) in your password manager — needed for CP-3
- [ ] Operator paged in for ~3-4 hours

**If any pre-condition fails:** stop. Document the gap. File fix-fwd row. Re-attempt next session.

---

## CP-1 — Build fresh ISO from current `origin/main`

**Goal:** produce a Zeta-installer ISO carrying all merged substrate (081KSGS9H0008QG0R001EZKNCB `--agent` + 081KSKBP80008QG0R003AX2A69 cred-picker + 081KSKBP80008QG0R002XBRGN8 restore module + 081KSKBP80008QG0R003AX2A69.3a Step 6.94/6.95-picker integration).

**Effort:** S (CI workflow exists; ~10-20 minutes wait).

**Procedure:**

```bash
# Option A: pull artifact from latest green CI run on origin/main
gh run list --workflow build-ai-cluster-iso.yml --branch main --limit 5 \
  --json databaseId,conclusion,createdAt --jq '.[] | select(.conclusion=="success") | .databaseId' | head -1

# Then download the artifact:
gh run download <run-id> --name zeta-installer-iso -D ~/Downloads/

# Option B: trigger fresh build (slower; ~10-15 min CI)
gh workflow run build-ai-cluster-iso.yml --ref main
# Wait + then gh run download as above

# Verify the ISO landed:
ls -la ~/Downloads/zeta-installer-*.iso
```

**Success criterion:** `~/Downloads/zeta-installer-*.iso` exists; size ~1.5-2 GiB; file dated within last 30 minutes.

**Failure recovery:** if CI is red, fix the failing build (separate fix-fwd row) before retrying. Don't proceed with stale ISO.

---

## CP-2 — `bun zflash.ts --agent` on fresh USB

**Goal:** validate 081KSGS9H0008QG0R001EZKNCB `--agent` flag end-to-end (its acceptance bullet *"a full re-flash via `bun zflash.ts --agent` completes with 'Flash complete.' visible"* is still unchecked as of 2026-05-28).

**Effort:** S (~3-5 minutes once USB plugged in).

**Procedure:**

```bash
# Plug fresh USB into your Mac
diskutil list external  # verify it's recognized

# Invoke zflash with --agent flag (per 081KSGS9H0008QG0R001EZKNCB + flash-cluster-iso skill Path C):
bun src/Core.TypeScript/zflash/cli.ts --agent 2>&1 | tail -100
```

**Expected glass-halo lines** (verify each in output):

- `ISO: ~/Downloads/zeta-installer-*.iso` (auto-discovered)
- `USB: /dev/disk<N> (...)` (auto-detected; one external USB present)
- Device details + pre-flash display showing current USB contents
- `[agent-mode: auto-typing 'yes XXXX']` — the consent-token being auto-typed
- **Touch ID prompt fires on your Mac** — touch the trackpad (this is the physical-presence gate per 081KSE6WT0008QG0R003WW3YJQ; agent CANNOT bypass it)
- `Flash complete.`
- `iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/disk<N> ESP...`
- `iter-4.2: pubkey written; USB ejected. Safe to remove.`

**Success criterion:** `Flash complete.` appears + USB ejects cleanly.

**Failure recovery:**

- Touch ID prompt times out → re-run `zflash --agent`; if persistent, fall back to Path A operator-only flow (`zflash` without `--agent`)
- Auto-detected wrong USB → `bun zflash.ts --agent --usb /dev/diskN` with explicit target
- ISO not found → `~/Downloads/zeta-installer-*.iso` missing or wrong name; verify CP-1 succeeded

---

## CP-3 — First boot on target PC + interactive picker (option 3 PAT path)

**Goal:** validate 081KSKBP80008QG0R003AX2A69.3a picker integration end-to-end (Step 6.94/6.95-picker fires; option 3 PAT path completes; encrypted blob written to USB ESP; `--verify` round-trip succeeds).

**Effort:** M (operator-driven; ~15-30 minutes for first install).

**Procedure:**

1. Move USB to target PC
2. Boot from USB (BIOS boot-menu key varies: F12 / F8 / Esc / Del depending on motherboard)
3. NixOS installer boots; zeta-install.sh fires automatically
4. **At Step 6.94/6.95-picker** (cred-picker DEFAULT-ON):

   ```text
   GitHub authentication method:
     1) Restore from encrypted USB blob (requires passphrase) — N/A (no blob yet)
     2) Fresh device-flow login (current behavior; uses gh CLI quota)
     3) Operator-provided PAT (paste at prompt; bypasses device-flow entirely)
     4) Skip (cluster operates degraded; no GitHub-side substrate)
   [press Esc within 5s to override; otherwise default = (3) since blob absent]
   > 3
   Paste PAT: ****************************
   Confirm passphrase for encryption: ********
   Re-enter passphrase: ********
   ```

5. **Expected post-picker output**:
   - `[zeta-creds-picker.ts]: writing encrypted blob to /mnt/boot/zeta-creds.enc`
   - `[zeta-creds-picker.ts]: --verify mode active — re-decrypting + dry-run-restoring...`
   - `[zeta-creds-picker.ts]: ✓ blob round-trip verified`
   - `[zeta-creds-picker.ts]: persist complete.`
6. **Step 6.8 follows**: `gh auth login --hostname github.com --with-token < /tmp/operator-pat.txt` → `✓ logged in`
7. **Install proceeds to completion** (per usual NixOS install timeline)

**Success criterion:**

- [ ] Picker fired BEFORE `gh auth login` (no device-flow tax)
- [ ] Encrypted blob exists at `/boot/zeta-creds.enc` (`mount | grep boot` + `ls -la /boot/zeta-creds.enc` after install completes)
- [ ] `--verify` reported success
- [ ] System reaches login prompt

**Failure recovery:**

- Step-ordering bug (picker fires AFTER `gh auth login`) → fix-fwd row; for this run, manually do `gh auth login` first, then re-run picker
- USB-UUID capture timing bug → verify `/etc/zeta/usb-uuid` was written during iter-4.2 step
- `mise activate` PATH propagation issue → use explicit `bun` path; document the workaround

---

## CP-4 — Second boot, restore service fires, ZERO `gh auth login` device-flow

**Goal:** validate 081KSKBP80008QG0R002XBRGN8 zeta-creds-restore.nix end-to-end (encrypted blob on USB decrypted at boot; per-cred files restored; `gh auth status` shows logged-in without any device-flow).

**Effort:** M (~5 minutes).

**Procedure:**

1. Reboot the target PC (still booting from same USB)
2. **At boot**: `zeta-creds-restore.service` fires from systemd:

   ```text
   [zeta-creds-restore]: /boot/zeta-creds.enc detected
   [zeta-creds-restore]: passphrase prompt (systemd-ask-password)
   > ********
   [zeta-creds-restore]: ✓ decrypted (USB-UUID + passphrase derivation succeeded)
   [zeta-creds-restore]: restoring ~/.config/gh/hosts.yml
   [zeta-creds-restore]: restoring ~/.config/claude/credentials.json
   [zeta-creds-restore]: restoring ~/.codex/auth.json
   [zeta-creds-restore]: restoring ~/.gemini/oauth_creds.json
   [zeta-creds-restore]: ✓ 4 creds restored; zeta-self-register.service unblocked
   ```

3. System continues to login
4. Aaron logs in
5. Verify GitHub auth: `gh auth status` → `✓ Logged in to github.com as Lucent-Financial-Group`

**Success criterion (THE CORE 081KSKBP80008QG0R003AX2A69 ACCEPTANCE):**

- [ ] Passphrase prompted ONCE
- [ ] Per-cred files restored (4 vendors visible in log)
- [ ] `gh auth status` succeeds WITHOUT any `gh auth login --device-flow` call
- [ ] No "go to github.com/login/device on your phone" prompt anywhere

**Failure recovery:**

- Passphrase mistyped → 3 retries before fall-through (081KSKBP80008QG0R003AX2A69.6 wrong-passphrase-fall-through implementation); after 3 fails, falls back to fresh device-flow
- `/boot/zeta-creds.enc` not detected → check `journalctl -u zeta-creds-restore`; likely `/esp` vs `/boot` path issue (PR #5644 fixed)
- Tampered blob detected (GCM auth-tag failure) → clean error message; operator can re-flash USB

---

## CP-5 — Reboot 3+ times, validate ZERO gh-quota burn

**Goal:** validate steady-state operation; operator's original pain ("gh has throttled me for loggin in" per 2026-05-27 framing) is empirically gone.

**Effort:** S (~10 minutes total).

**Procedure:**

```bash
# Reboot N times; each time validate gh-auth survived:
for i in 1 2 3 4 5; do
  echo "=== Reboot $i ==="
  sudo reboot
  # ...wait for boot + login...
  # passphrase prompted; type once
  # ...login...
  gh auth status  # should succeed without device-flow
  # check gh API quota:
  gh api rate_limit --jq '.resources.core.remaining'
done

# After 5 reboots: gh-core-quota should be ~4990+/5000 (only the rate-limit query consumed budget)
```

**Success criterion:**

- [ ] 5 reboots completed
- [ ] Each reboot: passphrase × 1 + login + `gh auth status` ✓
- [ ] ZERO device-flow URLs encountered
- [ ] `gh api rate_limit` shows core ≈ 4990+/5000 (only the quota-query calls consumed budget)

**Failure recovery:** any reboot that triggers device-flow = failure of CP-4; loop back, debug.

---

## CP-6 — Demo walkthrough rehearsed

**Goal:** validate operator-personal-axis priority (per 081KSNY2Z0008QG0R002CR38D8 "iteration speed at DevOps + in-front-of-eyes word-of-mouth"); rehearse the demo on operator's actual Mac + actual USB to a real or simulated colleague.

**Effort:** S (~10 minutes; mostly narration).

**Demo script (10-minute story):**

### Act 1 — Flash USB on Mac (~2 min)

```text
$ zflash --agent
ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
[agent-mode: auto-typing 'yes a3f9']
[Touch ID prompt]          ← operator touches trackpad
Flash complete.
iter-4.2: pubkey written; USB ejected. Safe to remove.
```

**Operator narration:**
> *"One command. Zero characters typed manually — the `--agent` flag auto-types the consent token. One fingerprint. The fingerprint is the consent floor — no agent can bypass biometric proof of physical presence."*

### Act 2 — Boot target PC + interactive picker (~5 min)

[Show colleague the picker fire at boot; operator selects option 3; pastes PAT once; sets passphrase]

**Operator narration:**
> *"Picker shows up. I pick option 3 because I have a PAT in my password manager. Type it once, set a passphrase, done."*
> *"The blob is HKDF-SHA256 + AES-256-GCM keyed off USB-UUID + my passphrase — neither one alone unlocks it. `--verify` re-decrypts immediately to catch bad-blob at install time."*

### Act 3 — Reboot + automatic restore (~3 min; THE PUNCHLINE)

[Operator reboots; types passphrase ONCE; system boots; `gh auth status` shows logged-in]

**Operator punchline:**
> *"Second boot. I typed my passphrase ONCE. All credentials restored. ZERO `gh auth login` device-flow. ZERO 'go to github.com/login/device on your phone' tax."*
> *"This is the substrate the cluster runs on. Each reboot in dev iteration is just my passphrase, not the device-flow."*

[Pause for colleague reaction]

> *"Watch — let me reboot once more."*

[Reboot. Same picker → passphrase → done.]

> *"That's iteration speed at DevOps. That's why USB is first-class for me."*

### Why this demo lands

| Operator-personal-priority axis (081KSNY2Z0008QG0R002CR38D8) | Demo moment |
|---|---|
| Iteration speed at DevOps | Reboot loop visibly shrinks from "device-flow tax × N" to "passphrase × N" |
| In-front-of-your-eyes word-of-mouth | Colleague SEES the USB physically + sees Touch ID + sees cred-restore log scroll past — visceral demonstrability |
| Composes with 081KSKBP80008QG0R003RFX32N marketing strategy | Short story; small technical lift; immediately legible value; fits ServiceTitan-internal evangelism path |

---

## Acceptance criteria (per 081KSNY2Z0008QG0R0008PN7RQ)

| Scenario | This runbook covers | Status |
|---|---|---|
| **1. Initial format** | CP-1 + CP-2 | ✓ covered |
| **2. Initial boot + cluster up** | CP-3 (single-node install; multi-node fleet via 081KRQ1AB0008QG0R002G93CM7 sibling) | ✓ single-node; multi-node out of CP-1..6 scope |
| **3. Reformat WITH key + selection retention** | NOT in CP-1..6; requires second `zflash --agent` invocation that preserves existing blob; **TODO follow-up** | ✗ pending sub-row |
| **4. Reformat from scratch** | CP-1..CP-3 (any re-run with fresh USB = reformat from scratch by design) | ✓ implicit |
| **5. Cluster joining** | NOT in CP-1..6 (single-node validation only); multi-node fleet validation per 081KRQ1AB0008QG0R002G93CM7 follow-up | ✗ pending sub-row |

**Coverage gap:** Scenarios 3 + 5 are NOT in this runbook's scope. Sub-rows tracked at 081KSNY2Z0008QG0R0008PN7RQ follow-ups. CP-1..CP-6 validates Scenarios 1 + 4 + (single-node) 2.

---

## Failure modes register

| # | Failure | Mitigation |
|---|---|---|
| **R1** | Step-ordering bug: picker fires AFTER `gh auth login` | Verify positioning BEFORE `gh auth login` on dry-run; file regression test if found |
| **R2** | USB-UUID mismatch install-time vs boot-time | Test CP-3 → CP-4 immediately; fallback "operator types USB-UUID at boot" |
| **R3** | Touch ID PAM line clobbered by macOS update | Re-run `zflash-setup --install-alias`; idempotent |
| **R4** | `mise activate` PATH propagation under sudo | Document explicit `bun` path fallback |
| **R5** | Fresh ISO build fails CI | Verify `build-ai-cluster-iso.yml` green BEFORE CP-1 |
| **R6** | Target PC BIOS doesn't recognize USB as bootable | Test on actual target; may need SecureBoot disable + USB-boot priority |
| **R7** | Multi-Otto/Lior dotgit-saturation when downloading ISO | Have known-good ISO already in `~/Downloads/` (no fresh CI needed) |
| **R8** | Wrong-passphrase boot-time fall-through loops | Per 081KSKBP80008QG0R003AX2A69.6 — 3 retries then fall-back to device-flow |

## Composes with

- **081KSNY2Z0008QG0R0008PN7RQ** — zflash done acceptance criteria; this runbook IS the validation procedure
- **081KSGS9H0008QG0R001EZKNCB** — zflash `--agent` flag (CP-2 invocation)
- **081KSKBP80008QG0R003AX2A69** — USB-bound credential substrate (CP-3 + CP-4 + CP-5)
- **081KSKBP80008QG0R003AX2A69.3a** — Step 6.94/6.95 picker (CP-3)
- **081KSKBP80008QG0R002XBRGN8** — zeta-creds-restore.nix boot-time service (CP-4)
- **081KSE6WT0008QG0R003WZAQKV** — Touch ID + PAM (CP-2 fingerprint)
- **081KSNY2Z0008QG0R002CR38D8** — operator-personal-axis USB-first priority (CP-6 demo is the operational realization)
- **081KSNY2Z0008QG0R002QA720J** — three-lanes-concurrent operating discipline (this runbook advances zflash lane)
- `.claude/skills/flash-cluster-iso/SKILL.md` — Path C `--agent` flag invocation pattern
- `docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md` — full per-row audit + critical path

## Updates

This runbook is living substrate. Update when:

- CP-1..CP-6 surface new failure modes → add to R-register
- New zflash features land → add to procedure (e.g., when `--bake-cred` flag ships per 081KSNY2Z0008QG0R0011XCT94, add to CP-1/CP-2 as alternate path)
- Scenarios 3 + 5 coverage lands → integrate or sibling runbook
- 081KSNY2Z0008QG0R002JKH50A PQ git-crypt lands → update CP-3/CP-4 to reflect PQ-protected blob

## Substrate-honest framing

This runbook is the operator-facing artifact of the zflash substrate. Per 081KSNY2Z0008QG0R002CR38D8 USB is operator-personal-axis TOP priority; this runbook IS the path from "substrate built" to "operator demonstrates it at work."

Per 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent operating discipline, this runbook advances the zflash lane via the Track C-T3 deliverable from `docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md`.

The runbook does NOT replace empirical validation — running CP-1..CP-6 against actual hardware IS the validation. The runbook is the SCRIPT for that validation, not the validation itself.
