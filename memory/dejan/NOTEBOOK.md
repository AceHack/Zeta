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
