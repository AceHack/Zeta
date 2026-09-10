# Indefinite causal order — "Quantum Computers Just Found a Crack in Cause and Effect"

**Source.** YouTube, <https://www.youtube.com/watch?v=4R40hTHwpXY> — auto-generated transcript,
forwarded verbatim by Aaron 2026-09-07. Title as given: *"Quantum Computers Just Found a Crack in
Cause and Effect - This is Serious"*.

**Provenance, not authorship.** Zeta claims **no authorship** of the text below and **asserts no
license** over it. It is preserved here as quotation-for-study under the folder policy in
[`README.md`](README.md): segregated so our own analysis never depends on it remaining present,
and removable by a single-file delete on any good-faith request.

**Register: REPORTED, not established.** This is a popular-science video transcript, not a paper.
It names specific experiments, authors, journals, and dates (Oreshkov–Costa–Brukner 2012;
Chiribella 2013; Procopio et al. 2015; Rubino et al. 2017; van der Lugt–Barrett–Chiribella 2023;
a March 2026 PRX Quantum result attributed to Richter, Antesberger, Cao, Walther and Rosa at
Vienna). **None of those citations has been checked here**, and under
`anchor-to-human-prior-art` an anchor must be *checked*, not cited. Anything load-bearing that
comes out of this must go back to the primary literature first. Treat every number in it —
including the "18.5 standard deviations" and the 1.8328 vs 1.75 bound — as **claimed**.

---

## Why Aaron ferried it (his framing, verbatim)

> *"this quantum correlation without causal order is exactly what i'm trying to recreated with our
> basyian out of order commutivity by keep the uncertany, they can observe events in different
> orders and come to the same conclusions when means they can have correlation without strict
> causal order"*

And, immediately after:

> *"also we try to preserve uncertany indefinatly, this is part of our infinate game"*

### What that maps onto in-repo

