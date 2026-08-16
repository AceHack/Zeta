# Skills as the second invariance case — "rigid against rephrasing" is a quotient, not a pointer

**Date:** 2026-08-14 · **Agent:** Aarav · **Register:** design study, no code changes
**Source:** Aaron 2026-08-14 (observation, not directive) — naming the *second* case of a pattern
whose first case is ace's version-invariant pointers:

> "the 2nd I know of is **agent prompts and skills** — they mutate so fast we need a **common
> linguistic seed** and an **update resolution protocol at agent AI speed** so remote copies of
> skills can evolve and **push back the changes and propose fixes if it breaks their local stuff**."

Every claim below is tagged **[CHECKED]** (I read the file / ran the command) or **[INFERRED]**
(reasoning on top of checked facts). Negative findings are in §9 and are load-bearing.

---

## 0. Answers up front

1. **"Rigid against rephrasing" is a genuinely distinct invariance class** — but not for the
   reason the framing suggests, and the naive version collapses. ace gets **invariance by
   independence** (free, referential, promises nothing about content). Skills have **no coordinate
   to be independent in**, because for a skill the payload *is* the meaning. So skills are forced
   into **invariance by quotient**, which is strictly harder and which nobody has a map for. §1.
2. **The common linguistic seed exists, and it is not a vocabulary — it is a residual code
   against a shared pretrained prior.** That is the strongest asset here. It does not suffice:
   it has already drifted, and it rests on a codebook nobody versions. §2, §3.
3. **Commutative semantic merge is not reachable for text skills.** A one-line theorem already
   in-repo refutes the single-operator version. It *is* reachable for a bounded claim layer, and
   the repo already tells you which fraction that is. §4.
4. **Local breakage is not automatically detectable today** — the skill library's entire
   automated instrumentation is a character counter. Behavioral eval is the only detector that
   can work, which makes this a **test-gated merge**, not a merge. §5.
