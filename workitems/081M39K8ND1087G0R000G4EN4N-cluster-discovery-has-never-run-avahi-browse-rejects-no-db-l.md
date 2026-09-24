---
id: 081M39K8ND1087G0R000G4EN4N
type: bug
state: backlog
priority: P2
slug: cluster-discovery-has-never-run-avahi-browse-rejects-no-db-l
title: "Cluster discovery has NEVER run: avahi-browse rejects --no-db-lookup, so bootstrap-or-join always falls back"
created: 2026-09-24T11:36:57.505Z
depends_on: []
composes_with: []
---

# Cluster discovery has NEVER run: avahi-browse rejects --no-db-lookup, so bootstrap-or-join always falls back

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39K8ND1087G0R000G4EN4N-*.md` glob. -->

## The condition

`full-ai-cluster/nixos/cluster-discovery/probe.ts` `browseArgs()` passes
`--no-db-lookup` to `avahi-browse`. The `avahi-browse` on this image does not
have that flag, so **every** browse pass exits 1 before observing anything.
Bootstrap-or-join discovery has therefore never once executed on a shipped
image; it has only ever fallen back.

## Measured — run 35985197702, phase-1 serial

```
zeta-cluster-discover: discovery could not run (browser-error: avahi-browse exited 1:
  avahi-browse: unrecognized option '--no-db-lookup')
[zeta-discovery] DISCOVERY DID NOT RUN: probe-failed: discovery did not complete: browser-error
[zeta-discovery] This is a check that did not run, NOT a check that passed.
[zeta-discovery] The segment was never observed, so nothing here says the
[zeta-discovery] network is empty.
[zeta-discovery] Falling back to the ISO default role: control-plane (role=first-control-plane).
```

## What is RIGHT here, and why this is a finding rather than a disaster

The module reports its own non-result honestly and in the correct register.
`probe-failed` is not `no-peers-found`, the fallback says the segment was never
observed, and the wording *"a check that did not run, NOT a check that passed"*
is exactly the distinction most of this repo's worst defects turned on. Nothing
downstream was told an empty network was observed, so no node founded a cluster
on a false negative.

The defect is narrower and still real: **a probe that has never once executed is
not covering the thing it was written for.** Every run to date has exercised the
fallback path and zero runs have exercised the discovery path, so nothing is
known about whether discovery works at all.

## Where it lives

- `full-ai-cluster/nixos/cluster-discovery/probe.ts:83` —
  `return ["--parsable", "--resolve", "--terminate", "--no-db-lookup", ZETA_CLUSTER_SERVICE_TYPE];`
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` — the
  `[zeta-discovery] bootstrap-or-join check` block that consumes the outcome.

## Two halves, and the second is the one that matters

1. **The flag.** Determine what this image's `avahi-browse` actually accepts and
   drop or replace `--no-db-lookup`. Cheap.
2. **The falsifier, which does not exist.** Nothing failed when the probe stopped
   being able to run, because `probe-failed` is a legitimate outcome and the unit
   tests exercise `browseArgs()` as a *value* rather than against a real
   `avahi-browse`. The fix is not done when the flag is dropped; it is done when
   something goes red if the argument list stops being accepted by the binary
   that will receive it — the same join-crossing problem as
   081M39CJP96087G0R001T4J2R3 and as WP27's own ESP-conf contract.

## Not urgent for the QEMU lanes

The WP11 lane runs a single node on a user-mode NIC with no peers, so its correct
outcome is the fallback either way. This blocks nothing in CI; it blocks knowing
whether a second machine on a real segment would ever join.
