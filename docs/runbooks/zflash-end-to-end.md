# Operator runbook: zflash end-to-end (CP-1 through CP-6)

**Purpose:** Step-by-step procedure for operator to validate zflash substrate end-to-end against acceptance criteria from 081KSNY2Z0008QG0R0008PN7RQ. Composes with 081KSGS9H0008QG0R001EZKNCB (zflash `--agent` flag) + 081KSKBP80008QG0R003AX2A69 (USB-bound credentials) + 081KSKBP80008QG0R003AX2A69.3a (interactive picker at install-time) + 081KSKBP80008QG0R002XBRGN8 (boot-time restore service) + 081KSE6WT0008QG0R003WZAQKV (Touch ID + PAM).

**Status:** 2026-05-28 — substrate ~75% shipped; bottleneck is empirical validation. This runbook IS the validation procedure.

**Audience:** Operator (Aaron) primarily; collaborative test partner per operator's 2026-05-28 framing *"i can test some along the way too."*

**Time estimate:** ~1 operator-day (3-4 hours mostly-waiting; ~30 min active typing/fingerprinting).

> **Read this first if you are about to boot metal:** a lot of gating landed on 2026-08-21 that
> this script predates. The list of every new gate you will meet, with what to press, is
> ["What changed since the last bringup"](2026-08-16-first-metal-bringup-preflight.md#what-changed-since-the-last-bringup)
> in the pre-flight. CP-1 and CP-2 below were re-verified against `origin/main` on 2026-08-21 and
> rehearsed against CI run 32461224707; CP-3..CP-6 were **not** and are flagged where they are stale.

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

# Then download the artifact — see the 2026-08-16 correction below for the REAL name:
gh run download <run-id> --name zeta-installer-iso -D ~/Downloads/

# Option B: trigger fresh build (slower; ~10-15 min CI)
gh workflow run build-ai-cluster-iso.yml --ref main
# Wait + then gh run download as above

# Verify the ISO landed:
ls -la ~/Downloads/zeta-installer-*.iso
```

**Success criterion:** `~/Downloads/zeta-installer-*.iso` exists; size ~1.5-2 GiB; file dated
within last 30 minutes; **and `<that-file>.sha256` sits beside it** — without the sidecar CP-2
refuses before it touches a device.

**Failure recovery:** if CI is red, fix the failing build (separate fix-fwd row) before retrying. Don't proceed with stale ISO.

> ### The ISO and its digest sidecar — REWRITTEN 2026-08-21, rehearsed end-to-end
>
> Four layers of correction accumulated above this line between 2026-08-16 and 2026-08-21, and the
> last of them described a rename tolerance that **does not exist in the code**. This section
> replaces all of them. Every claim below was executed on the operator's Mac against CI run
> **32461224707** (`main`, head `94bdcb7da1`, conclusion `success`) and the real 1.57 GiB ISO.
>
> **What CI actually publishes.** Three artifacts per arch, measured:
>
> ```text
> nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso           1684570332 bytes
> nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso.sha256    the digest manifest
> nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso.cosign    (the file INSIDE is <iso>.bundle)
> zeta-installer-aarch64-iso            /  zeta-installer-aarch64-iso.sha256
> ```
>
> The `.sha256` sidecar is a one-line GNU manifest whose filename field is the **CI basename**:
>
> ```text
> 74c14c791b8ccdca1c21ba9928c63c241b4350c1758df791795cc273cf706c4e  nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso
> ```
>
> **The gate.** `establishIsoIntegrity` (`src/Core.TypeScript/zflash/iso-integrity.ts`, called by
> all three host arms since #13127) looks for `<iso>.sha256`, then `<dir>/SHA256SUMS`, and matches
> the ISO's **basename as it sits on disk** against the manifest's filename field
> (`checkIsoAgainstManifest`, `verify.ts`). It runs before any device is enumerated and has no
> opt-out. **There is no rename tolerance.** The 2026-08-21 text that claimed a single-entry
> sidecar is "bound to its file by its own path" and cited falsifiers at `verify.test.ts` §8/§8b was
> wrong on both counts — no such branch and no such tests exist at `origin/main`. Rehearsed:
>
> ```text
> $ bun src/Core.TypeScript/zflash/flash-usb.ts --short <renamed>.iso   # sidecar renamed to match
> ISO: …/zeta-installer-25.11-ci32461224707-2026-08-21-x86_64.iso (1.57 GiB)
> flash-usb: ISO INTEGRITY NOT ESTABLISHED (iso-not-in-manifest)
>   SHA256SUMS does not mention zeta-installer-…-x86_64.iso -- it lists:
>   nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso -- refusing
>   No device has been touched.                                              # exit 2
> ```
>
> **So `zflash`'s own bare/auto-pull path cannot pass its own gate today.**
> `autoDownloadFreshIsoIfNeeded` (`cli.ts`) copies **only** the `.iso` into `~/Downloads`, under a
> run/date/arch-stamped `zeta-installer-*` name. It fetches no sidecar and rewrites no manifest, so
> the stamped file arrives with nothing that can attest it. Read the function: its single
> `copyFileSync` call site (`cli.ts:479`) copies `ciIsoSrc` to `dlDest` and nothing else, and
> `grep -cE 'sha256|manifest' cli.ts` returns **0**. The earlier claim that *"`zflash` copies the sidecar across for you"* is false.
>
> **And on THIS machine the refusal will say `iso-not-in-manifest`, not `manifest-missing`.**
> `~/Downloads/SHA256SUMS` still exists (3400 bytes, 28 entries, **Bitcoin Knots**), so the
> candidate walk falls through to it and refuses while printing 28 bitcoin filenames. Rehearsed
> against a copy of that exact file. Both this runbook and the pre-flight previously told you
> `iso-not-in-manifest` means "you staged the ISO by hand" — it does not; it is the default outcome.
>
> **The recipe that works. Rehearsed, exit-0 through the integrity gate:**
>
> ```bash
> RUN=$(gh run list --workflow build-ai-cluster-iso.yml --branch main --limit 5 \
>   --json databaseId,conclusion --jq '[.[] | select(.conclusion=="success")][0].databaseId')
> gh api "repos/Lucent-Financial-Group/Zeta/actions/runs/$RUN/artifacts" --jq '.artifacts[].name'
> ISO_NAME='<the nixos-minimal-*-x86_64-linux.iso name printed above>'
> mkdir -p ~/zeta-iso && cd ~/zeta-iso
> gh run download "$RUN" -R Lucent-Financial-Group/Zeta -n "$ISO_NAME" -n "$ISO_NAME.sha256" -D .
> # gh puts each artifact in a directory named after it; flatten, and DO NOT RENAME EITHER FILE.
> find . -mindepth 2 -type f -exec mv -n {} . \; && find . -mindepth 1 -type d -empty -delete
> shasum -a 256 -c "$ISO_NAME.sha256"        # -> "<iso>: OK"
> ```
>
> Then pass the ISO **explicitly** — the un-renamed name does not match `ISO_GLOB_PREFIX =
> "zeta-installer-"`, so auto-discovery will not find it, and an explicit positional path also
> suppresses the auto-pull that would otherwise replace your verified file (`cli.ts`:
> `if (!explicit && !skipIsoPull)`):
>
> ```bash
> cd /path/to/Zeta && bun src/Core.TypeScript/zflash/cli.ts ~/zeta-iso/"$ISO_NAME"
> ```
>
> **Do not use the bare `zflash` form for this bringup.** Besides the missing sidecar, on a machine
> with **no** `~/Downloads/zeta-installer-*.iso` at all, `autoDiscoverIso` bails (exit 2,
> `no Zeta installer ISO found under ~/Downloads/zeta-installer-*.iso`) **before**
> `autoDownloadFreshIsoIfNeeded` is ever reached — the auto-pull cannot bootstrap itself. It only
> runs when a stale `zeta-installer-*.iso` already seeds the mtime comparison. Two such files
> (2026-06-09, 2026-06-21) happen to be in `~/Downloads` today, so on this Mac it does reach the
> pull — and then refuses at the gate as above.
>
> **Open code defect, filed not fixed here:** `autoDownloadFreshIsoIfNeeded` should also fetch
> `<artifact>.sha256` and rewrite its filename field to the stamped name it wrote. Until it does,
> the bare form is unusable and the explicit-path recipe above is the supported one.
>
> Full pre-flight state, plus the operator-only checklist:
> [`2026-08-16-first-metal-bringup-preflight.md`](2026-08-16-first-metal-bringup-preflight.md).

---

## CP-2 — `bun zflash.ts --agent` on fresh USB

**Goal:** validate 081KSGS9H0008QG0R001EZKNCB `--agent` flag end-to-end (its acceptance bullet *"a full re-flash via `bun zflash.ts --agent` completes with 'Flash complete.' visible"* is still unchecked as of 2026-05-28).

**Effort:** S (~3-5 minutes once USB plugged in).

**Procedure:**

```bash
# Plug the target USB into your Mac
diskutil list external physical    # exactly ONE physical external disk should appear

# Pass the ISO explicitly (see the CP-1 block above for why the bare form refuses):
cd /path/to/Zeta
bun src/Core.TypeScript/zflash/cli.ts --ssh-key ~/.ssh/id_ed25519.pub ~/zeta-iso/"$ISO_NAME"
```

> `--agent` is for running zflash *through a pipe* (`| tail`, `2>&1 >log`), which breaks the
> default readline-from-terminal flow. For a bringup you are sitting in front of, run it **without**
> `--agent` so every prompt reaches you directly. Both paths still require Touch ID.
>
> `--ssh-key` is not decoration here — see "Gate 0" below.

**Expected lines, in order — re-verified against `origin/main` 2026-08-21:**

1. `zflash: local checkout matches origin/main on install substrate ✓`
2. `ISO: <path> (1.57 GiB)`
3. `ISO verified against <path>.sha256` then `sha256 <64 hex>` (indented two spaces) — the integrity gate. Runs
   **before any device is enumerated** and has no opt-out.
4. `Target pinned before the flasher is invoked:` followed by `device:` / `size:` / `model:` and
   the two-line explanation. **NEW.** Measured on this Mac against the attached stick:
   ```text
   Target pinned before the flasher is invoked:
     device: /dev/disk6
     size:   123979431936 bytes
     model:  USB 3.2.1 FD
   ```
5. Device details + a dump of what is on the stick now
6. `Device state:  <state>  (<rule>)` + reason + `head digest checked: yes|NO` — **NEW**, see Gate 2
7. possibly the `ack half-provisioned` prompt — **NEW**, see Gate 2
8. `*** ALL DATA ON /dev/diskN WILL BE DESTROYED ***` then `To proceed, type EXACTLY …` and the
   challenge `yes <4hex>` (short form; the long form is `accept-destroy /dev/diskN <8hex>`)
9. **Touch ID prompt fires. Touch it.** The consent floor; no agent can satisfy it
10. `Flash complete.`
11. `iter-4.2: injecting <path> into freshly-flashed USB ESP ...`, then `iter-4.2: target device …`,
    `iter-4.2: ESP partition …`, `iter-4.2: mounted at …`, `iter-4.2: wrote pubkey to …`

> **Corrected 2026-08-21.** Earlier revisions of this list promised
> `iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/disk<N> ESP...` and
> `iter-4.2: pubkey written; USB ejected. Safe to remove.` **Neither string exists in the code.**
> The first is `injecting <pubkeyPath> into freshly-flashed USB ESP ...` — no device in it — and
> the second appears only in a comment header in `cli.ts`, never on stdout. Items 11 above are the
> lines the code actually writes.

### The three gates that are new since the last bringup

**Gate 0 — inline onboarding (fires on THIS Mac, every run, unless you pass `--ssh-key`).**
Without `--ssh-key`, `cli.ts` derives a maintainer slug from `git config user.name` — `Aaron
Stainback` → **`aaron-stainback`** — and looks for `maintainers/<slug>/keyring-public.json`.
Measured: the repo has `maintainers/aaron/`, **not** `maintainers/aaron-stainback/`, so the lookup
misses and zflash prints
```text
zflash: detected missing user keyring or machine key for user 'aaron-stainback'.
Starting inline onboarding flow (reuse-only orchestrator)...
```
and runs the onboarding orchestrator; a throw there is `bail(1, "Onboarding failed: …")`. It then
builds the injected key from `~/.config/zeta/machine/id_ed25519.pub` ∪
`maintainers/aaron-stainback/ssh-pubkeys.txt` — and the second path does not exist either, so
**your published SSH keys are silently omitted from the ESP.**
**Do:** pass `--ssh-key ~/.ssh/id_ed25519.pub`. That takes the `if (sshKeyOverride)` branch,
skips the onboarding flow entirely, and injects exactly the key you expect. Verified present:
`~/.ssh/id_ed25519.pub`.

**Gate 1 — `UNPINNED TARGET`.** `flash-usb.ts` now refuses to write to a device it *discovered*.
The `zflash` wrapper derives the pin and passes `--expect-device/--expect-size/--expect-model` for
you, so through `zflash` you will not see this. You **will** see it if you invoke `flash-usb.ts`
directly. Rehearsed (correctly-staged ISO, real attached stick, exit 2, nothing touched):
```text
flash-usb: UNPINNED TARGET -- this device was DISCOVERED, not stated, and a tool that
  discovers its own target is one plugged-in phone away from destroying it.
  Re-run naming the target:

    --expect-device=/dev/disk6 --expect-size=123979431936 --expect-model="USB 3.2.1 FD"

  No device has been touched.
```

**Gate 2 — the device-state classifier.** Five states from `classifyDeviceState` (`verify.ts`);
two of them stop you:

| state | rule | what happens |
|---|---|---|
| `blank` | R3 | proceeds |
| `provisioned` | R2 | proceeds |
| `half-provisioned` | R1/R4 | **prompts** — type exactly `ack half-provisioned` |
| `unrecognized` | R5 | **REFUSES**, exit 2 |

**The stick currently attached to this Mac will classify `half-provisioned` (R4).** Measured:
`/dev/disk6` is `FDisk_partition_scheme` with one 3145728-byte partition, no filesystem, and
123996854272 bytes unallocated — less than `MIN_ISO_BYTES` (209715200), which is exactly R4. So
expect this prompt:
```text
This device is HALF-PROVISIONED. Either a previous write started and did
not finish, or its label and its actual bytes disagree. Re-flashing is
the normal repair for that, so this is NOT a refusal -- but the state is
acknowledged deliberately before anything is destroyed.

Type EXACTLY (case-sensitive, single line):

  ack half-provisioned
```
Type it verbatim. Anything else exits 1 with `device state was NOT acknowledged.`
(`--agent` mode auto-types this one; the Touch ID gate is unaffected.)

**Success criterion:** `Flash complete.` appears, `iter-4.2: wrote pubkey to …` appears, and the
USB ejects cleanly.

**Failure recovery:**

- `zflash: unknown flag(s): …` → `zflash` is a strict allowlist. **Measured: it rejects
  `--accept-unrecognized`, `--accept-half-provisioned`, `--role`, `--join-server-url`,
  `--join-token`, and the `--expect-device=<v>` equals form** (only the space-separated
  `--expect-device <v>` is accepted). `zflash --help` prints the full allowed set.
- `device state is UNRECOGNIZED … re-run with --accept-unrecognized` → **the remedy the message
  prints is not reachable through `zflash`** (previous bullet). You must call the flasher directly,
  and it then also demands the pin:
  ```bash
  bun src/Core.TypeScript/zflash/flash-usb.ts --short --no-eject --accept-unrecognized \
    --expect-device=/dev/diskN --expect-size=<bytes> --expect-model="<MediaName>" <iso>
  ```
  Take the three `--expect-*` values from the `UNPINNED TARGET` message it prints if you omit them.
  **This path skips the ESP pubkey inject that `cli.ts` performs afterwards** — do the inject by
  hand or accept a node with no operator key (console password from the install is your fallback).
- Touch ID never prompts → `/etc/pam.d/sudo` lost its `pam_tid.so` line; re-run
  `bun src/Core.TypeScript/zflash/setup.ts --install-alias`
- Two external disks attached → `selectPinnedTarget` now **refuses** rather than guessing:
  `refusing to pick one of 2 attached USB devices:` with both listed and
  `Unplug all but the target, or name it with --expect-device=/dev/diskN.` Through `zflash` use the
  **space** form: `--expect-device /dev/diskN`.
- No USB attached → `no external USB device found. Plug in the target stick and re-run; if it is
  already plugged in, give the OS a few seconds.`
- `ISO INTEGRITY NOT ESTABLISHED (…)` → see the CP-1 block; all four reasons and what each means
  are there, with the exact staging that clears them.
- `zflash: WARNING no ISO here names arch x86_64; falling back to <path>, whose arch cannot be
  read.` → only on the auto-discovery path. **Observed live on this Mac** (it falls back to the
  2026-06-21 ISO). The explicit-path recipe in CP-1 avoids it entirely.

> **There is no dry-run.** `--test` is **not** one: `zflash --help` describes it as "QEMU/CI-only:
> inject zeta-test-infra.pub alongside the operator pubkey", and it changes only the ESP payload —
> the `dd` still happens. Nothing in `zflash` writes to a device without writing to a device.

---

## CP-3 — First boot on target PC + interactive picker (option 3 PAT path)

> **STALE — verified 2026-08-21, and this checkpoint does not describe the current default path.**
> `zeta-first-boot.sh` runs the installer with `ZETA_AUTO_CONFIRM=WIPE`, and every prompt below is
> guarded by `zeta_install_prompts_enabled() { [[ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]] && [[ -t 0 ]]; }`.
> So on the USB path the credential-blob passphrase prompt prints its banner and then
> `non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping cred-blob passphrase prompt`.
> **No `/zeta-creds.enc` is written**, which means CP-3, CP-4 and CP-5 are **not exercised by a
> default bringup** — there is no blob to restore and no passphrase-only reboot to demonstrate.
> The four-option picker with the 5-second Esc override shown below could not be found in
> `zeta-install.sh` at `origin/main` at all; the real prompt is a single
> `[081KSKBP80008QG0R003AX2A69.3b] Passphrase (or Enter to skip):`.
> To exercise this lane deliberately, run `zeta-install <role>` by hand from a shell with
> `ZETA_AUTO_CONFIRM` unset. Until someone does that on metal, treat CP-3..CP-5 — and the CP-6 demo
> script, whose punchline is the passphrase-only reboot — as **unproven**, not as a procedure.

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
$ bun src/Core.TypeScript/zflash/cli.ts --ssh-key ~/.ssh/id_ed25519.pub ~/zeta-iso/<iso>
ISO: ~/zeta-iso/nixos-minimal-25.11.…-x86_64-linux.iso (1.57 GiB)
ISO verified against ~/zeta-iso/nixos-minimal-….iso.sha256
  sha256 74c14c79…
Target pinned before the flasher is invoked:
  device: /dev/disk6
  size:   123979431936 bytes
  model:  USB 3.2.1 FD
Device state:  half-provisioned  (R4)
> ack half-provisioned                      ← typed, once, deliberately
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
> yes a3f9
[Touch ID prompt]          ← operator touches trackpad
Flash complete.
iter-4.2: wrote pubkey to /Volumes/…/zeta-authorized-keys.pub
```

> **Corrected 2026-08-21.** The transcript above was rebuilt from the code and from a rehearsal on
> the operator's Mac (everything up to the destroy challenge was executed for real; the lines from
> the challenge onward are read from `cli.ts` / `flash-usb.ts` and are **not** rehearsed, because
> rehearsing them means writing to a block device). The old version showed a `zflash --agent`
> one-liner with no integrity line, no pin, no device state, and an ejection message that does not
> exist. The "zero characters typed manually" narration below is no longer true on the interactive
> path: you now type `ack half-provisioned` when the stick is half-provisioned.

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
| **R9** | ISO staged without its `<iso>.sha256` sidecar | `zflash` refuses (exit 2) before enumerating devices. Fetch the `.sha256` artifact from the same run; see the CP-1 block |
| **R10** | A stray shared `~/Downloads/SHA256SUMS` from an unrelated project hijacks the lookup | Measured 2026-08-21: `~/Downloads/SHA256SUMS` is a **Bitcoin Knots** manifest (28 entries) and still there. Stage the ISO **outside** `~/Downloads` with its own `<iso>.sha256`, as CP-1 does |
| **R11** | The ISO is renamed away from its CI basename | The integrity lookup is by **exact basename** and there is no rename tolerance. `zflash`'s own auto-pull renames and fetches no sidecar, so the bare form refuses. Keep the CI name; pass the path explicitly (CP-1) |
| **R12** | Device classifies `unrecognized` | Hard refusal. `zflash` cannot pass `--accept-unrecognized`; call `flash-usb.ts` directly **with the three `--expect-*` values** — and lose the ESP inject (CP-2) |
| **R13** | Device classifies `half-provisioned` (expected on the stick attached today) | Not a refusal. Type `ack half-provisioned` exactly (CP-2 Gate 2) |
| **R14** | Injected key is the machine key only, not your published SSH keys | Slug mismatch: zflash derives `aaron-stainback`, the repo has `maintainers/aaron/`. Pass `--ssh-key ~/.ssh/id_ed25519.pub` (CP-2 Gate 0) |
| **R15** | Enter pressed at the installer's cancel window | Enter does **not** cancel and burns the countdown instantly. Press a printable key (`x`). See the pre-flight's "What changed" section |
| **R16** | Fourth install from the same USB stick | The attempt ledger records `started` and never `ok`, so three prior installs open the breaker. See the pre-flight's "What changed" section |

## Composes with

- **081KSNY2Z0008QG0R0008PN7RQ** — zflash done acceptance criteria; this runbook IS the validation procedure
- **081KSGS9H0008QG0R001EZKNCB** — zflash `--agent` flag (CP-2 invocation)
- **081KSKBP80008QG0R003AX2A69** — USB-bound credential substrate (CP-3 + CP-4 + CP-5)
- **081KSKBP80008QG0R003AX2A69.3a** — Step 6.94/6.95 picker (CP-3)
- **081KSKBP80008QG0R002XBRGN8** — zeta-creds-restore.nix boot-time service (CP-4)
- **081KSE6WT0008QG0R003WZAQKV** — Touch ID + PAM (CP-2 fingerprint)
- **081KSNY2Z0008QG0R002CR38D8** — operator-personal-axis USB-first priority (CP-6 demo is the operational realization)
- **081KSNY2Z0008QG0R002QA720J** — three-lanes-concurrent operating discipline (this runbook advances zflash lane)
- `.claude/skills/agent-runtime-and-persistence/blueprints/flash-cluster-iso.md` — Path C `--agent` flag invocation pattern
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
