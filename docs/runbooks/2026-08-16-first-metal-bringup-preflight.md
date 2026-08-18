# First-metal bringup — pre-flight state and the operator-only checklist

**Date:** 2026-08-16 · **Staged by:** the shadow · **Audience:** Aaron, at the keyboard, with a USB
stick and a target box.

**Purpose.** Aaron said: *"we can move hardware and dogfood background agents forward, i'd like to
test some hardware with keys and everything working."* Everything an agent can do without him has
been done and is recorded below with what was **run** versus what was **read**. What remains is
eleven operator acts, and every one of them is a physical presence or a biometric — the class an
agent must not perform (`nothing operator-run, only operator-approved via biometric`).

**Register discipline.** A check that passed because no hardware was present is reported as a
**skip**, not a pass. Where the honest answer is "unproven", it says unproven.

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

Two older installer ISOs are still in `~/Downloads` (2026-06-09, 2026-06-21). They are **eight weeks
stale**. `zflash` picks newest-by-mtime, so they will not be chosen — but do not hand-pick them.

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

## 3. The operator-only checklist — eleven acts

Everything below needs a hand, an eye, or a finger. Nothing below can be delegated.

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

```bash
cd /Users/acehack/Documents/src/repos/Zeta
bun src/Core.TypeScript/zflash/cli.ts
```

**Use the bare form.** Auto-pull is architecture-aware as of 2026-08-18 (§4 known unknown #2,
now closed), so `zflash` fetches the current x86_64 artifact itself. An explicit path is still the
way to pin a *specific* build — but the file §0 used to name is **gone** (see the 2026-08-18
correction there), so do not copy that path out of this document.

**Expected, in order:**

- `zflash: local checkout matches origin/main on install substrate ✓`
- `ISO: …zeta-installer-25.11-ci<run>-<date>-x86_64.iso` — and, because `~/Downloads` currently holds only arch-less ISOs, possibly first a line reading `zflash: WARNING no ISO here names arch x86_64; falling back to <path>, whose arch cannot be read.` **Read that warning.** If it appears and auto-pull did *not* then replace the pick, you are about to flash an eight-week-old June image
- `USB: /dev/diskN (…)` and a printed dump of what is on the stick now
- `*** ALL DATA ON /dev/diskN WILL BE DESTROYED ***` and a challenge — you type `yes <nonce>`
- **Touch ID prompt fires. Touch it.** This is the consent floor; no agent can satisfy it.
- `Flash complete.`
- `iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/diskN ESP…` then `pubkey written; USB ejected.`

**Failure signatures:**

- aborts at the freshness line → go back to A0
- `no Zeta installer ISO found under ~/Downloads/zeta-installer-*.iso` → you dropped the path argument and the staged file was moved
- Touch ID never prompts → `/etc/pam.d/sudo` lost its `pam_tid.so` line (a macOS update does this); re-run `bun src/Core.TypeScript/zflash/setup.ts --install-alias`
- `Flash complete.` but no `pubkey written` → the ESP inject silently skipped; the node will come up **without** your SSH key and you will need the console password from A7

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

### A6 — Choose the BOOT disk and confirm the wipe

**Expected:** an enumeration of internal disks (USB excluded), then
`Which disk is the BOOT disk (gets OS + first Longhorn path)? [<fastest>]:` — Enter accepts the
fastest. Every other internal disk becomes a DATA disk and **is wiped**.

**Failure signature:** `BOOT_DISK <x> not in internal-disk set` → you typed a device that is not in
the enumerated set. Also: if the enumeration lists a disk you care about, **stop here** — step 3 of
`zeta-install.sh` wipes every disk in scope.

### A7 — Set the initial console password

The iter-5.3 prompt. This is your console fallback if the SSH-key inject in A2 failed.

### A8 — Credential-blob passphrase (optional)

Step 6.56 asks for a passphrase used to encrypt `/zeta-creds.enc` on the USB ESP. An empty answer
skips the picker entirely and you fall through to a fresh device-flow at A9. Typing one here is what
buys you passphrase-only reboots later (CP-4/CP-5 in `zflash-end-to-end.md`).

### A9 — `gh auth login` on the node

**Expected:** `[iter-5.4.0] Run gh auth login now? [Y/n]:` → Enter → the interactive `gh` flow
(browser code, device flow, or paste-token — your pick), then
`gh auth login: SUCCESS` and `git credential helper: configured`.

**This is your GitHub identity and only you can present it.**

**Failure signature:** `WARN: 'gh auth setup-git' failed` — the later self-registration `git push`
will then prompt for an HTTPS password and hang the unattended path.

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
ISO=~/Downloads/<the zeta-installer-*-x86_64.iso zflash cached on this run>
cosign verify-blob \
  --bundle "$ISO.bundle" \
  --certificate-identity 'https://github.com/Lucent-Financial-Group/Zeta/.github/workflows/build-ai-cluster-iso.yml@refs/heads/main' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  "$ISO"
```

2026-08-18: `zflash`'s auto-pull copies **only** the `.iso` into `~/Downloads` — the sigstore
bundle is not fetched with it, so `$ISO.bundle` will not exist until you `gh run download` the
`.cosign` sibling from the same run.

---

## 5. Corrections to `zflash-end-to-end.md`

That runbook is from 2026-05-28 and its CP-1 does not work as written today:

- `gh run download <run-id> --name zeta-installer-iso` — **no artifact by that name exists**. The
  x86_64 artifact is named `nixos-minimal-<version>-x86_64-linux.iso` (nixpkgs 25.11 names the
  derivation from the default, not from `isoImage.isoName`), and `gh run download` writes it into a
  directory of that name. Downloading it therefore lands a file that `zflash`'s
  `ISO_GLOB_PREFIX = "zeta-installer-"` auto-discovery will **not** see, which is exactly the
  "ISO not found" failure that CP-2 lists without explaining.
- `zflash --agent --usb /dev/diskN` — **there is no `--usb` flag.** The only device-adjacent flag is
  `--usb-uuid`. The supported override is the positional ISO path.

Both are fixed inline in that file by the same change that adds this one.

---

## Pointers

- `docs/runbooks/zflash-end-to-end.md` — the long CP-1…CP-6 validation script this pre-flight feeds
- `docs/trajectories/usb-zflash-installer/RESUME.md` · `docs/trajectories/cluster-encryption-credential-substrate/RESUME.md` · `docs/trajectories/dogfooding-the-whole-stack/RESUME.md`
- `.github/workflows/build-ai-cluster-iso.yml` — the build, the NixOS k3s tests, the QEMU scenarios, the cosign step
- `src/Core.TypeScript/ci/qemu-boot-test.ts` — `AARCH64_TCG_TIMEOUT_SECONDS = 1800`, the budget known unknown #1 exhausts
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why a `continue-on-error` green is reported here as a skip
