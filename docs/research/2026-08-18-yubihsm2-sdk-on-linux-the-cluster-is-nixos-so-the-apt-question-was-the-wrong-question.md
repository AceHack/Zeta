# YubiHSM2 SDK on Linux: the cluster is NixOS, so the apt question was the wrong question

**Status:** DESIGN — awaiting maintainer sign-off. **Q8 ANSWERED 2026-08-18** (measured on Aaron's Mac against the attached device). **Q7 SUPERSEDED 2026-08-20 — section 6 is WRONG; see section 12 before relying on it.** Q1-Q6 open, plus a new Q9 raised by the Q8 measurement — see section 11. No workflow or NixOS
module changed in this PR. Round-29 discipline: numbered open questions in section 8,
answers land before YAML/Nix does. Sign-off date: _pending_.

**Author:** Dejan (devops-engineer). **Date:** 2026-08-18.
**Provoked by:** Aaron, 2026-08-18 — *"we are going to need to have this available on our
Linux distributions, I just installed the Mac version."*

---

## 0. The one-paragraph answer

A cluster node needs **`yubihsm-connector` (a daemon), a udev rule, and a systemd unit**
— not "the SDK". A CI runner needs **nothing**. A dev laptop needs the PKCS#11 module
only if a device is actually attached to it. And the acquisition question has a different
answer than expected, because **our cluster nodes are NixOS, not Debian/Ubuntu**: the
pinned nixpkgs already carries `yubihsm-connector`, `yubihsm-shell`, and `yubihsm-setup`,
so there is **no third-party apt source to add and no `.deb` to vendor**. What nixpkgs
does *not* carry is the udev rule and the systemd unit — both of which Yubico ships in a
`deb/` directory that `buildGoModule` never installs. That gap, plus a **path-contract
collision between the probe and NixOS**, is the whole of the real work.

---

## 1. What is actually needed on a node (question 1)

The SDK is four separable pieces. They are not a bundle and should not be installed as one.

| Piece | What it is | Cluster node | Dev laptop | CI runner |
|---|---|---|---|---|
| `yubihsm-connector` | HTTP daemon owning the USB device | **REQUIRED** | if device attached | **NO** |
| `yubihsm_pkcs11.so` | PKCS#11 module (ships in `yubihsm-shell`) | **REQUIRED** | if device attached | **NO** |
| `yubihsm-shell` (CLI) | interactive/CLI wrapper | diagnostic only | yes | **NO** |
| `yubihsm-setup` | **provisioning/reset tool** | **NO** — see below | Aaron's laptop only | **NO** |

**Why the connector is not optional.** The YubiHSM 2 presents a USB **bulk** interface,
not CCID. Nothing in the ordinary smart-card stack (`pcscd`, OpenSC, `ykman`) can reach
it. The path to the device is either the connector daemon or direct libusb — and the
direct path still needs the same device permission, so it removes a process, not the
problem. This matches the probe's own header in PR #12042, written independently.

**Why `yubihsm-setup` is excluded from nodes, and this is the sharpest line in the table.**
`yubihsm-setup` is the tool that *resets and reprovisions* an HSM. A node's job is to
*use* a key, never to *re-key* the device. Shipping the reset tool onto every machine that
holds key material widens the blast radius of a node compromise from "can sign while I
hold the box" to "can wipe the box". Least privilege here is a package-list decision: free
to get right, expensive to get wrong.

**Why the CLI is diagnostic-only.** It is genuinely useful at 2am on the metal, and it is
also an interactive shell against key material. Recommendation: include it, but see
section 8 Q4 — that is a call the maintainer should make explicitly rather than inherit
from me.

---

## 2. Acquisition, and why the expected tradeoff evaporated (question 2)

The brief framed this as apt-repo vs vendored `.deb` vs source, judged on reproducibility,
third-party apt surface, and pinning. **On our actual node OS none of those three is the
answer.** Verified against the exact pinned revision the ISO builds from
(`full-ai-cluster/flake.lock` gives nixpkgs `b77b3de8775677f84492abe84635f87b0e153f0f`):

| Package | Present in pinned nixpkgs | Version | License |
|---|---|---|---|
| `yubihsm-connector` | **yes** | 3.0.7 | Apache-2.0 |
| `yubihsm-shell` | **yes** | 2.7.3 | Apache-2.0 |
| `yubihsm-setup` | **yes** | — | — |

So the supply-chain tradeoff is not "which unpinned thing do we accept". It is already
the strongest option available: a **flake-locked, hash-pinned, source-built** derivation
from a revision we already trust for the entire node OS. Adding Yubico's apt repository
would *weaken* this — a new signing key and a floating channel, used to provision the one
class of machine that holds key material, in exchange for nothing.

**What we trade for it.** Not "Yubico's official binary". nixpkgs builds `yubihsm-shell`
from Yubico's own GitHub source at tag `2.7.3` with a pinned
`sha256-0Y2Dj/MAg5Nb6etxF164/7gvytjKYROVIkhqE6Lr2p8=`, and `yubihsm-connector` from tag
`3.0.7`. The trade is: Yubico's **source** plus a community-maintained build recipe,
instead of Yubico's **compiled artifact**. That is a real and nameable difference — the
recipe is maintained by nixpkgs maintainers, not Yubico — and it is the same trade the
rest of this node's OS already makes. Recorded here so it is a decision, not a default.

### 2a. Two defects in the in-repo mechanism someone would otherwise reach for

`tools/setup/manifests/from-deb` exists and is empty, and it is the obvious tool for
"install a pinned Yubico `.deb`". It should **not** be used for this, for two independent
reasons found by reading `src/Core.TypeScript/ace/setup-realizers/from-deb.ts`:

1. **No checksum, no signature.** It takes a URL, fetches it, and runs `dpkg -i`. There is
   no `sha256=` attribute and no verification of any kind. Compare its sibling `from-url`,
   whose own manifest header states the correct doctrine — *"A URL is a name, not a pin"* —
   and whose realizer **refuses** a row without `sha256=`. Using the unverified mechanism
   to install an HSM driver would invert the repo's own standard at exactly the point
   where it matters most.
2. **It structurally cannot install a library-only package.** Its idempotence check is
   `commandOnPath(name) || existsSync("/usr/bin/" + name)`, and after install it throws
   `"install finished but binary missing"` if that check still fails. Yubico's
   `yubihsm-pkcs11` package ships a `.so` and **no binary**, so such a row would
   re-download every run and then hard-fail on an install that actually succeeded.

Neither blocks this design (we are not using `from-deb`). Defect 1 is worth filing on its
own merits regardless of the HSM: an unpinned `dpkg -i` mechanism, in a repo whose every
sibling mechanism pins by digest, is a latent supply-chain hole waiting for its first user.

---

## 3. Where it belongs (question 3) — and the CI-runner answer is *nothing*

| Surface | Gets the SDK? | Mechanism |
|---|---|---|
| Cluster node | **yes** | `full-ai-cluster/nixos/modules/` — a new `yubihsm.nix` |
| Dev laptop (macOS) | **yes**, but see section 6 | no clean route exists today |
| Dev laptop (Linux) | **opt-in only** | env-gated, off by default |
| CI runner | **NO** | — |
| Devcontainer | **NO** | no USB passthrough |

**The CI runner carries none of it, and this is the load-bearing decision.** A GitHub
runner has no HSM, cannot have one, and is destroyed after each job. Every byte on that
path is pure cost against a guaranteed-zero benefit. Concretely, measured from `gate.yml`:

- **24 jobs** in `gate.yml` run `tools/setup/install.sh`; **23 workflow files** invoke it.
- The `install-v2` cache path list is `~/.local/bin/mise`, `~/.local/share/mise`,
  `~/.dotnet/tools`, `~/.elan`, `~/.cargo`, and friends — **all under `$HOME`**. Nothing
  apt installs into `/usr` is cached by anything.
- Therefore **an entry added to `manifests/apt` is re-downloaded and re-installed on every
  job, on every run, forever.** It is the single most expensive place in this repo to add
  a dependency — and it is exactly where the naive fix would have gone.

**And an apt entry would never reach a node at all.** `linux.sh` skips apt entirely on
NixOS (the `/etc/NIXOS` marker, line 49). So an apt entry reaches every CI runner and
every dev laptop and **not one cluster node**. Precisely backwards: maximum recurring cost
on the machines that will never see an HSM, zero effect on the machines that will.

### 3a. A second, less obvious cost: the cache key

The key is `install-v2-<os>-<arch>-hashFiles('.mise.toml', 'tools/setup/**', 'global.json')`.

**Any** file added or edited under `tools/setup/**` rotates that key for all 19 cache
consumers at once — a full cold re-populate across the matrix, and a fresh key set written
while the old one is still resident. With the Actions cache already at **200% of its
10 GiB limit**, that is not free. It is an argument for putting node-only provisioning
under `full-ai-cluster/`, where it belongs on the merits anyway. The cost lens and the
correctness lens agree here, which is the outcome to want.

---

## 4. udev rules: **required** — and the constants are verified, not guessed (question 4)

Yes, a udev rule is required. And nixpkgs will not give it to us.

`yubihsm-connector` in nixpkgs is a plain `buildGoModule` producing
`$out/bin/yubihsm-connector` and nothing else. Yubico ships the operational glue in a
`deb/` directory that the Nix build never installs:

- `deb/70-yubihsm-connector.rules`
- `deb/yubihsm-connector.service`

Read at tag `3.0.7`, the rule is:

    ACTION!="add|change", GOTO="yubihsm_connector_end"
    #Yubico YubiHSM2
    SUBSYSTEM=="usb", ATTRS{idVendor}=="1050", ATTRS{idProduct}=="0030", OWNER="yubihsm-connector"
    LABEL="yubihsm_connector_end"

`1050:0030` is Yubico's own published constant from Yubico's own shipped rule file — not a
value inferred from a forum post. That is the same standard the probe author applied when
they deliberately matched a USB **product string** rather than an unverified numeric
VID/PID.

Two consequences that are easy to miss and expensive to discover on the metal:

1. **Without the rule, the device node is root-only.** A connector running as a non-root
   user cannot open it, and the failure presents as a healthy-looking daemon that cannot
   see a plugged-in HSM — a check that did not run, wearing the face of one that ran.
2. **Upstream's own design is a dedicated non-root system user.** The unit runs as
   `User=yubihsm-connector` with `PrivateTmp`, `ProtectHome`, `ProtectSystem=full`, and
   the udev rule hands device ownership to exactly that user. So the rule is not merely a
   permissions fix — it is the mechanism that *keeps the daemon unprivileged*. Adopt the
   rule without the user, or the user without the rule, and you get either a broken daemon
   or a root one.

Note also that NixOS cannot use the unit verbatim: `ExecStart=/usr/bin/yubihsm-connector`
does not exist on NixOS. It becomes a `systemd.services.yubihsm-connector` block pointing
at a store path, plus `users.users.yubihsm-connector`, plus `services.udev.extraRules`.

---

## 5. The path-contract collision — a defect in PR #12042, found before it merged

**This is the finding with the shortest fuse, because #12042 is still open.**

The probe declares three Linux paths, and they are correct for the FHS world:

| Probe path | Produced by |
|---|---|
| `/usr/lib/x86_64-linux-gnu/pkcs11/yubihsm_pkcs11.so` | Yubico's Debian/Ubuntu `.deb`, amd64 |
| `/usr/local/lib/pkcs11/yubihsm_pkcs11.so` | source build, default prefix |
| `/usr/lib/pkcs11/yubihsm_pkcs11.so` | distro packaging with `LIBDIR=/usr/lib` |

All three are consistent with upstream's install rule, confirmed in
`pkcs11/CMakeLists.txt` at tag `2.7.3`:
`LIBRARY DESTINATION "${YUBIHSM_INSTALL_LIB_DIR}/pkcs11"`.

**On NixOS the module lands at none of them.** `yubihsm-shell` in
`environment.systemPackages` resolves to:

    /run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so

(`/lib` is in NixOS's default `environment.pathsToLink`, verified in
`nixos/modules/config/system-path.nix` at the pinned revision — so that symlink genuinely
exists. The module is present; it is simply not where the probe looks.)

So a **correctly provisioned** cluster node would report `yubiHsm2Pkcs11ModuleFound: false`,
`pkcs11MatchedPair` would be false, and `availableHardwareSealTiers` would refuse
`hardware-pkcs11` — on the machine where everything is installed right. That is the probe's
own stated failure mode ("a probe looking one place and an installer writing another")
landing on the probe itself, one OS over.

**This is explicitly not a request to loosen the probe.** The brief's warning is correct
and I am not proposing a wildcard, a `find`, or a fallback. The fix is to *add the NixOS
path* — a fourth exact, absolute path carrying the same precision as the other three —
because NixOS is genuinely a fourth packaging convention, not a convenient location chosen
to make something pass. Tightness is preserved:
`/run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so` is as specific as
`/usr/lib/x86_64-linux-gnu/pkcs11/yubihsm_pkcs11.so`.

Ownership: that constant belongs to Nazar's probe, in Nazar's open PR. I have not touched
it. Section 8 Q1 asks whether it lands there before merge or as a follow-up.

---

## 6. macOS parity is not closable by `manifests/brew`

> **CORRECTED 2026-08-20 — this section's conclusion is wrong. See section 12.**
> The 404s below are real; the inference from them is not. The SDK ships as a
> Homebrew **cask** (`yubihsm2-sdk`), which is now declared in
> `tools/setup/manifests/brew-cask`. Kept unedited as the record of the error.

Aaron installed the macOS SDK by hand, and the reason is structural: **Homebrew has no
`yubihsm-shell` and no `yubihsm-connector` formula** (checked against `formulae.brew.sh` —
both 404). The `manifests/brew` route that would normally close the laptop leg does not
exist. What remains is Yubico's macOS `.pkg` via a `from-installer`-shaped row, or a
documented manual step on the one laptop that has the device.

Recorded as **parity DEBT**, not silently accepted (GOVERNANCE section 24). Low severity —
the device is attached to exactly one laptop today — but debt. The honest statement is
that after this design lands, the three-way parity story for the HSM reads: node
**declarative**, laptop **manual**, CI **deliberately absent**. One of those three is a gap
with a name, and naming it is the point.

---

## 7. Cost summary

| Change | CI cost |
|---|---|
| **Recommended:** `full-ai-cluster/nixos/modules/yubihsm.nix` | **0 min/run on `gate`.** Triggers `build-ai-cluster-iso.yml` once, on the PR that lands it: one build job (180 min ceiling) plus up to four QEMU jobs at 90 min each. One-time, and the correct place to spend it — a node-provisioning change should be validated by a node build. |
| **Rejected:** a `manifests/apt` entry | 24 jobs, every run, forever, **uncached** — and it reaches zero cluster nodes. |
| **Rejected:** any new file under `tools/setup/**` | rotates `install-v2` for 19 consumers; a full cold re-populate against a cache already at 200% of its 10 GiB limit. |
| **This PR** | docs + memory + one workitem. The workitem file flips `code=true` (`workitems/*` is not in `gate.yml`'s docs-only allowlist, line 248), so this PR pays one full matrix. Stated rather than hidden — the alternative is an untracked design doc, which rots. |

Nothing in this PR adds a recurring CI minute.

---

## 8. Open questions — maintainer sign-off required before any of this lands

**Q1 — the probe path (blocking, time-sensitive while #12042 is open).** Add
`/run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so` to `YUBIHSM2_PKCS11_LIBRARY_PATHS`?
*Expected answer:* "yes, in #12042 before merge" / "yes, follow-up PR" / "no, because ...".

**Q2 — which pieces land on a node.** Confirm the section 1 table, specifically that
**`yubihsm-setup` is excluded** from cluster nodes.
*Expected answer:* accept the table, or name the piece to add/remove and why.

**Q3 — nixpkgs build vs Yubico's compiled artifact.** Section 2 trades Yubico's binary for
Yubico's source plus a nixpkgs recipe. Acceptable for a machine holding key material?
*Expected answer:* "acceptable" / "want the vendor binary, accept the pinning work".

**Q4 — `yubihsm-shell` CLI on nodes.** Diagnostic value at 2am, versus an interactive shell
against key material sitting on every node.
*Expected answer:* "include" / "exclude — use an ad-hoc `nix shell` when debugging".

**Q5 — which nodes.** All nodes via `common.nix`, or only nodes that will physically hold
an HSM? A daemon and a udev rule on a machine with no device is inert, but it is still
surface.
*Expected answer:* "common.nix" / "control-plane only" / "an opt-in module argument".

**Q6 — Linux dev laptops.** Opt-in behind an env gate, or absent entirely?
*Expected answer:* "opt-in gate" / "absent — the Mac is the only laptop that matters".

**Q7 — macOS parity debt (section 6).** Close it with a `from-installer` row for Yubico's
`.pkg`, or accept a documented manual step and log the DEBT?
*Expected answer:* "close it" / "accept, log it".

**Q8 — ANSWERED 2026-08-18. Kept for the record; see section 11 for what it changed.**

Originally: On the Mac with the
SDK installed, which path actually holds the module?

    ls -l /usr/local/lib/yubihsm_pkcs11.dylib \
          /opt/homebrew/lib/yubihsm_pkcs11.dylib \
          /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib 2>&1

*Expected answer:* the path that exists, or "none of them" plus the real one. The probe's
three darwin paths are **unverified against a real installation**. If the macOS `.pkg`
writes somewhere else, the darwin leg carries the same defect as section 5 and nobody has
noticed, because nobody has run it against a real install. No device interaction, no PIN,
no credential — a directory listing.

---

## 9. What was deliberately not done

No hardware touched, queried, or plugged in. No credential, key, or PIN read or sought. No
auth-key change and no custody step — those are Aaron's, biometric-gated. No file modified
under `tools/setup/**`, `.github/workflows/**`, or `full-ai-cluster/**`. The probe in PR
#12042 was **read, not edited**. No third-party apt source proposed. No SDK component
placed on a CI runner.

---

## 10. Sources checked

Every claim above was read at a pinned revision, not recalled:

- `full-ai-cluster/flake.lock` — nixpkgs `b77b3de8775677f84492abe84635f87b0e153f0f`.
- nixpkgs `pkgs/by-name/yu/yubihsm-connector/package.nix` and `.../yubihsm-shell/package.nix`
  at that rev — versions, source hashes, build type; plus a full-tree listing showing
  **no** `services.yubihsm-connector` NixOS module exists.
- nixpkgs `nixos/modules/config/system-path.nix` at that rev — `/lib` in the default
  `environment.pathsToLink`.
- `Yubico/yubihsm-connector` at tag `3.0.7` — `deb/70-yubihsm-connector.rules` and
  `deb/yubihsm-connector.service`.
- `Yubico/yubihsm-shell` at tag `2.7.3` — `pkcs11/CMakeLists.txt` install destination.
- `formulae.brew.sh` — `yubihsm-shell` and `yubihsm-connector` both absent.
- In-repo: `tools/setup/linux.sh`, `tools/setup/manifests/apt`, `.../from-deb`,
  `.../from-url`, `src/Core.TypeScript/ace/setup-realizers/from-deb.ts`,
  `.github/workflows/gate.yml`, `.github/workflows/build-ai-cluster-iso.yml`,
  `full-ai-cluster/nixos/modules/common.nix`, and PR #12042's
  `tools/setup/persona-keys/frost-hardware-probe.ts` (read-only).

---

## 11. Q8 answered, and the second-order finding it produced (2026-08-18)

### 11a. The answer

Measured on Aaron's Mac with the YubiHSM attached and the macOS SDK installed from
Yubico's releases page, running `probeYubiHsm2Pkcs11` from #12042's branch:

    yubihsm_pkcs11 module found: true   /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib

**The macOS `.pkg` writes to the third entry on the probe's darwin list, and that entry is
correct.** The darwin *module* leg is now verified against a real installation rather than
assumed. Section 5's NixOS finding is unaffected and remains the open one.

### 11b. The finding that came with it — and it is my section 5 defect, one layer over

`probeYubiHsm2` (**device** detection, not module) returned **`false` with the device
physically attached**. On that machine `system_profiler SPUSBDataType` returns **zero
lines** — not an error, empty output — and the darwin branch is
`try { ...includes(MARKER) } catch { return false }`. So three distinct facts collapse to
one value:

| reality | reported |
|---|---|
| no device attached | `false` |
| enumerator returned nothing | `false` |
| enumerator failed outright | `false` |

`ioreg -p IOUSB` saw it immediately (`+-o YubiHSM@00142200`, behind a USB2 hub on a
Thunderbolt dock). Reported to the probe's author on #12042; the fix is theirs.

**The remedy already exists in that same file, with a name.** `probeTpm2` was refactored
for exactly this defect and answers a five-way `Tpm2State` — `present` / `absent` /
`unreadable` / `unavailable` / `indeterminate` — precisely because `existsSync` returned
`false` for every error and "a check that could not run" looked identical to "a check that
ran and said no". `probeYubiHsm2` is still a boolean. The pattern is in-file, tested, and
simply not applied here yet.

### 11c. Why this lands on my node design, not only on the probe

**The Linux branch has the same defect.** It is not inherited safety:

```
try {
  for (const dev of fx.readDir("/sys/bus/usb/devices")) { ... }
} catch { /* No sysfs USB tree. */ }
return false;
```

`readDir` throwing — no sysfs, permission denied, a container without `/sys/bus/usb` —
returns `false`, identically to an empty tree and to a genuinely absent device. sysfs is
more reliable than `system_profiler`, which lowers the *probability* and does nothing to
the *structure*.

**On a headless node that structure is the whole problem.** Nobody is standing at the rack
to see whether the HSM is seated. "No HSM" and "could not look" must not be one answer, and
a provisioning failure must not be able to impersonate an absent device.

### 11d. The mechanism — and it is already in the software we are installing

The connector's own `/connector/status` endpoint (`api.go`, tag `3.0.7`) emits:

    status=OK|NO_DEVICE
    serial=<serial>|*
    version=... pid=... address=... port=...

and `usbCheck` — verified in `usb_libusb.go` — calls `usbopen` and then reads the device
serial number. It **actually opens the device**, so it is *permission-sensitive*: a missing
or unapplied udev rule yields `NO_DEVICE` with the HSM plugged in and healthy.

That single endpoint separates two states a boolean cannot ("connector down" is an HTTP
failure; `NO_DEVICE` is a live connector that cannot reach the device). It still cannot
separate *absent* from *present-but-unopenable* — which is the udev failure this design
exists to prevent. **Crossing it with the unprivileged sysfs read does:**

| sysfs (`/sys/bus/usb/devices`) | connector `/connector/status` | node state |
|---|---|---|
| device found | `status=OK` | **healthy** |
| device found | `status=NO_DEVICE` | **provisioning fault — udev rule missing or not applied** |
| device found | HTTP unreachable | **provisioning fault — connector unit down** |
| no device | `status=NO_DEVICE` | **genuinely absent** — no HSM seated |
| unreadable / no sysfs | any | **inconclusive — the check could not run** |

The second and third rows are the ones that matter, and a boolean cannot express either.
They are exactly "a correctly-cabled node whose provisioning silently failed", which on
headless metal is otherwise indistinguishable from "nobody plugged it in" — and the failure
would surface mid-ceremony rather than at provisioning time.

**Design consequence, folded into the recommendation:** the `yubihsm.nix` module should
carry a node-side readiness check that reports this five-way state and **never a boolean**,
and the systemd unit should not be considered `active` on the strength of the process
having started. A daemon that started and cannot open the device is the false-green this
whole document is trying to avoid.

Note the scope boundary: every row above is reachable with **no session, no PIN, and no
authentication** — `usbCheck` opens the USB device and reads a serial, nothing more. The
readiness check needs no credential, which is what makes it safe to run unattended on a
node at boot.

### 11e. Open question this raises

**Q9 — the node readiness check.** Ship the sysfs x `/connector/status` cross product above
as a systemd readiness/health unit reporting a five-way state, or leave node health to
ordinary `systemctl status` on the connector unit?
*Expected answer:* "ship the five-way check" / "unit status is enough, accept that a udev
fault reads as an absent device" / "ship it but as a manual diagnostic, not a boot-time unit".

My recommendation is the first: the cross product costs one small TypeScript checker and no
CI minutes, and it converts the single most likely provisioning failure on this surface from
a silent one into a named one.

---

## 12. Correction: section 6 was wrong, and the error is the one this document warns about (2026-08-20)

**Provoked by:** Aaron, 2026-08-20 — *"can we save all the yubikey and yubihsm
software/drivers i installed today as ACE packagemanager missing, we need to make sure new
contributors to Zeta just get this for free on Mac, Windows, Linux, and our own micro/uni
kernel."*

### 12a. What section 6 claimed, and what is actually true

Section 6 says macOS parity "is not closable by `manifests/brew`" because "**Homebrew has no
`yubihsm-shell` and no `yubihsm-connector` formula** (checked against `formulae.brew.sh` —
both 404)", and concludes the only options are a `from-installer`-shaped row or a documented
manual step.

Both 404s are still true — re-checked 2026-08-20, `api/formula/yubihsm-shell.json` and
`api/formula/yubihsm-connector.json` both return 404. **The conclusion drawn from them was
wrong.** Homebrew has two namespaces and I checked one:

    GET https://formulae.brew.sh/api/cask/yubihsm2-sdk.json   -> 200
    token yubihsm2-sdk | tap homebrew/cask | version 2026-04
    arm64 url .../yubihsm2-sdk-2026-04-darwin-arm64.pkg  sha256 2f8e80e9...9e0612
    amd64 url .../yubihsm2-sdk-2026-04-darwin-amd64.pkg  sha256 89d22782...2cca59
    artifacts: pkg + uninstall pkgutil com.yubico.yubihsm2-sdk

The cask installs **Yubico's own signed `.pkg`** — the same 15,361,954 bytes Aaron installed
by hand — under a digest Homebrew maintains in a public repo with history. That is strictly
better than the `from-installer` row section 6 imagined and strictly better than a `from-url`
row, whose `sha256=` I would have had to supply myself from an unverified download.

**The error class is the one recorded in `manifests/apt` in this same round**: verifying a
weaker proposition ("no formula named yubihsm-shell") and treating it as the stronger one
("Homebrew cannot install the YubiHSM SDK"). That block was written as a warning to others.
I then committed it one manifest over. Recorded here rather than quietly patched, because a
design doc that silently acquires the right answer teaches nothing.

### 12b. What this changes

- **Q7 is answered by the evidence, not by a judgement call.** The choice section 6 posed —
  close the macOS debt with a `from-installer` row, or accept a manual step — was a false
  pair. The row lands in `tools/setup/manifests/brew-cask` using the **existing** cask
  mechanism, no new mechanism, no hand-supplied digest.
- **The macOS parity DEBT in section 6 is closed**, and the notebook entry that carries it
  should be retired rather than re-stated.
- **Sections 1–5 and 7–11 are unaffected.** The NixOS finding (section 5), the CI-runner
  exclusion (section 3), the udev requirement (section 4) and the five-way readiness state
  (section 11d) all stand, and Q1–Q6 and Q9 remain open and still blocking.

### 12c. The three-way parity story, restated honestly

| surface | YubiKey CLI (`ykman`, `yubico-piv-tool`) | `pkcs11-tool` (OpenSC) | YubiHSM 2 SDK |
|---|---|---|---|
| macOS | declarative (brew) | **declarative (brew, new)** | **declarative (brew-cask, new)** |
| Linux (Debian/Ubuntu) | declarative (apt) | **declarative (apt, new)** | **none — no apt route exists** |
| Linux (NixOS node) | not declared | not declared | designed, **blocked on sign-off** |
| Windows | declarative (scoop/winget) | **winget-only, `optional` (new)** | **none — no registry carries it** |
| micro/uni kernel | **no such target exists in-repo** | — | — |

Three cells are still open and none of them is closable by adding a row today. The Linux and
Windows HSM cells are blocked on a mechanism that does not exist (nothing here unpacks a
tarball-of-debs or a zip, and nothing verifies Yubico's detached `.sig`); the NixOS cell is
blocked on Q2/Q4/Q5; the micro/uni-kernel column is blocked on the target existing at all.

### 12d. On "our own micro/uni kernel"

Searched: there is **no microkernel or unikernel install target in this repo**. The term
appears only in `memory/` and in open P2 backlog rows —
`081KSV2WD0008QG0R000WNY74Q` (declarative microkernel substrate, `status: open`, umbrella,
no implementation), `081KTSZN10008QG0R000VZHRQ4`, `081KTSZN10008QG0R00349SM6P`. No seL4, no
Unikraft, no MirageOS, nothing that builds an image. The nearest real OS surface is
`full-ai-cluster/nixos/`, which is NixOS and is already the fourth column above.

So no row was invented for it. **What a row would need, when the target exists:**

1. **A package-selection surface at all** — the target has to have the notion of "declared
   system packages" before a manifest can name one. NixOS has `environment.systemPackages`;
   a unikernel typically has no package manager, only a link-time image manifest, so the
   artifact would be a *link set*, not a manifest row.
2. **A USB host stack.** The YubiHSM 2 is a USB **bulk** device. A unikernel with no USB
   host controller driver cannot reach it at any price, and no packaging decision changes
   that. This question — does the target speak USB — dominates the packaging question and
   has to be answered first.
3. **A permission model equivalent to the udev rule.** Section 4's rule exists to hand the
   device to an unprivileged connector. A target with no users has to answer that question
   differently or not at all.
4. **A build recipe pinned like the rest** — source at a tag, hash-pinned, reproducible,
   which is what `full-ai-cluster/flake.lock` already gives NixOS.

Until (1) and (2) have answers, a manifest row would be a declaration pointing at nothing —
the vacuity class in packaging form.
