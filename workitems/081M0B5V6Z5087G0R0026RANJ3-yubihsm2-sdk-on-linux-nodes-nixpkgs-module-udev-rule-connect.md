---
id: 081M0B5V6Z5087G0R0026RANJ3
type: task
state: backlog
priority: P2
slug: yubihsm2-sdk-on-linux-nodes-nixpkgs-module-udev-rule-connect
title: "YubiHSM2 SDK on Linux nodes: nixpkgs module, udev rule, connector unit, and the NixOS pkcs11 path the probe cannot see"
created: 2026-08-18T19:33:48.645Z
depends_on: []
composes_with: []
---

# YubiHSM2 SDK on Linux nodes: nixpkgs module, udev rule, connector unit, and the NixOS pkcs11 path the probe cannot see

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0B5V6Z5087G0R0026RANJ3-*.md` glob. -->

## Context

Aaron, 2026-08-18: *"we are going to need to have this available on our Linux
distributions, I just installed the Mac version."* `yubihsm` appears nowhere in
`tools/setup/linux.sh` or `.github/workflows/build-ai-cluster-iso.yml` — the SDK is a
hand-installed macOS-only dependency, and a freshly-flashed cluster node has no route to
an attached YubiHSM.

Design + evidence:
`docs/research/2026-08-18-yubihsm2-sdk-on-linux-the-cluster-is-nixos-so-the-apt-question-was-the-wrong-question.md`

**Blocked on maintainer sign-off** — Q1-Q6 + Q9 in section 8/11 of that doc. (Q7, the
macOS parity question, was superseded 2026-08-20 by evidence rather than answered: see
section 12.) Round-29 discipline: no CI/infra decision lands before the answers do.

## The shape (pending sign-off)

Cluster nodes are **NixOS**, so this is not an apt question. The pinned nixpkgs
(`b77b3de8775677f84492abe84635f87b0e153f0f`) already carries `yubihsm-connector` 3.0.7 and
`yubihsm-shell` 2.7.3 — no third-party apt source, no vendored `.deb`.

1. A new `yubihsm.nix` under `full-ai-cluster/nixos/modules/`: `yubihsm-connector` +
   `yubihsm-shell`, a `yubihsm-connector` system user, a `systemd.services` unit
   (nixpkgs ships **no** `services.yubihsm-connector` module), and
   `services.udev.extraRules` for `1050:0030` with `OWNER="yubihsm-connector"`.
   Deliberately **excludes** `yubihsm-setup` — a node uses keys, it does not re-key
   the device.
2. **Nothing** on CI runners. An apt entry would cost 24 uncached jobs every run
   forever and reach zero nodes (`linux.sh` skips apt on NixOS).
3. ~~macOS parity DEBT: Homebrew has no `yubihsm-shell` formula, so `manifests/brew`
   cannot close the laptop leg.~~ **CLOSED 2026-08-20.** There is no *formula* (still
   404), but there IS a *cask*: `yubihsm2-sdk`, tap `homebrew/cask`, version `2026-04`,
   installing Yubico's own signed `.pkg` under a Homebrew-maintained sha256. Declared in
   `tools/setup/manifests/brew-cask`. The original claim was a formula-namespace check
   read as a Homebrew-wide one -- see section 12 of the design doc.

## Acceptance

- [ ] Section 8 Q1–Q6 answered by the maintainer; sign-off date recorded in the doc.
      (Q7 no longer needs an answer -- see the macOS row below.)
- [ ] Probe path contract settled: NixOS resolves the module to
      `yubihsm_pkcs11.so` under `/run/current-system/sw/lib/pkcs11/`, which matches **none** of the
      three Linux paths in `frost-hardware-probe.ts` (PR #12042). A correctly provisioned
      node reports `yubiHsm2Pkcs11ModuleFound: false` until this is fixed — add the exact
      fourth path, never a wildcard or fallback.
- [x] **Q8 ANSWERED 2026-08-18** — measured on Aaron's Mac against the attached device:
      the macOS `.pkg` writes `/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib`, the third entry
      on the probe's darwin list. That leg is verified, not assumed.
- [ ] **Q9 (new, from the Q8 run):** node readiness must distinguish a provisioning fault
      from an absent device. `probeYubiHsm2` returned `false` with the device attached
      (`system_profiler` emitted zero lines; empty output and hard failure both collapse to
      `false`). The **Linux branch has the same shape** — a `readDir` throw on
      `/sys/bus/usb/devices` returns `false` identically to "no device". On headless metal
      nobody can see the HSM, so "could not look" must not read as "not there". Mechanism
      exists already: cross the unprivileged sysfs read with the connector's
      `/connector/status` (`status=OK|NO_DEVICE`, and `usbCheck` really opens the device, so
      it is permission-sensitive). See section 11 of the design doc for the five-way table.
- [x] **macOS leg landed 2026-08-20** (Aaron: *"make sure new contributors to Zeta just
      get this for free on Mac, Windows, Linux, and our own micro/uni kernel"*):
      `manifests/brew-cask` gains `yubihsm2-sdk`; `manifests/brew` + `manifests/apt` +
      `manifests/windows` gain `opensc` (`pkcs11-tool`), which was MISSING everywhere and
      is what actually loads `yubihsm_pkcs11`. Un-tier-gated on purpose so
      `macos-install-sh-test` exercises the cask rather than skipping it.
- [ ] **Windows HSM leg: still no route.** Re-verified 2026-08-20 -- winget-pkgs
      `manifests/y/Yubico` has no HSM entry, scoop Main 404, chocolatey 404. Yubico ships
      `yubihsm2-sdk-2026-04-windows-amd64.zip` + detached `.sig`; this repo has no
      unzip-to-PATH mechanism and no signature verifier. Needs a decision: new mechanism,
      an upstream winget contribution (GOVERNANCE section 23), or documented-manual.
- [ ] **Debian/Ubuntu HSM leg: still no route,** now proven by index parse rather than by
      a CI failure -- `yubihsm-shell` / `yubihsm-connector` / `libyubihsm2` are ABSENT
      from noble universe, noble main and jammy universe. Yubico ships a tarball-of-debs;
      `from-deb` takes one `.deb`, verifies nothing, and cannot install a library-only
      package. Do NOT re-add an apt row.
- [ ] **micro/uni kernel: NO SUCH TARGET EXISTS IN-REPO.** Searched 2026-08-20: the term
      appears only in `memory/` and in open P2 rows (`081KSV2WD0008QG0R000WNY74Q` umbrella,
      `081KTSZN10008QG0R000VZHRQ4`, `081KTSZN10008QG0R00349SM6P`); no seL4/Unikraft/Mirage,
      no image build, no package-selection surface. Blocked on the target existing, and
      before packaging, on whether it has a USB host stack at all -- a YubiHSM 2 is a USB
      bulk device. Design doc section 12d states what a row would need.
- [ ] Module lands and an ISO build validates it.

## Related

- PR #12042 — `frost-hardware-probe.ts`; the path contract is its constant, not mine.
- Separable finding, worth its own row: `from-deb` performs **no** checksum or signature
  verification (`dpkg -i` on a bare URL) while its sibling `from-url` refuses a row
  without `sha256=`; and its binary-only idempotence check cannot install a library-only
  package.