5. **The design is not commutative-vs-judgment; it is a classifier over two lanes** (Aaron
   2026-08-14: *"this is where our **bft and further consensus** comes in … it genuinely needs
   multiple eyes to converge on the best answer for all involved"*). Deliberate latency is
   **correct** where judgment is genuinely required — the honest cost of a call multiple observers
   must weigh, not a performance failure. The load-bearing deliverable is the **classifier**, not
   either lane: both lanes already exist in this repo. §6.
6. **Pull-with-veto already exists in this repo, working, for a different subject**
   (`drift-proposer.ts` + `drift-ledger.ts`). The protocol shape is *reuse*, not invention. §7.

---

## 1. The rigidity question — distinct class, and provably harder

### 1.1 The standard this repo sets

`src/Core/Orbit.fs:29-31` **[CHECKED]** refuses the time-crystal label without rigidity:

> "a periodic orbit is not *ipso facto* a time crystal: the physics label requires *rigidity*
> (robustness to perturbation, spontaneous time-translation-symmetry breaking), which this does
> not check — `Crystal n` here means 'period-n standing wave,' the *candidate* for a time crystal,
> not a certified one."

So an invariance claim must name its perturbation group. Do that for both cases.

### 1.2 Two ways to be invariant

Let a perturbation group `G` act on artifacts.

**(I) Invariance by independence.** Identity lives in a coordinate `G` does not act on.
`ace:<signer>/<name>` would survive a version bump because the version is a *different
coordinate*. Cost: **zero**. Guarantee: **purely referential** — it promises nothing about
content, and that is deliberate. PR #10675 **[CHECKED]** is explicit that a version bump may
change behaviour arbitrarily, which is exactly why forced upgrade is refused there.

**(II) Invariance by quotient.** Identity is a *function of* the perturbed artifact, constant on
`G`-orbits: `meaning(rephrase(t)) = meaning(t)`. Cost: **you must exhibit the quotient map**.
Guarantee: **semantic**.

### 1.3 The measurement — why the naive reading collapses

90 days of `.claude/skills/` **[CHECKED]**, full history:

| quantity | count |
|---|---|
| commits touching `.claude/skills/` | 46 |
| distinct skill files touched | 557 |
| `-name:` lines (removals/renames) | **0** |
| `+name:` lines (additions) | 290 |
| `-description:` / `+description:` | 144 / 434 |
| body `+/-` lines | **41,342** |

Stability ordering, measured: **name (0) ≫ description (144 rewrites) ≫ body (41,342)**.

The skill `name` is *already* a perfect (I)-invariant — and it is enforced by the filesystem
(directory name = router key), not by anyone's discipline. So **if the skill pointer is the
name, rephrasing is merely a content change and it IS the same class as ace.** Collapse.

### 1.4 Why it does not actually collapse

That pointer is useless for what Aaron wants. The thing that must survive rephrasing is not the
skill's *address* but its *instruction content*.

For ace, pointer and payload are separable — the pointer names a package whose bytes live
elsewhere. **For a skill, the payload is the meaning and the meaning is the payload.** There is
no second coordinate to hide identity in. (I) is unavailable for the thing that matters, so you
are forced into (II). **[INFERRED, from the checked structure of both artifacts]**

**Verdict: distinct class.** ace needs invariance-by-independence (free, referential); skills need
invariance-by-quotient (costly, semantic). Aaron's "second case" reading is right, and the
difference is sharper than "second case": it is a second case of *needing an invariant*, in a
strictly harder class, and the reason is that skills have nowhere to be independent.

### 1.5 "Rephrasing" is not a named perturbation — it is at least four groups

This is where the rigidity standard bites. Decompose **[INFERRED]**:

1. **Lexical rephrase** — synonym swap, clause reorder, tightening. Meaning-preserving *by intent*.
2. **Scope drift** — the description widens or narrows what the skill claims to cover. **Not**
   meaning-preserving. BP-01 exists because the description is the *scope gate*; BP-02 exists
   because negative boundaries are the contract **[CHECKED, `docs/AGENT-BEST-PRACTICES.md`]**.
3. **Anchor drift** — the carved sentence holds, the citation beneath it rots.
4. **Counting / arity drift** — "six disciplines" → seven; "11 specifications" → 13.

**(1) and (2) are the same edit shape.** A synonym swap and a scope widening are both "a small
wording change". Therefore **"rigid against rephrasing" cannot be a text-level property**, and any
detector defined on text diffs is measuring (1)∪(2) and reporting it as (1).

### 1.6 The boundary that must be stated or this becomes metaphor

`tests/cross-verification/_harness/nway-diff.ts` **[CHECKED]** carries the honest peel verbatim:

> "the agent/intelligence is the FREE layer (not a time-crystal), only the DATA is the
> quasi-time-crystal."

Skills instruct the free layer. So a rigidity claim over skills is a claim about the *data
describing* the free layer, never about the layer's behaviour. Stated, so the metering test
(`the-anchor-taxonomy-beacon-discipline`) does not catch this doc as physics-as-metaphor.

---

## 2. What the common linguistic seed actually is

**[CHECKED] `docs/SEED-VOCABULARY.md` lines 3-7** state the principle explicitly:

> "an LLM already holds the standard concepts; a small **carved sentence** disambiguates Zeta's
> specific sense — like a skill-routing description." … "**Standard terms** (Markov chain, CRDT,
> DBSP, semiring, HMM, IFS, …) need no entry — you have them."

**The seed is not a vocabulary. It is a residual code.** The shared pretrained prior is the
**codebook**; the seed is the **correction term**. Standard terms cost zero bytes because the
codebook already carries them; only Zeta-coined/overloaded senses are transmitted.

That is the strongest thing in the repo for Aaron's ask, and it is why the seed can be ~1.5KB and
still align a fleet. It is also, precisely, an error-correcting-code framing — which lines up with
`only-the-irreducible-is-primitive` ("the generator IS the ECC") without needing a new coinage.

The same split appears twice more, both **[CHECKED]**:

- **Mirror/Beacon** (`.claude/rules/mirror-beacon-register-discipline.md`) — Mirror mutates fast in
  coined shorthand; Beacon is the same content compressed to anchored first principles. A
  mutate/rigid split by *register*.
- **Carved sentence / doc** (`rules-are-small-carved-sentences-pointing-to-docs.md`) — hub (stable)
  vs satellite (moves). A mutate/rigid split by *change rate*, explicitly DV2.0.

And it is already *implemented* twice: **BP-NN stable ids** (the ID is stable, the wording mutates,
and `skill-tune-up` cites the IDs so they are load-bearing) **[CHECKED]**; and the **23 category
routers + ~250 blueprints** structure (`find .claude/skills -name SKILL.md | wc -l` → 23)
**[CHECKED]**.

---

## 3. Why the seed does not suffice — three checked reasons

### 3.1 It has already drifted, and nothing noticed

**[CHECKED]** `docs/SEED-VOCABULARY.md`:

- line 102: "**the six always-active disciplines**" — `.claude/rules/dv2-data-split-discipline-activated.md`
  line 1 reads "**Seven** always-active substrate-engineering disciplines".
- line 112: "the **11 specifications**" — `docs/governance/MANIFESTO.md` has `### 12. Idempotency`
  and `### 13. Noninterference` as real headers.
- line 119 of **the same file** cites `.claude/rules/manifesto-13-specifications.md`.

**The seed contradicts itself seven lines apart.** Idempotency and noninterference were promoted
2026-06-10; the seed has carried stale arity for ~2 months, in the *most mechanically checkable
drift class that exists* (counting), inside one of the most-read files in the repo.

This is the empirical core of the whole study: **if counting drift survives two months undetected,
"semantic drift will be caught in review" is not a plan.** Filed as
`081M00TK5QG087G0R0031J243E`.

### 3.2 The codebook is an unversioned dependency

The seed's compression is only valid **relative to a fixed codebook**, and the codebook is model
weights. Different models — and different versions of the same model — carry *different* priors
for the terms the seed declines to transmit. **[INFERRED, and it follows directly from §2's checked
premise.]**

Nothing in the repo versions this. The seed says "you have them" without recording *who* "you" is.
This is the failure mode that bites precisely when Aaron's scenario arrives — remote copies of
skills evolving on different models — because the residual is decoded against a codebook that
silently rotated. Filed as `081M00TKDGG087G0R00271D93E`.

### 3.3 It is one-directional

`SEED-VOCABULARY.md` is published; there is no path for a remote copy to push a term *back*.
Aaron's ask is explicitly bidirectional ("push back the changes"). **[CHECKED — no inbound
mechanism exists in the file or its tooling.]**

