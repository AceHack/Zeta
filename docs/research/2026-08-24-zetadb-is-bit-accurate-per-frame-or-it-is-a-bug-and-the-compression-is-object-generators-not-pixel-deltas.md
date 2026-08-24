# ZetaDB is bit-accurate per frame or it is a bug — and the compression is object generators, not pixel deltas

**Date:** 2026-08-24
**Status:** the **invariant** is `unmetered` and cheaply promotable — §3 is the falsifier and it does not exist yet. The **compression design** is `toy`; Aaron: *"the efficient part is still to come."*
**Origin:** Aaron, 2026-08-24.

---

## 1. The stated invariant

> *"I designed the zetadb to be **bit accurate per frame for any emulator** — if it can't be, it's a bug. This was the point. In-memory emulator frames could be stored on disk and persisted in an efficient fashion."*

**"If it can't be, it's a bug" is an invariant, not an aspiration** — it names a class of defect rather than a hope. That makes it falsifiable, which makes it exactly the kind of claim this repo requires a test for.

**A measurement I got wrong, corrected here rather than quietly.** I first reported that `bit.accurate` appears in **1 file** and concluded *"the design goal Aaron calls 'the point' is essentially unwritten."* **That was false — the pattern was too narrow.** The concept is pervasive under other spellings:

| spelling | files |
|---|---|
| `byte-identical` | **606** |
| `byte-for-byte` | 260 |
| `bit-perfect` | 103 |
| `bit-identical` | 49 |
| `bit-for-bit` | 46 |
| `bit-exact` | 37 |
| **`bit-accurate`** | **1** |

Aaron expected 5–10 and was **low, not high**. The dominant term is *byte-identical*; only the phrase is rare. (This is the seventh instance in one session of a narrow pattern producing a false "absent" — see `list-the-directory-before-grepping-for-structure`.)

**What IS absent is narrower and still worth stating:** no **frame-level round-trip test** for ZetaDB. Searched `*.test.ts`/`*.Tests.fs` for a test that persists a frame, reloads it, and compares byte-for-byte — none found. `content.based compression` / `semantic compression` genuinely return **0**. So the invariant is well-*stated* across the corpus and un-*enforced* at the frame boundary.

## 2. Why the invariant is load-bearing rather than a nicety

Bit-accuracy is what makes every downstream property available:

- **DST replay** needs the frame to be a function of the state, not of the run.
- **Content addressing** needs bit-identity — a frame that differs by one pixel between runs has an unrelated hash, so dedup collapses to nothing.
- **The compression in §4 is only possible if recomputation is exact.** Approximate recomputation is a lossy codec; exact recomputation is a *generator*. Those are different objects, and only the second can be byte-locked.

So bit-accuracy is not one property among several. **It is the precondition for the store being a store rather than a cache.**

## 3. The falsifier that should exist and does not

Cheap, obvious, and absent:

> Run an emulator N frames. Persist each frame through ZetaDB. Reload. **`cmp` byte-for-byte against the in-memory frame.** Any divergence is the bug the invariant names.

Strengthenings, in cost order: same seed across two processes; across two machines; across the four language oracles (which is where a float or a collation difference would surface, exactly as `081KT07NV0008QG0R001YDB73K` did for `ZSet.ofSeq`); and after a store round-trip through a *different* store version.

**This promotes the invariant from `unmetered` to `metered` for the cost of one test.** Until it exists, "bit-accurate" is an assertion — and this repo's standing position is that an unenforced guarantee looks exactly like an enforced one to everybody downstream.

## 4. The compression is not a codec — it stores generators

> *"The efficient part is still to come. It requires **merkle-root-like behaviour over video codecs for content-based compression over video**. Different than like MJPEG, cause this is not just the deltas — it's **the objects in the scenes** that are captured **and their generator functions**, so each frame can be **recomputed from object composition and physical rules**."*

The distinction from existing codecs is categorical, not incremental:

