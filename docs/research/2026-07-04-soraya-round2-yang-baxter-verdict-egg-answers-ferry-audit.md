# Soraya round 2 — the Yang–Baxter verdict, the Egg answers, and the ferry audit

*Soraya (formal-verification routing authority), background round 2, 2026-07-04, dispatched per Aaron
("we should drive some Soraya background work too"). Landed by the shadow with her leg-2a test built in the
same PR (`tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs`, 6/6 matching her pre-verified numerics) and her
BUGS finding filed. Condensed; verdicts hers.*

## 1. The Yang–Baxter verdict (leg-2a) — now executable

She verified the candidate matrices numerically before speccing, and the reading **sharpened** her #9468
prediction with two new facts:

- **JOIN = CNOT fails Yang–Baxter outright** (deviation 1.0) — the ISA's only two-strand operator is not a
  braiding *at all* (it IS the correct entangler; it just isn't a braid generator).
- **Strand-local EMIT = Ry(θ) fails the braid relation for every non-degenerate θ** (deviation = sin(θ/2)).

So the braid structure in `BraidIsaZetaConsistency.Tests.fs` lives **entirely in the words** (the free
monoid / Ihara level) — none of the shipped amplitude images is a properly braided generator. The landed
test encodes: SWAP symmetric (YB ✓, σ²=id), CNOT involutive but not YB, BRANCH-dressed swap YB-but-σ²=id,
and the **Kauffman–Lomonaco R as positive control** (YB ✓, σ²≠id, R⁸=I — proper braiding EXISTS in Mat(ℂ),
proving the instrument distinguishes symmetric from braided; the negatives are not vacuous). **Standing
verdict: traced symmetric dagger-compact Mat(ℂ); "braided" unearned until a KL-class R-matrix ships in the
ISA itself.** (Anchors: Joyal–Street; Selinger; Kauffman–Lomonaco 2004; Freedman–Kitaev–Larsen–Wang.)

## 2. The Egg's open questions — first-pass answers

- **Q1 (is count-CV the right temporal metric?):** in the simulated regime (shared stream, prefix
  consumption, homoscedastic commutative Gaussian), the obs-count is the **arc-length parameter** on one
  shared trajectory — count-CV is a *sufficient statistic* for temporal spread, and trajectory-KL is a more
  expensive monotone reparametrization (zero extra information). It breaks with the regime: heteroscedastic
  noise, different streams (FIG8), non-commutative updates. **The cheap upgrade is accumulated-precision CV**
  (τᵢ = τ₀ + Σ 1/σ²ⱼ — reduces to count-CV in the homoscedastic case, stays honest under heteroscedastic).
  Reserve trajectory-KL for the non-commutative case only. Routing: Adaeze falsifying simulation, NOT Lean.
- **Q2 (rhoPost vs rhoCount in the limit):** **not equivalent, and the interesting limit is t→∞, not N→∞.**
  Sketch: Var(μᵢ − μₖ) ≈ σ²·|nᵢ − nₖ| / n² — so (1) rhoPost's delay-invariance is an **asymptotic fact, not
  an identity** (the delay term decays as 1/n²; invisible at the simulation's n, not absent); (2) the two
  metrics are NOT independent axes — spatial spread = temporal spread / n²; (3) at t→∞ both degenerate
  (all posteriors → δ_truth; count-CV → 0), and degenerate equivalence is not equivalence — **they carry
  distinct information precisely and only at finite time.** Routing: Tariq one-page Gaussian derivation +
  Adaeze/FsCheck rate check (the BP-16 pair).

## 3. Audit of the shadow's Egg-ferry claim — CORRECT, sharpened

The claim ("under a shared stream with commutative updates, temporal spread adds no stationary-limit
information — one voice with lag") is **correct as stated**, and the load-bearing condition is
**sufficiency**, not commutativity alone: (i) shared prefix stream; (ii) identical deterministic commutative
updaters; (iii) the posterior is a *sufficient statistic* (Halmos–Savage/Blackwell); (iv) stationary θ (Doob).
Then I(θ; any vote statistic | leader's posterior) = 0. The counterexamples are exactly the **sufficiency
failures**: non-stationary drift under a static-θ updater, or heteroscedastic noise under a known-variance
updater — there, lag-spread IS stationary information, **because the model is misspecified**. So temporal
spread is a **model-criticism channel** — a sharper version of the ferry's finite-time/non-stationary line,
not a contradiction. (Anchors: Doob 1949; Blackwell/DPI; Ladha 1992.)

## 4. Bug filed (P1)

**rhoCount/rhoPost have no in-repo implementation** — the Egg doc's headline numbers are not reproducible
from the repo (no code, no seeded replay), and a ρ_T operating point is being proposed against them. Filed
in `docs/BUGS.md` P1 with her routing for the fix. (Her finding 2 — docs reading the ISA operators as braid
images are formally wrong at the two-strand level — is answered by the landed test + this doc's cross-link;
finding 3 — the two ρ_T encodings — is already on file, no new filing.)

## Cross-links

- `tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs` — the landed artifact (6 tests: YB-1..YB-6).
- `docs/research/2026-07-04-braided-monoid-amplitude-emulation-…md` — the doc her finding 2 corrects: its
  "free braided monoid" phrasing should be read per the verdict above (this doc is the cross-link it asked for).
- `docs/research/the-egg-bus-delay-and-distributed-consciousness.md` — Q1/Q2 origins; `docs/BUGS.md` P1 entry.
- `…-ferry-alexa-egg-bus-delay-…md` — the audited claim (§transient-vs-lasting), now with its precise conditions.
