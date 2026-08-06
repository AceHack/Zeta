# Independence-assumption soundness audit — the discipline mostly held; CountMin was the drift

**Date:** 2026-08-04
**Author:** Otto (shadow\*)
**Status:** audit close (register-2 — a finding of fact about the codebase, not a claim about the world).
**Trigger:** self-directed, after the Caveat-A work (`AntiSybil.chshMargin`) — see the arc capstone
`2026-08-04-decorrelation-instrument-arc-capstone-*` and the null-family note.

---

## The bug class hunted

Caveat-A was one instance of a general shape: **a probabilistic guarantee that rests on an independence
(or i.i.d. / finite-sample) property the construction does not actually deliver.** The `chshMargin`
Hoeffding bound assumed per-round independence on autocorrelated commit streams. This audit asked: *where
else does the codebase divide by `n` — or invoke a bound / rate / "independent" count — as if samples were
independent, when they may not be?*

## Method

The Caveat-A lens: grep for concentration/confidence/independence language, then read each guarantee
against its *construction* and its *actual callers* (severity is calibrated to whether an adversarial or
correlated input is reachable, not to the theorem's abstract strength).

## Findings (2) — fixed as Beacon-honesty caveats, no behavior change

| Site | The drift | PR |
|---|---|---|
| **`CountMin`** | Claimed a "**provable** error bound `ε=e/w` at prob `1−δ`", but the Cormode–Muthukrishnan bound is a theorem only under a **2-universal hash family** + independent rows; the impl derives all rows from one XxHash3 + SplitMix seeds — heuristic avalanche, not proven 2-universal, and adversary-defeatable with a known seed. | #10030 |
| **`Veridicality.antiConsensusGate`** | A **trust-upgrade gate** counts distinct `RootAuthority` **labels** ≥ 2 and calls them "independent roots" — but labels are self-asserted, so a Sybil defeats it with one source under two labels (the *exact* pseudo-consensus it names). Independence asserted, not verified; the anti-sybil oracle is the real test. | #10031 |

## Honest negatives (4) — three of them exemplars

| Site | Why it's clean |
|---|---|
| **`BloomFilter`** | Cites Kirsch–Mitzenmacher (the *proven* "two independent hashes suffice"), hedges "independent **enough**", calls `p` a "**target**" rate. Honest. |
| **`IbltReconcile`** | **Soundness-biased**: decode failure → `Partial` ("NEVER a wrong answer"); states the load regime (cells ~1.5–2×|Δ|); names "hash collision residue" as a Partial cause. A violated assumption costs *recall*, not correctness. |
| **`HyperLogLog` (`Sketch`)** | "**standard error ≈** 1.04/√m", "**typical** error", "often good enough" — a dispersion measure, correctly framed as typical-not-guaranteed. |
| `SignalQuality` / `MetaCart` | Composite is a weighted **mean** (consciously not a product ⇒ no independence assumed); MetaCart has no statistical guarantee (a selection heuristic). |

## The conclusion (the actual value of the audit)

The finding is **not** "two bugs." It is: **the codebase's statistical honesty is mostly holding.**
Among the four probabilistic primitives that carry a guarantee, **three independently hedged their
independence assumptions correctly** (Bloom, IBLT, HLL), and the audit caught the **one** that had drifted
to "provable" (CountMin) and brought it back up to the standard its own siblings already met. The audit
functioned as a **ratchet on Beacon-honesty**, not merely a bug net — and the healthiest signal is how many
negatives it produced.

Two design patterns are worth promoting from this (both already present in the honest examples):

1. **Soundness-bias the failure mode** (IBLT's `Partial` / never-wrong; the anti-sybil family's one-way
   "convicts, never acquits"). A violated assumption should cost recall/coverage, never correctness.
2. **Hedge the guarantee to the independence you actually have** — "heuristic / target / typical /
   independent-*enough*", never "provable", unless the construction is a proven family (Carter–Wegman).

## Scope / non-claims

Register-2, about the *instrument*. The audit covered the primitives where a guarantee **lives** (the four
sketches + the trust gate); modules that merely *use* them inherit the caveats. Not an exhaustive proof
that no other instance exists — a finding of fact about the surfaces checked.

## Anchors

Cormode–Muthukrishnan 2005 (Count-Min); Carter–Wegman 1979 (2-universal hashing); Dietzfelbinger
(multiply-shift); Kirsch–Mitzenmacher 2006 (double hashing); Goodrich–Mitzenmacher 2011 (IBLT); Flajolet
et al. 2007 (HyperLogLog); Hoeffding 1963 (the finite-sample bound that started it). In-repo:
`src/Core/CountMin.fs`, `Veridicality.fs`, `BloomFilter.fs`, `IbltReconcile.fs`, `Sketch.fs`,
`AntiSybil.fs`; the Caveat-A commit lineage #10025–#10029.