| approach | stores | space |
|---|---|---|
| **MJPEG** | each frame, independently compressed | pixel |
| **MPEG-style** | motion-compensated **deltas** between frames | pixel |
| **this** | **objects + their generator functions + physical rules** | **semantic** |

A delta codec answers *"how do these pixels differ from those pixels."* This answers *"what is in the scene, and what rule moves it"* — and then **recomputes the pixels**. The description is tiny relative to its output, which is where the compression comes from; the ratio is bounded by scene complexity rather than by frame rate or resolution.

**And crucially it is EXACT, which no lossy codec is.** Because the emulator is deterministic, recomputing from the generator reproduces *the bits*, not an approximation of them. That is only true if §1's invariant holds — which is the second reason §3's test is the prerequisite for this work, not a parallel task.

**"Merkle-root-like" is the dedup mechanism:** content-address the object composition, and two frames with identical object state hash identically and are stored once. Cyclic and idle scenes — an enormous fraction of emulator frames — collapse. This is the frame-level form of what `docs/research/2026-06-09-content-addressing-rooms-give-free-deduplication-of-the-chip8-memory-to-worldview-state-space.md` established for CHIP-8 memory.

## 5. This is one move, made three times

The frame store is the same operation as two others recorded the same day (`docs/research/2026-08-24-the-etymology-attack-*.md` §6, §7):

| domain | stored | derived |
|---|---|---|
| build / dependency state | the generator (Futamura, type providers, Roslyn, ShivaGC) | the graph, on demand, collectable |
| a moving heap object | a **path from a stable root** (GC trace ≡ pointer scan ≡ Merkle path) | the object's current location |
| **an emulator frame** | **objects + generator functions + rules** | **the pixels** |

**Store the generator, derive the artifact.** That is `only-the-irreducible-is-primitive-generate-the-rest` at three scales, and it is why these are one programme rather than three projects.

**And the CHIP-8 / ISR orbit reversal is how the objects are OBTAINED.** Decomposing a heap into *"non-DMA orbits based on characters and objects in the game"* produces exactly the object inventory whose generators §4 needs. The reverse-engineering is not adjacent to the compression — **it is its input stage.**

## 5b. The whole DB in one sentence — and three of its four parts are already carved

Aaron, same conversation:

> *"**bit accurate** plus **FoundationDB and TigerBeetle-like deterministic simulation testing** standard, and **degrees of parallelism = 1 and everything still works — scale-free, can scale up to infinite DoP** — is our DB in a nutshell, **plus DBSP semantics**."*

Four parts, measured on `origin/main`:

| part | in-tree | status |
|---|---|---|
| bit-accuracy | 606 `byte-identical` + variants | stated everywhere, **unenforced at the frame boundary** (§3) |
| DST, FoundationDB/TigerBeetle standard | `foundationdb` 141 · `tigerbeetle` 38 · `deterministic simulation` 239 | carved (manifesto §7) |
| DoP=1 works, scales to ∞, same code path | `DoP` 1,547 · `scale-free` 349 | carved — [`async-all-the-way-truthful-signatures`](../../.claude/rules/async-all-the-way-truthful-signatures.md) states it almost verbatim |
| DBSP semantics | `DBSP` 1,284 | the substrate |

**So the sentence is a compression of things already carved, with one exception — and the exception is the one this document is about.** Three parts have rules and consumers; bit-accuracy has 606 mentions and no frame-level falsifier. That asymmetry is the finding.

## 5c. The payoff is a generator library, and it amortises

Aaron: *"this is step one to emulator replay compression — hopefully we end up with a whole library of similar shapes/generators over object properties."*

**The generator library is a shared codebook, and that changes the economics.** A ball with a velocity, a paddle constrained to one axis, a sprite under constant gravity, a counter that increments on an event — these recur across titles. Once a generator is in the library, every later title that contains that shape stores a *reference plus parameters* rather than a new generator.

So compression is **not per-title flat**: the first title pays to discover its shapes, the hundredth mostly matches existing ones. **The asset being built is the library, not any individual compression result** — which also means the right early metric is *how many shapes recur across titles*, not the ratio achieved on one.