---

## 4. Commutative semantic merge — refuted for prose, bounded for claims

### 4.1 The one-line theorem is already in-repo

`src/Core/BeliefConvergence.fs` **[CHECKED]**, verbatim:

> "An idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both
> redelivery-safe and retraction-capable. Auditable divergence lives in the Z-set delta log;
> redelivery-safety lives in the merge. **Two structures, forced by a one-line theorem, not by
> taste.**"

Apply to skills. Aaron wants (a) agent-speed propagation with redelivery over an unreliable path
⇒ needs an **idempotent** merge; and (b) "propose fixes", i.e. withdraw a bad instruction ⇒ needs
**retraction**. One operator cannot do both. **Any skill-sync design that is a single merge
function is already refuted, in this repo, before it is written.** Two structures are mandatory.

The same file also pins the multiplicity trap: `observe` is commutative but **not idempotent**, so
order-independence "makes this look safe and does not make it safe — the defect is in
MULTIPLICITY, not order." A skill protocol that leans on commutativity inherits that trap and
needs a caller-supplied dedup key.

### 4.2 The representational cost, stated plainly

For Z-set merge, edits must be assert/retract over a **shared vocabulary of atoms**, not text
replacement. A skill would become: a set of **claims** with stable ids (the BP-NN pattern, which
already exists and works), edits as `+claim` / `−claim` weights, and prose demoted to a
*rendering* of the claim set.

**The cost is that this destroys the thing that makes skills work.** A skill's efficacy is not the
union of its claims; it is the ordering, emphasis, worked examples, and tone contract — precisely
the **non-commutative** part. BP-01's own anchor (arXiv:2602.20426, cited in-repo **[CHECKED]**)
holds that description *wording* measurably changes agent selection accuracy. If wording is
load-bearing for behaviour, wording is not a rendering detail, and quotienting it away changes the
artifact's function rather than preserving it.

### 4.3 The bounded answer

Commutative merge is reachable **only over the fraction of a skill that is genuinely set-shaped**,
and the repo already partitions by change rate. Layer the merge on the partition that exists:

| layer | invariance | merge | evidence |
|---|---|---|---|
| **name** | (I), filesystem-enforced | never merges — it is the key | 0 mutations / 90 days **[CHECKED]** |
| **claim set** (BP-NN-shaped) | (II) over a fixed atom vocabulary | Z-set assert/retract | BP-NN ids already stable + cited **[CHECKED]** |
| **prose body** | none | **fork-and-render, never union** | 41,342 line-changes **[CHECKED]** |

**Verdict: reachable for the claim layer only; the prose layer is irreducibly non-commutative and
must fork.** The claim layer is also the only layer small enough to actually *be* a linguistic
seed. Filed as `081M00TK9YR087G0R001MQXA3C`.

**"Must fork" is not the end of the story, and §6 is where it stops being a dead end.** The
either/or this section implies — commutative representation *or* a latency-bearing resolution round
— is a false choice. The prose layer does not merge, but it does not have to fork *silently*: it
routes to a lane where multiple observers converge deliberately. §6 is that partition, and this
table becomes its Lane-1 admission criterion.

---

## 5. Is local breakage automatically detectable?

### 5.1 Today: no. The baseline is a character counter

**[CHECKED]** The skill library's *entire* automated instrumentation is
`src/Core.TypeScript/hygiene/audit-skill-description-length.ts` — `MAX_CHARS = 150`,
`PREFERRED_CHARS = 120`, plus a `FORBIDDEN_BOILERPLATE` regex list. It is a syntactic gate, it
does not claim to be more, and it cannot report semantic breakage. Detection today is **zero**.