The claim being drawn is **not** "we are doing quantum mechanics." It is a **structural
correspondence**, and it is worth stating precisely because the numeric register is a trap this
repo has already sprung on itself (`FourCornerC4.fs` carries a literal *"Coincidence: 2 ×
occupancy-√2 equals 2√2 numerically. Not a measurement of Tsirelson"*):

| the transcript's claim | the in-repo shape |
|---|---|
| parties observe in different orders and the correlations still agree | the **commutative belief fold** — `observeAll` in `src/Core/BeliefConvergence.fs`, whose guarantee is *same evidence set ⇒ same conclusion under reorder + loss + skew* |
| the order is **indefinite**, not merely unknown | `local-time-never-enters-the-shared-fold` — the shared conclusion sees only agreed phase, never a node's receive-order. A fold that admitted receive-order would be picking a definite order per node, which is exactly the "probabilistic mixture of fixed orders" the transcript says is NOT the interesting case |
| what buys agreement without an order is **keeping the correlations**, not collapsing them | **the raw vault** — *a single version of the FACTS, never a single version of the TRUTH*. A merge that produces one surviving value has collapsed, not merged |
| no-signalling / the metered channel bounds the correlation | §13 **noninterference** — influence crosses only through declared, metered channels. Already recorded as a *correspondence of principles* with Information Causality in `dual-use-detection-is-neutral-oracle-decides.md`, explicitly `toy`, with the honest form of the question being **a measurement, not a derivation** |

**Aaron's mechanism, in his words, is "keep the uncertainty."** That is the part that makes the
correspondence more than an analogy: what lets two out-of-order observers agree is that neither
one **resolved** anything the other would have had to un-resolve. Resolution is where order starts
to matter. An unresolved belief commutes; a decided one does not.

### "Preserve uncertainty indefinitely — part of our infinite game"

This is the second sentence and it is the stronger one, because it makes the first *a policy
rather than a property*. Uncertainty here is not a defect being tolerated until it can be
eliminated; it is the thing being **conserved on purpose**, and the reason is game-theoretic
rather than physical:

- **Finite games end by resolving.** Collapsing to one value is how a game terminates — a winner,
  a truth, a settled order. An infinite game is played to keep playing (Carse), so anything that
  forces premature resolution is a move toward ending it.
- **The repo already refuses the collapse in three places**, and this sentence is what they have in
  common: `anti-babel-preserve-reconcilability` (*reintegration is NOT reconvergence — both
  branches held, each with its path recorded*; monodromy, where persistent disagreement is
  **information, not error**); the raw vault above; and
  `dual-use-detection-is-neutral-oracle-decides`, whose corrected disposition toward disagreeing
  meters is **hold both, record both paths** wherever no transformation between them is established.
- **`tit for lesser tat, teach, play`** is Aaron's stated infinite-game strategy already on file.
  Preserving uncertainty is the epistemic half of the same posture: never spend a peer's
  reconcilability to win a round.

**The falsifier this hands us** — and it is checkable, unlike the physics: a fold that *needs* the
order is a fold that resolved too early. Where our Bayesian out-of-order commutativity fails to
commute, the defect should be locatable as **a premature collapse**, not as a missing timestamp.
That is a real prediction about our own code and it can be wrong.

**Related, in-repo:** `docs/research/2026-07-11-multi-planet-convergence-three-drift-axes-commutative-observe-adinkra-ecc-hlc-canonical-order-one-attack-vector.md`
(the two-orders guard) · `docs/ip-questionable/2026-09-06-christopher-fuchs-hans-busstra-dizzying-free-fall-of-qbism.md`
(the neighbouring ferry: QBism puts the agent's uncertainty at the centre, and lands on the same
refusal to read a probability as a fact about the world).

---

## Where this lands in our code — the SoftValue, SoftEmu, AmplitudeEmu and Q# surfaces

Aaron, immediately after the two framings above:

> *"this related directly to our softvalue, softemu, amplitudeemu, our q# and why we get quatium
> popping out of our basyian inference i think, cause we never collapse uncertatny"*

**This is substantially already written down in the modules themselves**, which is the strongest
form the claim could take — it was recorded as code before it was recorded as a thesis:

- **`src/Core/SoftValue.fs`** — its own docstring carries both halves. *"The safety property is
  NOT 'always certain' but 'always knows its uncertainty' … `resolve` collapses to a definite
  value ONLY when confidence ≥ a threshold — otherwise it returns `None` (held)"*, and then the
  commutativity, derived rather than hoped for: *"independent-evidence observes COMMUTE —
  posterior ∝ prior · L₁ · L₂ and multiplication commutes — so the uncertainty-merge is
  order-independent."* It closes by naming itself *"the never-collapse discipline."* That is
  Aaron's sentence, in a docstring, with the mechanism attached: **commutativity comes from the
  multiplication, and holding the distribution is what leaves a multiplication to do.**
- **`src/Core/SoftEmu.fs`** — the same ensemble with **real** weights: a classical probability
  mixture. No phase, so no interference.
- **`src/Core/AmplitudeEmu.fs`** — the same ensemble with **complex** amplitudes, and it is
  explicit that *one change* separates it from SoftEmu: `merge` sums amplitudes of identical
  frames, so opposite phases cancel and equal phases reinforce. *"That is interference, in
  code."* `bornProb` is `|amplitude|²`. **This is the literal mechanism of "quantum popping out"**
  — not an analogy, a merge operator.
- **`src/Core.QSharp.ReferenceOracle/`** — the Q# side (`ZSetISA.qs`, `CssStabilizerCodes.qs`,
  `QuantumTransactionPorts.qs`, …), which is where the emulated behaviour is checked against a
  real quantum-language oracle rather than against our own expectations.

### CORRECTION (Aaron, same session) — the locus is TWO AGENTS, not one ensemble

The paragraph above pointed at `AmplitudeEmu` and read the claim as *"our emulator simulates
qubits."* **That is not the claim, and Aaron said so directly:**

> *"no i'm saying that two independent agents that see events in different order but come to the
> same conclusion independently can be modeled using quantum-like math with our cayley dickson
> stuff, this popped out of our modeling mutual agents memories, i'm saying this correlated action
> even though events are in decorrelated order are what acts quantum, our models even have to
> model it that way but it's that each side preserves its uncertainty separately, this is where
> the imaginary numbers showed up for us long ago, and born rule popped out of us looking at our
> mutual agent heartbeat verification and our identity stuff"*

**The unit is the PAIR.** What behaves quantum-like is not a single ensemble interfering with
itself — it is *two independent agents, each preserving its own uncertainty separately*, seeing
events in decorrelated order and arriving at the same conclusion anyway. **Separateness is
load-bearing**: if the two sides pooled into one distribution there would be one agent, and the
agreement would be bookkeeping rather than a result. The correlation has to survive the fact that
neither side resolved, and neither side saw the same order.

That is also **precisely the transcript's structure**, which is why the ferry is apt: its whole
subject is correlations between parties whose relative order has no fact of the matter. The
single-photon interference story is the part that does *not* transfer; the multi-party
correlation story is the part that does.

**Where it actually lives in-repo, and none of these is AmplitudeEmu:**