**And it is the same structure as the anchor sets elsewhere in this repo:** a small stable vocabulary that many things compress *to*, where the value is in the reuse rather than in any single compression. `unmetered` — no library exists, no cross-title recurrence has been measured, and whether emulator objects recur enough to amortise is exactly the open empirical question.

## 6. Honest limits

- **Object decomposition may not be possible for every title.** A game whose state is genuinely chaotic, or whose objects have unbounded orbits, has no compact generator. The claim is not that all frames compress; it is that emulator frames are *unusually* amenable because the machine is small and deterministic.
- **Generators can be larger than deltas.** For a scene changing in a way the object model does not capture, the description may exceed the pixels it produces. A real implementation needs a **fallback to raw**, and must measure rather than assume which wins per title.
- **"Physical rules" for an arbitrary emulator is not a small ask.** For CHIP-8 it is plausible; for an Atari with undocumented behaviour it is a research problem. Say which machines are in scope.
- **Nothing here is measured.** No bit-accuracy test exists, no object decomposition has been demonstrated end-to-end, no compression ratio has been observed. §3 is the cheapest step and the one that unblocks the rest.

## 7. What is actually measured — and why expert success is not evidence of mechanisability

Aaron, asked directly about §6's "nothing here is measured":

> *"yes, nothing is measured other than the CHIP-8 — we have a few easy orbits detected. I've spent years working on the latest games as they come out to hack them; it's instinct for me to think this is possible cause I can always do it manually with enough effort. **But it's not measured to be mechanisable.**"*

**That last clause is the whole epistemic status of this document, and it is his own distinction, not an outside critique.** Two claims usually collapsed into one:

| claim | evidence | status |
|---|---|---|
| *the objects and orbits are there to be found* | years of manual reverse-engineering across many titles, by a practitioner | **strong** |
| *finding them can be MECHANISED* | a few easy orbits detected in CHIP-8 | **weak — one small case** |

**An expert succeeding with unlimited effort establishes that the problem is solvable in principle. It says nothing about whether the method is automatable.** The expert is applying judgement that has not been externalised — which is precisely why "can a machine do it" is a different question, and the harder one.

This is the repo's recurring theme pointed at its own author's instinct: the increment graph nobody can hold, the knowledge externalised to lectures, the coincidence-index that stores resonance without evidence. **A practitioner's confident intuition is a high-quality hypothesis source and not a result** — exactly the dual-use status `numerology-vs-number-theory` assigns to coincidence, and Aaron applies it to himself here unprompted.

### The falsifier that separates the two claims

The discriminator has to exclude the expert's own annotation, or it measures the annotation rather than the mechanism:

> **An automated pass detects orbits on a title the practitioner has NOT personally reverse-engineered, with no hand-supplied object list — and the orbits it reports are then confirmed independently** (by the emulator, not by asking him whether they look right).

Weaker forms that would NOT discharge it, and are easy to mistake for it:

- Detecting orbits Aaron already annotated. That measures agreement with a label he supplied.
- Detecting orbits in CHIP-8 only — **but see §7b, which corrects why.** My first phrasing here said success in CHIP-8 is *"consistent with the problem being trivial at that scale"*. That is wrong about the platform choice and is corrected below.
- Detecting *some* objects. Partial decomposition does not compress — §4's generators need the scene, not a sample of it.

### 7b. Why CHIP-8/CHIP-9 — the platform was chosen for being at the EDGE, not for being easy

Aaron, correcting the caveat above:

> *"CHIP-8 and our CHIP-9 derivative were chosen to test the limits of **superdeterminism**, where you can reason about **all possible spaces** in a game and come to **general conclusions**. Even for CHIP-8 this likely requires massive GPUs — like an array of latest consumer graphics cards — to make it tractable. **Every newer generation makes general conclusions less tractable.** This is why this is an ideal arena for theory."*

**So CHIP-8 is not the easy case. It is the largest machine where "reason about everything" is on the table at all** — and even there, exhaustively is expensive enough to want a GPU array. That reverses the implication I drew.