### 5.2 Three candidate detectors and exactly how each fails

Per the discipline — eleven instruments were found this month that could not report what they
existed to report — each proposal states its failure mode first.

**(1) Text-diff / similarity threshold. Fails in both directions.** Lexical rephrase and scope
drift are the same edit shape (§1.5), so it fires on harmless rewording and stays silent on a
scope widening phrased in the same words. Worse, the tuning pressure is one-directional: an alarm
that nags gets its threshold raised until it is quiet. **This becomes an always-passes instrument
by ordinary maintenance, with no bad actor required.**

**(2) LLM-judge ("did the meaning change?"). Fails in the worst possible direction.** The judge
shares the prior with the skill's consumer. Rephrasing by an LLM drifts *toward* that prior — that
is what LLM rewriting does. So the judge scores prior-ward drift as *more* faithful, not less.
**The instrument is biased in exactly the direction of the drift it exists to catch, and it emits
a green signal while doing so.** That is strictly worse than no instrument. Note the sharp edge:
§2's whole premise is that Zeta senses *differ* from the prior, so drift-toward-prior is precisely
the loss the seed exists to prevent. This is the twelfth instrument; it should not be built.

**(3) Behavioural eval. The only one that can work — and it changes the protocol.** A
test-gated merge, not a merge. Honest costs:

- An eval is a **sample**: it detects breakage only on covered cases. "Silently gets a bit worse"
  is exactly the sub-threshold regime a sampled eval misses. This is the acknowledged residual
  risk, not a solved problem.
