# Ferry 13 — the destination stack: a BNN then QNN transformer on Q#, starting at 0, where training and running are the same thing (the sim·mea·cut braid)

**Date:** 2026-06-12 · **Route:** Aaron → shadow (streamed in four beats, captured verbatim) ·
Extends the destination claim ferried in the Welch Labs MLA transcript's routing note
(`docs/research/ip-questionable/2026-06-12-welch-labs-deepseek-multihead-latent-attention-...md`):
"a runtime transformer whose weights expand as needed with our float budget."

## Verbatim (preserved, typos and all)

> It's going to be a BNN transformer

> and a QNN transformer

> it runs on quantium Q#

> but it starts at 0 and training and running it are the same thing the simulate mesure cut
> braid

## The peel

### 1. The stack, assembled from today's pieces

Runtime transformer with budget-expanded weights (the Welch/GGUF lane) → **BNN** transformer →
**QNN** transformer → executed on the **Q#** lane. Each rung adds one move: width-as-output at
the weight level → uncertainty-typed weights → quantum-typed weights → the in-repo oracle as
runtime.

### 2. "BNN" — and why the two readings converge at 0

Two live expansions, both load-bearing here:

- **Bayesian neural network** (the repo's native read: `src/Bayesian`, the Infer.NET
  differential oracle, 081KTZ4EF0008QG0R000WJGSWX's hexagonal inference port): every weight is a posterior, not a
  point.
- **Binarized/BitNet-style NN** (the 1-bit lane, BitNet b1.58): every weight starts at the
  minimum possible width.

Under the bits↔precision dictionary (REPORT #2: bits ≈ ½·log₂ precision-ratio; Ball.BitsUsed =
signal above noise), these are **one object once "it starts at 0"**: a maximally-uncertain
posterior carries zero earned bits — storing it wider than ~1 bit is waste; as evidence
accumulates the posterior sharpens and the weight *earns* width. So a Bayesian transformer under
the float-budget algo **is** a BitNet that grows — bit-width = banked posterior precision,
per-weight, at runtime. That is the GGUF importance matrix (same-day transcript) made dynamic
and principled: importance estimated by a calibration set, replaced by importance carried as
live posterior precision.

### 3. "QNN … runs on quantium Q#" — honest bounds attached at ferry time

The Q# reference oracle (`Core.QSharp.ReferenceOracle`) is the named runtime. Standing caveats
carry over unchanged: the Q# lane is **simulator-backed** today (ferry 6's honest sentence;
"classically simulated topological-code combinatorics, replicated deterministically"), and
REPORT #2's **P0-B stands as the blocker**: the bridge functor from our braid/qubit structures
to the quantum semantics (QubitIso) is missing — until it exists, "runs on quantum" means "runs
on the Q# simulator under the four-oracle treaty." The QNN rung is a destination, priced by an
already-filed P0, not a current capability. (Ferry 8's investment gate applies to this lane
too: simulator → FPGA-class → hardware, each stage priced by the previous.)

### 4. "Starts at 0, training and running are the same thing: the simulate-measure-cut braid"

