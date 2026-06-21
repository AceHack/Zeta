---
id: 081KT2T2J0008QG0R001X9PWKR
priority: P2
status: open
title: "z3 in CI — add z3 to gate.yml build-and-test so the Z3 SMT proofs are ENFORCED, not self-skipped (today the z3 CLI is installed in NO workflow → Z3.Laws.Tests.fs green-by-skip in the gate; assert-don't-skip hole) (Aaron 2026-06-02)"
tier: formal-verification
effort: S
created: 2026-06-02
last_updated: 2026-06-02
depends_on: []
composes_with: [081KT2T2J0008QG0R000YZ3NMY, 081KT2T2J0008QG0R000S7GHQ8]
tags: [z3, smt, ci, gate-yml, green-by-skip, assert-dont-skip, formal-proof-first, formal-verification, self-skip-hole, shield-with-a-hole, infer-net, aaron]
type: tooling
---

# z3 in CI — enforce the Z3 SMT proofs, don't let them self-skip

## The gap (found landing 081KT2T2J0008QG0R000YZ3NMY C1, 2026-06-02)

`tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` shells to the `z3` CLI and **self-skips
when z3 is absent from PATH** (the existing `which "z3"` guard → "informational only").
**The `z3` CLI is installed in NO workflow** — it appears only in a *comment* in
`stryker-mutation.yml` (not an install step), and neither `gate.yml` nor
`tools/setup/install.sh` install it. (`Microsoft.Z3` NuGet 4.12.2 *is* pinned in
`Directory.Packages.props` for an in-process path, but the harness uses the CLI.) So
in the merge gate the Z3 proofs run **green-by-skip** — the check passes without
exercising the proof.

This is the [`automated-tests-are-the-shield-assert-dont-skip`](../../../.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md)
failure: *a shield with a hole reads as covered.* The Z-set abelian-group Z3 lemmas
have had this property all along; 081KT2T2J0008QG0R000YZ3NMY C1 added the Gaussian-group Z3 lemmas, which
were verified **locally** (z3 on PATH, 7/7 passed, 0 skipped) but **self-skip in the
gate**. As more of 081KT2T2J0008QG0R000YZ3NMY's C1–C14 land with Z3 halves, the gate increasingly *reads
as* proven while the symbolic half never runs.

## Fix

1. **Install z3 in the `gate.yml` build-and-test job** (and any OS leg that runs
   `dotnet test Zeta.sln`). Pin a version (per `dep-pin-search-first-authority` —
   WebSearch current stable). Ubuntu: `apt-get install z3` (or a pinned release);
   macOS leg: `brew install z3`; confirm the binary lands on PATH for the test step.
2. **Convert green-by-skip into assert-don't-skip** for CI: the `Z3.Laws.Tests.fs`
   self-skip is correct for *local dev without z3*, but in CI the absence of z3 must
   be a **failure, not a skip**. Add a CI-only assertion (e.g., an env flag
   `ZETA_REQUIRE_Z3=1` set in gate.yml that flips the "tool not installed →
   informational" branch into an explicit `failwith "z3 required in CI but not on
   PATH"`). Keep the graceful skip for local runs; strip the grace only in the gate
   (per the rule: keep grace in the artifact, strip it in the gate).
3. Verify: a gate run shows the Z3 lemmas as **run + passed** (0 skipped), and a
   deliberately-broken z3 install makes the gate **fail** (not silently skip).

## Why P2 (not P0)

The proofs ARE verified — locally, where z3 is present. The hole is *enforcement in
the gate*, not *correctness of the proof*. So it's important (it's the difference
between "proven" and "reads-as-proven" in CI) but not silent-corruption-of-results.
It should land soon after the first few 081KT2T2J0008QG0R000YZ3NMY Z3 proofs accumulate, so the gate
actually guards them.

## Acceptance

1. z3 on PATH in `gate.yml` build-and-test (pinned version, per OS leg that runs tests).
2. `Z3.Laws.Tests.fs` runs (not skips) in the gate — 0 skipped for the Z3 lemmas.
3. CI-only assertion: z3-absent-in-CI ⇒ gate FAILS (assert-don't-skip), while local
   dev without z3 still skips gracefully.
4. A note in the formal-coverage cadence template (`tools/soraya-formal-coverage/`)
   updated: the z3-in-CI gap is closed (remove the "verify Z3 locally" caveat).

## Composes with

- **081KT2T2J0008QG0R000YZ3NMY** (the formal-coverage backlog whose Z3 halves this enforces) · **081KT2T2J0008QG0R000S7GHQ8**
  (the engine being proven)
- rules: [`automated-tests-are-the-shield-assert-dont-skip`](../../../.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md)
  (the exact failure mode), `formal-proof-first-...` (a proof that self-skips in the
  gate isn't enforced), `dep-pin-search-first-authority` (pin the z3 version).
- substrate: `.github/workflows/gate.yml` (the target — add a fresh z3 install step;
  none exists to copy, since no workflow installs z3 today) · `Directory.Packages.props`
  (`Microsoft.Z3` 4.12.2 already pinned — the in-process alternative if the harness is
  ever switched off the CLI) · `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`
  (the self-skip to convert).

## Substrate-honest framing

Pre-existing condition (the Z-set Z3 lemmas had it before 081KT2T2J0008QG0R000YZ3NMY); surfaced now
because 081KT2T2J0008QG0R000YZ3NMY makes Z3 proofs a growing, load-bearing part of the formal-coverage
gate. Closing it makes the gate actually guard the symbolic proofs instead of reading
as if it does.