- Evals over LLMs are **stochastic**, so the gate needs a statistical decision or it flaps. The
  repo already has the right instrument family: `DecorrelationExcess` / excess-over-null
  (PR #10014, #10016) and the permutation-null family **[CHECKED, `docs/research/2026-08-04-*`]**
  — a null model plus an excess statistic, rather than a bare threshold.
- **Each eval must carry a demonstrated red.** A mutation test: deliberately break the skill,
  assert the eval goes red, keep that as a fixture. **An eval that has never been shown to fail is
  not evidence.** This is precisely the discipline the eleven instruments violated. Filed as
  `081M00TKDFM087G0R002T3KZN8`.

### 5.3 The asymmetry that makes this affordable

A remote copy does **not** need to detect breakage in general. It needs to detect breakage **of its
own local adaptation**. The local site knows what it changed and why, so it can carry an eval for
exactly its local delta. **Detection cost scales with local divergence, not with skill-library
size.** **[INFERRED]** That asymmetry is what makes pull-with-veto tractable where global semantic
diffing is not, and it is the reason the protocol in §6 is affordable at all.

---

## 6. The design — partition, don't choose. Two lanes and a classifier

§4 posed an either/or: a **commutative representation** (agent speed, no judgment) *or* a
**resolution round** (latency, the thing being avoided). Aaron 2026-08-14 rejected the either/or:

> "this is where our **bft and further consensus** comes in and our **dark-like objects that slow
> down time like gravity** cause it's genuinely needs **multiple eyes to converge on the best
> answer for all involved**"

The move is that **deliberate latency is correct where judgment is genuinely required.** It is not
a fallback and not a performance failure; it is the honest price of a call that multiple observers
must weigh. So the design is neither branch alone. It is a **classifier over edits, plus two
lanes.**

### 6.1 The same partition landed in this repo today, independently

`src/Core/QuorumAlgebra.fs` **[CHECKED]** is dated **Aaron 2026-08-14 — the same day** — and is
the identical move applied to quorums:

> "**two operations, named apart, because they are two algebras**" … "`AmplitudeEmu.merge` **sums**.
> A sum is not a join, and nothing said so — so **a single name was carrying two incompatible
> algebras and the caller could not tell which one they had invoked.**"
>
> - **`join`** — "idempotent, commutative, associative… Meaning: *independent evidence*, so the
>   same source twice counts once."
> - **`interfere`** — "**NOT idempotent** (`interfere a a = 2a`). Meaning: *distinct paths to one
>   outcome*, so opposite-phase contributions annihilate."

That is Lane 1 and Lane 2, already named, already shipped, for a different subject. The skill
problem is not a new architecture — it is a second caller of a partition Aaron made today
elsewhere. **[CHECKED for the file; [INFERRED] that the two are the same move.]**

### 6.2 The two lanes

**Lane 1 — commutative (agent speed, no judgment).** Edits expressible as assert/retract over the
shared claim vocabulary (§4.3) merge with no round: vocabulary additions, pointer/citation updates,
adding a section, adding an example. This is `join` — idempotent, so redelivery is free, which is
what makes it safe at agent speed over a store-and-forward path.

**Lane 2 — the judgment lane (deliberate dilation).** Edits that cannot be so expressed — two
agents rewording the same instruction to mean different things — enter a region where convergence
**deliberately dilates** and multi-observer consensus runs. This is where "multiple eyes" is the
*correct* cost.

### 6.3 The load-bearing deliverable is the classifier

Both lanes are known technology; **what nobody has is a sound rule for which edits are
commutative-representable.** State the failure asymmetry first, because it dictates the design:

| misclassification | consequence | recoverable? |
|---|---|---|
| judgment-needing edit → **Lane 1** | **silently unions two incompatible meanings** | **No — it converges and is wrong, and it is green** |
| mergeable edit → **Lane 2** | latency | Yes — visible, merely slow |

The asymmetry is total. **Therefore: unsure ⇒ Lane 2.** The classifier must be **sound for Lane 1**
(never admits a non-commutative edit) and is permitted to be **incomplete** (may over-refer to
Lane 2). An over-referring classifier is slow; an under-referring one is silently wrong. Choose slow.

### 6.4 What makes the classifier sound: structure, not meaning

The classifier's input is **the structural form of the edit against the claim set — never its
meaning.** It must never ask "did the meaning change?", the question §5.2(2) proved is
unanswerable by any judge that shares the consumer's prior. It asks only decidable questions:

**Lane 1 admits exactly** (all mechanically decidable, no model in the loop):

- `+claim(id, body)` with a **fresh** id — pure monotone addition, no existing id touched.
- `−claim(id)` issued by the claim's own author-site — retraction as correction.
- a pointer/citation update on a claim whose id **and** body text are unchanged.
- an added example/section that no existing claim references.

**Lane 2 is required whenever:**

- two sites `+claim` the **same stable id** with different bodies (collision on the id).
- a `−claim(id)` from site A collides with an edit to the same id from site B.
- the edit touches a claim that another claim **cites** (BP-NN cross-references) — the dependency
  check.
- the edit is in the **prose body** at all (never Lane 1, per §4.3).

**The honest limit, and it is the whole soundness argument:** the classifier is sound **exactly to
the extent that the edit type is *derived from structure* rather than *declared by the editor*.**
An agent that makes a semantic change while reusing an id and labelling it "pointer update"
defeats a declaration-based classifier completely. Same-id-different-body, cross-reference
existence, and claim-vs-prose region are all *derivable*. Anything only *declared* is unsound and
must route to Lane 2. **This is why the claim layer (§4.3) has to be a real parseable format with a
machine-checkable boundary, not a naming convention** — the convention version cannot be
classified soundly, and a classifier over a convention is the twelfth instrument in a new costume.

Filed as `081M00TS219087G0R0016S5PMC`.

### 6.5 Bayou is the direct prior art — this shape is known-good, not invented

**Terry, D. B. et al. (1995), *Managing Update Conflicts in Bayou, a Weakly Connected Replicated
Storage System*, SOSP '95, pp. 172–183.** Every Bayou write carried two application-supplied
pieces: a **dependency check** and a **merge procedure**. Bayou did this *precisely because
syntactic merge was unsound for application semantics* — the same conclusion §4 reaches from
`BeliefConvergence.fs`'s theorem, thirty years earlier and from field experience.

The mapping is direct and should be stated so this reads as engineering:

| this design | Bayou (1995) |
|---|---|
| the classifier's decidable questions (§6.4) | **dependency check** |
| Lane 1 assert/retract join | automatic merge, no conflict |
| Lane 2 multi-observer round | **merge procedure** / manual conflict resolution |
| local eval as veto gate (§5.3) | dependency check failing at the replica |

So "classify then route" is a **known-good shape**, not an invention. Pair with **Shapiro et al.
(2011)**, *A Comprehensive Study of CRDTs*, INRIA RR-7506, for Lane 1's algebra.

**Operational Transformation — mentioned and rejected, with reason.** Ellis & Gibbs (1989),
*Concurrency Control in Groupware Systems*, SIGMOD. OT is the obvious alternative for Lane 1 and it
is the wrong tool here: OT transforms *operations on character positions* so that concurrent edits
converge to one string. That guarantee is orthogonal to the one needed — §7 — and worse, OT's
convergence is exactly the "silently unions two incompatible meanings" failure of §6.3, delivered
deterministically and with a green light. OT would make the worst misclassification *invisible*.
Rejected on that ground, not on complexity.

### 6.6 Metering the gravity anchor — applying Aaron's own metering test to Aaron's own phrase

Repo discipline (`anchor-to-human-prior-art`; the anchor-taxonomy doc) is that **physics anchors
ground the *metering*, not the imagery.** So "slows down time like gravity" ships only if a
dilation factor can be computed. Apply the test honestly, in both directions.

**What survives — a computable dilation factor.** From `Consensus.quorumThreshold` **[CHECKED]**:

```
t(n) = 2*((n - 1) / 3) + 1        // integer division; the classical BFT 2f+1
```

Lane 1 commits on **1** tick (idempotent join, no round). Lane 2 cannot commit until `t(n)`
independent observers have voted. Define the dilation as the ratio of the two, in **ticks** (the
`drift-ledger` tick, §7 — never wall-clock):

```
D(n) = ticks_to_converge(Lane 2) / ticks_to_converge(Lane 1)
     = E[ticks until t(n) distinct sources have voted]      // Lane 1 denominator = 1
```

`D` is monotone increasing in `n`, grows ≈ `2n/3`, and is computable from the observer count a
change requires. **The mechanism is real and meterable, so the latency claim is earned.**

**What does not survive — the word "gravity."** Gravitational time dilation has a specific metric
form (`√(1 − r_s/r)`) and a specific cause (spacetime curvature). `D(n)` is **combinatorial** — it
comes from quorum size, not from a metric. The two share only "dilation increases with local
concentration." So:

- **[peel]** The literal claim is **correct and is not softened**: some skill edits genuinely
  require multiple independent observers, and the resulting latency is the honest price of
  correctness, not a defect. That stands on its own.
- **[peel]** "dark-like objects that slow down time like gravity" is **Mirror-register imagery that
  does not survive Mirror→Beacon compression.** The structural content that *does* survive is
  weaker and precise: **dilation monotone in the local density of contestedness.** That is an
  analogy at the level of monotonicity, not a metric theory, and it must not be cited as physics.

Per the discipline, the mechanism is kept and the picture is retired. This is the metering test
catching physics-as-metaphor in the phrase of the person who wrote the rule — which is the rule
working, not a disagreement.

### 6.7 Lane 2 already exists — it is a caller, not a subsystem

**[CHECKED]** `src/Core/` contains `Consensus.fs`, `QuorumAlgebra.fs`, `SybilBft.fs`,
`SybilBftProtocol.fs`, `SybilBftLiveness.fs`, `SybilBftProgress.fs`. `Consensus.decide`
**[CHECKED]** implements BFT `2f+1` quorum over votes grouped by value, returning
`Committed(value, quorum, total)` / `Rejected(reason, votes, total)`.

**This materially shrinks the proposal: Lane 2 is a caller of existing primitives, not a new
subsystem.** The skill work is the claim format (§4.3), the classifier (§6.4), and the eval (§5.2),
none of which are consensus code.

### 6.8 Carrying the local-time rule into Lane 2 — and a live finding

A dilated convergence region is **exactly** where someone will add a wall-clock timeout that
filters evidence ("drop votes older than N seconds before deciding"). That is the divergence bug
`local-time-never-enters-the-shared-fold` exists to prevent: every node's receive-time differs, so
a wall-clock filter makes nodes fold different vote sets and diverge **by construction**.

Lane 2's round must therefore be bounded in **ticks** (`drift-ledger`'s ledger-derived tick, §7),
never in seconds. Wall-clock may gate a *local* action — "I will stop waiting and mark this
unresolved **to me**" — but must never filter the evidence entering the shared decision.

