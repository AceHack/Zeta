---
id: 081KZETP6AT08QG0R003MG1VYN
type: bug
state: backlog
priority: P2
slug: x86-64-build-ai-cluster-iso-qemu-scenario-1-first-boot-insta
title: "x86_64 build-ai-cluster-iso: QEMU scenario-1 first-boot install fails at mise toolchain step (regression since ~2026-08-02)"
created: 2026-08-07T19:20:05.722Z
depends_on: []
composes_with: []
---

# x86_64 build-ai-cluster-iso: QEMU scenario-1 first-boot install fails at mise toolchain step (regression since ~2026-08-02)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZETP6AT08QG0R003MG1VYN-*.md` glob. -->

## RE-CHECK (2026-08-08, Otto shadow*) — bug is INTERMITTENT, NOT resolved; reopened observation

Triggered a fresh `workflow_dispatch` build-iso on `main` (run **31270499976**) to get a
second data point. Result: `build-iso` (x86_64) **FAILED**, and `install.sh` in the
first-boot **failed again (rc=1)** — vs the prior run (31212929243) where it succeeded.
So the underlying failure is **INTERMITTENT**, not fixed. Two important refinements:

- **Different failure mode this time:** `install.sh FAILED rc=1` with **`mise ERROR`=0**
  and **no pipx-skip** lines (the original Aug 1–7 signature was mise/pipx). Exact rc=1
  cause still NOT captured (serial tail truncated). Root-cause still needs the documented
  `MISE_VERBOSE=1` + phase-1 serial-log capture.

