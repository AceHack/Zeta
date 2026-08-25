---
id: 081M0X0C932087G0R001SWQQVQ
type: task
state: backlog
priority: P2
slug: host-tier-helper-emits-the-measured-capability-vector-alongs
title: "host-tier helper emits the measured capability vector alongside the chosen tier"
created: 2026-08-25T17:44:36.194Z
depends_on: []
composes_with: []
---

# host-tier helper emits the measured capability vector alongside the chosen tier

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X0C932087G0R001SWQQVQ-*.md` glob. -->

## Why

Aaron 2026-08-25:

> "eventually we want tiers of optional features that can coexist/compose with each other in higher layers"
> "in a perfect world i imagine some matrix for cpus, memory, solid state, and rotational disk and picking the right dependence to install based on those results"

The shipped design is a TIER ENUM (`slim | standard | full` — `tools/setup/common/host-tier.sh`,
`src/Core.TypeScript/ace/setup-realizers/host-tier.ts`, `.mise.full.toml`). An enum is a TOTAL
ORDER, and that is the defect: it cannot express "rotational disk but 128GB RAM", and two tiers
do not compose, so "tiers of optional features that coexist" is unrepresentable in it. What the
quote describes is a CAPABILITY VECTOR that dependencies state requirements over, with tiers
demoted from primitive to a DERIVED named region of that space.

## What this item is NOT

The redesign itself is blocked — there is not enough installed hardware to fit a model over, and
Aaron said so. This item does the part that is not blocked and does not presume the outcome.

## Scope (done)

MEASURE AND RECORD ONLY. `host-tier.sh` additionally emits the measured capability vector beside
the tier the enum chose, as one JSON artifact. Install behaviour is unchanged: `ZETA_HOST_TIER`
still decides every package. The value is that the pair (measured vector, chosen tier) becomes a
record, which is what later makes the tier a *checkable function of reality* rather than a guess.

Vector v1 carries: cpu logical count, cpu arch, total RAM bytes, per-block-device rotational flag
(three-state), device sizes, the chosen tier + its provenance, and an explicit `unmeasured` list.

## Measured on the maintainer's host 2026-08-25 (darwin/arm64)

24 logical CPUs, 206158430208 bytes (192 GiB) RAM, `tier = full (detected)`.

The enum's top threshold is 16 GiB. This host carries **twelve times** that and lands in the same
bucket as a 16 GiB laptop. That is the total-order collapse Aaron is describing, now recorded as
a number rather than asserted as a concern.

## Open (deliberately not answered here)

- What the requirement language over the vector looks like (`requires: rotational=false`, ranges, ...).
- How tiers are re-derived as named regions once the vector is the primitive.
- Whether the artifact should be collected centrally (CI workflow artifact) or stay host-local.
- Linux and Windows measurement paths are unverified on real hosts (see below).

## Honest limits

- The Linux `/sys/block/*/queue/rotational` reader is FIXTURE-TESTED ONLY. No Linux host has run it.
- Windows has no probe; it records the gap rather than a zero.
- GPU, core frequency, cache sizes, P/E-core split and cgroup CPU quota are NOT measured, and each
  is named in the artifact's `unmeasured` list.