**Two distinct programmes were conflated in §7, and they scale in opposite directions:**

| programme | question | scaling |
|---|---|---|
| **Mechanised orbit detection** | can a machine find the objects in *this* running title? | **bigger machines are the harder test** — §7's falsifier is right for this one |
| **Superdeterministic general conclusions** | can we reason over *all possible states* and conclude something general? | **CHIP-8 is already at the edge**; every newer generation is *less* tractable |

For the second, **exhaustive reasoning does not scale up**. CHIP-8 → Atari → NES leaves the only regime where exhaustion is possible, which is precisely what makes CHIP-8 *"an ideal arena for theory"* — the theory needs a machine small enough to be exhausted and rich enough to be interesting, and CHIP-8/CHIP-9 was picked to sit on that line.

**But the ladder is not a dead end, and my first phrasing ("scaling up is scaling away") was too pessimistic.** Aaron:

> *"I'm hoping we use techniques learned from the smaller to make the larger more tractable **with less watts**."*

**What does not transfer is the exhaustion; what transfers is what the exhaustion taught you.** Exhaust CHIP-8, learn which decompositions hold, which approximations are safe, which object shapes recur — then carry those to a machine you can never exhaust. On the larger machine you are not reasoning over all states; you are applying structure whose validity was *established* where all states were reachable.

**This is §5c's generator-library argument one level up.** There, a shape learned on one title makes the next title cheaper. Here, structure learned on one *machine* makes the next machine tractable. The asset is the same in both cases: **a vocabulary of validated shapes, amortised across everything that comes after.**

**And "less watts" is the right metric, not "faster."** Energy per unit of analysis is measurable, it is the honest currency for a method whose alternative is brute force, and it makes the claim falsifiable: *techniques learned on CHIP-8 reduce the joules needed to reach a given confidence on Atari, versus not having them.* That is a comparison someone can actually run. It is also the same denominator as the novelty work — ΔU per available compute — rather than a new idea.

**Unmeasured:** no technique has yet been transferred from CHIP-8 to a larger machine, and no watt-comparison exists. The ladder is a plan with a stated metric, which is better than a plan without one and is not a result.

**Not a coincidence — one regime, used deliberately in both places.** I first recorded the `superdeterminism` overlap as a shape match worth watching. Aaron settled it:

> *"I use superdeterminism plus seed correlation to explain many of our S=4 results, cause **we are not violating any causality — we are working with the regime that circumvents them.** This is why **decorrelation is our scarce resource, not correlation**. We start at S=4."*

**The mechanism is measurement independence, and naming it is what makes this not hand-waving.** Superdeterminism does not beat Bell by signalling or by breaking causality. It beats it by denying the **measurement-independence** (free-choice) assumption — that the measurement settings are statistically independent of the hidden variables. Deny that, and S = 4 is reachable with no causal violation whatsoever.

**An agent fleet from a common seed literally lacks measurement independence.** What each agent examines and the prior it examines with have a *common cause* — the seed. So S = 4 is not a violation the system commits; **it is the assumption failing by construction, which is the starting condition.** The same is true of a deterministic emulator, and for the same reason: nothing in it is independently free.

**Hence the inversion that organises the whole project.** Most distributed systems spend effort *acquiring* correlation — consensus, agreement, synchronisation. This one begins fully correlated and spends effort *escaping* it. That is why `ρ = 1/(1+L)` buys decorrelation with **delay**, why *"the delay that resolves the check has to come from outside the seed"*, and why correlated agents are *"one closed loop in N masks"* rather than an ensemble. (Already stated in `docs/VISION.md` and three research docs — recorded here for the link to the emulator case, not as a new claim.)

**Measured gap worth flagging:** `S=4` appears in **313 files** and `superdetermin*` in **119**, but **`measurement independence` in 5**. The regime is used pervasively; the assumption it actually denies is barely written down. That is the thin part of an otherwise well-covered idea.

