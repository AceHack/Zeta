# First-metal bringup — pre-flight state and the operator-only checklist

**Date:** 2026-08-16 · **Staged by:** the shadow · **Audience:** Aaron, at the keyboard, with a USB
stick and a target box.

**Purpose.** Aaron said: *"we can move hardware and dogfood background agents forward, i'd like to
test some hardware with keys and everything working."* Everything an agent can do without him has
been done and is recorded below with what was **run** versus what was **read**. What remains is
a handful of operator acts, and every one of them is a physical presence or a biometric — the class
an agent must not perform (`nothing operator-run, only operator-approved via biometric`).

> **2026-08-21.** This said "eleven operator acts". Three of them (the console password, the
> credential-blob passphrase, `gh auth login`) **no longer fire on the default USB path**, and five
> new gates were added on the way to the wipe. The corrected walk is
> ["What changed since the last bringup"](#what-changed-since-the-last-bringup) plus §3 below,
> both re-verified against `origin/main` and rehearsed where a Mac could rehearse them.

**Register discipline.** A check that passed because no hardware was present is reported as a
**skip**, not a pass. Where the honest answer is "unproven", it says unproven.

---

## What changed since the last bringup

Nothing built after 2026-06-21 has ever run on hardware, and a lot of gating landed on
2026-08-20/21 that the rest of this document and `zflash-end-to-end.md` predate. This section is
the whole list, in the order you will meet it. **Every literal string below was read out of
`origin/main`; the ones marked "rehearsed" were executed on this Mac.** Nothing here is a guess —
where behaviour is only knowable on metal it says so.

### On the Mac, before the stick is written

| # | Gate | What you see | What you do |
|---|---|---|---|
| M1 | **ISO integrity gate** — now on all three host arms (#13127), fail-closed, no opt-out | `ISO verified against <iso>.sha256` + the digest, **or** `ISO INTEGRITY NOT ESTABLISHED (<reason>)` and exit 2 | Stage the ISO under its **CI basename** with its `.sha256` beside it. See A2 and §5 |
| M2 | **Inline onboarding** (pre-existing but never documented) | `zflash: detected missing user keyring or machine key for user 'aaron-stainback'.` | Pass `--ssh-key ~/.ssh/id_ed25519.pub` to skip it entirely. See A2 |
| M3 | **Target pin** — the flasher refuses a device it *discovered* | `Target pinned before the flasher is invoked:` + device/size/model | Read it. Confirm it is your stick |
| M4 | **Device-state classifier** | `Device state:  half-provisioned  (R4)` then a typed acknowledgement | Type `ack half-provisioned` **exactly**. The stick attached today classifies R4 — measured |

### On the target box, after it boots

| # | Gate | Where | What you see | What you do |
|---|---|---|---|---|
| B1 | **Role picker — unchanged, still 10 s** | first-boot, step 0 | `Press 'c' for control-plane / 'w' for worker-gpu / Or wait 10s …` | Press `c`. It also makes the role **DECLARED**, which skips B2 entirely |
| B2 | **mDNS bootstrap-or-join** (#13110/#13124) | after the network step, **before** any wipe | `[zeta-discovery] probing for 30000ms (token-present=false) ...` then **~30 s of a completely silent screen** | Wait. On a first node it then prints `[zeta-discovery] BOOTSTRAP — nothing answered…` and continues |
| B3 | **Pre-wipe disk probe** (#13107, "R6") | `zeta-install` step 2.5 | `── Pre-format probe (R6): what is on these disks RIGHT NOW ──` and one block per disk | **Read it.** This is your last look at what is about to be destroyed |
| B4 | **Circuit breaker** (#13107, "R9") | step 2.6 | `[R9-breaker] verdict=… state=closed\|open\|blind bound=3` | `closed`/`blind` → nothing. `open` → see below |
| B5 | **Repair mode** (#13107, "R4") | step 2.7 | `[R4-repair] a prior Zeta install was recognised…` + an identity verdict | Only on a re-pave. A failed verdict flips B6's default to ABORT |
| B6 | **Cancel window** (#13107, "R7") | step 2.9, **the last gate before `wipefs`** | `Formatting the disks listed above in 60s.` + a `60s remaining ...` countdown | **See the warning below** |

### The five things that will actually bite you at 2am

**1. Enter does NOT cancel the cancel window — and mashing it makes things worse.**
The prompt says *"Press any key to CANCEL"*. The loop is
`read -r -n 1 -s -t 1 ZETA_CANCEL_KEY` followed by `if [ -n "$ZETA_CANCEL_KEY" ]; then break; fi`.
`read -n 1` consumes Return as its *delimiter* and leaves the variable **empty**, so Enter does not
break — and because each Enter satisfies `read` immediately, the loop never waits its second.
Rehearsed on this Mac with a faithful copy of the loop (GNU bash 3.2.57; the installer runs bash 5,
where `read -n 1` behaves the same, but that is **unverified on metal**):

```text
5 Enters into a 5-second window  ->  remain=0  cancelled=NO  elapsed=0s
one 'x' into a 5-second window   ->  remain=5  cancelled=YES
```

**Press a printable key — `x`, or the space bar. Never Return.**

**2. A successful cancel reports "Install complete" and reboots the box in 10 seconds.**
Both abort branches of `zeta-install.sh` `exit 0`, and `zeta-first-boot.sh` treats a zero exit as
success: `if /run/current-system/sw/bin/zeta-install "$HOST"; then … "[zeta-first-boot] Install
complete. Rebooting in 10s (Ctrl-C to cancel) ..." ; systemctl reboot`. So after you correctly stop
a wrong-disk wipe you will be told it worked, and ten seconds later you are back at the same
countdown. **Hit Ctrl-C inside those 10 seconds** to stay put; `getty@tty1` is `mkForce false`, so
for a login use **Ctrl-Alt-F2**. None of this is printed on screen.

**3. The fourth install from one USB stick will refuse to wipe.**
The attempt ledger (`zeta-install-attempts.txt`, written to the boot stick's FAT ESP) records
`<n>|<utc>|started|wipe` before each destructive run. **Nothing anywhere writes an `ok` record** —
that `printf` is the only ledger write in the entire script — and the validator counts `started` as
a failure (`started|failed) fails=$((fails + 1))`). With `bound=3`, node 4 flashed from the same
stick gets `state=open`, the window flips to `default=abort`, and on the zero-typing path it aborts,
"completes", reboots, and does it again forever.
**Do:** press a key at the gated window to proceed deliberately, **or** mount the stick on your Mac
and delete `zeta-install-attempts.txt` from its FAT partition before each node.
The remedy the console prints — `ZETA_MAX_DESTRUCTIVE_ATTEMPTS=<n> zeta-install <HOST>` — is
correct only for the count trigger; for an *untrusted* (corrupt) ledger `zeta_pf_breaker` returns
`open` before it consults the bound, so raising it does nothing. Deleting the file is the remedy
that always works, and it is printed nowhere.

**4. `breaker is BLIND` is harmless, and nothing on screen says so.**
`blind` means the ledger surface was not writable, so *this attempt cannot be counted*. It is not a
block: the install proceeds, `default` stays `proceed`, and the only cost is the window is forced to
the full 60 s. The cause is that no non-target device offered a rw-mountable vfat partition 1 or 2
containing the marker file `zeta-authorized-keys.pub` — i.e. the stick was flashed without the ESP
inject, or is write-protected. There is no flag to clear it.

**5. Three of the eleven operator acts below no longer happen on the default path.**
`zeta-first-boot.sh` runs `zeta-install` with `ZETA_AUTO_CONFIRM=WIPE`, and
`zeta_install_prompts_enabled()` is `[[ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]] && [[ -t 0 ]]`. So the
console-password prompt (A7), the credential-blob passphrase (A8) and `gh auth login` (A9) all print
their banner and then `non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping …`.
Consequences you should expect rather than debug: the node comes up with the **default password
`zeta-change-me`**, with **no** `/zeta-creds.enc`, and with **no** GitHub auth. Do those after first
login, over SSH. The typed `Type WIPE to confirm:` prompt is skipped by the same mechanism — the
cancel window (B6) is the only consent gate that survives on this path.

### And one dead end to know about before you hit it

If discovery refuses (two clusters answered, a malformed advertisement, or — the likely one — a
**second node with no join token**), it halts and prints:

```text
[zeta-discovery] Declare the role explicitly and re-flash, e.g.:
[zeta-discovery]   zflash --role first-control-plane
[zeta-discovery]   zflash --role joiner --join-server-url <url> --join-token <file>
```

**Measured: `zflash` rejects all three of those flags.** It is a strict allowlist and `--role`,
`--join-server-url` and `--join-token` are not in it — they exist only on the file-backed CI path
(`file-backed.ts`). So for **this** bringup: bring up **one** node. Adding a second node from a
plain stick is a known open gap, not something to discover at 2am. For node 1, pressing `c` at the
role picker makes the role DECLARED and skips discovery altogether — the cheapest way to avoid the
whole class.

### What is still genuinely unknown until hardware runs

Named rather than smoothed, because a check that did not run is not a check that passed:

- Whether `read -r -n 1 -s -t 1` behaves on tty1 under systemd as it does in a terminal here.
- Whether keystrokes reach the cancel window at all for a **serial-only** operator: output is
  mirrored to `/dev/ttyS0`, but stdin is `TTYPath = /dev/tty1`. A serial watcher may see the
  countdown and be unable to answer it.
- Whether the boot stick's ESP is reachable at partition 1 or 2 (the ledger scan tries only those).
- The real shapes of `blkid` / `lsblk` / `dumpe2fs -h` output on your disks, and whether
  `mount -t ext4 -o ro,noload` succeeds on a real prior install.
- Everything about mDNS between two machines. `zeta-cluster-discover.nix` says so itself: *"the
  protocol behaviour is DESIGNED AND UNRUN until two machines boot on one segment"*, and
  `cluster-discovery-advertise.nix` has never been evaluated by a `nixos-rebuild`.
- The full keyless cosign chain. `cosign` is still not installed on this Mac (checked). The ISO ↔
  signature **digest binding** for run 32461224707 *was* verified here by hand — the bundle's
  `messageSignature.messageDigest` decodes to
  `74c14c791b8ccdca1c21ba9928c63c241b4350c1758df791795cc273cf706c4e`, which equals the ISO's
  SHA-256 — but Fulcio chain + Rekor inclusion were **not** checked.

---

## 0. What is already staged (no action required)

| Staged | Where | State |
|---|---|---|
| x86_64 installer ISO, built from `main` | ~~`~/Downloads/zeta-installer-25.11-ci31954188104-2026-08-16-x86_64.iso`~~ | **GONE as of 2026-08-18** — re-checked by `ls`; neither the ISO nor its bundle is in `~/Downloads` any more. See the correction below. |
| Its sigstore bundle | same name + `.bundle` | **GONE** (only `otto-agent-sovereign-keys.bundle` remains in that folder) |
| ISO ↔ signature binding | — | **verified**: SHA-256 `d62ff70c509eb4bb3fe5337912f7f522e47ecffbfcaceb643498dfe3423c403f` equals the `messageSignature.messageDigest` in the bundle |
| Signing identity | read from the bundle's Fulcio cert | SAN `https://github.com/Lucent-Financial-Group/Zeta/.github/workflows/build-ai-cluster-iso.yml@refs/heads/main`, OIDC issuer `https://token.actions.githubusercontent.com` |
| ISO currency vs `main` | — | **verified**: `zeta-install.sh`, `installer/configuration.nix` and `operator-ssh-keys.nix` are byte-identical between the ISO's build commit `e034c5d` and `origin/main` |
| Touch ID for `sudo` | `/etc/pam.d/sudo` line 1 | `auth sufficient pam_tid.so` **present** — `zflash-setup` does not need re-running |
| CA + machine key + registered device cert | `~/.config/zeta/{ca,machine}`, `machines/acehacks-mac-studio.local{,-cert}.pub` | **present** (checked by filename + mtime only; no key material was read, printed, or copied) |

Two older installer ISOs are still in `~/Downloads` (2026-06-09, 2026-06-21) — re-confirmed by `ls`
on 2026-08-21. They are **ten weeks stale**, neither carries an arch token, and neither has a
`.sha256` sidecar. `zflash` picks newest-by-mtime among them, so on the auto-discovery path one of
them **is** chosen (with the arch-fallback warning) — which is the opposite of what this row used to
say. A2 now stages the ISO explicitly and outside `~/Downloads`; do not hand-pick these two, and do
not rely on them not being picked.

> **Correction, 2026-08-18 (re-measured, not re-read).** The staged ISO above **is no longer on
> disk**, so any step in this document that passes that path by hand now fails at
> `flash-usb.ts`'s ISO gate with `ISO file does not exist`. The two 2026-06 ISOs are the only
> `zeta-installer-*.iso` files left, and **neither carries an arch token**, so
> `selectDownloadedIsoForArch` takes its arch-less-fallback branch on this machine today.
>
> **Use the bare `zflash` form.** Auto-pull is architecture-aware (§4 #2) and a successful
> `build-ai-cluster-iso` run exists on `main` from today, so `zflash` re-downloads the current
> x86_64 artifact and caches it as `zeta-installer-<rel>-ci<run>-<date>-x86_64.iso`. Do not
> re-stage a file by hand; that is the step this tool exists to remove.
>
> Consequence for §0's remaining rows: the digest and signing-identity verifications below were
> performed against a file that is gone. They are **not** claims about whatever ISO you flash next
> — re-verify per §4 #5 if you want the keyless chain checked.

---

## 1. Pre-flight verification — what was actually run

**Run locally by the shadow, green:**

| Check | Command | Result |
|---|---|---|
| Installer TS suite | `bun test src/Core.TypeScript/installer/` | **295 pass, 0 fail** (14 files, 572 assertions) |
| Installer source-substrate audit | `bun src/Core.TypeScript/ci/audit-installer-substrate.ts` | **PASS** — 13 required files + 8 sentinel + 1 cross-file assertion |
| iter-5.4 install-flow structural test | `bun test src/Core.TypeScript/ci/test-iter-54-install-flow.test.ts` | **29 pass, 0 fail** |
| aarch64 ISO actually boots | `qemu-system-aarch64 -machine virt,accel=hvf` on the downloaded CI artifact | **reaches `zeta-installer login:`** — see §4 |
| ISO ↔ signature digest binding | `shasum -a 256` vs bundle `messageDigest` | **match** |
| Shared-checkout freshness | `git diff HEAD origin/main` over `INSTALL_SUBSTRATE_FILES` | **FAILS TODAY** on `zeta-install.sh` — see step A0 |

**Read from CI run [31954188104](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/31954188104)
(`main`, 2026-08-16T14:56Z, conclusion `success`), not re-run here:**

- NixOS test — k3s control-plane reaches active — pass
- NixOS test — k3s agent joins the server — pass
- NixOS test — cluster all the way up, node Ready + CoreDNS — pass
- Build installer ISO, ISO-content audit — pass
- Scenario 1 (initial format: audit + `zflash --test` + QEMU boot) — pass
- Scenario 2 (boot + install substrate) — pass
- cosign keyless sign of the ISO — pass

**Skipped in that run, so unproven, and named as skips:** WiFi-ESP acceptance, scenario 3
(reformat with retention), scenario 4 (path-fork migrate vs fresh). All three are
`workflow_dispatch`-only. If you want them before touching metal, dispatch the workflow manually.

**Not runnable without you:** anything that writes a block device, associates a radio, or takes a
fingerprint.

---

## 2. Which arch is proven

**Aaron's cluster target is x86_64, and x86_64 is the proven path.** `full-ai-cluster/flake.nix`
states it directly — the NixOS `checks` are gated to `x86_64-linux` "because the nixosTest driver
boots an x86_64 VM (**and our cluster nodes are x86_64**)". The k3s control-plane / agent-join /
cluster-online tests, scenario 1 and scenario 2 all run on that arch and all passed today.

aarch64 is the Raspberry Pi rung (`installer-aarch64`), it is **not** the target for this bringup,
and it is **not** cosign-signed (only the x86_64 job has a signing step). Use the staged x86_64 ISO.

---

## 3. The operator-only checklist

Everything below needs a hand, an eye, or a finger. Nothing below can be delegated.

> **Renumbered 2026-08-21.** This was "eleven acts". A5.5 and A6.1–A6.4 are **new gates** that
> landed 2026-08-20/21; A6 no longer prompts and A7–A9 no longer fire on the default path. Step
> letters are kept where they were so older notes still resolve.

### A0 — Refresh the checkout (30 s, and it is currently required)

```bash
git -C /Users/acehack/Documents/src/repos/Zeta pull --rebase origin main
```

**Why now:** `zflash`'s iter-4.3 guard diffs seven install-substrate files against `origin/main` and
refuses to flash if any differ. Measured today: `full-ai-cluster/usb-nixos-installer/zeta-install.sh`
**differs** in the shared checkout. Without this pull, step A1 aborts before it touches the stick.

**Expected:** the pull succeeds and `git diff --quiet HEAD origin/main -- full-ai-cluster/usb-nixos-installer/zeta-install.sh` is silent.
**Failure signature:** `iter-4.3 freshness check FAILED — local checkout differs from origin/main on N install-substrate file(s)`.

### A1 — Insert the USB stick into the Mac

```bash
diskutil list external
```

**Expected:** exactly one external physical disk, with a size that matches the stick.
**Failure signature:** empty output, or two external disks. Two is the dangerous case — `zflash`
auto-detects and a second stick makes the auto-detection ambiguous. Unplug the other one.

### A2 — Flash, and give the fingerprint

**REWRITTEN 2026-08-21 and rehearsed.** The previous version told you to use the bare `zflash`
form. That form cannot pass zflash's own ISO integrity gate today — see §5 for the measurement.
Stage the ISO first, then pass it explicitly:

```bash
# 1. Stage the ISO under its CI basename, WITH its digest sidecar, OUTSIDE ~/Downloads.
RUN=$(gh run list --workflow build-ai-cluster-iso.yml --branch main --limit 5 \
  --json databaseId,conclusion --jq '[.[] | select(.conclusion=="success")][0].databaseId')
gh api "repos/Lucent-Financial-Group/Zeta/actions/runs/$RUN/artifacts" --jq '.artifacts[].name'
ISO_NAME='<the nixos-minimal-*-x86_64-linux.iso name printed above>'
mkdir -p ~/zeta-iso && cd ~/zeta-iso
gh run download "$RUN" -R Lucent-Financial-Group/Zeta -n "$ISO_NAME" -n "$ISO_NAME.sha256" -D .
find . -mindepth 2 -type f -exec mv -n {} . \; && find . -mindepth 1 -type d -empty -delete
shasum -a 256 -c "$ISO_NAME.sha256"          # -> "<iso>: OK"

# 2. Flash. --ssh-key is load-bearing -- see "the onboarding detour" below.
cd /Users/acehack/Documents/src/repos/Zeta
bun src/Core.TypeScript/zflash/cli.ts --ssh-key ~/.ssh/id_ed25519.pub ~/zeta-iso/"$ISO_NAME"
```

**Do NOT rename the ISO.** The integrity lookup is by exact basename and there is no rename
tolerance. **Do NOT stage it in `~/Downloads`** — a stray `SHA256SUMS` belonging to Bitcoin Knots
still lives there and the gate will find and parse it.

**The onboarding detour — why `--ssh-key` is load-bearing.** Without it, `cli.ts` derives a
maintainer slug from `git config user.name` — `Aaron Stainback` → **`aaron-stainback`** — and looks
for `maintainers/<slug>/keyring-public.json`. **Measured: the repo has `maintainers/aaron/`, not
`maintainers/aaron-stainback/`.** So the lookup misses on every run and zflash prints

```text
zflash: detected missing user keyring or machine key for user 'aaron-stainback'.
Starting inline onboarding flow (reuse-only orchestrator)...
```

then runs the onboarding orchestrator, whose failure path is `bail(1, "Onboarding failed: …")`. It
then builds the key it injects from `~/.config/zeta/machine/id_ed25519.pub` ∪
`maintainers/aaron-stainback/ssh-pubkeys.txt` — and the second path does not exist either, so
**your published SSH keys are silently left off the stick**. Passing `--ssh-key` takes the
`if (sshKeyOverride)` branch, skips the onboarding flow entirely, and injects exactly the key you
named. Verified present on this Mac: `~/.ssh/id_ed25519.pub` and
`~/.config/zeta/machine/id_ed25519.pub`.

**Expected, in order:**

- `zflash: local checkout matches origin/main on install substrate ✓`
- `ISO: …/nixos-minimal-25.11.…-x86_64-linux.iso (1.57 GiB)`
- `ISO verified against …/<iso>.sha256` then `sha256 <64 hex>` (indented two spaces) — the integrity gate. It runs
  **before** any device is enumerated and has no opt-out; if it refuses, nothing was touched
- `Target pinned before the flasher is invoked:` with `device:` / `size:` / `model:` — **NEW**.
  Rehearsed against the stick attached to this Mac:
  ```text
  Target pinned before the flasher is invoked:
    device: /dev/disk6
    size:   123979431936 bytes
    model:  USB 3.2.1 FD
  ```
- `USB: /dev/diskN (…)` and a printed dump of what is on the stick now
- `Device state:  half-provisioned  (R4)` + a reason + `head digest checked:` — **NEW**. The
  currently-attached stick classifies R4 (measured: `FDisk_partition_scheme`, one 3145728-byte
  partition, no filesystem, allocated < `MIN_ISO_BYTES` = 209715200)
- the acknowledgement prompt — **NEW**. Type **exactly** `ack half-provisioned`
- `*** ALL DATA ON /dev/diskN WILL BE DESTROYED ***` and a challenge — you type `yes <nonce>`
- **Touch ID prompt fires. Touch it.** This is the consent floor; no agent can satisfy it.
- `Flash complete.`
- `iter-4.2: injecting <path> into freshly-flashed USB ESP …` then `iter-4.2: target device …`,
  `ESP partition …`, `mounted at …`, `wrote pubkey to …`

> **Corrected:** earlier revisions promised `iter-4.2: injecting ~/.ssh/id_ed25519.pub into
> /dev/diskN ESP…` and `pubkey written; USB ejected.` **Neither string is in the code** — the second
> exists only inside a comment header in `cli.ts`. The bullets above are what is written to stdout.

**Failure signatures:**

- aborts at the freshness line → go back to A0
- `ISO INTEGRITY NOT ESTABLISHED (manifest-missing)` → no `<iso>.sha256` beside the image.
  Refusal, exit 2, **before any device is enumerated**. Fetch the `.sha256` artifact from the
  **same CI run** into the same directory. **The earlier claim that zflash's auto-pull carries the
  sidecar across for you is false** — read `autoDownloadFreshIsoIfNeeded`: its single
  `copyFileSync` call site copies the `.iso` and nothing else
- `ISO INTEGRITY NOT ESTABLISHED (iso-not-in-manifest)` → **two causes, and the common one is not
  the one previously documented.** (a) You staged in a directory holding a foreign `SHA256SUMS` —
  measured on this machine, `~/Downloads/SHA256SUMS` is a Bitcoin Knots manifest and the refusal
  prints 28 bitcoin filenames. (b) **You renamed the ISO** (or let `zflash` rename it): the sidecar
  still records the CI basename, and the lookup is by exact basename. Rehearsed both. Fix: stage
  under the CI name, outside `~/Downloads`
- `ISO INTEGRITY NOT ESTABLISHED (digest-mismatch)` → the bytes are not the bytes CI built.
  Re-download before assuming it was a truncated transfer
- `ISO INTEGRITY NOT ESTABLISHED (manifest-unreadable | iso-unreadable)` → **new since #13127.**
  A permission error, not a missing file. The message names which
- `UNPINNED TARGET` → you invoked `flash-usb.ts` directly. `zflash` derives and passes the pin; the
  message prints the exact three `--expect-*` values to paste back
- `refusing to pick one of N attached USB devices` → unplug the others, or name it with
  `--expect-device /dev/diskN` (through `zflash` the **space** form only; `--expect-device=<v>`
  is rejected as an unknown flag — measured)
- `device state is UNRECOGNIZED … re-run with --accept-unrecognized` → **the remedy is not
  reachable through `zflash`** (strict allowlist, measured). Call the flasher directly and supply
  the pin as well — and note this path skips the ESP pubkey inject:
  ```bash
  bun src/Core.TypeScript/zflash/flash-usb.ts --short --no-eject --accept-unrecognized \
    --expect-device=/dev/diskN --expect-size=<bytes> --expect-model="<MediaName>" <iso>
  ```
- `zflash: WARNING no ISO here names arch x86_64; falling back to …` → auto-discovery only.
  **Observed live on this Mac today.** The explicit-path form above avoids it
- Touch ID never prompts → `/etc/pam.d/sudo` lost its `pam_tid.so` line (a macOS update does this);
  re-run `bun src/Core.TypeScript/zflash/setup.ts --install-alias`
- `Flash complete.` but no `wrote pubkey to …` → the ESP inject skipped; the node will come up
  **without** your SSH key. On the default path A7 also no longer sets a password, so your console
  fallback is the built-in default `zeta-change-me`

> **There is no dry-run.** `--test` is not one — `zflash --help`: *"QEMU/CI-only: inject
> zeta-test-infra.pub alongside the operator pubkey"*. It changes the ESP payload only; the `dd`
> still happens. Nothing in zflash writes an ISO to a device without writing it to a device.

### A3 — Move the stick to the target box and boot it

Physical: unplug, plug into the x86_64 target, power on, hit the boot-menu key (F12 / F8 / F11 / Esc
/ Del — board-dependent), pick the USB device.

**Expected:** GRUB, then a NixOS boot, then the first-boot service takes tty1.
**Failure signature:** "no bootable device" → Secure Boot is on, or USB is below the internal disk in
boot order. Both are one-time BIOS settings.

### A4 — Role picker (10-second window)

**Expected on tty1:**

```
Press 'c' for control-plane
Press 'w' for worker-gpu
Or wait 10s to accept default (control-plane) ...
```

Press `c` for the first node. **Failure signature:** the prompt scrolls past unpressed → it takes the
default from `/etc/zeta-firstboot.conf`, which is `control-plane`. For the first node that is
harmless; for a worker it is not, so watch for it.

### A5 — Network (this is where the radio gate lives)

**Ethernet:** nothing to do; it waits up to 30 s for DHCP + internet.

**WiFi only:** `nmtui` launches. Pick the SSID and type the PSK. **This is the radio-associate gate —
metal-only, never simulated in CI.** If you escape out without connecting, `nmtui` relaunches rather
than dropping you to a shell.

**Failure signature:** `No wifi hardware — waiting …s for ethernet` on a box you believed had WiFi
means the NIC's firmware did not load; check `dmesg | grep -i firmware` from the shell drop.

> **Added 2026-08-21.** The nmtui retry is a `while true` loop with **no timeout**: on a box with
> WiFi hardware and no working internet it will re-launch forever. Pressing `s` at the retry prompt
> is the only escape and drops you to a shell. `has_internet` is a real reachability check
> (`ping 1.1.1.1` then `ping github.com`), not a link check — so a connected-but-firewalled
> network keeps you in the loop. On a no-WiFi box the path is different and does **not** loop:
> it waits 90 s and then prints `Still offline; proceeding to zeta-install (will fail loudly if
> unreachable).`

### A5.5 — Cluster discovery (NEW: mDNS bootstrap-or-join)

**Runs after the network step and before anything is wiped.** Added by #13110 / #13124.

**Expected on a first node:**

```text
[zeta-discovery] bootstrap-or-join check
[zeta-discovery] probing for 30000ms (token-present=false) ...
```

then **roughly 30 seconds of a completely silent screen** — no dots, no countdown — then:

```text
zeta-cluster-discover: discovery heard nothing in <N> ms over 5 query bursts
zeta-cluster-discover: silence passed the admissibility check (dwell, elapsed, query count)
[zeta-discovery] BOOTSTRAP — nothing answered, and the silence passed
[zeta-discovery] the admissibility check. Keeping role control-plane (first-control-plane).
```

Nothing blocks. Cost: ~30 s. **The dead screen is normal — do not power-cycle.**

**If you pressed `c` at A4** the role is DECLARED and you instead see
`[zeta-discovery] SKIPPED — the role was DECLARED (keystroke:c).` That is the fastest path and
skips this whole class of failure.

**Failure signatures:**

- `[zeta-discovery] DISCOVERY DID NOT RUN: <reason>` followed by *"This is a check that did not
  run, NOT a check that passed"* → **does not halt**; it falls back to `control-plane` and installs.
  Reasons: `disabled by ZETA_DISCOVERY=off`, `zeta-cluster-discover is not on PATH`,
  `probe-failed: …`, `dwell-too-short: …`
- a `╭─ CLUSTER DISCOVERY REFUSED ─╮` box → **halts and drops to a shell**, nothing wiped. The
  reachable reasons as the installer wires it are `multiple-clusters-answered`,
  `malformed-advertisement`, `trust-domain-disagreement` and — the one you will actually hit on a
  second node — `join-token-unavailable`
- **The remedy the box prints does not exist.** It says `zflash --role first-control-plane` /
  `zflash --role joiner --join-server-url <url> --join-token <file>`; **measured, `zflash` rejects
  all three flags** (strict allowlist). See "one dead end" in "What changed" above. Bring up one
  node this session

> **Unproven on metal.** `zeta-cluster-discover.nix` says so in its own comment: *"the protocol
> behaviour is DESIGNED AND UNRUN until two machines boot on one segment."* The 30 s dwell is
> derived from RFC 6762 timers, not from an observed time-to-first-answer.

### A6 — The BOOT disk (CORRECTED: no prompt on this path)

**The `Which disk is the BOOT disk …?` prompt does NOT fire.** `zeta-first-boot.sh` exports
`BOOT_DISK=auto`, and `zeta-install.sh` takes the `elif [[ "$BOOT_DISK" == "auto" ]]` branch, which
resolves silently to the fastest internal disk (NVMe > SSD > HDD). Every other internal disk becomes
a DATA disk and **is wiped**. USB-transport disks are filtered out before the probe.

**Your control point is A6.4, not this step.** The enumeration is printed, then the pre-format
probe shows you exactly what is on each disk, then the cancel window is your chance to stop it.

**Failure signature:** `ERROR: BOOT_DISK <x> not in internal-disk set` (only reachable if you ran
`zeta-install` by hand with an explicit `BOOT_DISK`).

### A6.1 — Pre-wipe disk probe (NEW, "R6")

```text
── Pre-format probe (R6): what is on these disks RIGHT NOW ──
  /dev/nvme0n1: prior-zeta-install   (931.5G NVMe)
      partition table: gpt
      /dev/nvme0n1p2: ext4 label=nixos partlabel=root  340 GiB used   [ZETA-STAMPED]
```

Five dispositions, first match wins: `installer-medium` · `prior-zeta-install` · `foreign-data` ·
`blank` · `indeterminate`. **None of them prompts** — the probe prints, and sets how long the A6.4
window is. A probe error becomes `indeterminate` (failure-closed) and keeps the full 60 s.

**This is your last look at what is about to be destroyed. Read every block.**

`[R6] REFUSED /dev/…: carries the ZETA_INSTALL volume label; removed from the wipe scope` protects
a Zeta stick that does not present as USB (an NVMe enclosure, a QEMU `vd*`). If that disk *is* the
BOOT disk the script dies with `ERROR: BOOT_DISK … is the installer medium, not an install target.`

Then: `[R6/R7] mode=fresh-install window=60s default=proceed`.

### A6.2 — Circuit breaker (NEW, "R9")

```text
[R9-breaker] attempt ledger: /tmp/zeta-attempt-ledger/zeta-install-attempts.txt
[R9-breaker] verdict=trusted 1 state=closed bound=3
```

Three states: **`closed`** (proceed), **`blind`** (ledger not writable — *harmless*, install
proceeds, window forced to 60 s), **`open`** (proceed only on a deliberate keypress).
See items 3 and 4 of "the five things that will bite you" above — including the fact that
**three prior installs from the same stick will open it**, and that deleting
`zeta-install-attempts.txt` from the stick's FAT partition is the remedy that always works.

### A6.3 — Repair mode (NEW, "R4") — only on a re-pave

Fires automatically when any in-scope disk classified `prior-zeta-install`. Reads four files from
the old root over a read-only, `noload` ext4 mount and prints a verdict:

```text
[R4-repair] a prior Zeta install was recognised on an in-scope disk.
[R4-repair]   recovered hostname=… mac=… cidr=… cp=…
[R4-repair]   identity verdict: trusted
[R4-repair]   REUSING identity: this node rejoins as … rather than registering a duplicate
```

If the verdict is not `trusted`, it prints `REFUSING to proceed by default: …` and **flips A6.4's
default to ABORT** — a keypress is then required to proceed. On a first bringup with clean disks
this whole step does not appear.

A `[R8-seam]` line may also print: any `zeta-creds.enc` found is **destroyed by the wipe and not
carried forward**. Nothing prompts about it.

### A6.4 — The cancel window (NEW, "R7") — the last gate before `wipefs`

```text
  Formatting the disks listed above in 60s.
  Press any key to CANCEL and drop to a shell.
  Do nothing and the install proceeds (headless default).
  60s remaining ...
```

60 s normally; **10 s only when every in-scope disk classified `blank`**; always 60 s if the breaker
is `open` or `blind`. Zero typing ⇒ it proceeds and prints
`[R7] No keypress; proceeding (headless default preserved).`

**Press `x` (or space) to cancel — NOT Return.** Enter does not cancel and burns the countdown
instantly; the mechanism and the rehearsal are in item 1 of "the five things" above. And read item 2
before you cancel: a successful cancel prints `[R7] CANCELLED by operator keypress. Nothing was
wiped.` and exits 0, which `zeta-first-boot.sh` reports as **"Install complete. Rebooting in 10s"**.
Hit **Ctrl-C** inside those 10 s.

If the default was flipped to ABORT and you do nothing:
`[R7/R9] No keypress and the default is ABORT. Not wiping anything.` — note its `Reason:` line is a
fixed template that interpolates the breaker state, so it can read `Reason: closed breaker /
repair-identity refusal above` when the cause was the identity refusal alone.

### A7 / A8 / A9 — CORRECTED: these do not fire on the default path

The console-password prompt (was A7), the credential-blob passphrase (was A8) and `gh auth login`
(was A9) are all guarded by
`zeta_install_prompts_enabled() { [[ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]] && [[ -t 0 ]]; }`, and
`zeta-first-boot.sh` runs the installer with `ZETA_AUTO_CONFIRM=WIPE`. Each prints its banner and
then `non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping …`.

**So expect, rather than debug:**

- the `zeta` user keeps the default password **`zeta-change-me`** — rotate it after first login
- **no** `/zeta-creds.enc` is written, so CP-4 / CP-5 of `zflash-end-to-end.md` (passphrase-only
  reboots, zero device-flow) are **not exercised by this bringup**
- **no** GitHub auth on the node; run `gh auth login` yourself over SSH afterwards
- the typed `Type WIPE to confirm:` prompt is skipped by the same mechanism

To get the interactive versions you would run `zeta-install <role>` by hand from a shell with
`ZETA_AUTO_CONFIRM` unset. That is a deliberate second pass, not the default path.

### A10 — Let it install, then verify from the Mac

The install runs to completion and reboots on its own. Then, from the Mac:

```bash
ssh nixos@<hostname>.local 'systemctl is-active k3s && sudo k3s kubectl get nodes -o wide && sudo k3s kubectl get pods -A'
```

**Expected:** `active`; the node in `Ready`; CoreDNS running. These are exactly the three assertions
the `k3s-cluster-online` NixOS test makes in CI, so a green here means metal reproduced CI.
**Failure signature:** `k3s` in `activating (auto-restart)` → the token deadlock class; grab
`journalctl -u k3s -b` before rebooting, it is the evidence that matters.

---

## 4. Known unknowns — named, not smoothed

**#1 — The aarch64 boot smoke-test used to report green while timing out. Fixed since this was
written; the paragraph below is kept because its conclusion still stands.**

> **Update 2026-08-18.** `continue-on-error: true` is **gone** from that step. The workflow now
> reads the harness exit code and routes it: `0` BOOTED passes, `1` BOOT-FAILED **fails the job**,
> `3` TIMEOUT and `4` STALLED warn only. So a boot *break* now blocks and a *budget* overrun does
> not — which is the distinction the paragraph below was arguing for. The honest limit the workflow
> states in its own comment: a break that manifests as a silent hang past the bootloader still lands
> in the advisory bucket.

The step was `continue-on-error: true`, so the job was green whatever happened. In `main`
run (31954188104) that step ran **exactly 1800 s** — `15:15:21Z → 15:45:22Z` — and its log ends:

```
Exit code: 1
Reason: Timeout (1800s) waiting for "zeta-installer login:"
EFI stub: Exiting boot services...
```

That is a real, currently-green-but-failing check, and it should be read as a **skip**.

**What is new here:** the same artifact from that same run was downloaded and booted locally under
HVF on an arm64 Mac, and it **reached the login prompt**:

```
zeta-installer login: nixos (automatic login)
nixos@zeta-installer:~$
```

Reproduce:

```bash
gh run download <run-id> -R Lucent-Financial-Group/Zeta -n zeta-installer-aarch64-iso -D /tmp/iso
cp /opt/homebrew/share/qemu/edk2-aarch64-code.fd /tmp/iso/code.fd
dd if=/dev/zero of=/tmp/iso/vars.fd bs=1m count=64
qemu-system-aarch64 -machine virt,accel=hvf -cpu host -m 2048 -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/tmp/iso/code.fd \
  -drive if=pflash,format=raw,file=/tmp/iso/vars.fd \
  -cdrom /tmp/iso/*.iso -boot d -serial file:/tmp/iso/serial.log \
  -display none -no-reboot -nic none
```

So the conclusion is: **aarch64 emulated boot is proven; the CI failure is a TCG budget problem, not
a boot defect.** CI runs `-cpu max` under pure TCG on `ubuntu-24.04-arm` (GitHub's ARM runners expose
no `/dev/kvm`), which is tens of times slower than the accelerated path. What remains genuinely
unproven for aarch64 is **metal** — a Pi has never booted this image — and aarch64 is not this
bringup's target anyway (§2).

Riven's PR #10959 (`riven/fix-qemu-uefi-serial`, merged) touches
`src/Core.TypeScript/installer/multiboot/*` — the UEFI **menu** smoke test. It does **not** touch
`src/Core.TypeScript/ci/qemu-boot-test.ts`, so this aarch64 step is a different, still-open lane.
Nothing in that branch was modified here.

**#2 — `zflash` CI auto-pull was architecture-blind. CLOSED 2026-08-18.**

`autoDownloadFreshIsoIfNeeded` ran `gh run download <id>` with **no artifact filter**, then
`findIsoUnder` returned the **first** file ending in `.iso` in `readdirSync` order. Since the
aarch64 job was added a run carries **two** ISOs, and nothing in that walk preferred x86_64. The
destination name it wrote — `zeta-installer-25.11-ci<run>-<date>.iso` — recorded no architecture
either, so a wrong pick also became the newest file in `~/Downloads` and won every **later**
auto-discovery. Sticky, and invisible in the filename.

The fix (PR on `dejan/zflash-iso-arch-selection`): selection is now a pure, tested function.
`selectIsoForArch` collects **every** `.iso` in the download tree, sorts them so the verdict does
not depend on `readdirSync` order, and reads the architecture from the whole path — the artifact
DIRECTORY as well as the name, because `configuration.nix` `mkForce`s an `isoName` carrying no arch
token. It **refuses rather than guesses**: only-wrong-arch and genuinely-ambiguous trees are errors
that name the failure, not picks. The cached copy is now stamped `...-<arch>.iso`, and
`autoDiscoverIso` filters `~/Downloads` by arch so a stale wrong-arch file can no longer win on
mtime alone. `--iso-arch x86_64|aarch64|host` overrides; the default is **x86_64**, because the
cluster nodes are x86_64 and deriving it from the host would pick aarch64 on your Mac every time.

Falsifier: mutate `selectIsoForArch` back to "return the first ISO" and 7 tests in
`src/Core.TypeScript/zflash/lib.test.ts` go red. Verified.

**#3 — `~/.config/zeta/{keyring,keyset}` do not exist.** The
`cluster-encryption-credential-substrate` RESUME (last refreshed 2026-06-21) describes a teardown
primitive over `~/.config/zeta/{ca,machine,keyring,keyset}`. Only `ca/` and `machine/` are present
(both dated 2026-06-21). Checked by directory listing only — no file contents were read. Whether
`keyring`/`keyset` are created later in a flow or are simply not part of this machine's state is
**not determined here**.

**#4 — `maintainers/aaron/` has no `cluster-nodes/`.** `Addisons820` and `maximdolphin` each have two
registered nodes; Aaron has none. So the Step 6.9 self-registration path has demonstrably worked for
other maintainers and has **never been exercised for Aaron's identity**. Expect A9→self-registration
to be the least-travelled step of the run.

**#5 — cosign is not installed on the Mac,** and it is not declared in any ACE manifest. The digest
binding in §0 was verified without it; the **full keyless chain** (Fulcio cert chain + Rekor
inclusion proof) was **not**. To close that:

```bash
brew install cosign
# NOTE 2026-08-21: use the ISO under its CI BASENAME, as staged by A2 -- the bundle
# artifact is named `<iso>.cosign` but the FILE inside it is `<iso>.bundle`, named
# after the CI basename. A renamed ISO leaves you with no `$ISO.bundle` at all.
ISO=~/zeta-iso/nixos-minimal-25.11.<...>-x86_64-linux.iso
cosign verify-blob \
  --bundle "$ISO.bundle" \
  --certificate-identity 'https://github.com/Lucent-Financial-Group/Zeta/.github/workflows/build-ai-cluster-iso.yml@refs/heads/main' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  "$ISO"
```

2026-08-18: `zflash`'s auto-pull copies **only** the `.iso` into `~/Downloads` — neither the
sigstore bundle **nor the `.sha256` digest sidecar** travels with it, so `$ISO.bundle` will not
exist until you `gh run download` the `.cosign` sibling from the same run. (The missing sidecar is
the more serious half; see §5.)

**Rehearsed 2026-08-21 without cosign, for run 32461224707.** The `.cosign` artifact was
downloaded, its `messageSignature.messageDigest` base64-decoded to
`74c14c791b8ccdca1c21ba9928c63c241b4350c1758df791795cc273cf706c4e`, and that equals the ISO's
measured SHA-256. So the **digest binding** holds for the ISO you are about to flash. The Fulcio
certificate chain and the Rekor inclusion proof remain **unverified** — `cosign` is still not
installed on this Mac (checked).

---

## 5. Corrections to `zflash-end-to-end.md` — and to THIS file

Both documents have been corrected in the same change that added §"What changed since the last
bringup". What follows is the ledger of what was **wrong**, so the corrections are auditable rather
than merely applied. "Rehearsed" means executed on this Mac on 2026-08-21 against CI run
**32461224707** and its real 1.57 GiB x86_64 ISO.

### Wrong, not merely stale

1. **The rename tolerance does not exist.** The 2026-08-21 block in `zflash-end-to-end.md` CP-1
   claimed a single-entry `<iso>.sha256` sidecar is "bound to its file by its own path" so a
   renamed ISO still verifies, and cited falsifiers at `verify.test.ts` §8 / §8b.
   `checkIsoAgainstManifest` has **no such branch** (it does `entries.find(e => e.filename ===
   isoBasename)` and nothing else) and `verify.test.ts` has **no such sections**. This file's A2
   listed the resulting `ISO verified against … NOTE the manifest records this image as …` line as
   an expected non-failure; **that string exists nowhere in the repo.**
   *Rehearsed:* renaming the ISO and carrying the sidecar under the new name — exactly what CP-1's
   own manual block instructed — produces
   `ISO INTEGRITY NOT ESTABLISHED (iso-not-in-manifest)`, exit 2.
   **This is the defect class in its purest form: following the runbook converted one refusal into
   a different one.**

2. **"`zflash` copies the sidecar across for you on the auto-pull path" is false.**
   `autoDownloadFreshIsoIfNeeded`'s single `copyFileSync` call site (`cli.ts:479`) copies
   `ciIsoSrc` to `dlDest` and nothing else, and `grep -cE 'sha256|manifest' cli.ts` returns **0**. Consequence: the bare `zflash` form, which both
   documents recommended, **cannot pass zflash's own integrity gate.**

3. **`iso-not-in-manifest` was documented as meaning "you staged by hand".** It is the *default*
   outcome of the recommended path, for two reasons: the rename (1), and — on this machine —
   `~/Downloads/SHA256SUMS`, which is a **Bitcoin Knots** manifest (3400 bytes, 28 entries, still
   present). *Rehearsed both.*

4. **The bare form cannot bootstrap itself at all on a clean machine.** `autoDiscoverIso` bails
   (`no Zeta installer ISO found under ~/Downloads/zeta-installer-*.iso`, exit 2) **before**
   `autoDownloadFreshIsoIfNeeded` is reachable — the auto-pull only runs when a stale
   `zeta-installer-*.iso` already seeds the mtime comparison.

5. **Two documented output lines do not exist.**
   `iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/disk<N> ESP...` — the real line is
   `injecting <pubkeyPath> into freshly-flashed USB ESP ...`, with no device in it. And
   `iter-4.2: pubkey written; USB ejected. Safe to remove.` appears **only inside a comment header**
   in `cli.ts`; it is never written to stdout.

6. **`Which disk is the BOOT disk …?` does not prompt on this path.** `zeta-first-boot.sh` exports
   `BOOT_DISK=auto`, which `zeta-install.sh` resolves silently.

7. **A7 / A8 / A9 do not fire on this path** — `ZETA_AUTO_CONFIRM=WIPE` disables all three prompts.
   Three of the "eleven operator acts" this document is built around are not operator acts here.

8. **The 10-second role picker was described as the destructive-install consent.** It is not, and
   `zeta-first-boot.sh` now retracts that in its own comments. The consent gate on the zero-typing
   path is the **cancel window** (A6.4), which did not exist when this document was written.

### Correct, and re-verified rather than assumed

- `zflash --agent --usb /dev/diskN` — there is still **no `--usb` flag**. Confirmed against the
  current allowlist.
- `gh run download --name zeta-installer-iso` still does not resolve; the x86_64 artifact is
  `nixos-minimal-<version>-x86_64-linux.iso`. Confirmed against run 32461224707's artifact list.
- `zflash: local checkout matches origin/main on install substrate ✓` — string present, A0 stands.
- `zflash: WARNING no ISO here names arch x86_64; falling back to …` — **observed live** on this
  Mac today, verbatim as this document predicted.
- The 10-second role picker itself (`'c'` / `'w'`, `ROLE_PROMPT_SECS=10`) is unchanged; the only
  edit `74c2054c28` made to that block was a comment.

### Known code defects, filed here rather than fixed

Stated so they are not rediscovered at 2am, and so the runbook is not quietly papering over them:

- `autoDownloadFreshIsoIfNeeded` should fetch `<artifact>.sha256` and rewrite its filename field to
  the stamped name it writes. Until it does, the bare `zflash` form is unusable.
- The `unrecognized` refusal prints `re-run with --accept-unrecognized`, and `zflash`'s allowlist
  rejects that flag. Same for the discovery halt banner's `zflash --role …` /
  `--join-server-url` / `--join-token`. **Measured — all five flags refused.**
- Nothing writes an `ok` record to the attempt ledger, so three installs from one stick open the
  breaker.
- The cancel window's "Press any key" is false for Return, and Return *accelerates* the countdown.
- A successful cancel exits 0 and is reported by `zeta-first-boot.sh` as "Install complete".

### The freshness gate no longer covers the substrate that changed most

`INSTALL_SUBSTRATE_FILES` in `cli.ts` lists seven paths. `zeta-install.sh` is one of them (good —
that is where the probe, breaker, repair mode and cancel window live). But
`zeta-first-boot.sh` — changed by both #13107 and #13124 — and the entire
`full-ai-cluster/nixos/cluster-discovery/` tree are **not** in the list, so A0's guard would pass on
a checkout stale in exactly those files. A0 is still worth running; it is just narrower than it
looks.

---

## Pointers

- `docs/runbooks/zflash-end-to-end.md` — the long CP-1…CP-6 validation script this pre-flight feeds
- `docs/trajectories/usb-zflash-installer/RESUME.md` · `docs/trajectories/cluster-encryption-credential-substrate/RESUME.md` · `docs/trajectories/dogfooding-the-whole-stack/RESUME.md`
- `.github/workflows/build-ai-cluster-iso.yml` — the build, the NixOS k3s tests, the QEMU scenarios, the cosign step
- `src/Core.TypeScript/ci/qemu-boot-test.ts` — `AARCH64_TCG_TIMEOUT_SECONDS = 1800`, the budget known unknown #1 exhausts
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why a `continue-on-error` green is reported here as a skip

New surfaces this document now covers (all landed 2026-08-20/21):

- `src/Core.TypeScript/zflash/iso-integrity.ts` — the one ISO integrity gate, called by all three
  host arms since #13127; `verify.ts` `checkIsoAgainstManifest` holds the verdict logic
- `src/Core.TypeScript/zflash/verify.ts` `classifyDeviceState` — the five device states (R1–R5) and
  the `half-provisioned` acknowledgement
- `src/Core.TypeScript/zflash/target-pin.ts` — `selectPinnedTarget` / `describePin`; the
  `UNPINNED TARGET` refusal and the two-stick ambiguity refusal
- `src/Core.TypeScript/installer/disk-preflight.ts` — the five dispositions, as an executable
  specification. **It never runs at install time** (the ISO ships no bun); the operator-visible text
  is printed by the shell block between `# ZETA-PREFLIGHT-PARITY-BEGIN` / `-END` in
  `zeta-install.sh`, which `disk-preflight-shell-parity.test.ts` keeps in agreement
- `src/Core.TypeScript/installer/install-circuit-breaker.ts` — `closed` / `open` / `blind`,
  `DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS = 3`
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — steps 2.5 / 2.6 / 2.7 / 2.9 (probe,
  breaker, repair, cancel window)
- `full-ai-cluster/nixos/cluster-discovery/` — `decide.ts` (the ten refusal reasons),
  `probe.ts` (`PASS_OFFSETS_MS`, `MIN_HONEST_DWELL_MS = 30_000`), `cli.ts`
- `.github/workflows/build-ai-cluster-iso.yml` — the `Locate ISO + capture metadata` step that
  writes `<iso>.sha256`, and the aarch64 equivalent added by #13093
