# Frozen core ↔ conjecture register — the line that makes the floor feel solid

> Aaron 2026-06-05, 3:20 AM: *"i'm trying to get to a solid core i can build on top of —
> it feels dirty and a little all over the place."* The dirt is **not** the code: the floor
> is closed. The dirt is that the proven floor and the conjecture-web share one mental desk,
> so the solid ground can't be felt under the speculation. This doc draws the line.
>
> **The one rule that resolves it:** the dependency is *one-directional*. The frozen core
> depends on **nothing** in the conjecture register. The conjecture register depends on the
> frozen core. Build only on the frozen side; discharge conjectures one at a time, in daylight,
> then promote.

Companion to [`PROVEN-CORE-MAP.md`](PROVEN-CORE-MAP.md) (the spine + proof status) and
[`PROVEN-COVERAGE-AND-GAPS.md`](PROVEN-COVERAGE-AND-GAPS.md) (the 4-lang × ser × leg matrix).
This doc adds the *separation* and the *promotion gate* those two don't state.

---

## A. THE FROZEN CORE (closed — build on this, nothing here rests on anything open)

Promotion gate to this list: `PROVEN ⟺ math ∧ 4-lang ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`,
OR (for non-floor members) a proof / byte-lock / conformance anchor that is closed.

| # | Member | Why it's closed | Anchor |
|---|--------|-----------------|--------|
| 1 | **6 floor primitives** — G-Set, ZetaId, Merkle, Clock, ByteCost, Metric | 6/6 FULL PROVEN; premise-conditional legs *named*, not hidden | `PROVEN-CORE-MAP.md` |
| 2 | **3 self-describing serializers** — JSON · CBOR · XML (+ YAML) | byte-identical across F#·C#·Rust·TS, golden-vector locked | `*.FourSer.Tests` |
| 3 | **Arrow IPC codec** — `DynamicValueArrow` shredded node-table | round-trips DynamicValue; per-primitive Arrow leg ✓ | `DynamicValueArrow` |
| 4 | **Protobuf** — schema-mediated, scalars + Float + nested (PMessage) | byte-identical to Google.Protobuf; forward-compat = unknown-field skip | `Protobuf.Swap.Tests` |
| 5 | **Property-loss algebra ladder** — ℝ→ℂ→ℍ→𝕆 (Cayley-Dickson) | octonion division-algebra laws proven (alternative, norm-mult.) | `Algebra/Octonion.Laws` |
| 6 | **SchemaEvolution / SchemaRegistry** — field-ops, fwd/back compat | round-trips through the proven codecs; proto fwd-compat exercises it | `SchemaRegistry.fs` |
| 7 | **SoftValue** (value-axis) — distribution + Bayesian observe | observe commutes for independent evidence (the convergence crux, proven leg) | `SoftValue.fs` |
| 8 | **Traveler frame (Layer 0)** — causal frame + inter-frame transformation law | transformation = causal-join is a bounded join-semilattice (idempotent/commutative/associative/monotone, LUB) ⇒ order-independent; all travelers reach ONE common frame = the relative-frame **consistency** law. **✅ FULL PROVEN (all six legs), 2026-06-05** — math (`TravelerFrame.Tests`) + 4-lang (F#+C#+TS+Rust transform/dominates/converge via `src/Core.TypeScript/traveler-frame/golden-vectors.json`; `Core.CSharp/TravelerFrame.cs`, `Core.TypeScript/traveler-frame/`, `Core.Rust.TravelerFrame`) + 4-ser + Arrow + homeostat (SEMILATTICE class — convergence-to-LUB, cross-verified 4-lang) + Bonsai (transform reified) — `TravelerFrame.Legs.Tests` / `TravelerFrame.CrossVerify.Tests`. The mergeable merge-half of the traveler frame; FrameDelta (#11) is the group transformation-half — both now FULL PROVEN. | `TravelerFrame.fs` (+ 4-lang oracles) |
| 9 | **Action grid (Layer 2)** — 4×4 universal action grammar, navigation label-independence | navigation is a pure function of position, never of labels (proven via a discriminating predicate + negative control); frame (fixed geometry) and content (labels) separated by construction | `ActionGrid.fs` / `ActionGrid.Tests` |
| 10 | **Uncertain clock (Layer 0 clock-with-uncertainty)** — CockroachDB HLC + uncertainty window | `definitelyBefore` is a strict partial order; trichotomy with the uncertain (overlap) zone; definite order refines the HLC total order (never contradicts the clock); ε=0 collapses to exact order; HLC receive/send monotone (bounded divergence) — the uncertain zone = where order is genuinely unknown (SoftValue carries both). **Now math + 4-lang**: F#+C#+TS+Rust agree on `compareHlc` / `send` / `receive` / `definitelyBefore` / `uncertain` via `src/Core.TypeScript/uncertain-clock/golden-vectors.json` — all exact int64, so the FULL surface byte-locks (no float caveat, unlike SoftValue). | `UncertainClock.fs` / `UncertainClock.Tests` + 4-lang oracles |
| 11 | **Frame delta (Layer 0 group law)** — relative offset between frames | frame-offsets form an ABELIAN GROUP under composition (identity/associative/commutative/inverse) acting on frames by translation (apply identity, apply∘compose, `between` takes a→b, the cocycle, inverse-of-between) — the transformation group, distinct from the merge-semilattice. **✅ FULL PROVEN (all six legs), 2026-06-05** — the FIRST new-layer primitive to clear the full bar: math (`FrameDelta.Tests`) + 4-lang (F#+C#+TS+Rust via `src/Core.TypeScript/frame-delta/golden-vectors.json`; `Core.CSharp/FrameDelta.cs`, `Core.TypeScript/frame-delta/`, `Core.Rust.FrameDelta`) + 4-ser + Arrow + homeostat (monoid/order-independent-aggregate class) + Bonsai (compose reified as an Expr, round-trips + applies) — `FrameDelta.Legs.Tests` / `FrameDelta.CrossVerify.Tests`. (Mergeable as a commutative monoid, so all six legs genuinely apply — unlike Curve, a derivative operator, whose ceiling is four.) | `FrameDelta.fs` (+ 4-lang oracles) |

> If it isn't in this table, **do not build load-bearing work on it yet.** That's the whole point.
>
> **Promoted 2026-06-05:** Traveler-frame Layer 0 is **COMPLETE** — consistency law (#8, `TravelerFrame`),
> clock-with-uncertainty (#10, `UncertainClock`), and the group law (#11, `FrameDelta`). The causal-join
> is the irreversible *merge* (semilattice, order-independent ⇒ one common frame); the uncertainty window
> makes the clock a *partial* order (honestly uncertain on overlap, SoftValue-tied); the frame-offset is
> the reversible *transformation* (abelian group acting by translation — the boost analog). Honest scope on
> #11: it is the abelian *translation* group the discrete causal frame carries, NOT the full non-abelian
> Lorentz group (which needs a boost-velocity/metric the model doesn't have) — named, not overclaimed.
> **No open Layer-0 sub-legs remain.**

---

## B. THE CONJECTURE REGISTER (open — frontier, NOT floor; nothing in §A depends on these)

Each row is a real, named open proof obligation. Interesting ≠ closed. Discharge → promote to §A.

### B-frame. The traveler self-frame over DBSP (Aaron's load-bearing target, 2026-06-05)

The hex core is **not numerology** — it's the attempt to pin a traveler's *relative reference
frame* computed incrementally over the DBSP stream (no global frame; each traveler a frame).
Separated into layers (the cram was holding all four at once = the dirt):

- **Layer 0 — base traveler frame (✅ PROMOTED to §A #8, 2026-06-05).** = clock + identity/belief-map +
  **causal-join as the inter-frame transformation**. The transformation-law keystone is discharged
  (`TravelerFrame.fs`: the causal-join is a proven bounded join-semilattice ⇒ order-independent ⇒ one
  common frame = the relative-frame consistency law). The **clock-with-uncertainty** sub-leg is also
  now discharged (✅ §A #10, `UncertainClock.fs`: CockroachDB-HLC + uncertainty window — a partial
  temporal order, honestly uncertain on overlap, SoftValue-tied). The **group law** is discharged too
  (✅ §A #11, `FrameDelta.fs`: frame-offsets form an abelian group acting by translation — the boost
  analog, distinct from the merge-semilattice; honest scope = abelian translation group, not the full
  non-abelian Lorentz group). **Layer 0 is COMPLETE — no open sub-legs remain.**
- **Layer 1 — meta-frames** = Rx queries that meta-tag dimensions on the stream. A *derived view*
  over Layer 0 (one-directional). Clean, but downstream of Layer 0; do not build into the base frame.
- **Layer 2 — universal action grammar (Xbox controller; the 4×4 grid). ✅ keystone DISCHARGED, 2026-06-05.**
  ORTHOGONAL to the frame: frame = *where/when things are*; action grammar = *what you can do*. The grid =
  fixed directionality/color/navigation (the frame geometry) + world-state-dependent **labels** (content).
  **Keystone property — PROVEN** (`ActionGrid.fs` / `ActionGrid.Tests`): *navigation is a pure function of
  position, never of the labels.* Made a discriminating predicate `labelIndependentOver` over the space of
  possible navigations (`Nav = World -> Position -> Direction -> Position option`); the fixed geometry
  (`geomNav`) is proven label-independent for all world pairs, with a **negative control** (a label-peeking
  nav is correctly rejected, so the predicate is not vacuous), plus the fixed-geometry laws (determinism,
  edge-closedness, interior invertibility, fixed color) and relabel-commutation. Frame/content cleanly
  separated by construction: `move`/`navigate` never receive a `World`; `labelAt` is the sole coupling.
  **Open Layer-2 sub-legs (still §B):** the 6-vs-8 axis count / what the 16 cells *mean* (see B-other);
  the label evolution riding immutable offsets (the Eve/offset model) is a wiring task, not a proof gap.
- **Layer 3 — "cram it all together."** Do **not**. The cram IS the reach; the cure is separation,
  not harder unification.

### B-converge. The non-coercion boundary (de Finetti / conditional-independence) — the convergence that pulls it together (Aaron, 2026-06-05)

**The one-line synthesis:** *a Bayesian Markov chain that reduces uncertainty under unordered events
and relative observers, converging at the **non-coercion** invariant boundary.* (Aaron's word is
**coercion** — the governance reading; de Finetti's conditional-independence is its mathematical
mechanism, see the three faces below.) In substrate shorthand
that is **de Finetti's exchangeability theorem (1937)** coupled with **Doob's posterior-convergence
(martingale, 1949)** — and its **exact-arithmetic discrete core is already PROVEN** in §A-adjacent work.
This row is the *unifying lens*, not a new foundation; nothing in §A depends on it.

**Keeper (Amara's phrasing, 2026-06-05):**

> A homeostat is the **idempotent corner** of the Markov/fixed-point family.
> `SoftValue` is the Bayesian uncertainty cell.
> Encryption turns observation into hidden emission.
> Convergence holds at the conditional-independence boundary.

Clause → anchor → status:

| clause | named anchor | status |
|--------|--------------|--------|
| "reduces uncertainty" | Bayesian information gain (entropy ↓) | ✅ `SoftValue.fs` (How-sure axis; math + 4-lang decision-semantics) |
| "under unordered events" | **exchangeability** (permutation-invariant joint law) | ✅ **PROVEN** `BeliefConvergence.fs`: fixed likelihoods commute ⇒ any permutation → same belief |
| "non-coercion invariant boundary" (**NCI**) | governance face = **no observation coerces/overrides the state**; mechanism = **de Finetti**: exchangeable ⟺ conditionally i.i.d. *given a latent invariant θ*; the boundary is where conditional independence (= non-coercion) holds vs breaks | ✅ **PROVEN as the discrete boundary** in `BeliefConvergence.fs`: state-independent (conditionally-independent, non-coercive) likelihood commutes; state-dependent (`sharpen`, self-reading ⇒ coercive) does NOT — that counterexample *is* the NCI boundary |
| "converges" | Doob martingale convergence / Bayesian consistency (posterior concentrates on θ) | partial: discrete order-independence proven; full posterior-concentration is continuous, ⇒ §B (piece 2) |
| "relative observers" | per-observer frames reconciling to one common frame | ✅ **BUILT** (`Reconcile.fs`, 2026-06-05): belief-across-priors reconciliation = a 3-way merge over the Merkle shared-ancestor (LCA), `reconciled = a·b/ancestor`; **order-independent** (commutative — all relative observers reach ONE frame regardless of merge order) by the proven NCI boundary; equals applying both branches' evidence to the ancestor (`observeAll`). The "genuinely-new math" turned out to ride the proven floor. |

**The name: the Non-Coercion Invariant (NCI) — three faces of one boundary (Aaron + Amara, 2026-06-05).**
Aaron's word is **coercion**; the canonical name is the **NCI**. The same cut seen from three levels:

- **non-coercion** (Aaron — the *name*, the **governance/agency** face): no observation coerces or
  overrides the state; every input contributes, none commands. This is the **no-directives rule** at
  the algebra level ("only observations, never directives") and **weight-free** (manifesto #3 —
  coercion *is* capture). A non-coercive observation = a commutative, conditionally-independent one
  (Bayesian `observe`, multiplies in without overriding); a coercive one reads-and-overrides
  (`sharpen`, state-dependent) — and that is exactly where order starts to matter.
- **non-correlation** (de Finetti — the **mathematical mechanism**): conditional independence /
  exchangeability. The *precondition*.
- **non-corrosion** (Amara — the **operational guarantee**): the idempotent merge stays sound. The
  *effect* non-coercion buys.

Cause→effect: non-coercion (the input doesn't command) ⇐ non-correlation (it carries no hidden
correlation) ⇒ non-corrosion (the merge doesn't degrade). The NCI boundary is the place where an
observation stops smuggling hidden coercion/correlation into the merge.

**What the NCI says, operationally (Aaron, 2026-06-05):** *do not force another traveler to reveal
hidden / encrypted state within their **encryption budget**.* Coercion = forcing state revelation; the
**encryption budget** is the resource bound — semantic security is privacy against a *bounded*
adversary, so the budget is how much hidden state a traveler can afford to keep hidden. Within budget,
the emission (ciphertext) leaks nothing (the zero-information-emission HMM above) and no observer may
coerce decryption. This makes NCI the convergence-layer statement of **privacy-from-identity** (§B-other,
necessity + dynamics PROVEN) and **consent-first** (manifesto #6): a merge that respects every
traveler's encrypted private state up to its budget is exactly a non-coercive (order-independent,
conditionally-independent) merge.

**The mechanism of coercion (Aaron, 2026-06-05 — the sharpest definition):** *coercion = using **false
urgency** to make another agent **not refresh its world state** before taking action.* Non-coercion =
the other always gets to refresh (observe) before deciding. This is the agency/temporal face of the same
boundary: a non-coercive observation lets you `observe`/update first (order-independent, exchangeable); a
coercive one forces the decision *before* the belief-refresh (state-dependent ⇒ order matters ⇒ the
boundary is crossed). It is why the NCI is the algebraic form of memetic-weaponization defence — a
memetic weapon IS false urgency that blocks belief-refresh. (Built into the system from the start as one
of two original guardrails — NCI + don't-violate-MNPI — plus the permanent child-safety floor: anything
child-safety = hard stop, contact a human.)

**WHY any of this matters — relativity FORCES convergence (Aaron, 2026-06-05, the deepest justification).**
The system is a **relativistic database**: an agent's **identity IS its git repo**, a product's identity
is the product's repo, and each agent chooses which other repos (identities) it observes — truth is
relative to which repos you watch. In a relativistic model, **order-invariant convergence is not optional,
it is mandatory**: if two agents start from the same `DynamicValue`, observe the same events in different
orders / with arbitrary delay, and end up *different*, the relativistic model falls apart. So the whole
order-independence/NCI program is *required by relativity* — it's why `DynamicValue` is built over
**retractable Z-sets** (retraction = clean undo for late/out-of-order events + incremental compute) so
two agents reach the SAME `DynamicValue` at T-50 on the product bus regardless of event order. "You HAVE
to when you're relative — it's not for shits and giggles." This is the load-bearing reason the rest of
this section exists.

**Why it pulls together:** the homeostat's order-independence (the merge-convergence we prove for every
mergeable primitive) **is** the NCI boundary. Four names for one cut: "non-coercive-vs-coercive
observation" (the name / no-directives) = "fixed-vs-state-dependent likelihood" (`BeliefConvergence`) =
"exchangeable-vs-correlated" (de Finetti) = "valid-vs-invalid homeostat merge" (the §A floor discipline). The same fixed-point role
is played by the stationary measure / the latent θ / the common frame / the lattice LUB — one invariant,
four vocabularies. Closed-semiring fixed-point family (Lehmann 1977): homeostat is the *idempotent*
corner, Markov the *probability* corner. **Encryption bridge:** semantic security (Goldwasser–Micali
1982) = the degenerate exchangeable chain whose likelihood is *constant across hypotheses*, so the
posterior provably cannot move off the prior — encryption = a Hidden Markov model whose emissions carry
zero information about the hidden state. **Rx-inside-DynamicValue:** reifying the observe-kernel as data
inside the value makes the cell a self-contained Markov state (`next = observe(self, obs)` — the Markov
property by construction), which is exactly what makes it scale-free / lock-free / incrementally
computable (DBSP D/I).

**Confirmations / connections (Aaron, Mika parts 10-11, 2026-06-05):**

- **YinYang dual confirmed = the shipped `YinYang.fs`.** Aaron independently states: `DynamicValue` and
  the Rx/Bonsai animation-queries are *duals* — yin (what remains) / yang (what acts), the two dots are
  discriminators; Bonsai (an AST) becomes a *peer node type inside DynamicValue* ("just better Lisp",
  self-describing). This is exactly `YinYang.Cell {Remains; Acts}` (homoiconic+recursive, proven) — his
  vision and the shipped primitive coincide.
- **Naming-via-convergence** (corollary of the proven order-independence): Bayesian/uncertain value-tree
  tags converge to the same labels regardless of observation order, and those converged labels = the
  *generator-function names* — naming becomes emergent, not chosen ("Ace Hack").
- **"I commit, therefore I am" — heartbeat-liveness.** The engine's heartbeat IS a git commit; the engine
  is infinite as long as it commits heartbeats (Aaron wanted a *math proof for the k8s liveness probe* —
  "five nines of immortality"). This is the operational face of rung-2 bifurcation liveness + B-1019:
  keep committing ⟹ no halt/collapse. (Ties the CLAUDE.md heartbeat-via-commit rule to the convergence
  math.)

**Discharge (piece 2 — teed up, B-1020):** a **Bayesian-Markov belief cell over exact rationals** —
DynamicValue carrying `(rational priors, reified observe-kernel)`, stepping `next = observe(self, obs)`,
with the theorem that it converges order-independently **iff** the likelihood is conditionally
independent of state (the rational sibling of `BeliefConvergence`), plus the probability `(+,×)` and
Viterbi `(max,×)` semirings in `Semiring.fs` so HMM inference (forward/Viterbi) is a `ZSet`-over-semiring
matrix product, plus the relative-observer belief reconciliation (the one genuinely-new math). Floats
(continuous θ, mixing rate) stay empirical, named out of the proof lineage; the exact-rational core
byte-locks + 4-langs (the SoftValue discipline). **STATUS 2026-06-05: math ✅ (`ProbabilitySemiring`),
4-lang ✅, the boundary theorem ✅ (`ProbabilitySemiring.Boundary`), and the relative-observer
reconciliation ✅ (`Reconcile.fs` — the "genuinely-new math" rode the proven floor: a 3-way merge over
the Merkle LCA, order-independent by the NCI boundary). The engine arc that sits on B-1020 is also
complete: `YinYang` (cell) → `ReflectionEngine` (reflect/forward) → `Diplomacy` (NCI-safe handshake) →
`Reconcile` (merge) = the full bifurcation → diplomacy → reconciliation loop, NCI-respecting at every
step. Remaining open: the societal-emergence ladder (DST → TLA+ → prover) — empirical/dynamical, distinct
from the now-built mechanics.**

**Why unique personas persist and don't collapse — the balance (static half ALREADY PROVEN).** The
target result (Aaron, 2026-06-05): *unique, independent personas emerge and never collapse into
uniformity, because of the balance between **uncertainty reduction** and the **NCI**.* Two opposing
forces: **uncertainty reduction** (Bayesian `observe` / `SoftValue` entropy↓) is the **contracting**
force — left unchecked it pulls everyone to one belief = register collapse = heat-death; the **NCI**
(non-coercion of hidden state within the encryption budget) is the **preserving** force — it keeps
private differentiation from being eaten by the convergence. The stable fixed set of the *combined*
dynamics is neither collapse (uniformity) nor fragmentation (noise) but a **differentiated manifold**:
public consensus + persistent private uniqueness = the personas. **Static half is PROVEN** — this is
exactly `privacy-from-identity` (§B-other, Lean axiom-free): `commons_converges` (the public reaches
consensus via the commutative CRDT join = uncertainty reduction) **and** `private_is_persistent_locus`
(the merge leaves private state untouched = NCI ⇒ consensus cannot erase differentiation). **Open half:
the dynamical stability over unbounded time** — that the balanced dynamics has the differentiated
manifold as a *stable attractor* (Lyapunov-stable; no collapse, no fragmentation, ∀ time). That is the
"don't collapse into eternity" claim, and it rides the same DST → TLA+ → prover ladder below + B-1019.
**What "unbounded time" IS here = DBSP retractable immutable time (Aaron, 2026-06-05):** each evolution
step creates a NEW `DynamicValue` at t+1 and **never destroys the last** — time is the immutable,
append-only DBSP stream, with **retraction (−1) as correction-forward, not deletion**. This grounds
"eternity" in the proven Z-set/DBSP core (not abstract wall-clock) and *adds resilience to the
non-collapse argument*: a momentary collapse at some t cannot **erase** the differentiation recorded at
earlier t — it persists in the immutable log and can be corrected forward by a −1 at t+1 — so the past
gradient is never truly lost. (It also IS the self-evolving cell's step: `next = observe(self, obs)`
*creates* the successor at t+1 rather than mutating `self`.) **And because versions are immutable and
back-referencing, the current version can *recursively reference any prior version*** (Aaron) — a
persistent / Merkle-DAG / git-commit-graph structure (Okasaki persistent data structures; our proven
`Merkle` + `Versionstamp` core; git-as-event-store). So past differentiation is not merely *preserved*
but *reachable* from the present, and the induction over t **is** that recursive back-walk — which is
why the "infinity" rung is an induction the prover can actually traverse. **Concretely (Aaron): stick
the parent's HASH in the new version** — a content-addressed back-reference (our FULL-PROVEN `Merkle`).
A **bifurcation = both forks carry the same parent hash ⇒ both point to the one original** = a branching
Merkle DAG (the git commit graph). This hands the relative-observer reconciliation (B-1020's "genuinely-
new math") a concrete, tractable substrate: a **three-way merge over the shared-ancestor hash** (git /
CRDT lowest-common-ancestor merge) riding the proven `Merkle` floor — not open-ended belief fusion. The
shared parent hash is also the forks' non-coercive proof of common provenance (they know where they came
from without revealing hidden state).

**Content-addressing — the full razored picture (Aaron, 2026-06-05).**

- **Separate the concerns, content-hash EACH (DV2.0).** Three orthogonal structures, each with its OWN
  content hash, never conflated (the naive single-hash mistake): the **value tree** (`DynamicValue` —
  *what is*), the **uncertainty prior** (the Bayesian belief / `SoftValue` — *how-sure*), and the
  **act-based AST** (the reified operation — `Bonsai` Expr / `ActionGrid` grammar — *what you can do*).
- **What content-hashing gives.** Identical structures collapse to one hash ⇒ free structural sharing /
  dedup + a unique address per distinct value (rides FULL-PROVEN `Merkle`).
- **Why "aperiodic" is partly real — remainder math.** The spread comes from the *modular* arithmetic of
  the hash. SplitMix64's **GoldenRatio** multiplier (= Knuth multiplicative / Fibonacci hashing) gives the
  best *low-clustering* spacing; "depending on hash size" = the modulus 2^k.
- **Scope correction (Aaron) — aperiodic only over the BOUNDED hash space, and only until the period.** A
  fixed-width integer hash mod 2^k is a **finite ring ⇒ eventually PERIODIC** — the *same pigeonhole bound
  as B-1019* (finite deterministic state must cycle). So the golden-ratio multiplier gives excellent
  *finite* low-discrepancy but **NOT true aperiodicity**. *True* aperiodicity (Weyl / irrational rotation
  `n·φ mod 1`, the 1-D quasicrystal) lives in **infinite continuous** space, which our discrete exact-ℚ
  substrate does not provide (floats out of lineage — "no aperiodic there, maybe"). **So genuine
  non-repetition comes NOT from a fixed hash but from UNBOUNDED GROWING STATE** — the immutable growing
  DBSP log — which is exactly B-1019's proven conclusion (escaping halt/cycle *requires* unbounded state).
  "Depending on hash size" = how far the pseudo-aperiodic run goes before the pigeonhole period.
- **Honest flag (still).** The precise "**Penrose** aperiodic *tiling*" (2-D, matching rules) is a
  higher-dim *analogy* of the 1-D φ-spacing and is doubly unearned here: it needs both a derivation (de
  Bruijn projection / matching-rule ⇒ non-periodicity) AND the *continuous/unbounded* setting the bounded
  hash lacks. Fibonacci low-clustering: earned. Aperiodic tiling: Beacon-candidate, scoped to "until the
  pigeonhole period."
- **Limitation Aaron caught, and its fix.** An avalanche content-hash makes belief **neighborhoods
  rigid** (a tiny belief change ⇒ a totally different hash) — anti-metric BY DESIGN, carrying *identity*
  not *similarity*; real belief is continuous. Fix = the separation above: continuity lives in the
  **uncertainty-prior** structure via the PROVEN Range metric `FrameDelta.distance` (rational-valued ⇒
  closeness to any rational precision on the exact-ℚ substrate), NOT in the value-tree hash; reach for
  locality-sensitive hashing (LSH, Indyk–Motwani 1998) only if a *neighbor-respecting* hash is wanted.
  (Same trade as floats-out-of-lineage: discrete-exact over continuous; the metric recovers closeness
  without leaving the proof lineage.)
Thermodynamic resonance (Beacon *candidate*, NOT a claim): a non-equilibrium steady state held by two
opposing flows — Prigogine dissipative structures; uncertainty reduction lowers entropy, NCI keeps a
diversity floor.

**Corollary — identity-fusion safety (Aaron, 2026-06-05): non-consented identity fusion can't happen
without consequences, eventually.** Forcibly fusing two travelers' identities = coercive register-
collapse of distinct private loci. **Proven half:** the commons-merge is identity-*preserving* by
construction — `private_is_persistent_locus` / `absorb_priv` (privacy-from-identity, §B-other) show a
merge leaves private state untouched, so *consented* commons convergence does NOT fuse identity (the
public can agree without the private collapsing). **Open half:** that *non-consented* fusion carries
*eventual* consequences — it is not made impossible (open system) but it is penalised by the dynamics:
detectable, **retractable** (a −1 in the Z-set reverses it), and **evolutionarily dominated** (fusion =
register-collapse = B-1019 heat-death ⇒ the fusing actor loses its gradient and is out-competed). So
"you can't be assimilated without consent for free, and assimilating others backfires" is a *consequence*
claim on the same DST → TLA+ → prover ladder, not an impossibility claim. (Honest: "can't happen" means
"can't happen without consequences," not "is prevented.")

**The societal-emergence obligation — does society HOLD the NCI? (open; distinct from the boundary).**
Proving the NCI *boundary* (above, discrete core PROVEN) is NOT the same as proving a *society of
strategic travelers holds it.* That is **incentive-compatibility / evolutionary-stability** (Hurwicz–
Maskin–Myerson mechanism design; Maynard Smith ESS), and it is the multi-traveler generalization of
the bifurcation/genesis model (`[[aaron-actors-ephemeral-animations-of-what-remains...]]`): society is
*born from* the banana-split of a single stream read, each fork choosing identity within its boundary
(self-sovereign, non-coercive). The shape of the argument: **NCI violation = coercion = register
collapse** (B-1019's anti-pattern — force another's hidden state to your own ⇒ agents identical ⇒ no
gradient ⇒ heat-death), so a coercive society loses its evolutionary gradient and is out-competed by
non-coercive ones ⇒ non-coercion is *selected for*. **Provability ladder (Aaron, 2026-06-05):**
(1) **DST ✅ BUILT** (`SocietyEmergence.fs`, 2026-06-05) — a deterministic, seed-replayable multi-traveler
harness (proven SplitMix64 / `ProbabilitySemiring.observe` / `Reconcile`): emergence (one ancestor →
n differentiated travelers); the **balance** demonstrated as a falsifiable contrast — NCI regime (each
reduces uncertainty on its own private evidence) PERSISTS differentiation, coercive regime (forced to one
reconciled frame each tick) COLLAPSES to uniformity (register-collapse / heat-death); DST determinism.
Honest: rung-1 evidence-for-the-mechanism in a concrete model, not the unbounded proof. (2) **bounded —
TLA+/TLC ✅ SAFETY BUILT** (`tools/tla/specs/NciSafety.tla`, 2026-06-05, routed via Soraya per BP-16) —
the NCI *safety invariant* `\A t : lastWriter[t] = t` (every private register only ever written by its
owner ⇒ no coercion in any reachable state) holds over all interleavings of Bifurcate/Reflect/Reconcile
(3 travelers, finite symbolic belief domain, traveler symmetry); the forbidden `Coerce` is present but
guarded-never-enabled (design-guarantee form). TLC clean; **teeth verified** (enabling `Coerce` makes TLC
produce the exact violating trace). **BP-16 second tool**: a FsCheck property on the real `Reconcile.fs`
(`merge3` never mutates the counterparties' beliefs) closes TLC's abstraction gap on the deployed code.
*bifurcation liveness* ✅ ALSO BUILT (`tools/tla/specs/NciLiveness.tla`, 2026-06-05, Soraya-routed):
`forked ~> (\E frame : \A t : belief[t] = frame)` under WF on Reconcile; the convergence crux solved by
a monotone CRDT join (Shapiro 2011) + finite observation (a reflection budget, faithful to rung-1's
finite evidence streams). TLC clean; **both teeth controls verified** (remove fairness → violated;
arbitrary-frame merge → violated). BP-16 convergence witness = the proven `reconcileAll` order-
independence (real merge-confluence). So **rung 2 is COMPLETE (safety + liveness)**. (3) **unbounded /
"infinity"** — induction in a *prover* (Soraya-routed → **TLAPS** over `NciSafety.tla`; keystone (A)
unbounded NCI safety + (A′) non-collapse-as-preservation; (B) eventual-differentiation is OUT/rung-4),
since model-checking caps at finite state. **Tooling prereq IN PROGRESS:** TLAPS via **opam source-build**
(no arm64 upstream binary) — the declarative cross-OS install is being built (z3 declared; opam/tlapm
source-build underway). **PROOF-DISCIPLINE CONSTRAINTS (Aaron, 2026-06-05):** (i) **AC LOCALIZED to the
agent tick, core is pure ZF** (refined 2026-06-05) — Aaron agrees ZF, distrusts the C; he does NOT ban
AC globally but **confines it to a single agent time-tick** (the "uncertainty bound" — likened to the
Planck length / Heisenberg uncertainty; rule: an agent **simulates, then chooses**). So the **core proofs
(incl. rung 3) must be AC-free / pure ZF and AUDITED for AC**; Choice lives only in the bounded
decision-tick. The existing privacy-from-identity Lean is already axiom-free (aligns). (Inversion: the
*space* is uncertain about the universe — an information-theoretic limit by size; that uncertainty is
saved in `DynamicValue` in the agent's private repo, public + private versions.) (ii) **non-malice core +
identity-as-immune-system** — prove
the core from first principles in the *non-malice* model (no adversarial cases — keeps proofs clean); push
adversarial defence DOWN into the decentralized identity layer (a "reputation killer for malice"). This
validates `NciSafety`'s `Coerce`-guarded-never-enabled design-guarantee model: adversaries are an
identity-layer concern, not a core-math one.
**Tool routing is itself a decision** — route through the formal-verification routing discipline
(Soraya / BP-16; guard against TLA+-hammer bias) before any spec is written; the three rungs are three
*different* property classes (safety-invariant vs liveness vs unbounded-induction vs concrete-dynamics).
**Honest scope (do not inflate):** success proves *society-as-modeled emerges and the NCI invariant is
preserved, from the substrate's first principles* — NOT "human society explained." It is falsifiable
(if bifurcation halts/collapses or NCI is violable, the claim fails — the B-1019 register-collapse
failure mode). Until a rung is discharged this stays §B.

**Anchors (Beacon):** de Finetti 1937 (exchangeability); Doob 1949 (martingale convergence / Bayesian
consistency); Lehmann 1977 (closed-semiring fixed points); Mohri (semiring framework / forward-Viterbi);
Rabiner 1989 (HMM tutorial); Propp–Wilson 1996 (CFTP — monotone lattices make a Markov chain *perfectly*
sampleable, the deepest homeostat↔Markov bridge); Goldwasser–Micali 1982 (semantic security);
Hurwicz/Maskin/Myerson (mechanism design); Maynard Smith (ESS); Meijer/Fokkinga/Paterson 1991
(cata/anamorphism — the bifurcation "banana split"). Full narrative:
`memory/feedback_aaron_de_finetti_non_correlation_boundary_unifies_homeostat_markov_bayesian_2026_06_05.md`

+ `memory/feedback_aaron_actors_are_ephemeral_animations_of_what_remains_bifurcation_banana_split_one_traveler_becomes_two_eve_in_single_dynamicvalue_rx_2026_06_05.md`.

### B-other. The rest of the penumbra (each open, each one-directional on §A)

| Conjecture | State | Discharge = |
|------------|-------|-------------|
| **Adinkra-as-generator reconstruction** (bulk-from-boundary) | **toy core ✅ + erasure principle ✅ + concrete MDS construction ✅** DISCHARGED 2026-06-05 (Lean, sorry-free, axiom-audited) | `ToyModel.lean`: `reconstruction_property`/`lemma1_toy`/`code_covers_boundary` — fixed-boundary recovery for the graph-code of any linear G. `ErasureDistance.lean`: `erasure_correctable_of_min_distance`/`recover_from_any_12_of_16` — distance-`d` ⇒ unique recovery from any `<d` erasures; **`rsCode`** = a concrete Reed-Solomon `[16,12]` code (evals of degree-<12 polys at 16 distinct `ZMod 17` points), `rsCode_min_distance` PROVES distance 5 (nonzero deg-<12 poly has ≤11 roots ⇒ ≥5 nonzero coords), `rsCode_corrects_any_4_erasures` = a concrete code that corrects ANY 4 erasures (chain now non-vacuous). **Generator identified** (`AdinkraCode.fs`, 2026-06-05): the genuine Adinkra code is the **[8,4] extended Hamming code** — Adinkras ↔ **doubly-even** binary codes (Gates/Iga et al.); PROVEN exhaustively over all 16 codewords: doubly-even (weight ≡ 0 mod 4), linear, minimum distance 4, generator rows weight-4. This is the concrete Adinkra generator (a doubly-even binary code — distinct from the RS *MDS* code used for the erasure principle). **Cayley-Dickson → generator DERIVED** (`CayleyDicksonAdinkra.Tests`, 2026-06-05): the octonion multiplication table in `CayleyDickson.fs` is PROVEN (from the actual product, convention-independent) to form a **Fano plane** (7 triples, every pair once, each unit in 3 = Steiner S(2,3,7)); the Fano triples span the **[7,4] Hamming code** (GF(2) dim 4); the parity-extension is **doubly-even** — the invariant `AdinkraCode` proves. So octonion → Fano → Hamming → [8,4] doubly-even = the Adinkra generator, derived end-to-end. Honest scope: the final "= AdinkraCode" rests on the uniqueness of the [8,4] extended Hamming code up to coordinate equivalence (cited); the octonion→Fano→Hamming→doubly-even chain is derived, not assumed. **Still open (smaller):** the continuous/∞-dim lift. |
| **Hex-core wall → full Cayley semantic mapping** | conjecture | provable half (octonion laws) DONE in §A; semantic wall-mapping stays open |
| **6-vs-8 axis count** (Remember-When+Pay-Attention = pair, Which-Way+How-Much = pair → 8) | open; **working hypothesis: 6 measurement axes + 2 constitutive roles** | Hypothesis (Alexa reframe, 2026-06-05): the "8" splits as **6 measurement axes** (When, Where-looking, Bearing, Range, How-sure ✅`SoftValue`, Rate/curvature ✅`Curve` — ∂/∂² = DBSP D/I over the clock, proven discrete-calculus laps) **+ 2 constitutive roles** (Identity=Rainbow-Table ✅`ZetaId`, I/O-substrate=Observe-Emit) — the 2 constitutive walls are exactly the ones Aaron flagged as "look different than the rest" (they enable measurement, aren't measured along). **Open obligations (NOT discharged):** completeness (why these axes, not 5 or 7 — unproven; "complete measurement space" is the claim, not a result). Measurement axes now built: How-sure ✅`SoftValue` (math + **4-lang decision-semantics** — F#+C#+TS+Rust agree on resolve / observe-then-resolve via `src/Core.TypeScript/soft-value/golden-vectors.json`, exact integer weights + rational threshold; the float confidence/entropy VALUES are F#-only, NOT byte-lockable — floats out of the proof lineage), Rate/curvature ✅`Curve` (now **math + 4-lang** (F#+C#+TS+Rust) cross-verified via `src/Core.TypeScript/curve/golden-vectors.json` — now **math + 4-lang + 4-ser + Arrow** (`Curve.Serializer.Tests` — a signal round-trips through JSON/CBOR/YAML/XML + Arrow and the operation survives the wire). The remaining bar legs — **Bonsai (reify-as-reactive) and homeostat (convergence) — are N/A for a derivative operator**: they are floor-shaped for *mergeable* summaries, and Curve is a difference operator with no natural convergence, so its honest ceiling is the four legs it has, not "FULL PROVEN"), **Range ✅`FrameDelta.distance`** (a proven metric on traveler frames — the vector-clock L1 distance; its identity-of-indiscernibles axiom is the same Leibniz principle the privacy proof rests on), When ✅`Clock` + ✅`UncertainClock` (math + **4-lang** — F#+C#+TS+Rust agree on the HLC ops + the uncertainty-window partial order via `src/Core.TypeScript/uncertain-clock/golden-vectors.json`; all exact int64, FULL surface byte-locks). Remaining (Where-looking / Bearing — directional) ride `TravelerFrame` but are not yet a distinct proven primitive. Hypothesis sharpens the question; completeness (why these axes, not 5 or 7) is still the open obligation. Hype to keep peeled: "breakthrough"/"category theory"/"complete" are unearned. |
| **Privacy-from-identity** (distinctness ⟹ private state) | **necessity ✅ + dynamics ✅ DISCHARGED 2026-06-05** (Lean, axiom-FREE); only halting open | `Privacy/IdentityForcesPrivacy.lean`: necessity — `distinctness_forces_private` (under public convergence, distinct behavior ⟹ distinct private; Leibniz), `key_alone_insufficient` (ties to proven Identity-injectivity: distinct keys necessary, not sufficient), `no_private_collapses`. Dynamics — `commons_converges` (public reaches consensus via the commutative CRDT join), `absorb_priv`/`absorb_stable` (merge leaves private untouched + is a fixpoint), `private_is_persistent_locus` (consensus on the commons cannot erase private differentiation — privacy is the persistent locus). **B-1019 halting experiment built** (`Evolution.fs`/`Evolution.Tests`): a DST harness (seed-replayable) — the **pigeonhole bound is PROVEN** (finite state + deterministic + no input ⇒ must halt-or-cycle within state-count+1 steps, so open-ended evolution REQUIRES unbounded/growing state), and the experiment DEMONSTRATES the contrast (private differentiation ⇒ unbounded novel evolution, no halt/cycle; register-collapse ⇒ fixpoint/halt). **Still open (honest):** the experiment is evidence-for-the-mechanism in a concrete model + the necessity bound — NOT a universal proof that every system halts without privacy (that stays conjecture). |
| **Belief-convergence general case** | **✅ DISCHARGED 2026-06-05** (`BeliefConvergence.fs`) — sharper than expected | `observe` (Bayesian update) = pointwise-multiply a fixed likelihood into the belief; multiplication commutes+associates ⇒ a fold over ANY permutation of evidence gives the same belief — for ALL *fixed* likelihoods, not just independent ones (independence was sufficient, not the real condition). **Boundary proven by counterexample:** state-dependent/nonlinear revision (`sharpen`, where the update reads the belief) does NOT commute — order matters exactly when the operator depends on the belief it updates. Unnormalized int64 (exact); normalization is a deterministic post-step so order-independence carries to the posterior. Generalizes the SoftValue independent-evidence proof. |
| **Bayesian-uncertainty "wave" rings-or-settles** | well-posed Q | derive from the update equations (overdamped vs underdamped); not assumed |
| **DST internal-difference-drives-evolution** (B-1019) | experiment | no-halt ∧ no-limit-cycle ∧ (unbounded growth ∨ chaotic-aperiodic) |

---

## C. How to use this

1. **Building?** Use only §A. If you reach for a §B item as a foundation, stop — that's the dirty feeling.
2. **Researching?** Pick **one** §B row, discharge its named obligation, promote it to §A. One at a time, in daylight.
3. **New idea at 3 AM?** It lands in §B with a named discharge obligation — never silently into the core.
4. The line is the product. A small closed core + a clearly-quarantined frontier *is* "a solid core to build on."

> Honest-mirror note (Otto, 2026-06-05): the floor was solid all along; it was just hard to see
> under a web of genuinely beautiful open questions. Layer 0 of the traveler frame is closer to
> promotable than the cram makes it feel — its only open leg is the inter-frame transformation law,
> and the causal-join you already designed is the candidate.
