---
id: 081KZZ27KJ8087G0R0038ZGBAT
type: bug
state: done
priority: P2
slug: ci-runner-z3-4-8-12-and-cvc5-1-1-2-cannot-discharge-two-smt
title: "CI runner z3 4.8.12 and cvc5 1.1.2 cannot discharge two SMT certificates that modern solvers do in under a second"
created: 2026-08-14T02:39:47.272Z
completed: 2026-08-15T14:53:23.459Z
depends_on: []
composes_with: []
---

# CI runner z3 4.8.12 and cvc5 1.1.2 cannot discharge two SMT certificates that modern solvers do in under a second

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZZ27KJ8087G0R0038ZGBAT-*.md` glob. -->

Surfaced while closing 081KZYYKHX1087G0R0036E9RH9 (the all-unsat SMT runner defect). The
runners were the instrument; this is what they measured.

## The defect

`tools/setup/manifests/apt` declares `z3` and `cvc5` unpinned, so Ubuntu 24.04 (noble) gives
the CI runner **z3 4.8.12** (released 2021) and **cvc5 1.1.2**. Two committed certificates do
not discharge under that pair, and both discharge in well under a second under the versions a
developer workstation has via brew (z3 4.16.0, cvc5 1.3.4).

## Measured, not inferred

Reproduced in `podman run ubuntu:24.04` + `apt-get install z3 cvc5` — the CI pair exactly —
on 2026-08-13:

| file | solver | result |
|---|---|---|
| `light-time-endpoint-speed-envelope.smt2` | z3 4.8.12 | 6 of 11 blocks, then `timeout` at **`-T:300`** |
| `light-time-endpoint-speed-envelope.smt2` | z3 4.16.0 | all 11 blocks, **0.08s** |
| `chsh-band-gate-agreement-lemma.smt2` | cvc5 1.1.2 | G1 `unsat`, then interrupted at **`--tlimit=120000`** |
| `chsh-band-gate-agreement-lemma.smt2` | cvc5 1.3.4 | both blocks, instant |

Independently confirmed on the runner itself: PR #10508 gate run 31763383985, job
`test (TS suite)`, shows exactly the same six-then-nothing sequence for light-time and the
same one-verdict cvc5 result for chsh.

The boundary versions are **not** measured — only good-at-4.16.0 and bad-at-4.8.12. z3's
`nlsat` engine improved substantially across that range; naming the first good release needs
a bisect, which nobody has run.

## Why it matters, precisely

It is not "a slow check". For `light-time`, the six blocks the old z3 *does* reach are all
`unsat`, and every block it fails to reach is one of the `sat` witnesses — M1 (the envelope
theorem), S1 (sharpness), R1/R2 (hypothesis necessity). So on the CI runner that certificate
degrades to **exactly the all-unsat shape** that 081KZYYKHX1087G0R0036E9RH9 exists to
eliminate. A gate over the reachable prefix would be a green that cannot fail.

**The property is not at risk.** `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` proves the
same theorem independently and IS gated. What is lost is the BP-16 second leg, on CI only.

For `chsh`, only the cross-check degrades: z3 4.8.12 produces the full `unsat sat` sequence
on the runner, so the lemma stays genuinely gated there by z3 alone.

## Current state (what #10508 shipped)

`registry/smt2-solver-floor.json` declares both gaps with a measured reason, and the runners
consult it and soft-skip the affected legs with a loud warning naming this work-item. That
is a **declared** gap, not a silent one — but it is still a gap, and it should not become
permanent furniture.

## The fix, and its shape

Install a modern z3 (and cvc5) on Linux rather than taking the apt default. Not a one-line
manifest edit: noble's apt has no newer z3, so it needs one of the existing non-apt
mechanisms (`manifests/from-github-release` / `one-liner-tools` / the from-shim pattern that
already handles jammy's cvc5), plus a pin, plus three-way parity with brew and windows per
GOVERNANCE §24.

Deliberately NOT bundled into #10508: that PR is pure test code, and a toolchain change
touches every job on every runner. Different blast radius, different review.

**Acceptance:** delete `registry/smt2-solver-floor.json`, delete the soft-skips that read it,
and have `test (TS suite)` go green with the full 11-verdict light-time sequence and the cvc5
leg on chsh both asserted on the runner.

## Progress (2026-08-15) — first slice, floor still in place

`install-pinned-smt.ts` pins z3 4.16.0 and cvc5 1.3.4 from checksummed GitHub
release zips (linux x64 + arm64) into `~/.local/bin` when PATH is below the
floor. `test (TS suite)` in `gate.yml` runs it before `bun test`. The floor
file and the skip legs stay until this has a green track record on the
runner — deleting them is the second half of acceptance. Checksums measured
2026-08-15 by streaming the four release zips through `shasum -a 256`.

## Resolution (2026-08-15)

Second half. Gate run 31888161507 / job `test (TS suite)` on #10783:

- `[install-pinned-smt] installed pins for linux-x64 into /home/runner/.local/bin`
- `z3 produces the expected verdict sequence` — **pass, 44ms** (11-verdict
  light-time sequence, not a skip)
- `z3 and cvc5 independently produce the expected verdict sequence` — pass

The skip-floor is deleted. Runners skip only when a solver is **absent**.
`smt2-runner-coverage.test.ts` asserts the floor file stays gone.