- **The errexit fix (#10135) is confirmed working:** install.sh failed **non-fatally**
  (WARN emitted, script did not abort). That part is solid.

- **What actually failed the job:** the `081KSGS9H0008QG0R003V23XNZ wifi ESP acceptance`
  scenario — which is **`workflow_dispatch only`** (does NOT run on push/PR). Its full-install
  phase-1 waits 10 min for `ZETA CLUSTER NODE INSTALL COMPLETE`; a failed install.sh means
  the node never finished provisioning → marker never appeared → phase-1 **timeout** → wifi
  ESP contract failed → job failure. So this is `install.sh` failure surfacing *through* the
  full-install acceptance path.

- **Why normal CI stays green:** push/PR `build-iso` runs only audit + zflash --test +
  qemu-boot (which don't require full install.sh success), NOT the dispatch-only full-install
  / wifi-ESP acceptance. So `main` stays green even when install.sh intermittently fails.

**Real-metal impact (honest):** on an actual x86_64 flash+boot, install.sh may
intermittently fail → node comes up **partial** (missing k3d/kubectl/helm, marked
`~/.zeta/PARTIAL-PROVISION`), recoverable via
`cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh`. Boots and recovers, but not yet
reliably one-shot — matters for the operator's x86_64 test path.

**Stays P2, OPEN.** Not blocking normal CI, but a real intermittent provisioning failure.
**Next (drive-the-fix):** add `MISE_VERBOSE=1` to the first-boot `install.sh` invocation
(`zeta-install.sh:1577`) + capture/echo the phase-1 serial log on failure, dispatch again,
read the exact rc=1 cause, then fix. Evidence runs: FAIL 31270499976, PASS 31212929243.

## (superseded) RESOLVED-PENDING-OBSERVATION (2026-08-07, Otto shadow*) — downgraded P1→P2

Two-part outcome:

1. **The acute blocker (the hard-fail) is FIXED** by #10135 (`fix(installer): restore
   non-fatal first-boot install`): the errexit regression that #9937 introduced is gone,
   so a first-boot `install.sh` failure no longer aborts the script. `build-iso` (x86_64)
   is **green on `main`** (run 31212929243).

2. **The underlying latent failure is NO LONGER REPRODUCING.** In that same green run's
   `build-iso` job log (8589 lines), with the wider `tail -40` in place: **zero** failure
   markers — `PARTIAL PROVISION` (0), `install.sh FAILED` (0), `mise ERROR` (0),
   `Skipped due to failed dependency` (0), `[zeta-first-boot] Install failed` (0) — while
   the `iter-5.5.0` first-boot install step **ran** (3×) and **all scenarios pass**
   (2× `"passed":1`, 2× `"failed":0`). So `install.sh` (mise→uv/python/pipx) now
   **succeeds** in the x86_64 first-boot VM. The Aug 1–7 failure was therefore
   **environmental/transient** (a mise/uv/python resolution/download condition in the VM
   during that window), not a standing code defect — it surfaced only because #9937
   stopped swallowing it, and it stopped occurring on its own.

**Why still OPEN at P2 (not closed):** confirmed on ONE green run. Keep open to observe
`build-iso` across a few more `main` runs; if install.sh stays clean, close. If the mise
failure recurs, the wider logs will now show the exact error (the original next-step:
`MISE_VERBOSE=1` capture + reproduce `ZETA_HOST_TIER=full tools/setup/install.sh` in the
x86_64 installer VM env — `zeta-install.sh:1577` call site).

## Impact (was P1 — acute blocker now cleared)

Blocks the **usb-zflash-installer** trajectory's x86_64 "test it out again" path. You
cannot produce a green x86_64 installer ISO in CI to flash and boot on metal. The
software/unit path is healthy (installer suite 271 pass, now gated by
`installer-unit-tests.yml`), and the **aarch64** ISO variant + qemu-boot **passes** —
only x86_64 `build-iso` is red.

## Symptom

`build-ai-cluster-iso.yml` job **`build-iso`** (x86_64) fails at the
`081KSNY2Z0008QG0R0008PN7RQ` QEMU **scenario-1 first-boot install**:

```
Exit code: 1
Reason: phase 1 FAILURE — hard-fail marker "[zeta-first-boot] Install failed"
pipx:mypy@2.1.0:     Skipped due to failed dependency
pipx:ruff@0.15.17:   Skipped due to failed dependency
pipx:semgrep@1.161.0: Skipped due to failed dependency
pipx:yamllint@1.38.0: Skipped due to failed dependency
[zeta-first-boot] Install failed. See output above.
mise ERROR Version: 2026.6.12 linux-x64 (2026-06-22)
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
```

Inside the first-boot VM a **mise toolchain step errors**, so the pipx-managed tools
(mypy/ruff/semgrep/yamllint) are skipped as "failed dependency" and first-boot
hard-fails. The k3s cluster-init / cluster-online VM tests **pass** (node Ready in
~3.6 s); the ISO-content audits **pass**. The failure is isolated to the first-boot
`mise` install.

## Bisected — #9937 UNMASKED a latent failure; it is NOT the regression to revert

Bisected against `build-ai-cluster-iso` run history on `main`:

- Last **green**: `a74c6a463` (2026-08-01 22:43).
- First **red**: `96bc1f584` (2026-08-01 23:42).
- The only first-boot/installer commit in that ~1-hour window: **`c3b607cab` — #9937
  "fix(installer): a failed node provision reported success and said nothing"**
  (confirmed ancestor of the first-red, not of the last-green).

**#9937 is a silent-failure fix, not the bug.** Its own message: an `install.sh`
failure during first-boot *"printed nothing at all. The node finished provisioning,
reported success, and could ship without k3d/kubectl/helm."* It added a hard-fail +
`~/.zeta/PARTIAL-PROVISION` marker. So the x86_64 first-boot `install.sh`
(mise → uv/python/pipx toolchain) **was already failing before Aug 1** — the ISO builds
were going *green with broken nodes*. #9937 made the failure honest, which is why the
build now correctly goes red.

⚠ **DO NOT revert #9937** — that only re-hides shipping nodes without their toolchain.
The real bug is the underlying **x86_64 first-boot `install.sh` failure** that #9937
surfaced. aarch64 unaffected → x86_64-VM-specific.

Ruled out (checked, not the cause): the ~Aug 1–3 `fix(setup): …mise…` commits
(#9996/#10000/#10003) are cleanly **Windows-ARM-gated** — they touch no Linux-shared
`.sh`/`.ts`/`.toml`. The `python = "3.14.6"` pin is old (#8080), not recent.

## Next steps

1. Re-run one build with `MISE_VERBOSE=1` in the first-boot `install.sh` to capture the
   exact mise error (serial-console text above the `[zeta-first-boot] Install failed`
   marker) — all four pipx tools skipping together points at the shared
   **uv/python** dependency failing to install in the minimal first-boot NixOS VM
   (candidate: no precompiled python 3.14.6 for that env → source build fails on missing
   toolchain).
2. Confirm by reproducing `ZETA_HOST_TIER=full tools/setup/install.sh` in the x86_64
   installer VM env (`full-ai-cluster/usb-nixos-installer/zeta-install.sh:1577` is the
   call site).
3. Owner: install-script / first-boot toolchain path (GOVERNANCE §24 — devops-engineer /
   Dejan). Trajectory: `docs/trajectories/usb-zflash-installer/`.

## Failing run

- run 31144073166 (main @ 85df0bb6), job `build-iso`.
