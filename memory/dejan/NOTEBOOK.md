---
name: dejan
description: Per-persona notebook — Dejan (devops-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Dejan — DevOps engineer notebook

Skill: `.claude/skills/devops-engineer/SKILL.md`.
Agent: `.claude/agents/devops-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

---

## Round: YubiKey/YubiHSM packaging, three OSes (2026-08-20)

Aaron: "save all the yubikey and yubihsm software/drivers i
installed today as ACE packagemanager missing ... free on
Mac, Windows, Linux, and our own micro/uni kernel."

**I WAS WRONG ON 2026-08-18 AND THE ERROR CLASS IS MINE.**
Section 6 of my own design doc said Homebrew cannot install
the YubiHSM SDK. I checked `api/formula/yubihsm-shell.json`
(404, still 404) and never checked the CASK namespace.
`api/cask/yubihsm2-sdk.json` is a 200: homebrew/cask,
version 2026-04, installs Yubico's own signed .pkg under a
digest Homebrew maintains. That is the SAME failure the apt
block one manifest over warns about in writing -- verify
the weak proposition, assert the strong one. I wrote that
warning and then committed it. Lesson: when a lookup says
ABSENT, ask what namespace the lookup covered.

**Landed (manifest rows only, no new mechanism):**
- brew-cask: `yubihsm2-sdk`. NOT tier-gated on purpose --
  a tier= token makes macos-install-sh-test (7 GB runner)
  skip it, and a row CI never runs is an unrun check
  wearing a green face. Cost: one 15 MB download on a
  path-filtered workflow, not on the 24 gate jobs.
- brew + apt + windows: `opensc` (pkcs11-tool). Was
  MISSING on every platform including Aaron's Mac. The SDK
  ships yubihsm_pkcs11 and nothing declared could LOAD a
  PKCS#11 module. Vendor-neutral half of the block.

**Verification technique worth reusing.** For apt I stopped
trusting packages.ubuntu.com and parsed the archive's own
binary indices, reading the COMPONENT: noble/universe
opensc 0.25.0~rc1 (64,754 pkgs), jammy/universe 0.22.0
(58,824), noble/main ABSENT (6,099). universe is where
yubikey-manager/yubico-piv-tool/pcscd already come from and
CI installs those, so the entailment is real. Same parse
proved yubihsm-shell ABSENT from all three -- the CI
failure is now backed by the strong check.

**Resolver defect found in install.ps1 (DEBT).** The
windows loop picks the first available SOURCE, not the
first that SUCCEEDS: `if (Have scoop) { scoop install ... }`
with no fallthrough, and scoop is bootstrapped
unconditionally. So a winget-only package hard-fails the
whole Windows install unless marked `optional`. `tailscale`
already carries that workaround (scoop Main 404, verified).
Consequence: `opensc optional` installs NOTHING on a
scoop-primary host and warns. Named in the manifest, not
hidden. Real fix is fallthrough-on-failure in install.ps1.

**Second DEBT: manifests/apt has no tier= gate.** brew and
brew-cask do. So every apt row is +1 package on 24 gate
jobs forever, uncached, and there is no way to say
"contributor yes, CI no". Five hardware rows now sit there
with zero CI benefit.

**Third DEBT: manifest-symmetry parses apt+brew only, not
brew-cask.** So a cask can drift from Windows with nothing
flagging it -- which is exactly what yubihsm2-sdk (mac) vs
nothing (Windows) now is.

**Still open, and none closable by a row today:**
- Windows HSM: winget-pkgs manifests/y/Yubico has no HSM
  entry (listed today), scoop 404, choco 404. Yubico ships
  a .zip + detached .sig. No unzip mechanism, no signature
  verifier here. Did NOT compute a sha256 from my own
  download -- that is trust-on-first-download in a pin's
  clothes.
- Debian/Ubuntu HSM: tarball-of-debs. from-deb takes one
  .deb, verifies nothing, cannot install a library-only
  package. Do not re-add an apt row.
- NixOS node module: still blocked on Q1-Q6 + Q9.
- micro/uni kernel: THERE IS NO SUCH TARGET. Only memory/
  files and open P2 umbrellas. Before packaging, the
  question is whether it has a USB host stack -- a
  YubiHSM 2 is a USB bulk device, so no packaging decision
  reaches it otherwise.

**Parity DEBT retired:** the macOS "no clean route" item
from 2026-08-18 is closed. Do not re-state it.

---

## Round 29 (anchor: CI + build-machine setup) — 2026-04-18

**Context.** Spawned this round as the persona who owns
`tools/setup/` (three-way parity script per GOVERNANCE §24)
and `.github/workflows/` (hand-crafted from read-only
reference patterns per round-29 discipline).

**Decisions carried forward.**

- Runners pin to specific images (`ubuntu-22.04`,
  `macos-14`) not the moving `-latest` label. Aaron wants
  reproducibility; research-project discipline.
- `.mise.toml` adopts dotnet + python this round; Lean
  stays on the custom elan installer until a mise plugin
  lands (possible upstream contribution target per
  GOVERNANCE §23).
- No verifier SHA ceremony — Aaron chose trust-on-first-
  use.
- `tools/install-verifiers.sh` retires greenfield in the
  same commit that lands `tools/setup/`; no alias, no
  deprecated-shim.
- `actions/setup-dotnet` in the first workflow is a
  **temporary parity-drift flag**; swapping to
  `tools/setup/install.sh` in CI is a backlog entry.
- Concurrency key: `${{ github.workflow }}-${{
  github.event.pull_request.number || github.ref }}`,
  `cancel-in-progress: ${{ github.event_name ==
  'pull_request' }}` — PR pushes cancel stale runs,
  main-branch pushes queue (so every main commit gets a
  green/red record).
- Hard-fail everywhere on red; re-evaluate if something
  feels off.

**Parity-drift log (open).**

- CI's `actions/setup-dotnet@<sha>` vs dev-laptop
  `tools/setup/install.sh`. **Drift severity:** medium.
  **Planned fix:** swap once install script is stable
  across macos-14 + ubuntu-22.04 runners. **Backlog
  entry:** "Parity swap: CI's `actions/setup-dotnet` →
  `tools/setup/install.sh`."
- Devcontainer / Codespaces third leg is unbuilt.
  **Drift severity:** low (no devcontainer consumer
  exists yet). **Planned fix:** `.devcontainer/
  Dockerfile` calls `tools/setup/install.sh` during
  image build. **Backlog entry:** "Devcontainer /
  Codespaces image."

**Upstream PRs open.**

- None yet this round. Prior example (pre-Zeta): Aaron
  landed a mise dotnet-plugin PR during `../SQLSharp`
  work; that plugin's current release carries the fix.
- Candidate future PR: mise plugin for `elan` / lean-
  toolchain, if we decide to author one rather than
  waiting. Tracked under backlog "Full mise migration."

**CI cost observations.** No baseline yet — will measure
the first three runs of `gate.yml` after it lands.

**Watch items (from round-29 CI design).**

- Action SHA ledger in `docs/research/ci-workflow-
  design.md` has empty commit-SHA cells; fill when the
  workflow lands.
- Whether `tools/setup/install.sh` is truly idempotent
  will be proven by the two-run CI contract; if it
  breaks in practice, that's a DEBT entry.
- Stryker's CI shape is unscheduled — per round-29
  design it's manual/scheduled only, never per-PR. Cost
  estimate flagged for the scheduled-workflow PR when
  that lands.

**Round: YubiHSM2 on Linux (2026-08-18).**

- Cluster nodes are **NixOS**, not Debian. The apt
  question was the wrong question — pinned nixpkgs
  already has `yubihsm-connector` 3.0.7 +
  `yubihsm-shell` 2.7.3. No third-party apt source
  needed, no `.deb` to vendor.
- **New parity DEBT:** macOS. Homebrew has no
  `yubihsm-shell` formula (checked, 404), so
  `manifests/brew` cannot close the laptop leg. Severity
  low (one laptop has the device). Fix candidate:
  `from-installer` row for Yubico's `.pkg`. Open Q7.
- **CI cost fact worth reusing:** `install-v2` caches
  only `$HOME` paths, so **every `manifests/apt` entry
  is uncached and re-installed on 24 gate jobs every
  run, forever.** And `linux.sh` skips apt on NixOS, so
  an apt entry reaches zero cluster nodes. Worst
  cost/benefit ratio available in this repo.
- **Second cost fact:** the `install-v2` key hashes
  `tools/setup/**` — ANY file there rotates the key for
  19 consumers at once. Cache is already at 200% of
  10 GiB. Bias node-only work to `full-ai-cluster/`.
- **Found in someone else's open PR (#12042):** on
  NixOS the pkcs11 module resolves to
  `/run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so`,
  matching none of the probe's three Linux paths. A
  correctly provisioned node would report the module
  absent. Reported, not edited — Nazar's constant.
- **`from-deb` is unsafe and unused:** no sha256, no
  signature, bare `dpkg -i` on a URL — while sibling
  `from-url` refuses a row without `sha256=`. Also
  cannot install a library-only package (binary-only
  idempotence check). Filed as a separable finding.
- Blocked on maintainer sign-off: 8 numbered questions.
  Nothing landed but docs. Workitem
  081M0B5V6Z5087G0R0026RANJ3.

**Same round, after Q8 came back (2026-08-18).**

- Q8 ANSWERED: macOS `.pkg` writes
  `/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib` — third
  entry on the probe's darwin list, correct. Darwin
  module leg now measured, not assumed. NixOS finding
  unaffected.
- **The measurement produced a bigger finding than the
  answer.** `probeYubiHsm2` returned `false` with the
  device attached: `system_profiler` emitted zero lines,
  and empty-output / hard-failure / genuinely-absent all
  collapse to one boolean.
- **Do not assume the Linux branch is safer.** Same
  shape: `readDir("/sys/bus/usb/devices")` throwing
  returns `false` identically to "no device". sysfs
  lowers the probability, not the structure.
- Remedy already exists in that same file: `probeTpm2`
  answers a five-way `Tpm2State` for exactly this
  defect. `probeYubiHsm2` is still a boolean.
- **Node-design consequence (new Q9):** on headless
  metal a provisioning fault must not impersonate an
  absent device. Cross the unprivileged sysfs read with
  the connector's `/connector/status`
  (`status=OK|NO_DEVICE`) — `usbCheck` calls `usbopen`
  and reads the serial, so it is permission-sensitive
  and a missing udev rule shows as `NO_DEVICE` on a
  healthy attached HSM. Five-way state, never a boolean.
  Costs no CI minutes; needs no PIN or session.
- Lesson to carry: I wrote the udev section assuming
  "device present" was a solved input to my design. It
  was not. Check the state space of a signal before
  building on it.