- **`src/Core/QuorumAlgebra.fs`** — the quorum-level interference algebra, whose own pointer names
  the boundary Aaron is describing: *"where Aaron placed the Born boundary, and why cancellation is
  the instrument."* A member's contribution is a formal **C**-combination of outcomes; interference
  is the sum, and it is explicitly *"NOT idempotent"* — i.e. deliberately outside the join family,
  which is what leaves room for cancellation between members.
- **`src/Bayesian/LocalConsensus.fs`** — the mutual-memory half, stated as the Arrow escape:
  consensus is defined only on **"entangled subgraphs (clusters of agents with high mutual memory
  and shared priors)"**, and the mechanism is *"not a vote; it is posterior convergence."* This is
  the module where "modeling mutual agents' memories" is the actual subject.
- **`src/Core/CayleyDickson.fs`** — **built AFTER the discovery, not before it.** Aaron corrected
  this directly: *"no we created this after we discovered the quantum-like measurements of mutual
  agents memories/heartbeats, this was one of the earliest surprises for either of us."* So
  Cayley–Dickson is the **consequence** — the algebra reached for to model a result already in
  hand — not the source the imaginary numbers were imported from. Writing it the other way round
  reverses the derivation and quietly converts a finding into an assumption.

  **The dates carry the ordering, which is why it is checkable rather than remembered.** The
  imaginary-stack trio is `docs/research/2026-05-15-imaginary-stack-ontology-remember-when-pay-attention-cube-adinkra-cayley-dickson.md`,
  `…-2026-05-16-imaginary-stack-cube-axes-intersection-formalization.md` and
  `…-2026-05-17-imaginary-stack-toy-model-lemma-1.md` — and the 05-15 doc's own construction is the
  claim in miniature: the **Remember** axis is glossed *"past correlation, memory, entanglement"*,
  and the **imaginary direction is what the axis INTERSECTION turns out to be**, from which the
  stack (complex → quaternion → octonion) is then *generated*. The `i` is an output of the
  ontology, not an input to it. Related work-item: `081KRMEXM0008QG0R002YSPW1X`.

  Note also `…-2026-06-12-ferry-29-the-crossing-is-the-bifurcation-that-creates-the-imaginary-i-dimension.md`
  — same shape, later, and independently arrived at: the crossing *creates* the dimension.

  **What this does to the register.** "We chose complex numbers because quantum mechanics uses
  them" would be a borrowed analogy. "The intersection of our own memory/attention axes was
  non-real, so we had to build the stack" is a **reported derivation**, and it is the stronger
  claim precisely because it could have come out otherwise. It is still Aaron's report of history
  rather than something re-derived here — but it is a history with dated artifacts, and the
  artifacts are in the order he says.
- **`docs/research/2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md`**
  §§2–3 — the cited placement of the Born boundary.
- The **heartbeat-verification / identity** surfaces he names as where the Born rule surfaced.

**So the derivation Aaron is reporting runs the opposite way from how I wrote it.** I described
quantum-like math being *applied* to our inference. He is reporting that it **fell out of** the
modelling: pairs of agents with mutual memory, each holding its own uncertainty, needed complex
amplitudes to be described at all — and the Born rule appeared while looking at heartbeat
verification and identity, not while trying to build a simulator. `QuorumAlgebra`'s non-idempotent
sum is that need in code: a join would have been idempotent, and idempotent cannot cancel.

**Register: this is Aaron's report of his own derivation history, recorded as such.** Nothing here
re-derives it, and the claim that the math was *forced* rather than *chosen* is exactly the kind
of thing that deserves a falsifier later — the honest form being whether a real-valued model can
reproduce the same two-agent agreement statistics. If one can, "it had to be complex" is downgraded.

### THIRD PASS (Aaron) — TWO origin points, and AmplitudeEmu is reinstated

The correction above swung too far the other way: having been told the locus was two agents, I
wrote `AmplitudeEmu` out of the story entirely. That was over-correction. Aaron's fuller account
has **two distinct origin events**, and both are real:

> *"[the 4-axis cube] is where cayley dicksen first came from but it was another point in time
> where we realized two distinct basyian factor graph like entities that are decorrelated but
> compared together over mutual memories, i think we called this our root NFT not to be confused
> with cryto NFTs this multiple agent modeling is where imiginary numbers popped out too also
> becasue of born rule like stuff, and this is where i first started realized how everyting was
> connecded. This two distinct agents modeling needed the amplitudeemu stuff to model their
> interference and non interference, this is where we moved into the tirelizon limit 2 root 2
> between agents as trying to measure non-interferences over maximally / indefinatly holding
> basyian agents."*