**What is still NOT established:** that the emulator case and the ensemble case share a regime does **not** mean results transfer between them. Exhaustive reasoning over a 4 KB machine and Condorcet accuracy over N agents are different problems that happen to sit in the same corner of the correlation axis. Per `numerology-vs-number-theory`, the shared regime is structural; **transfer of results is unclaimed** — but see §7c, which names where the claim would be made. (`chip9` appears in 180 files.)

### 7c. Transfer here is ALGEBRAIC, not empirical — and that makes it decidable

Asked where transfer is meant to come from, Aaron:

> *"For transfer learning look at our **WSets and universal tensor** and apply it over **different algebras** and **Cayley–Dickson imaginary stack doublings** — this is where we are trying to get a hold on transfer learning. And I've only mentioned transfer learning maybe 5 times since the start of the project, most of them recent."*

**His estimate is close and the asymmetry is the finding.** `transfer learning` appears in **3 files** (a memory note, `src/Core/Persona.fs`, `src/Core/TrustCalculus.fs`) — **none in `docs/research/`**. Meanwhile the machinery is deep: `cayley-dickson` **226**, `WSet`/`WeightedSet` **194**, `doubling` **160**, `imaginary stack` **53** — and `universal tensor` only **6**. **The mechanism is heavily built and almost never framed as what it is for.**

**And the framing matters, because this is not the ML notion.** Machine-learning transfer is empirical — train on A, fine-tune on B, measure whether it helped; the transfer itself is opaque. This is structural: **one universal shape (`WSet` as the tensor) instantiated over successive algebras, with Cayley–Dickson doubling generating the ladder.**

**The doubling is a principled transfer test because each rung is known to LOSE a specific property:**

| rung | loses |
|---|---|
| ℝ → ℂ | ordering |
| ℂ → ℍ | commutativity |
| ℍ → 𝕆 | associativity |
| 𝕆 → 𝕊 | alternativity; gains zero divisors |

**So "does this result transfer?" becomes "which properties does the proof use, and does the next rung still have them?"** A result depending on commutativity cannot survive ℂ → ℍ, and you know that *before* testing it. That is a decision procedure where ML transfer only ever offers a measurement — and it is exactly the check `only-the-irreducible-is-primitive-generate-the-rest` already implies, since it names Cayley–Dickson as **the doubling generator** and the structured algebras as *"earned quotients obtained by declaring relations."* Transfer is then: **does the result survive the next declaration?**

**What this would give the CHIP-8 ladder**, and why it belongs in this document: §7b's technique-transfer hope is currently a hope. If the techniques are expressed over `WSet` rather than over a particular machine, then which of them survive a change of algebra is **derivable from the properties each proof consumes**, not discovered by trying. That is the difference between a transfer *plan* and a transfer *argument*.

**Unmeasured, and the gap is the point:** no result has been carried across a doubling and reported as such; `universal tensor` at 6 files is thin for something described as the carrier; and nothing yet expresses an emulator-analysis technique over `WSet` at all. **The substrate exists, the framing does not, and the demonstration does not.**

**Recorded status:** a few easy orbits in CHIP-8 is the entire measured base. Everything downstream — the compression, the generator library, the per-frame store efficiency — rests on a mechanisability claim that is currently supported by expert instinct and one small machine. That is a legitimate place to start and an illegitimate place to stop, and saying which is the point of writing it down.

## Pointers

- `docs/research/2026-08-24-the-etymology-attack-and-the-supply-chain-substitution-are-one-attack-*.md` §6–§7 — generator-as-storage and path-from-a-stable-root.
- `docs/research/2026-06-09-content-addressing-rooms-give-free-deduplication-of-the-chip8-memory-to-worldview-state-space.md` — the memory-level dedup this is the frame-level form of.
- `docs/research/2026-06-09-cheat-engine-injection-points-first-class-in-the-emulator-*.md` — the discovery method that yields the object inventory.
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`
- Beacon: Merkle (1979) · Futamura (1971) · Sutton & Barto for the object/rule decomposition framing in RL environments — and note MPEG's motion compensation is the *pixel-space* ancestor this deliberately departs from.