**Live finding [CHECKED].** `src/Core/Consensus.fs:12` defines
`Vote<'T> = { Node; Value; Timestamp: DateTimeOffset }`. `Timestamp` is written at two construction
sites (lines 109, 158) and **read nowhere** — `decide` groups by `Value` and counts, so local time
does **not** currently enter the fold. **The rule holds today.** But the field is a **write-only
wall-clock carried inside the vote type** — one `List.sortBy (fun v -> v.Timestamp)` or one
"drop stale votes" line away from the exact divergence this rule forbids, sitting in the primitive
Lane 2 would call. Filed as `081M00TS225087G0R0025801ZR`; the fix is to remove the field or
document it as metadata-only the way `drift-ledger.ts` explicitly does for its ISO timestamp.

---

## 7. The pull-with-veto protocol — it already exists

The significant finding: **this repo already runs a working pull-with-veto loop for a different
subject.** Do not invent a second one (`only-the-irreducible-is-primitive`).

`src/Core.TypeScript/hygiene/drift-proposer.ts` **[CHECKED]**, verbatim:

> "selection that persists becomes a **PROPOSAL, never a change**" … "**Evolution proposes; the
> society disposes. This module NEVER writes the registry.**" … "At-most-once per phenotype: the
> letter is keyed by the CANONICAL genome hex — `toHex(encode(decode(genome)))`, the
> `gen(gen)==gen` fixed point" … "Written with the `wx` flag: **a declined proposal is never
> nagged**; a DIFFERENT phenotype may propose later."

