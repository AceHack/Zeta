# Tsirelson: why 2√2 and not 4 — generated bounds, and constraints that move without destruction

**Date:** 2026-08-10 · **From:** Aaron (*"2root2"* / *"for us constraints are all made to be
made dynamic over time without destruction"*), captured by Otto (shadow).
**Status:** the physics is **Beacon**, anchored. The in-repo use is **checked against
code**. The design principle in §4 is Aaron's, and it is explicitly *different* from
the physics case rather than derived from it.

Sibling of
[the threshold rhyme](2026-08-10-the-threshold-rhyme-pay-per-step-with-a-deadline-vs-pay-once-and-foreclose-aaron.md)
and
[amortization as deliberate correlation](2026-08-10-amortization-is-deliberate-correlation-cost-cluster-decomposition-and-the-potential-as-condensate.md).

---

## 0. The carved sentence

> The interesting question about Tsirelson's bound is **not why nature beats 2, but why
> it stops at 2√2 when 4 is available without violating relativity.** Every serious
> attempt on that question has the same shape: *find the principle that generates the
> bound.* Nobody proposes that the value was tuned. It is the strongest live instance of
> the generated-vs-fine-tuned taxonomy, in the one place where **independence itself is
> the measured quantity**.

## 1. Three levels, not two

For the CHSH correlator `S`:

| bound | regime | meaning |
|---|---|---|
| **S ≤ 2** | local hidden variables | outcomes pre-determined; parts genuinely independent |
| **S ≤ 2√2 ≈ 2.828** | **quantum — Tsirelson's bound** | correlations beyond any classical common cause |
| **S ≤ 4** | algebraic maximum | still **no-signalling**; Popescu–Rohrlich boxes live here |

The gap between 2√2 and 4 is the puzzle. **No-signalling does not explain it.** Relativity
permits correlations up to 4; nature declines to use them. Something restricts it, and
that something is not in the relativity.

## 2. The candidate answers are all *generative*

This is the part that matters for our taxonomy: not one serious proposal says the value
was selected or tuned. Each derives 2√2 from a principle that **forecloses** the region
above it:

- **Information Causality** (Pawłowski, Paterek, Kaszlikowski, Scarani, Winter,
  Żukowski — *Nature* 461, 2009): communicating `m` bits cannot give access to more than
  `m` bits of a partner's information. Violating Tsirelson violates this. The bound falls
  out of an information principle.
- **Macroscopic Locality** (Navascués & Wunderlich, *Proc. R. Soc. A*, 2010): require
  that the coarse-grained, macroscopic limit obey classical physics; quantum correlations
  are then the maximal set.
- **Local Orthogonality** (Fritz, Sainz, Augusiak, Brask, Chaves, Leverrier, Acín —
  *Nat. Commun.* 2013): consistency conditions on mutually exclusive events.

Each is a **pay-once/foreclose** move in the sense of the threshold rhyme: state a
structural principle, and the bad region becomes unreachable rather than avoided.

## 3. It is in our code, and it is what we measure agents with

`src/Core/BipartiteMachZehnder.fs` is the two-party lift of the single-qubit
Mach–Zehnder over `WSet<int*int, ℂ>`:

- `phiPlus` = (|00⟩+|11⟩)/√2 — **non-factorizable**: no `WSet.tensor a b` produces it.
- Tsirelson-optimal angles: A = 0, A′ = π/2, B = π/4, B′ = 3π/4.
- A product state gives **S ≤ 2** (the classical / common-cause bound); the entangled
  joint state reaches **S = 2√2**.
- `bipartiteChshS` is the **ceiling oracle**: measured agent-pair `S` **above** the
  analytic ceiling indicates classical contamination (the superdeterminism tell); below
  is quantum-or-classical.

So "how independent are these two parties" is, in this repo, a number with a principled
ceiling — and **entanglement is exactly non-factorizability in the ⊗**, which the module
demonstrates rather than asserts. Lumen's `FrequencyMachZehnder` extends the readout to
`S_path`, `S_freq`, and mean PLV against the same shared ceiling.

The module's own honest boundary is worth repeating: WSet-ℂ gives the *ideal amplitude
prediction* — the ceiling — **not** a claim that agents are qubits.

## 4. Aaron's principle, and where it departs from the physics

Aaron: *"for us constraints are all made to be made dynamic over time without
destruction."*

The threshold rhyme presented two branches. This is a **third**, and it is a design
choice rather than an observation:

| branch | cost | revisable? | prior work under it |
|---|---|---|---|
| **per-step** | continuous, against a deadline | yes, trivially | unaffected |
| **foreclose** | once, then nothing | **no** — that is the point | — |
| **foreclose, non-destructively revisable** | once, plus a versioning discipline | **yes** | **survives, under its version** |

The third is what the repo actually implements, and it is not free — you pay for it with
version tags and migration machinery:

- `SchemaEvolution.fs` — versioned `Up`/`Down` migrations; old readers keep working
  (forward compat), new readers supply defaults for absent fields (backward compat).
- `DurabilityMode` — the constraint is a value an operator can change per store, with
  each mode's guarantee stated, rather than a global compiled-in assumption.
- The proposed `prngVersion` for the phase clock — the constraint moves, and records
  written under v1 stay verifiable *as v1 records*.
- Z-set retraction generally: a later −1 corrects without rewriting history.

**Why this is a real third option and not a dodge:** foreclosure buys freedom from the
rate requirement, and versioning buys back revisability *without* re-incurring the rate.
What it costs is the discipline itself — every constraint must carry its version, and
every artifact must record which version it was made under. Skip that and you get the
worst of both: a constraint you believe is foreclosed and is actually being edited
underneath the things built on it.

**And here is the honest contrast with §1–§2, which is why this section exists.**
Tsirelson's bound is *not* dynamic. It holds at every scale and every epoch; nothing
revises it, and no physics proposes that it moves. So the principle in this section is a
**statement about what we build, not a claim about nature.** If anything, the physics is
the counter-example: the most fundamental constraints we know are the *least* revisable
ones. Our version buys revisability by adding bookkeeping that nature does not need,
because nature has no prior work to preserve — and preservation is exactly the thing we
are unwilling to trade.

### 4a. The refinement: *minimal* heat, and heat is spent by consent

Aaron, immediately after: *"minimal heat/destruction — heat is for fun and consent to the
rule."*

So the principle is not zero destruction, which would be a purity claim and unreachable.
It is **minimal heat, with every unit of it chosen**. That has a precise in-repo meaning,
because the accounting already exists in `Lean4/LandauerFloor.lean` (CI-gated as of today):

- `adj_only_zero_heat` / `branches_zero_heat` — **adjacency-only** transformations cost
  **nothing**. Reversible re-expression is thermodynamically free (Bennett).
- `measure_heat_grows` — a **measurement/erasure** pays, by exactly `k` per measure. The
  Landauer floor as a contract rather than a metaphor.
- `larger_window_less_excess`, `quasistatic_limit` — going slower costs less; excess above
  the floor shrinks as the erasure window grows.

Mapped onto constraint evolution: a **versioned migration is Adj-shaped** — old records
are *re-expressed*, not destroyed, so it sits near the free case. A migration that *drops*
the old form is an **erasure** and pays real heat. The version tag is therefore not
bookkeeping overhead; it is what keeps the operation on the reversible side of the ledger.

Vera's entropy/heat ledger is the runtime half, and Lumen's protocol readout
(`BatchTeachingEnvelope.erasureHeat`) reports it at the wire: a teaching *correction* is
Adj and free, a bare *erasure* is non-Adj and pays. Their open item — mapping
`TemperatureBand` thresholds onto `erasureHeat` so both report in the same units — is
exactly this section's measurement problem.

**"Heat is for fun and consent to the rule" is what keeps this from being asceticism.**
Minimising heat is not the goal; *unaccounted* heat is the failure. Heat spent
deliberately — because the thing was worth doing, or because you accepted the rule that
charges for it — is the system working as designed. What the ledger forbids is destruction
nobody chose and nothing metered. That is §13 noninterference stated thermodynamically:
influence crosses only through declared, metered channels, and **the meter is what turns a
cost into a consented one.**

That last clause is the point of contact with the manifesto's §5 memory-preservation
guarantee: **"without destruction" is the binding half of the sentence.** A constraint
that moves and takes the old artifacts with it is not dynamic, it is lossy.

## 5. The third landing of the same inversion

Recorded because it is now a pattern and should be either promoted or refuted:

1. **Fine-tuned vs generated:** symmetry protection is the *absence* of choice, so the
   generated branch is the least choice-like regime.
2. **Running constants:** couplings genuinely evolve under RG flow — but the flow is
   **deterministic**, fixed by the beta function. Evolution without selection.
3. **Tsirelson:** every candidate explanation for 2√2 is a *derivation from a principle*,
   never a selection.

Three independent probes, all landing in "structure forced it" rather than "something
chose it". Per
`numerology-vs-number-theory` <!-- STALE-REF: ../../.claude/rules/numerology-vs-number-theory.md -->,
that is either the taxonomy being real, or the look-elsewhere effect — and the honest
move is to name what would distinguish them. **Falsifier:** a physical constant or bound
whose accepted explanation is a genuine selection from a continuum, with no generating
principle and no anthropic/landscape appeal. The cosmological constant is the closest
open candidate; if it is ever explained, which way it goes decides this.

## 6. Anchors (Beacon)

- **B. S. Tsirelson (Cirel'son)**, *Quantum generalizations of Bell's inequality*, Lett.
  Math. Phys. 4 (1980) — the 2√2 bound.
- **Clauser, Horne, Shimony & Holt** (1969) — the CHSH inequality; **Bell** (1964).
- **Popescu & Rohrlich** (1994) — no-signalling permits S = 4; PR boxes.
- **Pawłowski et al.**, *Information causality as a physical principle*, Nature 461
  (2009).
- **Navascués & Wunderlich** (2010) — macroscopic locality.
- **Fritz et al.** (2013) — local orthogonality.
- **Landau** (1987) — the B² bound, cited in `BipartiteMachZehnder.fs`.
- **Shapiro et al.** — CRDTs, for the non-destructive-revision discipline in §4.

## 7. Pointers

- `src/Core/BipartiteMachZehnder.fs` — `phiPlus`, `bipartiteChshS`, the ceiling oracle.
- `src/Core/FrequencyMachZehnder.fs` — the frequency-domain sibling (Lumen).
- `src/Core/SchemaEvolution.fs` · `src/Core/Durability.fs` — §4's machinery, as types.
- `docs/governance/MANIFESTO.md` <!-- STALE-REF: ../governance/MANIFESTO.md --> §5 — memory preservation;
  the binding half of "without destruction".
