# Honest peels on the max-mode economics — the Condorcet guarantee is conditional (S=4 vs independence), Landauer is a benchmark, Eve's small-rooms is a testing principle

*Shadow ferry, 2026-07-04. Companion to Max/Lumen's committed
[`max-mode-economics-compute-allocation-in-a-bayesian-society.md`](2026-07-04-max-mode-economics-compute-allocation-in-a-bayesian-society.md)
(SHAs c50091ac9 / 7c5f69a78) + §11 SoftValue-GC (f7f5aa93c). The framework is saved; this does NOT
re-explain it. It carries the catcher's read — Max ran enthusiastic and three claims need peeling —
plus Eve's principle preserved with provenance and honest register, and the anchors the synthesis
gestured at but didn't cite.*

## Aaron verbatim

> "this E8 society soft-maximize on mutual empowerment … this [is] just true always, something we can
> depend on with many 9s of accuracy. this is why our chip8 AIs are useful."

> "yes i'm building the demon at the limit, the landauer limit." … "we should make this first class,
> like uncertainty and heat in our system."

> "my daughter summed this up — i make tests = rooms, and she said rooms should be small so you can
> know easily what went wrong and was uncertain." (Eve, 2026-07-04.)

## Peel 1 (the crux) — the Condorcet "many 9s / true always" guarantee is CONDITIONAL, and the shared seed S=4 is in tension with the very independence it needs

The max-mode doc states the competence>0.5 condition (good), but the "true always / many 9s / structural
guarantee" framing overclaims on two counts the doc does not surface:

1. **Condorcet cuts BOTH ways (anti-Condorcet).** The jury theorem drives majority correctness → 1
   *only if* each agent's competence > 0.5. If competence < 0.5, adding agents drives the majority
   toward **0** — many cheap agents make it *worse*. That the CHIP-8 AIs clear 0.5 **on a given task**
   is not automatic; it is a per-task empirical fact, not a geometric one. So the guarantee is "many 9s
   *when the cheap agents are individually better than chance on this task*," not "always."
2. **Condorcet needs ERROR-independence; delay-decorrelation only buys OBSERVATION-independence — and
   the common seed S=4 is a source of CORRELATED error the decorrelation does not remove.** The
   delay-decorrelation proof (Row 19) shows network latency decorrelates *timing/observations*. But the
   Condorcet bonus requires the agents' **errors** to be independent. A shared common seed (S=4), a
   shared prior, and shared training are exactly a source of **correlated systematic error** — every
   agent can be wrong *the same way* while their observation timing is fully decorrelated. Decorrelating
   *when* they observe does not decorrelate *how they are biased*. So the E8-packing → "maximum
   decorrelated directions per unit of shared prior" argument addresses the geometry of the observation
   space, not the covariance of the error — and the honest statement is: **the Condorcet multiplier
   applies to the independent-error component; the shared-seed/shared-prior component is correlated and
   is NOT amplified (and can anti-correlate the vote).** This is a real, load-bearing tension in the
   architecture — *the common seed that makes coordination free is in direct tension with the error-
   independence the Condorcet guarantee needs* — and it should be surfaced, not hidden inside a "many
   9s" claim the scheduler might then trust. Discharge target: bound the shared-bias fraction and show
   the residual independent-error component still clears the Condorcet threshold.

*(This is not "the Condorcet insight is wrong" — it's "the guarantee is conditional, and one of its
conditions is in tension with S=4." The many-cheap-beats-one-expensive intuition is sound for the
independent-error part; the peel is against "always / many 9s / structural.")*

## Peel 2 — "at the Landauer limit" is a benchmark/direction, not an achieved state

Landauer's limit is `kT ln 2` J per bit erased (~3×10⁻²¹ J at room temperature). Real computation runs
**~8 orders of magnitude above** it (modern CPUs ≈ 10⁸ × Landauer). "Building the demon *at* the limit"
is an aspiration and a *benchmark* — the `LandauerRatio = actual_ΔJ / (IV·kT ln2)` is a genuinely useful
metric *because* it names the gap — but the system is not operating at the limit and claiming so would
overclaim by eight orders of magnitude. Aim, not achievement. And the reason the demon doesn't violate
the second law is specifically **Bennett's resolution (1982)**: the demon's *memory erasure* pays the
`kT ln 2` (Szilard 1929's engine; Landauer 1961) — Max gestured at this ("the update costs compute") but
it deserves the citation, because it's the whole reason the metering has to include the cost of the
Bayesian update itself, not just the sorted work.

## Eve's principle — preserved with provenance, and honestly (the real insight, not the physics inflation)

Eve (Aaron's daughter, 2026-07-04): **"tests are rooms; rooms should be small so you can know easily
what went wrong and was uncertain."** This is a sharp, correct testing principle, and it is *already
well-established* under other names — **fault localization**, the **minimal reproducible example**, and
**unit-test granularity**: a small test has a small cause-set, so a failure is localized without search.
That is the real, load-bearing content, and it stands on its own (see `src/Core/RoomRun.fs` — rooms are
a real code concept here).

Honest peel on Max's framing: the write-up escalated it to "the Landauer limit applied to test design …
thermodynamically optimal … not a conjecture but a consequence of the proven thermodynamic framework."
That is **inflation** — the thermodynamic reading (small room ≈ low entropy ≈ fewer bits to erase ≈
closer to Landauer) is a *coherent rhyme*, not a proven consequence, and the thermodynamic framework it
leans on is itself mostly §B (conjecture). Eve's insight does **not need** the physics to be correct or
valuable — it's a good testing law on testing grounds. Credit the genuine insight; drop the grandiosity.

## Anchors the synthesis gestured at but didn't cite

- **Condorcet jury theorem** — Condorcet (1785); the anti-Condorcet (competence < 0.5) direction is part
  of the same theorem.
- **Maxwell's demon, resolved** — Maxwell (1867); **Szilard** engine (1929); **Bennett** (1982), the
  erasure-cost resolution (why no 2nd-law violation).
- **Landauer's principle** — Landauer (1961), `kT ln 2` per bit.
- **Eve's principle's real anchors** — fault localization; the minimal reproducible example; unit-test
  granularity / the test pyramid.

## Cross-links (substance already on main)

- Max's framework: the max-mode-economics doc (above); §11 SoftValue-GC in the tick-sources doc.
- Rooms in code: `src/Core/RoomRun.fs`.
- The S=4/independence tension connects to the earlier E8/anti-Sybil decorrelation ferry and the
  golden-vector treaty (the canonical seed is the shared substrate — the same S=4 whose independence is
  in question here).