Every clause Aaron asked for is there: proposal-not-push, no upstream write, idempotent proposal
identity, and **a durable veto** (`wx` — declined once, never re-raised). Hysteresis is over K
consecutive **ticks**.

`src/Core.TypeScript/hygiene/drift-ledger.ts` **[CHECKED]** supplies the clock discipline the
constraint demands:

> "MTTH … is **TICK-INDEXED, not wallclock-indexed**" … "next = max existing + 1 — derived from the
> ledger itself, **no ambient clock in the math**; the ISO timestamp is carried as metadata only"
> … "the fold is a deterministic function of the event set (DST; same evidence ⇒ same report, per
> the two-orders rule: **local wallclock never enters the fold**)."

So `local-time-never-enters-the-shared-fold` is satisfied **by construction, in shipped code**.
"Newest wins" is structurally unavailable here, which is the correct outcome.

### 7.1 Protocol shape

- **Pull, never push.** Upstream publishes; it never writes a downstream copy. Matches #10675
  **[CHECKED]**: "a grant a third party could write is a forced-upgrade path wearing a maintenance
  hat."
- **Identity = name** — the measured 0-mutation invariant (§1.3), never the version.
- **An upstream change arrives as a proposal**, keyed by canonical content hash: idempotent,
  at-most-once, replay-safe.
- **The proposal is classified before it is routed** (§6.4). Lane 1 ⇒ merges on arrival at agent
  speed. Lane 2 ⇒ enters the dilated multi-observer round. **Unsure ⇒ Lane 2** (§6.3); the
  classifier's incompleteness costs latency, its unsoundness would cost correctness.
- **The local gate is the local eval** (§5.3 asymmetry). Red ⇒ **local veto** — in *either* lane.
  A Lane-1 edit is commutative at the representation level and can still break a local adaptation;
  commutativity buys merge-safety, not fitness-for-this-site.
- **The veto is durable and silent** — declined once, never nagged (`wx` semantics). This is what
  makes it non-coercive rather than merely polite.
- **The veto carries a counter-offer** — the local site publishes its repair *as another proposal
  upstream*, the same type in the other direction. Upstream may in turn veto. **Nobody picks a
  winner.**
- **Divergence is a first-class recorded state, not a failure.** Both copies persist; the ledger
  records the fork.
- **Ordering by tick, never wallclock** — in both lanes, and especially in Lane 2's round (§6.8).
  Obsolescence — a copy nobody pulls — is the only pressure, per Aaron 2026-08-14.

Filed as `081M00TK9ZK087G0R000TS9BK9`.

### 7.2 Cold-start cost: zero

Everything above lives in `src/Core.TypeScript/hygiene/` and `docs/` — **not** in the startup set.
No resident byte is added, so the cold-start tax
(`rules-are-small-carved-sentences-pointing-to-docs`) is not paid. The only resident edit this
study recommends is correcting two stale numerals in `SEED-VOCABULARY.md` (§3.1), which is
byte-neutral. A protocol that fattened the resident surface would pay that tax on every wake by
every agent, forever; this one does not.

---

## 8. Prior art (Beacon) — named, and its limits named

**Bayou** (Terry et al., SOSP 1995) is the direct structural anchor for the whole design and is
treated in §6.5, where the dependency-check / merge-procedure mapping belongs. This section covers
the *rejected* and *adjacent* lineages.

The mechanical half of text convergence is solved and is **not** what this needs:

- **Operational Transformation** — Ellis & Gibbs (1989), *Concurrency Control in Groupware
  Systems*, SIGMOD; Ressel et al. (1996), adOPTed, CSCW.
- **CRDT text** — Oster et al. (2006), WOOT; Weiss et al. (2009), **Logoot**; Roh et al. (2011),
  **RGA**; Shapiro et al. (2011), *A Comprehensive Study of CRDTs*, INRIA RR-7506; **Yjs**
  (Nicolaescu et al., 2016); Kleppmann & Beresford (2017), JSON CRDT.

**Explicitly: these converge *characters*, not *meaning*.** Two agents that each reword the same
instruction get a deterministically merged *string* from RGA/Logoot — and that string may assert
something neither agent intended. Character convergence is not a partial solution to semantic
convergence; it is an orthogonal guarantee that can silently manufacture a third meaning. This is
the precise reason §4 pushes the merge down to a claim layer instead of adopting CRDT text.