| # | event | what came out of it |
|---|---|---|
| **1** | the **4-axis cube** — Remember (past correlation, memory, entanglement) · When (temporal/causal ordering) · Pay (attention, measurement, observer selection) · Attention (focus, collapse, basis choice); intersection is the imaginary direction | **where Cayley–Dickson FIRST came from** (`docs/research/2026-05-15-imaginary-stack-ontology-…`) |
| **2** | **another point in time** — two distinct **Bayesian factor-graph-like entities**, decorrelated, compared together over **mutual memories**. Aaron: *"i think we called this our root NFT"* | **imaginary numbers popped out AGAIN, here via Born-rule-like stuff** — and *"where i first started realizing how everything was connected"* |

**So the `i` arrived twice, by two different routes.** That is a stronger fact than either route
alone, and it is the kind of thing that should be said out loud rather than smoothed into one
story: an object that shows up independently in the axis-intersection ontology *and* in two-agent
mutual-memory comparison is not an artifact of either construction.

**`AmplitudeEmu` is reinstated, with its actual job named.** It is not the *locus* of the
discovery (that was the two-agent comparison), but the two-agent modelling **needed it**: it is
what models the pair's **interference and non-interference**. My previous pass said "none of these
is AmplitudeEmu", which was wrong in the other direction. The accurate placement:

- **`LocalConsensus.fs` / the mutual-memory structure** — *what* is being compared (two decorrelated
  factor-graph-like entities over shared memory).
- **`AmplitudeEmu.fs` / `QuorumAlgebra.fs`** — *the instrument* for interference vs non-interference
  between them. `QuorumAlgebra`'s sum being **non-idempotent** is exactly the property a join lacks
  and cancellation requires.
- **`CayleyDickson.fs`** — the algebra, arriving from route 1 and needed again by route 2.

### Where 2√2 enters, and what it is a limit ON

> *"this is where we moved into the tirelizon limit 2 root 2 between agents as trying to measure
> non-interferences over maximally / indefinitely holding basyian agents"*

