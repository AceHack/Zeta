---
id: 081M3HP7KKH087G0R0011NQAKF
type: task
state: backlog
priority: P2
slug: a-probe-that-could-not-run-still-founds-a-cluster-by-default
title: "A probe that could not run still founds a cluster by default: gate ZETA_DISCOVERY_REQUIRED=1 on discovery having run once"
created: 2026-09-27T15:02:44.081Z
depends_on: ["081M39K8ND1087G0R000G4EN4N"]
composes_with: []
---

# A probe that could not run still founds a cluster by default: gate ZETA_DISCOVERY_REQUIRED=1 on discovery having run once

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HP7KKH087G0R0011NQAKF-*.md` glob. -->

## The condition

The probe, the decider and `zeta-first-boot.sh` already keep three states apart
(`responded` / `silence` / `probe-failed`), and the call site names a probe that
could not run as *"a check that did not run, NOT a check that passed."* But with
the role undeclared and `ZETA_DISCOVERY_REQUIRED` at its default `0`, that named
non-result still falls back to the ISO default role, `control-plane`
(`first-control-plane`) -- i.e. it **founds a cluster**. On a second machine on a
segment where discovery errors (daemon down, pass killed at 2 s, no carrier), the
result is a second, separate cluster: split-brain, undone by hand.

## Why the default was not flipped in the same change

A halt (drop to shell, press `c`/`w` to declare) is reversible; a second cluster
is not cheaply reversible, so by that asymmetry the halt is the safe default. It
was **not** flipped alongside the `--no-db-lookup` fix (081M39K8ND1087G0R000G4EN4N)
because no lane has yet observed the probe *run* on the ISO: until a serial log
shows `BOOTSTRAP — nothing answered, and the silence passed`, flipping would turn
any still-unknown probe failure in the QEMU lanes (scenario 2 runs on `push`)
into a halted install on `main`, blind.

## Done when

1. A QEMU lane's serial log shows the discovery reaching `silence` -> `bootstrap`
   on the fixed argument list (measured, with the run id).
2. `ZETA_DISCOVERY_REQUIRED` defaults to `1` in `zeta-first-boot.sh`, and the
   `ZETA_DISCOVERY=off` arm is decided explicitly (an operator who chose `off`
   declared something; halting them may be wrong).
3. `installer-wiring.test.ts` pins the new default.