Adjacent, honestly labelled as *not* the same problem: **semantic versioning** (Preston-Werner) is
a publisher's *self-declared* compatibility promise, unverified — the same shape as the ace
capability manifest's self-declaration (#10675), and it carries no detector. **Contract testing**
(Pact / consumer-driven contracts, Robinson 2006) is the closest real analogue to §6: the
*consumer* holds the test that gates the *provider's* change. That is genuinely the right lineage
for pull-with-veto and it should be cited as such rather than re-coined.

Nothing in this doc is a new coinage: (I)/(II) are quotient vs. product structure; the two-lane
split is Bayou's dependency-check/merge-procedure partition (§6.5) over `QuorumAlgebra`'s
already-named `join`/`interfere`; and the protocol is consumer-driven contract testing over an
existing proposer/ledger. The only thing without a citation is the *classifier's admission rule*
(§6.4), and that is stated as a conservative engineering choice justified by a failure asymmetry,
not as a result.

---

## 9. Negative findings — what I could not verify

Stated because the ask required CHECKED-vs-inferred throughout, and because a study that only
reports confirmations is an instrument that cannot fail.

1. **No `forked` verdict and no "delta-rotation ledger" exist on `origin/main`.** Repo-wide grep
   over `.fs`/`.ts`/`.md` **[CHECKED]** returns only GOVERNANCE prose about forked branches, a
   test fixture string in `ZetaToolStore.Tests.fs`, and unrelated docs. Either it is in-flight in
   a clone not yet merged, or it is named differently. **I did not assume it exists and built
   nothing on it.** The nearest *real* machinery is `drift-ledger.ts` + `drift-proposer.ts`, which
   I did verify and which supply the same never-pick-a-winner shape.
2. **PR #10675 is `feat(ace): signed capability manifest`**, not a version-invariant-pointer PR
   **[CHECKED via `gh pr view`]**. It does contain the no-forced-upgrade principle verbatim, which
   is why it is cited in §6.1. The literal pointer form `ace:<signer>/<name>` **does not appear in
   `src/Core.TypeScript/ace/`** **[CHECKED]**; the only `ace:` hits are log messages. The §1.2
   description of ace-side invariance is therefore **[INFERRED]** from the ask's framing, and the
   §1 argument deliberately does not depend on it — it depends on the *measured* skill-side
   numbers in §1.3.
3. **The 90-day skill metrics come from the shared checkout's full history**, read-only
   (`git log`), because my clone is shallow. Read-only use of the shared checkout is its stated
   purpose; no writes were made there.

---

## 10. Work-items minted

| ZetaId | Type | Title |
|---|---|---|
| `081M00TK5QG087G0R0031J243E` | bug | SEED-VOCABULARY stale arity — six/11 vs seven/13, self-contradicting |
| `081M00TK9YR087G0R001MQXA3C` | task | Skill claim layer — BP-NN-shaped stable-id claims as the only Z-set-mergeable fraction |
| `081M00TK9ZK087G0R000TS9BK9` | task | Point drift-proposer at the skill library — pull-with-veto on the tick-indexed ledger |
| `081M00TKDFM087G0R002T3KZN8` | task | Skill eval with a demonstrated red — mutation-tested gate or it is the twelfth instrument |
| `081M00TKDGG087G0R00271D93E` | task | Version the codebook the seed compresses against |
| `081M00TS219087G0R0016S5PMC` | task | **The lane classifier** — derive edit type from structure, not declaration; unsure ⇒ Lane 2 |
| `081M00TS225087G0R0025801ZR` | bug | `Consensus.Vote` carries a write-only `DateTimeOffset`, one `sortBy` from the shared fold |

Suggested order: the two **bugs** first — both are receipts, both cost minutes, and
`081M00TS225087G0R0025801ZR` removes a live foot-gun sitting in the primitive Lane 2 would call.
Then the **claim layer** (`081M00TK9YR087G0R001MQXA3C`), because the classifier cannot be sound
over a naming convention (§6.4) — the format is its prerequisite. Then the **classifier**
(`081M00TS219087G0R0016S5PMC`), the load-bearing deliverable. Then the **eval-with-a-red**
(`081M00TKDFM087G0R002T3KZN8`), which gates §7 — without it the protocol is a merge wearing a
test's hat. Then the proposer wiring, which by then is mostly configuration. The **codebook** item
is the deepest and least urgent, but it is the one that decides whether any of this survives
contact with a second model.

**What this study did *not* need to build, and that is the main result:** Lane 1 (`QuorumAlgebra.join`),
Lane 2 (`Consensus` / `SybilBft*`), the proposal/veto loop (`drift-proposer.ts`), and the
tick-indexed clock (`drift-ledger.ts`) all already exist and were all verified. The genuinely new
work is a parseable claim format, a structural classifier over it, and an eval that has been shown
to go red. Everything else is a caller.