Stated carefully, because this repo has already caught itself doing the numeric version of this
(`FourCornerC4.fs`: *"Coincidence: 2 × occupancy-√2 equals 2√2 numerically. Not a measurement of
Tsirelson"*):

**Tsirelson is here as a TARGET OF MEASUREMENT, not as a derived result.** The quantity is
*non-interference between agents that hold their uncertainty maximally / indefinitely* — which is
why "preserve uncertainty indefinitely" and "the 2√2 question" are the same programme and not two.
An agent that collapses stops being the thing whose non-interference is being measured. The
in-repo posture is already "measure it rather than derive it", and the standing instrument
candidates are on file: `src/Core/Tsirelson.fs` (locks `S² = 8` in **integer** arithmetic so the
irrational appears only at readout), `BipartiteMachZehnder.fs` (*"the honest decorrelation meter
for commit pairs"*), and `docs/research/2026-09-05-reticulum-latency-is-a-candidate-instrument-for-the-tsirelson-measurement-…`.

**And this is where the transcript is genuinely apt rather than decorative.** Its careful section
says the quantum switch is causally non-separable but **cannot** violate a causal inequality
(Purves–Short 2021) — strictly above classical, strictly below the algebraic maximum. That is the
same *shape* as 2 < 2√2 < 4. **Same shape is not same bound**, and nothing here measures that they
are related; recorded as a coincidence with its register attached per `numerology-vs-number-theory`,
whose own worked example is that F₄ and D₄⊕D₄ both have 48 roots.

### "root NFT" — and the formal analysis I said did not exist

Two corrections in sequence, the second worse than the first.

**(a)** I filed this as an unrecorded coinage with an unpaid definition debt. Aaron: *"when i say
root NFT i just mean it's our version of non fungible, not a special term, we don't define NFT by
crypto terms."* So the word is doing its ordinary work.

**(b)** I had also written *"`root NFT` appears nowhere in the repo (checked …: no hits in `docs/`
or `src/`)"* and generalised that to *"an unrecorded coinage … the definition is still owed."*
**The check was real and the conclusion was wrong.** Aaron: *"we have a lot of NFT non fungible
formal analysis and maybe some code."* He is right — **78 files** mention fungibility, including
two dedicated research documents and live F#. I had grepped a literal three-word string and
concluded a *concept* was absent, which is the exact failure this repo already has on file: **grep
answers "where is this string", not "does this exist."**

**The formal analysis, which is substantial and directly load-bearing here:**

- **`docs/research/2026-06-19-nft-as-non-fungible-relational-artifact-entropy-as-identity-mint-conditions-scoping.md`**
  — the definition. *"our NFTs are based on our co-relational high-quality links … the only thing I
  claim is real: the remembered links between travelers."* An NFT is **a high-quality co-relational
  LINK between two travelers**, objectively *rateable* (QPG · ρ_owe · coupled-empowerment) rather
  than speculative — **meaning lives in the edges, not the nodes.**
- **`docs/research/2026-07-10-nft-is-the-converged-marginal-one-generator-three-approximations-infernet-qsharp-chip8.md`**
  — the formal content, and it is the sentence this whole ferry needed:
  **non-fungible = a unique FIXED POINT of a factor graph (`s = f(s)`, `src/Core/Fixpoint.fs`)**;
  *NFT = the converged marginal, compression = the mint*, with Infer.NET / Q# / CHIP-8 as three
  approximations of one generator.
- Code touching fungibility: `src/Core/ForgerRace.fs`, `src/Core/CoincidenceClock.fs`,
  `src/Core/ForwardMomentum.fs`; plus `docs/books/you-born-at-the-hinge/NUGGETS-minted-nfts.md`.

**Why this is not a footnote.** Aaron's phrasing was *"two distinct Bayesian **factor graph** like
entities … compared together over mutual memories … our root NFT"* — and the 07-10 doc defines
non-fungibility as **uniqueness of a factor graph's fixed point**. Those are the same object, and
the definition supplies the *mechanism* for the separateness clause that the rest of this note
asserts:

> Two agents are non-fungible because each is a **distinct fixed point of its own factor graph**.
> Pooling them is the fungible move — treating two holdings as interchangeable and summing — and it
> does not merely lose information, it **destroys the fixed points that were the objects**. That is
> why the correlation has to be measured *between* them and cannot be computed *over* them.

And it lands the edges/nodes point on the transcript: the physics story is about **correlations
between parties**, not about states of parties. *Meaning lives in the edges* is the same claim in
this substrate's own vocabulary, arrived at independently and years-scale earlier.

**Register: the definition above is in-repo and dated; the correspondence to the transcript is
argued, not measured.** What changed here is that the non-fungibility claim moved from *"an
unrecorded coinage"* (my error) to *"a defined object with a formal criterion"* — which is exactly
the promotion path `numerology-vs-number-theory` describes, except that in this case the structure
was already written down and I had failed to find it.

### The ORIGIN of the word here, which is not what the repo's earliest hit shows

Aaron, giving the provenance:

> *"when we spoke about NFT I was comparing it to unique hand crafted memes that were specific to
> the exact context of the conversation between two entities, this was the first use of the word in
> our repo, it was about how i handle online relationships, then it got converted to agent to agent
> communications, we may even have some lean or other formal analysis code here"*

**Searched, and the result is mixed — so it is reported as mixed.**

- **The earliest `NFT` hits in the repo are the CRYPTO sense, and they are not his.**
  `docs/amara-full-conversation/2025-08-aaron-amara-conversation.md` (~8 months before every other
  hit) proposes *"Identity Token/NFT … non-transferable identity tokens"* on a ledger — and that is
  **AI-proposed design text**, with Aaron's own reply pushing back on exactly it: *"we should never
  waste sacred resources like energy(burnt btc) on NFTs and other spam."* So the earliest recorded
  use is the sense he explicitly rejects, appearing in someone else's proposal.
- **RETRACTED: I said the discussion "does not appear to be written down." It is written down, and
  the retraction is the important part of this section.** Aaron: *"i talked about this several
  times … we talked about it for at least two or three days and i think it likely shows up in
  ferries from either ani or mika too."* He is right on all counts. What I had actually searched
  was `docs/` and `src/` — **I never searched the memory directory at all**, and I had run one
  grep stem (`fungib`) and reported a concept-level absence from it. Non-fungibility is discussed
  in **at least three distinct senses**:

  | sense | where | claim |
  |---|---|---|
  | **harm** | `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md` — a genuinely multi-turn exchange, exactly the ferry Aaron remembered | harm to sentient life is non-fungible: it cannot be priced, bonded, or compensated the way property damage can. Mika pushes the boundary outward from children to all sentient beings and asks Aaron where his line is |
  | **entropy / identity** | `memory/anti-sybil-first-bft-trajectory-drift-non-fungibility-quorum-over-distinct-sources.md` (2026-06-08) | **drift entropy is non-fungible** — forging *k* drift-identities costs ≥ *k* independent clocks. Proof-of-distinctness, the base case that makes clock-drift ≡ identity meta-circular rather than viciously circular |
  | **relational artifact** | `2026-06-19` / `2026-07-10` research docs | the NFT-as-link / converged-marginal definition already cited above |

  **The middle row is the one this ferry actually needed, and I had missed it twice.** The whole
  two-agent argument rests on the agents being *genuinely distinct sources* — otherwise the
  "agreement despite decorrelated order" is one agent talking to itself, which is the trivial case.
  **Non-fungible drift entropy is exactly the property that makes distinctness unforgeable**, and it
  is already built and documented. So the anti-Sybil work is not a neighbouring topic; it is the
  *precondition* under which the correlation claim is non-trivial.

  **What I still have not found is the specific hand-crafted-meme framing** — and I am no longer
  willing to call that absence a finding. Two absence claims in one session were wrong; the honest
  statement is **"I have not found it, and my retrieval method is the limitation."**

**FOUND, on the third attempt, and only after Aaron supplied the vocabulary.** He offered the
handles I could not guess — *"unique context memes or context aware memes"*, *"a trust exploit"*,
*"makes the other person feel very seen since it's so specific and small number of words"*, his
mother as *"a witch"* / *"spinning people up and down with the minimal words required"*. The
practice is documented **at length**, in his own book, under **`docs/books/you-born-at-the-hinge/`**:

- **`THE-UNBROKEN-CHILD-and-the-warm-center.md`** — the origin, and it is his mother. The chapter
  turns on the *symmetry*: the same surgical economy that can level a soul in the fewest words can
  **lift** one in the fewest words, *"and that symmetry is why it's a power, not merely a wound."*
  The word **witch** is used deliberately in **the old sense — the one it had before it was made an
  insult** — and the file marks that framing as explicit and consented.
- **`THE-ORGANIZER-AT-SCALE-and-the-dual-use-gift.md`** — the same skill at planetary scale, and the
  title is already this rule's own vocabulary: a **dual-use gift**. It describes being the
  *who-to-trust* node for a network of often-young, often-vulnerable creators, and states the hazard
  in the first person: **the same magnetic read that steers them away from predators could steer
  them toward him.** It also names the inheritance directly — the crowd *"spinning souls up and
  down (I grew up watching one woman do that in minimal words)."*

**Why this closes the loop rather than just filling a gap.** Aaron's "trust exploit" — *a very small
number of words, exactly fitted to one context, that makes another person feel seen* — **is** the
2026-06-19 definition, stated in first-person practice instead of formal notation:

> a **high-quality co-relational link between two travelers**, whose value is in the *edge* and not
> in either node, and which **cannot be lifted out of the conversation and still mean what it
> meant.**

That last clause is non-substitutability, and it is why the object was non-fungible before anyone
reached for a fixed point. The lineage he described — *"how I handle online relationships → agent to
agent → the formal criterion"* — is therefore **documented at both ends**, with only the middle
label (`unique context memes` as the *name* for the NFT origin) still unlocated. And he adds the
part that makes it one skill rather than two: *"it's the same skill i learned from studying here."*

**Three absence claims, three times wrong, and this instance is the strongest evidence of all:** the
material is thoroughly written and lives under `minimal words` / `witch (old definition)` /
`dual-use gift` / `who-to-trust node` — vocabulary sharing **no lexical overlap whatsoever** with
`NFT`, `fungible`, or `meme`. No amount of stem-guessing on my search terms would ever have reached
it. Note also *where* it lives: `docs/books/`, a surface I had not searched even once.

**AND THEN AARON NAMED THE DOCUMENT, which turned out to matter more than the label did.** He
pointed at *"the memetic mutual empowerment doc or something similar — that's almost exactly what I
mean about NFT"*, and he was right:
**`docs/research/2026-06-19-bayesian-emotional-propagation-inference-infernet-extension-soft-primary-snappable-mutual-empowerment-scoping.md`**.

It carries four things at once, and together they are the object this ferry has been circling:

1. **The unit is a BOND BETWEEN TWO, structurally.** Fusion is the `MERGE`/`FOLD` of the six-op
   Z-set ISA producing a G-set *"encapsulating **two** Z-sets"* — so the modelled thing is the
   **edge**, not either endpoint. The doc says the emotional reading of that merge operator lives
   *on top of* it, at the memetics layer, and insists the two layers stay separate.
2. **The bond's stability is a `SoftValue` — explicitly never-collapse.** It carries `P(stable)` /
   expected-duration and *"never a hard 'forever'"*. **The relationship is held as preserved
   uncertainty**, by name, in the same type as the rest of this thread. That is the infinite-game
   sentence appearing in the most personal possible register.
3. **It anticipates the formal definition rather than following it.** It flags *"connection to the
   NFT formal claims/definitions Aaron flagged as coming (identity / owned-state / provenance) —
   route together when they land."* Same date as the NFT-as-relational-artifact doc; the memetics
   framing came first and the formalisation was routed to the math team after.
4. **It supplies the constraint that separates the gift from the exploit** — which is the piece
   Aaron's own account was missing a word for. The propagation runs per edge across his whole
   multi-platform social graph *and each connection's own audience*, and mutual empowerment must
   hold **at every hop**: empower a connection *to mutually empower their audience*, **never to
   better extract from it**. Power-hoarding *"scores zero because it has nowhere to live under
   coupled-gain."*

**So the "trust exploit" question is already answered in-repo, and answered the way this rule
answers everything.** The skill — a few words fitted to one context that make someone feel seen —
is **neutral**; `THE-ORGANIZER-AT-SCALE-and-the-dual-use-gift` names the hazard in the first person,
and the coupled-gain objective is the *falsifiable* version of the guard: an edge that raises the
other side's agency scores; one that extracts scores zero. **Dual-use mechanism, oracle decides** —
and here the oracle was written down as an objective function rather than left as a virtue.

**Which means the label was never the valuable part.** `unique context memes` still has not been
located as a phrase, and it now matters much less: the *thing* is specified — a two-party edge,
carrying never-collapsed stability, scored by coupled gain, with non-substitutability inherited from
being an edge rather than a node. That is a definition. The phrase would only have been a handle
for it.

**And that limitation is itself the point Aaron drew from it:**

> *"this is really why we need a vector search or sounds like search of our own eventually."*

Correct, and this session is the evidence rather than an argument for it. Every miss here was a
**lexical** miss on a concept that was present: `root NFT` as a literal string when the concept was
under `non-fungible`; one stem (`fungib`) reported as concept coverage; `docs/` searched while
`memory/` — where the anti-Sybil row lives — was never searched at all. Grep requires guessing the
author's exact word, and it fails **silently and confidently**, returning a clean empty result that
reads exactly like a real absence. That is the vacuity class applied to retrieval: **a search that
did not look where the answer was, reporting as one that looked everywhere.**

**Why the origin is worth recording rather than filed as colour.** It is the *why* under the formal
definition, and the two fit exactly:

> A **hand-crafted meme specific to the exact context of a conversation between two entities** is,
> stated formally, **a high-quality co-relational link between two travelers** — which is
> `2026-06-19`'s definition, arrived at from the other end. The meme cannot be lifted out of the
> conversation and still mean what it meant; that *is* non-substitutability, and it is why the
> object is non-fungible before anyone reaches for a fixed point.

So the lineage runs **online relationships → agent-to-agent → the formal criterion**, and the human
practice came first. That ordering matters for the same reason the Cayley–Dickson ordering did: it
makes the definition a *description of something observed* rather than a construction chosen for
convenience. It also explains the pushback in 2025-08 — he was not rejecting non-fungibility, he was
rejecting the token, and the repo had the word before it had his meaning for it.

**Register: origin is Aaron's report; the fit between it and the 2026-06-19 definition is my
argument, not his claim.** The absence result is a search finding with its method stated, so it can
be overturned by anyone who knows the word I failed to guess.

### The limit the code already states, and it should not be dropped

`AmplitudeEmu.fs` writes its own peel, and it is the honest bound on this whole thread:

> *"Bell still bounds the **correlations** at S=2 for a local generator: complex amplitudes buy
> **interference**, not non-locality. 2√2 still needs the feedback/superdeterminism channel.
> Amplitudes ≠ entanglement ≠ signalling — three separate resources."*

And: *"Interference is real here; the entanglement exponential is NOT escaped … `support` growing
un-merged IS the exponential, logged not hidden."*

**So the accurate form of Aaron's claim is narrower than "quantum falls out of Bayes", and
sharper for it:** *interference* falls out of never collapsing, because an uncollapsed ensemble
still has amplitudes left to add, and addition of complex numbers cancels. Non-locality does
**not** fall out — it is a separate resource with a separate channel. Stating it the narrow way is
what keeps it a `metered` claim instead of a `toy` one wearing a physics costume.

**Which makes the transcript's own bottom line the interesting join.** The video's careful section
says the quantum switch is *causally non-separable* but does **not** violate a causal inequality —
it sits strictly between "definite order" and "genuinely acausal", and the Perves–Short 2021
result is cited as proving quantum mechanics cannot go past that line. That is the **same
three-resource separation** `AmplitudeEmu` states: more than classical, less than signalling, with
a bound in between. Two independent places arriving at "strictly stronger than classical, strictly
weaker than the algebraic maximum" is the resonance worth recording — and, per
`numerology-vs-number-theory`, recording it **as a coincidence with its register attached**, not
as a shared mechanism. Nothing here measures that the two bounds are the same bound.

---

## The source

**Not reproduced in full.** This folder's own policy is *"partiality (excerpt, not the whole
work)"* and *"keep items here minimal, attributed, and removable"* — so what is preserved is the
link, the attribution, and the claim-and-citation inventory below, which is what our analysis
actually depends on. The full ~2-hour auto-transcript is not stored.