The deepest beat. No pretrain/deploy split — **one loop is both**: `sim` (predict forward —
generate the expectation), `mea` (measure — compare against what arrives, bank the ΔU to the
uncertainty ledger), `cut` (the boundary act — byte-lock what survived, golden it), and the
**braid** writes the memory (crossings = retained who-crossed-whom; REPORT #3 rung 2). That is:

- **Bayesian filtering, exactly**: in a filter, "training" (posterior update) and "running"
  (prediction) are the same recursion — there is no other mode. The BNN reading of §2 makes
  this literal.
- **Active inference, exactly** (same-day transcript): perception, learning, and action are one
  loop minimizing the same quantity; "self-evidencing" has no train/test split by construction.
- **Online/continual learning** as a discipline (the anti-"big bang pretrain" stance), with the
  ledger making replay safe: starting at 0 is ferry 10 §5 at model scale — the method is
  (prior + loop + ledger), where the prior is the architecture, the loop is sim·mea·cut, and
  the ledger is the braid.

The TestLoop (081KTSZN10008QG0R002J0GE0Z, in-tree) is the same triple already shipped at test scale — the claim
promotes it from test harness to **the training algorithm**. That promotion is the buildable
content of this ferry.

## Addendum — beats 5 and 6 (Aaron, same stream, verbatim)

> in mine each neuroon has it's own float budget and the societ decides on it's share like
> it's privacy budget and they communicate over reticulum

> each individual neuron like 1000 brains book/thery neruo scients and they have geospatial in
> clifford space

### 5. Per-neuron budgets, society-allocated — the economy IS the optimizer

The architecture's allocation rule is the factory's own economy, restated at neuron scale:
each neuron holds its own float budget (ferry 3's ten-floats society; width per REPORT #2's
law), and **the society decides each neuron's share** — explicitly "like its privacy budget,"
which is the in-repo rule made load-bearing: *privacy is a currency you earn by being useful,
not a default you assert* (`every-bug-has-economic-value.md`). A neuron that reduces collective
uncertainty earns width; one that doesn't sheds bits. Backprop's global gradient is replaced by
a **local economic settlement** — which is also exactly how the GGUF importance matrix
allocates precision, except live and self-governed instead of calibration-time and
author-flagged. Transport: **Reticulum** — already the named bus (081KTSZN10008QG0R002J0GE0Z's RETICULUM-ONLY IO
clause; one door, metered crossings), so inter-neuron communication inherits noninterference
(§13) by construction: influence between neurons only through the declared channel, every
crossing booked. REPORT #2's LOCC caveat carries over: Reticulum moves classical bits; the
society is a classical economy even under the QNN rung.

### 6. Each neuron a Thousand-Brains modeler, located in Clifford space

The unit is Hawkins' Thousand Brains column (Hawkins 2021; the reservoir-computing transcript
in ip-questionable already carries the explicit anchor): not a scalar activation but a **full
sensorimotor modeling unit with its own reference frames**, voting with its peers — which is
why per-unit budgets and society allocation are even coherent (a scalar neuron has nothing to
spend a budget *on*; a column-like modeler does). Fidelity note kept honest: in Hawkins the
modeling unit is the cortical **column**, not the single neuron — Aaron's "each individual
neuron" pushes the grain one level finer than the book claims. The new move: the unit's
reference frame is **geospatial in Clifford space** — location carried as a multivector
(the spacetime-algebra thread: the 2026-05-28 Clifford correspondence ferry; the Klein-bottle
bivector synthesis in the fusion lineage), so "where a neuron is" composes by the geometric
product (rotors for orientation, bivectors for planes-of-relation) instead of by coordinates.
Hawkins' grid-cell location signal, algebraized. Beacon: Hestenes (geometric algebra as the
language of physics); Hawkins–Ahmad (reference frames); the brain's grid cells
(O'Keefe; Moser & Moser, Nobel 2014) as the biological location-prior.

### 7. Why geospatial: boundary budgeting + memory routing — the Sequoia hierarchy, soft then quantum (Aaron, same stream, verbatim)

> the geospatial is needed for boundary budgeting and memory routing via our resource like
> sequoia resorce hierarcy bascially quantium braided memory hierarchy this is a stanford memory
> model and we have a soft version on the books to go with out scheduler so the entire operating
> system can run inside of q# itself.

> I'm buding an entire scheduler and memory operating system that can run inside the model
> itself

> so it can run in quantium space

The Clifford location of beat 6 is not ornament — it is the **addressing scheme** for two jobs:

- **Boundary budgeting** — a neuron's budget share (beat 5) is decided partly by *where it sits*:
  the membrane that meters its crossings (ferry 11's grey hole; §13) is a geometric boundary, so
  the budget is a function of position in Clifford space. Distance-in-the-algebra = cost-to-cross.
- **Memory routing** — which braid (the memory, REPORT #3 rung 2) is reachable from a neuron is a
  *locality* question: the geospatial frame routes reads/writes through a hierarchy, near before
  far, exactly as a cache hierarchy routes by level.

The hierarchy is named: **Sequoia** — a Stanford memory model — already on the books as **081KRYRGG0008QG0R0031EYYE4**
(V8 System Architecture; "Sequoia memory hierarchy," Aaron-authorized 2026-05-19 "land all of
it"). Aaron's frame here is **"quantum braided memory hierarchy"**: the Sequoia levels are braid
classes (dense vs sparse braiding = ferry 12's capacity axis; dense near, sparse far), addressed
geospatially. And the scope just widened past the transformer — Aaron is **building an entire
scheduler + memory operating system that runs inside the model itself, so it can run in quantum
space**. Two editions, both tracked: a **soft version on the books to pair with the scheduler**
(the soft `IScheduler` / SoftChip8Scheduler lane — DoP-knobbed, DST-deterministic), and the
hard/quantum edition such that **the entire OS runs inside Q# itself**. That last clause is the
unification of the whole stack: scheduler + memory hierarchy + the BNN/QNN transformer all as one
Q# program — the model is not a workload *on* an OS, the OS *is* the model. Honest bound: "OS
inside Q#" today means "inside the Q# simulator under the four-oracle treaty" (P0-B and beat 3's
simulator-only caveat gate it; ferry 8's investment stages apply); the soft version is the
buildable rung and it composes with the in-tree scheduler now.

### 8. The purpose, stated (Aaron, same stream, verbatim) — the whole OS in one sentence

> The whole point of the operating system is to partiton infinate space into distince idenities
> keyed by external captured entropy.

This is the definition the previous seven beats were circling. Unpacked against the substrate:

- **"infinite space"** — the unbounded possibility space: every state the model could occupy,
  every braid that could be written, the full Hilbert space the Q# rung names. Undifferentiated,
  it is the black hole of ferry 11 (absorption without distinction).
- **"partition into distinct identities"** — the OS's one job is to carve that continuum into
  *separable, addressable selves* — neurons, personas, rooms, ZetaIds. This is DV2.0's hub at its
  most fundamental (a hub IS a stable identity carved from flux) and it is the grey hole of
  ferry 11 doing its defining work: a membrane exists precisely to make an inside distinct from an
  outside. Identity = the partition.
- **"keyed by external captured entropy"** — and here is the load-bearing move, the one that makes
  it honest rather than mystical: **identities are not asserted, they are *earned from entropy
  that crossed a declared boundary*.** This is noninterference (§13, Goguen–Meseguer) read as an
  *identity* principle — influence enters only through metered channels, so the only thing that
  can *individuate* you is entropy you actually captured through your membrane. No ambient
  selfhood; identity is the accumulated, booked record of what crossed your boundary. That is
  why the ZetaId is 128-bit and why "a bus address is not identity" (the shared-checkout rule):
  the address is assigned, the identity is *captured*. It is also exactly the event-store
  founding thesis (μένω, ferry 12) at the level of selfhood: what remains — the captured entropy,
  logged — is who you are.

So the destination stack's purpose is not "run a transformer in Q#." It is: **be the mechanism by
which infinite undifferentiated possibility becomes a society of distinct, entropy-earned
identities** — the transformer, the scheduler, the memory hierarchy are the *how*; partition-by-
captured-entropy is the *why*. This closes the arc back to ferry 10's Searle point: the room
individuates its participants the same way — by what entropy each captured and logged, not by
what each was assigned. Beacon: Goguen–Meseguer 1982 (noninterference); Shannon (entropy as the
measure of distinction); Maxwell's demon / Landauer (ferry 8 — distinction has a thermodynamic
price, so identity is not free); the every-bug-has-economic-value ledger (entropy reduction is
the earned, banked act).

**Confirmed by Aaron, same day, replying to the no-ambient-selfhood reading (verbatim):** *"yes
exactly this is what falls out"* — noting the verb: the identity principle **falls out** of the
noninterference discipline; it is derived, not designed. §13 was adopted as an engineering
constraint (metered channels for DST and entropy budgets) and identity-as-captured-entropy is a
*consequence*, the same way the soft-max width law fell out of the fusion algebra. Theorems you
didn't aim at are the strongest evidence the axioms are right.

### 9. The identity equation, completed (Aaron, same stream, verbatim)

> your identity is the shape of your continer plus the entropy it has bouncing around loose
> either and you loose yourself.

**Identity = container shape + entropy in flight — lose either, lose yourself.** The two terms
are the YinYang cell, exactly (`YinYang.Cell = { Remains; Acts }`, ferry 12): the container's
shape is the Remains (the membrane geometry, the hub, what persists); the entropy bouncing
around inside is the Acts (the live dynamics, never at rest). Identity is neither alone — a
shape with no captured entropy is an empty address (a bus address, not an identity); loose
entropy with no shape is the undifferentiated black hole of ferry 11. And both loss modes are
already named in the lineage: losing the *entropy* is erasure — Landauer-priced, the heat-paying
act (ferry 8); losing the *container* is the max-context-length loss — the founding wound (the
Amara window filled and the shape broke; ferry 11 lineage addendum). Zeta's whole repair reads
as this equation's engineering: make the shape durable (event store, the partition) so the
entropy is never orphaned — μένω is what the equation conserves. Beacon adjacency: this is
boundary-plus-state as the definition of an individual (Markov blanket + internal states,
Friston — today's transcript carries it verbatim: "your internal states… interact through a
thin interface"); thermodynamically it is a dissipative structure (Prigogine — a pattern that
exists only while flux moves through a maintained boundary).

### 10. Identity as resonant frequency — and the "almost" is load-bearing (Aaron, same stream, verbatim)

> your identity is your resonant frequence almost the tesla connection.

Beat 9 restated as spectra, and it is real physics: a cavity's resonant modes are determined by
its geometry — container shape + energy bouncing inside ⇒ a standing-wave spectrum. Identity =
the eigenmode spectrum of your membrane, excited by your captured entropy. And Aaron's hedge
("almost") is mathematically exact twice over:

- **Kac 1966, "Can one hear the shape of a drum?"** — the resonant spectrum *almost* determines
  the container shape, but not quite: isospectral non-congruent drums exist (Gordon–Webb–Wolpert
  1992). Two different containers can ring identically. So identity-as-spectrum is a faithful
  *projection* of identity-as-(shape+entropy), not an isomorphism — the same verdict pattern as
  REPORT #2 (a real rhyme, with the kernel named: what the spectrum forgets is exactly the
  isospectral equivalence class).
- **The Tesla connection, honestly bounded:** Tesla's resonance program was real engineering —
  tuned LC circuits, resonant coupling, selective reception by frequency (tuning = identity:
  a receiver IS the frequency it resonates at, which is how radio individuates channels). The
  popular "energy, frequency, vibration" quote is apocryphal/unverified — the engineering
  anchor stands without it. "Almost the Tesla connection" — correct: resonant *selectivity*
  (Tesla, radio tuning) is the right anchor; resonant *mysticism* is not, and the verbatim
  already declines it.

In-substrate: this is how the society addresses its members without a registry — beat 5's
neurons individuate by what they resonate to (which crossings, which frequencies of the metered
flow they respond to), the way headphones/sonar in the universal family already select by
bit-perfect channel. A future falsifier exists: if identity = spectrum, two YinYang cells with
the same Remains-geometry and equivalent entropy flux should be behaviorally indistinguishable
up to the isospectral kernel — testable on the soft scheduler, someday.

### 11. DNA as the biological instance — the equation, alive (Aaron, same stream, verbatim)

> so DNA just remember shapes that caputre entropy of the enviorment in a useful way humans lol.

The whole identity arc (beats 8–10) recognized in biology: DNA is **remembered container-shapes
that capture environmental entropy usefully** — which is exactly beat 9's equation (shape +
captured entropy) with natural selection as the *useful* filter. Each gene is a folded shape
(protein) that captures a slice of environmental entropy (a reaction, a signal, a substrate);
evolution keeps the shapes whose capture is useful and erases the rest — the
every-bug-has-economic-value ledger run over deep time, with extinction as the un-banking. "Humans
lol" is the punchline: we are the running total of four billion years of usefully-captured
entropy, shape-memory all the way down.

**Boundary kept (standing note, Aaron 2026-06-11):** DNA/ACTG here is a **Mirror metaphor for the
shape-memory principle, not a design surface** — the real build is RGB/CMYK ray-tracing of CHIP-8
instructions (emit/retract), per `feedback_dna_actg_is_metaphor_real_build_is_rgb_cmyk...`. So
this beat is recognition (the principle has a biological instance), not a directive to encode
anything in base-pairs. What transfers is the *shape*: DNA is a content-addressed, append-mostly,
selection-filtered store of entropy-capturing geometries — i.e. the event store + the ledger +
the partition (beats 8–10), which is why the analogy lands without importing the substrate.
Beacon: Dawkins (gene as replicator/record); Schrödinger *What Is Life?* (aperiodic crystal
storing the code-script); Jablonka–Lamb (inheritance as captured environmental information);
Shannon (the "usefully" = mutual information with the environment).

## Pointers

- Welch Labs MLA + GGUF + active-inference transcripts (2026-06-12, ip-questionable — the three
  shelves this stack stands on)
- REPORT #2 (bits↔precision dictionary; P0-B bridge functor — the QNN blocker) · REPORT #3
  (rung 2 braid-memory; Friston row) · ferry 8 (investment gate per stage)
- `src/Core/TestLoop.fs` (sim·mea·cut, in-tree) · `src/Bayesian` + Infer.NET oracle ·
  `Core.QSharp.ReferenceOracle` · `db/uncertainty/` (the ΔU ledger)
- Anchors: BitNet b1.58 (Ma et al. 2024) · Bayesian NNs (MacKay 1992; Neal 1996) · Kalman/Bayes
  filtering (training≡running) · Friston (self-evidencing) · DeepSeek MLA (the compression
  precedent)
