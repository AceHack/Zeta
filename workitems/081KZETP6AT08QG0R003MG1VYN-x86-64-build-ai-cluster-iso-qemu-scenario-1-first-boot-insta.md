---
id: 081KZETP6AT08QG0R003MG1VYN
type: bug
state: backlog
priority: P1
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

## Impact (why P1)

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

## Persistence + correlation (not a flake)

`build-ai-cluster-iso` on `main` has failed **9 of the last 10 runs since ~2026-08-02**,
across unrelated triggering commits (setup, browser-room, bridge, book-build) — so the
breakage is independent of the trigger. The window coincides with a run of
`fix(setup): …mise…` commits (Windows-ARM mise graph filtering, clean-host mise
entries). **Prime suspect: a mise/setup change ~Aug 2 that regressed the first-boot
x86_64 toolchain install.** aarch64 unaffected.

## Next steps

1. Re-run one build with `MISE_VERBOSE=1` in the first-boot install to capture the exact
   mise error (the serial-console text above the hard-fail marker).
2. Bisect the `fix(setup): …mise…` commits from ~2026-08-02 against the first-boot
   x86_64 mise install path.
3. Owner: install-script / first-boot toolchain path (GOVERNANCE §24 — devops-engineer /
   Dejan). Trajectory: `docs/trajectories/usb-zflash-installer/`.

## Failing run

- run 31144073166 (main @ 85df0bb6), job `build-iso`.