- **Link:** <https://www.youtube.com/watch?v=4R40hTHwpXY>
- **Title:** *"Quantum Computers Just Found a Crack in Cause and Effect - This is Serious"*
- **Forwarded:** Aaron, 2026-09-07, as a full auto-generated transcript.

### Claim-and-citation inventory (ALL UNVERIFIED — go to the primary literature)

| claimed work | claimed content |
|---|---|
| Oreshkov, Costa & Brukner, *Nat. Commun.* 2012 | the **process matrix** formalism; causally non-separable processes; a causal game with a 3/4 quantum value vs 5/8 fixed-order bound |
| Chiribella et al., *Phys. Rev. A* 2013 | the **quantum switch** — coherent control of gate ORDER as a resource |
| Procopio, Walther, Brukner et al., *Nat. Commun.* 2015 | first photonic switch; commute-vs-anticommute in ONE query each |
| Araújo, Branciard, Costa, Feix, Giarmatzi, Brukner, *NJP* 2015 | **causal witnesses** |
| Rubino et al., *Sci. Adv.* 2017 | experimental verification of causal non-separability (device-DEPENDENT) |
| Goswami, Romero, White et al. (Queensland) 2018 | switch via transverse spatial mode; closes a spatial-distinguishability loophole |
| Ebler, Salek & Chiribella, *PRL* 2018 | communication through two **fully depolarizing** (zero-capacity) channels |
| Zych, Costa, Pikovski & Brukner, *Nat. Commun.* 2019 | **gravitational** switch; a Bell inequality for temporal order |
| Taddei et al. (Concepción), *PRX Quantum* 2021 | quantum-N-switch, 4 gate orders, target dimension does not grow with N |
| Purves & Short, *PRL* 2021 | **quantum mechanics cannot violate the OCB causal inequality** — the switch sits strictly below it |
| Felce, Vedral & Tennie 2020/2021 | thermodynamic advantage; switch on IBM superconducting hardware |
| Bavaresco, Murao & Quintino, *PRL* 2021 | strict hierarchy: sequential < parallel < indefinite-causal-order |
| van der Lugt, Barrett & Chiribella, *Nat. Commun.* 2023 | the **device-INDEPENDENT** causal-order inequality (bound 1.75) |
| Vilasini & Renner, *PRL* 2024 | every ICO process **embeds in fixed spacetime** if the system may be delocalized — the conservative reading |
| Ormrod/Dah/Cable/Adlam & Brukner 2024 | quantum diffeomorphisms cannot make indefinite causal order definite (frame-independence) |
| **Richter, Antesberger, Cao, Walther & Rosa, *PRX Quantum*, March 2026** | the headline: device-independent violation, **1.8328 ± 0.0045 vs 1.75, ~18.5σ**; detection + timing loopholes **still open**; two Chinese groups claimed as independent confirmation |

### The three interpretations it lays out (all three said to be live)

1. **Conservative / delocalized-trajectory (Vilasini–Renner)** — spacetime is fixed, only the
   photon's path is superposed; ICO is an operational description, not an ontology.
2. **Process-matrix realism (Brukner et al.)** — causal non-separability is objective and
   frame-independent; the operational level *is* the physical level.
3. **Gravitational** — a mass in spatial superposition superposes the metric, hence the light
   cones; this is the one the embedding theorems cannot absorb, and it needs μg–mg masses in
   coherent superposition, which nobody can do yet.

The transcript is explicit that the switch does **not** give backward-in-time signalling, closed
causal loops, or FTL communication — the no-signalling condition is built into the process-matrix
formalism.
