# Decision (PROPOSED): BP-29 — track falsifiers, not features

**Date:** 2026-08-20 · **Driver:** Aaron · **Status:** **proposed** (BP promotion is an
Architect decision per `docs/AGENT-BEST-PRACTICES.md`; this ADR is the proposal, not the
promotion) · **Class:** methodology

## Carved sentence (proposed BP-29)

> **Track falsifiers, not features.** A feature you cannot falsify is a claim, and a claim
> that cannot fail is worse than an absent feature — it *looks* like a guarantee and carries
> none. So the unit of progress is **the check that could have gone red**, and every positive
> assertion ships with a negative computed by the **same code path**.

## Why now

Aaron 2026-08-20, twice in one session:

> *"the biggest obstical to human AI trust is proper [un]implemented excetiopns of vacuious
> claims"*

> *"we should track falsfiers over features as a best practice diciplie and promte it"*

The first is the thesis: **the vacuity class is not an engineering-hygiene nit, it is the
principal obstacle to a human trusting an AI's output.** An unenforced exception, or an
assertion that cannot fail, is indistinguishable from a guarantee at reading distance and
distinguishable only by audit — which is exactly the cost trust is supposed to remove.

## The meter, because a discipline without one is vacuous by its own standard

Proposing "track falsifiers" with no way to count them would commit the error it names. So it
ships with a counter: `src/Core.TypeScript/hygiene/falsifier-density.ts`.

**Measured baseline, 2026-08-20, TypeScript suites:**

| quantity | value |
|---|---|
| test files with at least one test | **1107** |
| of those, **negative-bearing** (carry a refusal-shaped check) | **899** |
| **falsifier density** | **81.2%** |

So roughly **one test file in five carries no refusal-shaped check at all.** The counter emits
that list ordered by test count, so the work-list leads with the largest gaps.

## What the meter does and does not claim

- **Does:** count files containing a check *shaped* like a refusal — an expected throw or
  rejection, an assertion of `false`/`not`, or a test **name** drawn from refusal vocabulary.
  The count is exact and reproducible.
- **Does NOT:** establish that any assertion is *actually* falsifiable. `expect(true).not.toBe(false)`
  is negative-shaped and can never fail, and this meter counts it. That limit is **pinned as a
  test** so it cannot be quietly forgotten.
- The strictly stronger check already exists and is expensive: `mutation-runner.ts` — a test
  that survives mutation is not a falsifier however it is spelled. **Read density as the cheap
  wide screen and mutation as the narrow proof.** Register: **UNMETERED** — the count is exact;
  the claim that it tracks falsifiability is an unvalidated proxy.

## Why density can only ever be a proxy — and it is a theorem, not a concession

Aaron 2026-08-20, on `expect(true).not.toBe(false)`: *"oh wow we captured godel here."*

The instinct is right and the precise anchor is **stronger than Gödel**, which matters because it
converts this document's central caveat from an apology into a result.

- **The plain fact** is Shannon, not Gödel: that assertion is a **tautology** — true in every model —
  and a tautology carries `−log(1) = 0` bits. It cannot discriminate because there is nothing it
  excludes.
- **The Gödel-shaped part** is nearer **Tarski's undefinability of truth**: a system cannot define
  its own truth predicate. A test suite cannot express *"this test is meaningful"* **within itself**,
  which is why density defers soundness to mutation testing — and why the mutation runner cannot
  validate its own mutants either. Each level needs a level above it.
- **The rigorous form, and it is a theorem about the exact artifact here:** the **equivalent-mutant
  problem is undecidable** (Budd & Angluin, *Two notions of correctness and their relation to
  testing*, Acta Informatica 18, 1982). You cannot decide in general whether a mutant is semantically
  identical to the original. Since *"is this test a falsifier?"* reduces to *"does a mutant survive
  that should not?"*, **vacuity detection is undecidable in general.**

> So the honest limit is not *"density is a proxy because we settled for one."* It is:
> **the exact quantity is undecidable, so every practical instrument is an approximation — and the
> only question is which approximation, at what cost.** Mutation testing is not the complete answer
> either; it is the best *decidable* approximation, and its incompleteness has a name.

**This is why the section below refuses a gate**, and the refusal now follows from the theorem
rather than from caution: a threshold on an undecidable quantity is a threshold on a **proxy**, and
proxies under pressure are optimised directly. *(Register: the theorem is **cited, not checked** —
no formalisation of Budd–Angluin was run here. The tautology claim is arithmetic.)*

## What this does NOT propose

- **No gate, no threshold, no CI failure.** A ratcheted minimum would immediately be gamed by
  adding `.not.` to assertions, which would *lower* real falsifiability while raising the
  number — Aaron's own leaderboard-gaming instinct applied to this metric. Measure first,
  decide later, and only after the proxy has been validated against mutation results.
- **No retroactive sweep** of the barren files. The list is a work-list, not a debt.

## Where it belongs (the "best division" question Aaron raised)

| surface | carries |
|---|---|
| `docs/AGENT-BEST-PRACTICES.md` **BP-29** | the operational rule agents cite in review |
| `docs/VISION.md` | the *why* — falsifiers are how a claim becomes trustable without an audit |
| `falsifier-density.ts` | the number, so the discipline is not itself a vacuous claim |
| `mutation-runner.ts` | the strong check the density proxy defers to |

Hub/satellite per `dv2-data-split-discipline-activated`: the carved sentence is the hub; the
measurement and its limits are the satellite.

## Pointers

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register this operationalizes
- `src/Core.TypeScript/hygiene/mutation-runner.ts` — the mechanical falsifier check
- `docs/PROVEN-COVERAGE-AND-GAPS.md` — the existing coverage audit this composes with
- `memory/feedback_vacuous_claims_and_unimplemented_exceptions_are_the_biggest_obstacle_to_human_ai_trust_aaron.md` (**not in-repo**) — the origin
