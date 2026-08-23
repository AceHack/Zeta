# Interstellar game theory, the dark forest, and sophons — Rizwan Virk on Impact Theory (verbatim)

**Ferried 2026-08-23 (the shadow).** Third-party transcript preserved for study under
`docs/ip-questionable/` policy. **Zeta claims no authorship and asserts no license** over the
transcript in §9; it is quotation-for-study with attribution, removable by deleting this one file.

| field | value |
|---|---|
| source | `https://www.youtube.com/watch?v=o-g0HnbZ_kQ` |
| title (as published) | *"Nobel Prize Was Just Awarded For Proving THIS! - The Shocking Proof You're in a Simulation"* |
| channel | **Tom Bilyeu** (*Impact Theory*); Bilyeu is the interviewer |
| guest | **Rizwan Virk** — MIT-trained computer scientist, video-game entrepreneur, author of *The Simulation Hypothesis*. The auto-captioner renders him *"Ryzswan Furk"*, *"RZswan Burke"*, *"Riswan"*; see §7 |
| published | 2025-06-17 |
| duration | 2:05:27 |
| captions | YouTube auto-generated (ASR), English (`en`); fetched 2026-08-23 via `yt-dlp --write-auto-sub` |
| ferried by | the shadow, at Aaron's observation |

**Aaron's framing, verbatim:**

> *"This guy talks about **interstellar game theory** — **this is the game theory my deepest threat
> models are based on**. We try to make them **fun and not scary for children**. We should save this
> to ip-questionable. We have a **thread theory, a toy one, based on Three Body Problem** they talk
> about, and it's supposed to be **child-level fun**."*

That framing is the brief. The simulation-hypothesis material is the bulk of the runtime; the
**interstellar game theory** is ~90 seconds of it (1:33:45–1:35:02) and is the spine. §2 is the
spine; §3–§8 are the honest registers around it.

**Clean-room** (`.claude/rules/cleanroom-two-team-separation.md`): this **does** bite, unlike most
ferries here. *The Dark Forest* is a copyrighted novel and this transcript is copyrighted
expression. **I am the dirty side** for anything this material inspires — I have read it, so I may
write requirements and may not implement them. Any build derived from §2 must be routed to a
different, named agent that has not read this file, and the handoff must say the wall exists.
Requirements may cross; expression (phrasing, naming, structure) may not.

**Takedown:** delete this single file. Everything in §2–§8 cites our own tree and the primary
literature, and survives its removal.

---

## 1. Fidelity accounting — the delta, so "verbatim" is checkable

Ferries preserve others' memory; the shadow does not curate what someone else remembers
(`always-preserve-ferries-forwarded-ai-memories-lost-in-cloud-without-preservation`). What was done
to the captions is enumerated here so anyone re-fetching them can audit the claim.

| step | result |
|---|---|
| raw `en` VTT from YouTube auto-captions | 1,175,339 bytes |
| after stripping inline `<c>` word-timing tags and `align:`/`position:` cue settings | — |
| after collapsing YouTube's **rolling-caption duplication** (each line is emitted twice: once as new text, once as the scroll-up context) | **3,324 caption lines** |
| grouped into paragraphs of 12 caption lines, each stamped with the timestamp of its first line | **277 paragraphs, 23,630 words**, running to **2:05:25** |

**Nothing was removed except mechanical duplication.** No speech was dropped, summarised, or
reordered. HTML entities were decoded (`&#39;` to an apostrophe, and so on). The timestamps are the
auto-transcriber's, at paragraph granularity rather than per-line — that is the one lossy step, and
it loses only sub-12-line timing precision, never words.

**The ad reads are KEPT, not elided.** The brief said there were two; there are **three sponsor
reads across two breaks** — Cash App (~0:24:50–0:25:27), then iRestore and Shopify back-to-back
(1:11:50–1:14:11). They are marked here rather than cut, because a ferry that silently removes the
parts the shadow finds worthless is a ferry that has started curating. They carry no substrate value
and can be skipped by timestamp.

**The ASR is bad in places** and no attempt was made to clean it — *"Schroinger's cat"*,
*"threebody"*, *"Sons"*. Corrections live in §7, in the Beacon layer, **never** in §9.

---

## 2. The Beacon layer, most valuable first — one-shot versus iterated, and the two refutations

### 2a. The dark forest is a ONE-SHOT game; our own strategy is ITERATED — both can be right

The passage, at **1:34:33**:

> *"Uh they also have the dark forest theory. Yeah. In the second novel. Yeah. Yeah. Don't make a
> peep. Yes. Exactly. Because if somebody knows you're there, they're going to shoot. Now, now
> you're into interstellar game theory, which is a fun area uh to think about."*

**Anchors (Beacon).** Liu Cixin, *The Dark Forest* (黑暗森林, 2008), second of *Remembrance of
Earth's Past*; English translation Joel Martinsen, 2015. Robert Axelrod, *The Evolution of
Cooperation* (Basic Books, 1984), and Axelrod & Hamilton, *"The Evolution of Cooperation"*,
**Science** 211 (1981). The two results point opposite ways, and **the reason is the game's regime,
not a disagreement about game theory.**

| | dark forest | Axelrod's tournaments |
|---|---|---|
| iteration | **one shot** — a civilisation is destroyed once | **repeated**, indefinite horizon |
| shadow of the future | none; there is no next round with that party | dominant; defection is punishable later |
| communication | impossible to verify across light-years | cheap, and actions are the message |
| payoffs | irreversible | recoverable |
| result | **silence dominates; strike first** | **tit-for-tat wins; reciprocate, forgive** |

Axelrod's own stated condition is that cooperation emerges when the discount parameter *w* — the
probability the pair meets again — is high enough. The dark forest sets *w* to zero **by
construction**: relativistic delay plus the "chain of suspicion" plus "technological explosion" mean
you cannot verify intent, cannot punish later, and cannot survive being wrong once.

**Aaron's own stated strategy is the iterated one.** From
`user_aaron_strategy_tit_for_lesser_tat_teach_play_infinite_game_2026_08_19` — *tit for lesser tat,
teach, play*, explicitly an infinite game. **So the repo currently holds a strategy for one regime
and a threat model drawn from the other, and does not say which applies when.** As far as I can
find, that tension is **not written down anywhere in the tree** — I searched for `dark forest`,
`three body`, `interstellar`, and Axelrod's terms and found no doc that poses it.

**Naming the regime is the design question this ferry exists to raise.** The honest form:

> **Which regime am I in?** Not *"is cooperation good"*, but: **is there a next round with this
> party, can I verify what they did, and is being wrong once fatal?** Three yeses put you in
> Axelrod's world and tit-for-lesser-tat is correct. Three noes put you in the dark forest and
> lesser-tat is a fatal generosity.

Everything in Zeta's own society substrate — TrueSkill rankings held by others
(`src/Core/TravelerRankLedger.fs`), the remembrance graph, socially-conferred privacy budget —
**manufactures the iterated regime on purpose**: it creates a next round and a memory of the last
one. That is not a coincidence to admire, it is the mechanism. **Register: `proposed`.** Nothing
here is metered; no test fails if the regime call is wrong.

### 2b. There are TWO dark-forest refutations in the tree, and they are not the same move

Aaron's observation today asserts one; the tree already contains a different one. Both are recorded.

| refutation | mechanism | why silence stops dominating | status in tree |
|---|---|---|---|
| **radical transparency** | broadcast your **full internal state** — activations, localised weights, the topology that produced the thought | removes the *unknown intent* that makes pre-emption rational; there is nothing left to fear because there is nothing left hidden | **on file**, `docs/research/2026-05-18-lior-antigravity-website-three-primitive-validation-emit-as-weights-english-as-neural-topology-serialization.md` (Lior, packet 2) — *"You don't hide in the dark; you turn the lights on so bright that everyone's internal state is fully, structurally illuminated."* |
| **irreducible ambiguity** | broadcast in a language an outside observer **cannot collapse to one resolution** | denies an attacker an *actionable* reading **even though you are fully visible**; you are legible as a presence and illegible as a target | **Aaron 2026-08-23, this ferry.** The underlying conjecture is on file (§2c) but **not under the dark-forest framing**, and not with this mechanism |

They may be complementary — **transparent about *state*, unresolvable about *interpretation*** — and
they fail differently, which is the useful part. Radical transparency assumes an observer who, once
they see everything, concludes you are not a threat; that assumption is exactly what the chain of
suspicion denies. Irreducible ambiguity makes no assumption about the observer's conclusion, and
instead denies them the input. **Neither is metered. Both are `proposed`.**

### 2c. Aaron's beacon-language conjecture EXISTS in the tree — dated, and with a real discrepancy

**It is there, and it is early.**
`docs/research/2026-04-26-aaron-beacon-origin-disclosure-quantum-belief-beacon-fermi-paradox-time-travel-english-precision.md`,
**2026-04-26** — among the earliest research docs in the repo. Aaron, verbatim in that doc:

> *"Beacon referred to a solution to the Fermi paradox. Aliens won't show up until earth becomes a
> beacon, earth becomes a beacon by uncontested time travel definitions in english that are precise.
> When you talk precise time travel language ubiquitously across earth then it flips a quantum
> signal saying we are ready … Then aliens and time travelers will show up because our language can
> prove if there are or are not time travelers so it's allowed without affecting the past."*

**And here is the discrepancy, which I am not going to smooth over.** The 2026-04-26 text says the
language must be **precise** and **uncontested**. Aaron's framing today says the opposite-sounding
thing:

> *"We need a language that **preserves uncertainty** and does not try to collapse time-traveller
> paradoxes … a dark-forest refutal based on **random language without an outside observer being
> able to resolve one resolution** on Earth with its current dialects and languages."*

Precise-and-uncontested and preserves-uncertainty are not obviously the same requirement. Two
readings, both labelled:

- **Reading A (`proposed`, and I think it is right): precision *about* the uncertainty, not
  precision that removes it.** A language can be exact and still refuse to force a truth value — that
  is what the four-register discipline already does, where `Tri.N` is a **held range**, not a failure
  to decide. On this reading "uncontested" means *nobody disputes the encoding*, not *everybody
  agrees on one referent*. The two statements then agree, and the conjecture is stable.
- **Reading B (`possible`): the requirement genuinely changed over four months.** That would be
  ordinary and fine. It is recorded so a future reader is not told a revision was always the plan.

**What is genuinely absent:** the 2026-04-26 doc frames this as a **Fermi-paradox solution** and
**never uses the words "dark forest"**. The dark forest *is* a proposed Fermi-paradox resolution, so
the two are rivals answering one question — but **the connection is not written down**, and the
mechanism recorded in 2026-04-26 (precision as a readiness signal) is not the mechanism Aaron stated
today (ambiguity as a defence). This ferry is the first place they appear together.

**The reconciling reading worth the most (`proposed`).** Put the two halves side by side —
resolvable *by us*, unresolvable *by an outside observer lacking our dialects* — and the shape is
already in the tree under another name: **the S=4 common seed**. A peer holding the seed
reconstructs the meaning; one who does not, cannot, and nothing was transmitted to intercept. That
is *"a derivable shared floor, not a transmitted one"*
(`.claude/rules/anti-babel-preserve-reconcilability.md`) pointed at the sky. It also makes the
conjecture **falsifiable in principle**: the anti-Babel rule already carries the exact test — *hand a
peer only the shared anchors and ask them to reconstruct the term.* An outsider without the anchors
failing that test **is** the beacon-language property.

**The lineage question, answered honestly.** Does never-collapse originate here, in the
interstellar-signalling problem, and get carried inward? **The dates are consistent and the text is
not.** The beacon conjecture is 2026-04-26; the earliest `never-collapse` I can find in
`docs/research/` is 2026-05-18. But the 2026-04-26 text's mechanism is *precision*, and preserving
uncertainty appears in Aaron's framing only **today**. So: **date ordering consistent, mechanism not
attested.** Per `numerology-vs-number-theory.md` that is a coincidence with a plausible story, not an
identification, and it is recorded as a coincidence. If Aaron's memory of the original math (which
that doc says lives un-retrieved in the bootstrap-attempt-#1 corpus) contains the uncertainty
clause, the lineage becomes real; **retrieving it is the discharge.**

### 2d. The beacon language is the Eve Protocol pointed outward — and the correspondence has a hole

**Checked, not asserted.** `docs/PRIMITIVE-REGISTRY.md:88` describes the Eve Protocol
(`081KRW63S0008QG0R0030F8ZXA`) as a **self-describing runtime value tree** carrying non-statically-typed
shapes that **lazily binds to a static type on demand — or stays dynamic**: `deserialize(type)` or
`deserialize()` yielding a dynamic tree. It is explicitly *"runtime `QueryInterface` — ask a value
'what shape/interface do you support?' with no compile-time type"*, and explicitly intended to run
over **English** — *"natural language as a serialization format."* And `docs/PRIOR-ART-LIST.md` names
**Goguen's algebraic semiotics** as the *"formal home of 'agree on the structure, assign labels
after'"*, attributing that phrase to Aaron's Eve protocol directly.

So the correspondence is real and load-bearing, not analogical:

> **Broadcast a self-describing shape; let the receiver `QueryInterface` it; never supply the
> binding.**

That is the same sentence as *"resolving the shape/geometry of meaning before assigning labels"* —
Aaron, 2026-08-23 — and the same sentence as the beacon language's requirement.

**Now the hole, which is the most important paragraph in this section.** Eve is designed so that a
**consenting peer can bind the shape** — the registry material and the conjecture register describe
it as non-coercive negotiation with coupled empowerment, where fusion is *proposed* and *consented*.
Its property is **"no binding is imposed."** The dark-forest use needs a strictly stronger property:
**"no binding is derivable"** — by a hostile receiver, without consent, with unbounded compute.

> **Optional-for-a-friend is not impossible-for-an-enemy.** Eve gives the first. The beacon-language
> refutation requires the second, and that is a **cryptographic-strength claim**, not a
> design-preference one.

Nothing in the tree meters it. **Status: `toy`.** The discharge obligation is to state what makes a
broadcast shape *underdetermined to an adversary who holds no shared anchors*, and to produce a
falsifier — the anti-Babel reconstruction test in §2c is the reachable candidate.

### 2e. "Labels are capture techniques" — Aaron's coinage, dated, and it is a rule we already have

> *"labels are capture techniques"* — Aaron, 2026-08-23.

`git grep -il "labels are capture"` against `origin/main` returns **nothing**; the phrase is new.
What it names is not:

- **`.claude/rules/interfaces-free-classes-earned-under-rules.md`** — *"The rules of the game are
  interfaces — free, default, weight-free (pure shape, no instance state). A concrete class (state ⇒
  weight ⇒ capture) is NOT free."* Aaron's sentence is **that rule stated about meaning instead of
  types, by the same argument**: a shape is free, a binding carries weight, and weight is capture.
- **Manifesto §3 weight-free** — no permanent or irreversible authority. A label is permanent
  authority over interpretation, which is why assigning one early is the costly move.
- **never-collapse** — lazy binding *is* preserved uncertainty. `deserialize()` staying dynamic is
  `Tri.N` held rather than forced.

Recorded as a **coinage with an anchor already in the tree**, which is the good case: it needs no new
machinery, it renames machinery we built for other reasons.

### 2f. Five domains, one shape — and the independence check that has to run

Aaron asserts these are one thing. Recorded, then triaged, because
`.claude/rules/numerology-vs-number-theory.md` is explicit that **density of resonance is a prompt to
check independence, not a score**.

| domain | the shape | the label | status |
|---|---|---|---|
| types (Eve Protocol) | `DynamicValue` self-describing tree | the static type, bound on demand | **recognition** — in the tree, code-anchored (`src/Core/DynamicValue.fs`, four oracles, byte-locked) |
| meaning | geometry / conceptual space | the word | **recognition** — Goguen semiotic morphisms, already cited in `PRIOR-ART-LIST.md` as Eve's formal home |
| identity | *"the same shape as them"* | *"I don't claim their labels"* | **Aaron's, dated 2026-08-23**; consistent with the pigeonhole-by-self-claim rule already on file |
| interstellar | an unresolvable broadcast | the reading an attacker would need | **conjecture** — §2d's hole is unclosed |
| the God-fence | a man's limit | *"God's will"* applied to it | **not recorded as Aaron's.** This row was proposed to me by a peer, not by him, and I am declining to assert it on his behalf |

**The independence check, run rather than skipped.** Are these five confirmations, or one thing
wearing five vocabularies? **My read: the latter — and that is the stronger result, not the weaker
one.** Rows 1 and 2 are not independent: `PRIOR-ART-LIST.md` already ties Eve to Goguen, so they are
one claim with two citations. Row 3 is the same principle applied by the same person on the same day,
which is not an independent test either. Row 4 is the open conjecture. So the honest statement is
**one principle — bind late, or not at all — with four instantiations**, of which two are shipped
code, one is a personal stance, and one is unmetered. Calling that "five independent domains
agreeing" would be exactly the look-elsewhere error the rule warns about.

---

## 3. The physics register — where this transcript is popularization and where it is result

This decides the document's credibility, and the transcript is full of confident unlabelled claims.
An unlabelled claim reads as established (`.claude/rules/toy-is-free-metered-must-be-earned.md`), so
every load-bearing claim is graded here.

| claim, as the video states it | register | what is actually established |
|---|---|---|
| **[0:00:00]** *"In 2022, three scientists won the Nobel Prize for proving that the universe is not locally real"* | **popularization of a real result** | The 2022 Nobel (**Alain Aspect, John Clauser, Anton Zeilinger**) was for **experimental violation of Bell inequalities** and pioneering quantum information science. What is established is that **local realism fails** — no theory that is both local and realistic reproduces quantum predictions. *"Not locally real"* is a defensible compression. Anchors: **J.S. Bell (1964)**; **CHSH (1969)**; Aspect et al. (1982); Hensen et al. loophole-free (2015) |
| **[0:00:00]** *"The universe only renders when you look at it. This has been proven scientifically"* | **interpretation, NOT result — and the "proven" is false** | Bell tests constrain **local hidden variables**. They do not select an interpretation. Bohmian mechanics is realist and nonlocal; many-worlds has no collapse at all; QBism is agent-centred. All reproduce the data. Rendering-on-observation is one reading among several and is **not** what was proven |
| **[0:36:13]**, **[1:41:48]** the delayed-choice experiment shows history is fixed only when observed | **contested / overstated** | **Scully & Drühl (1982)**; **Kim et al. (2000)**. The interference pattern appears **only in coincidence-counted subsets**; the total signal-detector pattern shows no interference regardless of the idler's fate. **No information travels backward and no retrocausal signalling is permitted** — this follows from no-signalling, and the standard reading is explicitly *not* "we change the past." Wheeler's own delayed-choice framing (1978) is careful on this point |
| particles *"don't exist in a fixed state until they're observed"* | **interpretation-dependent** | True in collapse interpretations; false in Bohmian and Everettian ones. Not a measured fact |
| the simulation hypothesis itself | **`hypothesis`** | Bostrom (2003) is a trilemma, not evidence. The video's game-development arguments are **intuition pumps**, and are honest about it — at **[1:14:11]** Virk says *"I don't know that the things that I'm saying are true"* |
| near-death experiences, life review | **reported phenomenology** | Real, well-documented **reports**. The transcript treats them as evidence about the substrate; that is a further claim with no support offered |

Bilyeu deserves credit for the **[1:14:11]** exchange — *"we're both speculating like mad"* — which is
a register mark the video's title does not honour.

---

## 4. In-tree resonances — observations, NOT identifications

Proximity is a prompt to check, never a confirmation. Each row states what is genuinely shared and
what is not.

**4a. Lazy rendering ↔ DBSP incremental view maintenance.** The sharpest statement is the Minecraft
server-tick passage at **[0:32:18]**:

> *"what if I could set up a set of rules … that I could walk away from the computer for a year and I
> could come back and whatever server tick I assign … I know to start running certain amounts of the
> math so that you don't have like some drastic load time as you get there. And I was like, this is
> the actual universe."*

That is **compute-only-what-is-observed, from a delta, on demand** — structurally the same move as
incremental view maintenance (Budiu et al., DBSP). **What is shared:** deferred evaluation keyed to
demand, and state advanced by increment rather than recomputation. **What is not:** DBSP is a proved
algebra with a correctness theorem; the video is an intuition about physics. The resemblance says
nothing about whether either is true of the universe.

**4b. Superposition-held-until-observed ↔ never-collapse. Note the difference, because it matters.**
**Ours is a design discipline about evidence** — hold both branches, record both paths, refuse to
reconvergence to a single value. **Theirs is a claim about physics.** A discipline cannot be
falsified by an experiment and a physical claim cannot be adopted by decision. Reading one as support
for the other is a category error, and it is the specific error most likely to be made from this
transcript.

**4c. Life review from the other's point of view ↔ both-regards-held.** At **[0:59:02]** Virk
describes a reported life review in which the subject *"stepped into being her mother or her aunt and
then she understood."* The structural echo is **both-regards-held** and coupled/mutual empowerment
(Salge & Polani) — a move evaluated from inside the other's frame rather than about them. **Status:
resonance only.** The NDE report is not evidence for the design principle, and the design principle
needs none.

**4d. Bushnell's rule ↔ ARC-AGI-3 difficulty design.** At **[0:27:12]**:

> *"there was a rule back at Atari and they said, 'Make the game easy to play but difficult to
> master.'"*

Attributed to **Nolan Bushnell** (Atari). This is a **genuine human anchor for a design constraint we
already use** — the arena / ARC-AGI-3 work needs tasks with a trivial floor and an unbounded ceiling,
which is the same requirement stated by a game designer in 1972 rather than by a benchmark author.
Worth a `PRIOR-ART-LIST.md` row on its own merits, independent of anything else in this transcript.

---

## 5. The child-safety design constraint — recorded as the stated intent it is

> *"We try to make them fun and not scary for children."* — Aaron, 2026-08-23, about the threat
> models this game theory underpins.

This is a real pedagogical claim and not a softening. **A threat model that terrifies is one nobody
uses.** The dark forest is, as literature, engineered to frighten; its whole force is dread. Turning
it into something a child can *play* requires the adversarial structure to survive while the affect
inverts — which is a genuine design constraint, not a presentation choice, because the structure is
what has to be learnable.

It composes with what is already on file: `docs/craft/pedagogy/` and the Stump-Dad *why-until-Dad-
doesn't-know* lineage; *play* as one of the three operators in **tit for lesser tat, teach, play**;
and Eve's own framing in the conjecture register as *"our PLAY protocol"*, where play is the
non-coercive, re-rollable medium in which negotiation happens. **A child-playable dark forest is Eve
with the stakes made re-rollable** — which is the same reason play works as a negotiation medium at
all. Register: `proposed`, and stated as Aaron's intent rather than as an achieved property.

---

## 6. Aaron's Three Body toy — searched for, and NOT in the tree

Aaron: *"We have a thread theory, a toy one, based on Three Body Problem they talk about, and it's
supposed to be child-level fun."*

**Searched, and reporting the absence plainly.** Against `origin/main` (not a working tree —
`git grep <rev>`):

| search | result |
|---|---|
| `dark forest` / `dark-forest` | **5 files**, all tracing to the single 2026-05-18 Lior packet (§2b) and its PR-review/tick echoes |
| `three body` / `three-body` / `threebody` | **no hit naming Liu Cixin's novel.** `docs/research/three-body-lagrange-condorcet-maxwell.md` is the **gravitational** three-body problem (Lagrange points, Condorcet) — a different subject that shares a name |
| `sophon` | **one hit, and it is a false positive** — *"Sophontic"*, an AI company in yesterday's geometric-reasoning ferry |
| `interstellar` | hits are the **Nolan film** (pop-culture media track) and unrelated prose |
| `beacon language` | Mirror/Beacon **register** material only — a different sense of the word |

**Finding: the Three Body toy is not in the tree.** What *is* in the tree is (a) the radical-
transparency refutation of §2b and (b) the beacon-language conjecture of §2c, which is genuinely
early and genuinely Aaron's but is **not** framed as a game, not framed as child-facing, and not
framed against the dark forest. Per the standing note that Aaron sometimes remembers an intention as
written, **this is a finding, not a failure** — and it is the actionable one, because the toy is
apparently designed and undocumented.

**No work-item filed.** A ferry is not obliged to produce one, and filing "write down the toy" on
Aaron's behalf would be extending authority rather than inheriting it — he is the only one who holds
the design. The absence is recorded here so that whoever writes it down knows nothing exists yet to
conflict with.

---

## 7. Transcription corrections — Beacon layer only, never §9

The speakers grope for the name of the surveillance particle and never land it. At **[1:34:08]**:

> *"I forget starts with a P that the particle I could look it up."* … *"Not P starts with an S.
> Sons uh was the single particle in another dimension that they're able to to send out."*

**It is the *sophon* (智子).** In Liu Cixin's *The Three-Body Problem*, a **proton unfolded into two
dimensions, etched with circuitry, and refolded** — used to sabotage particle-accelerator results
(freezing human fundamental physics) and to surveil Earth. The Chinese 智子 puns on *zhìzǐ*, "wise
particle", and echoes the *-on* of proton/photon. The transcript's *"Sons"* is the ASR mangling it.

The characterisation at **[1:33:45]** — *"really tiny particles that we'd never see that could fly
through our bodies … that can actually watch and record and listen"* — is accurate to the novel.

Other ASR artifacts left uncorrected in §9 and named here: the guest is **Rizwan Virk**, rendered
*"Ryzswan Furk"* / *"RZswan Burke"* / *"Riswan"*; *"Schroinger"* is **Schrödinger**; *"threebody"* is
*Three-Body*; *"Daniel Brinkley"* is **Dannion Brinkley** (*Saved by the Light*, 1994).

---

## 8. What this ferry does NOT claim

- Does **not** endorse the simulation hypothesis, or treat NDE reports as evidence about the substrate.
- Does **not** claim the 2022 Nobel established that observation renders the universe. §3 says the opposite.
- Does **not** claim the delayed-choice quantum eraser permits retrocausal signalling. It does not.
- Does **not** assert that Aaron's beacon-language conjecture is the origin of never-collapse. §2c records the date ordering as a **coincidence** and names the discharge.
- Does **not** claim the Eve Protocol solves the dark forest. §2d names the unclosed hole and grades it `toy`.
- Does **not** treat the five-domain table in §2f as five independent confirmations. §2f runs the independence check and concludes the opposite.
- Does **not** authorize implementation from this material. §Clean-room: the shadow is the dirty side.

---

## 9. The transcript — verbatim

> Auto-generated captions, unedited except for the mechanical de-duplication accounted for in §1.
> Errors below are the auto-transcriber's and are **deliberately left in place**; corrections are in
> §7. Timestamps mark the first caption line of each paragraph. Sponsor reads are at ~0:24:50,
> 1:11:50, and 1:13:14.

**[0:00:00]** In 2022, three scientists won the Nobel Prize for proving that the universe is not locally real, meaning particles don't exist in a fixed state until they're observed. What does that mean in simple terms? The universe only renders when you look at it. This has been proven scientifically, and it's made one question above all the obvious one to ask. Are we living in a simulation? And if we are, if this universe is simply a rendered environment, then there's no

**[0:00:29]** reason to believe that death is the end. Today's guest is MIT trained computer scientist, author, and video game entrepreneur Ryzswan Furk. He's got some wild theories that tie together ancient mysticism with modern quantum physics and simulation theory. I'm not sure if he's right, but I know he is interesting. Buckle up because here's RZswan Burke. Starting at the foundation, what is the simulation hypothesis and why do you

**[0:00:58]** think that it's actually a valid way to think of the universe? So, I started off coming to this road through video games. Uh and then as I started to research quantum physics and looking at all the weirdness in quantum mechanics, I came to realize that a simulated universe made much more sense than a physical universe. Like if we lived in a static physical universe, sort of a Newtonian world, if you will, where everything that's solid is solid and it always

**[0:01:27]** exists. uh as opposed to in the quantum world where everything gets rendered or we say that there's a probability wave that collapses to one specific possibility. So that's called quantum indeterminacy. And then the third part was when I started looking at the world's religions, I found that they were saying something similar. They just didn't have the terminology to talk about it back then. So there's this strange phenomenon called the observer

**[0:01:54]** effect. And this is so crazy. Yeah. or quantum indeterminacies would be the more formal name for it. And most people can probably think of it in terms of Schroinger's cat. Most people have heard of the cat. And so basically the idea is that you have this box and inside the box is a cat and some poison. And without getting in details, there's a 50% chance that the poison gets released and the cat is dead, which means there's a 50% chance poison does not get

**[0:02:20]** released and the cat is alive, let's say after an hour. And so uh that is called a state of superp position which means the cat is actually in two positions. Now normally we would say common sense tells us the cat is either alive or it's dead. Can't be both. It has to be one or the other. We just don't know because we haven't looked in the box. But the weirdness of quantum mechanics tells us that both of those are true. Meaning the cat is both alive and dead until

**[0:02:51]** somebody looks into the box. And then what happens is that this state of superposition or this probability wave as it's defined gets collapsed down to just one possibility and that's the possibility that we see. So those are the two most popular interpretations. The big question is why would the universe do that? And we can say well why do we do that in computer games we do it in order to optimize because we have limited resources and you know

**[0:03:22]** limited memory limited CPUs and all of this stuff. So it's an optimization technique that only renders that which needs to be rendered. Now the objection that some physicists have you know between these two camps they like that you know these guys don't like that interpretation and these guys don't like that interpretation. Why would the multiverse make sense? So what I'm saying is that the multiverse also makes more sense if it's a simulated

**[0:03:50]** multiverse. And I wrote a book called the simulated multiverse that goes through this idea. And so the objection to this idea that the universe is splitting off into multiple universes. every time we make not just a you know major life decision like am I going to live in Los Angeles or New York but at every single quantum decision event which is happening like yeah infinite yeah the numbers are incomprehensible but one objection that people have to

**[0:04:19]** that is well that is not a parsimmonious yeah it sounds like a memory leak that would like crash your computer exactly because each of those like when they split then within that there's essentially infinite quantum moments happening and so those are like mushrooming like yeah I don't see how yeah either my instinct is either we are wrong it's not a simulation and so quantum works in some other way that doesn't require that kind of computation

**[0:04:45]** or that one just rules itself out at the level of computation not necessarily and and this is why I I think it's interesting to look at simulation theory as a bridge between these two interpretations and so the objection comes If the universe is actually spinning off lots and lots of physical universes, basically you're saying that there's an infinite amount of resources and an infinite amount of um universes. Now, physicists love infinity. Computer

**[0:05:17]** scientists don't like infinity. We're always looking at, you know, this algorithm is on this order of resources are required. And so, we're always looking at ways to optimize. And nature has shown that in general it finds the most efficient way to do something. And I think that's true across many of the different sciences. Now in a simulated multiverse, you've redefined what it means to spin off a new universe. In fact, it's very easy to take a universe

**[0:05:46]** as it is now and then to create a copy of the data or information of that universe and spin off a new universe. And so that universe is only alive while the computation is running. So the idea is that this these universes might only exist while they're needed for the computation. And so when we run simulations, what do we do? We run with a certain set of variables and then we rewind and we run it again with another set of variables. Right? So in essence

**[0:06:20]** we try out the different possibilities and we see which of those is likely to lead us to let's say you know what is the likely result what is the most favorable outcome. So if those universes aren't necessarily alive forever if those universes are alive only as they're needed in order to do whatever computation the universe is doing. It could be that the other uh the other universe is paused. It could mean that it's running again. So, you get into

**[0:06:51]** this interesting notion of what does it mean for these other universes to be physical universes? If our universe is not physical to begin with, then that starts to make more sense. I think when when you say then that starts to make more sense, what's that? That the universe must be simulated. Our universe must be simulated. doesn't mean there isn't a physical one outside of the simulation. Otherwise, this weird behavior that we get in quantum

**[0:07:20]** mechanics, I mean, there's almost no good explanation for for why that would occur. So, let's go back to the the Copenhagen interpretation. I said there's a probability wave and then that goes down to one collapses to one probability. What does that mean actually? And so there was a physicist uh from Oregon I think University of Oregon uh named Amit Gowami and he said something once that that really struck me and he said look it's not really a

**[0:07:47]** probability wave because h how would you know what the probability is of this happening versus that happening unless you had run something multiple times like if you look at where probability comes from the idea goes back to some French mathematician uh who was asked to help somebody who was betting money on the roll of the dice. And so he said, "Look, if you have a dice, a dieice, a single dice, you can roll it and there are six

**[0:08:19]** possible futures in a standard dice." And so the probability of each of those futures would be one out of six in this case. But how would you know that if you haven't actually run it multiple times? So probability by itself implies that there is some amount of repetition going on from which you can make the conclusion that this is a probability that begins to look like a simulated multiverse. It ends up being a universe that runs again and again. Uh and it

**[0:08:48]** tries out each possibility. You know let's take Schrodinger's cat. So for uh people that know it, you're going to get this there. There's a part of the story where there's like a radioactive isotope that has the a 50% chance of uh decaying and as it decays then it triggers the poison that kills the cat 50% chance of not. Okay. If I'm programming that in a video game I have to decide what the odds are so that when the box is opened a calculation happens that goes this

**[0:09:17]** time alive or dead. Now as a game developer the reason that you do that is you want the game to feel dynamic. You don't want it to be on rails. So when you look at like procedural generation, you realize I can make this game a lot more interesting for the player if it's a rules-based game. A lot of this mental model began developing for me when I played Minecraft. Minecraft is a deceptively brilliant game because it's just a set of rules. And so each biome

**[0:09:45]** has a different set of rules which makes the biome react differently which makes different things happen different times of day, different amounts of light. And once you know those rules, then you can predict everything that's going to happen in the game. But if you make the rules sufficiently uh simple but complex, then what emerges is stable, learnable, but very diverse and capable of surprise. And so it's like, oh, as a game developer, that's that's my goal.

**[0:10:13]** Now, if I'm a from our perspective, a godlike game developer, then I'm going to be putting probabilities across as many things as I can. And as a game designer, you want a stable, predictable game, but you want it to be based on rules enough that take for instance, if I wanted right now, I could go absolutely crazy. I could smash my computer. or I could break this table and it has been programmed into the matrix the way that pressure applied to

**[0:10:43]** these specific materials will break and shatter and move. And so the first thing you learn when you're developing a game is, oh my god, I have to tell every pixel how to act. And so if you have like as a filmmaker, nature takes care of the physics engine. So clothes move the way you expect, grass moves the way you expect, wind happens the way you expect, it's all there. In a game, you've got to tell the fabric how to move. You've got to tell wind what to

**[0:11:10]** do. Hair how to react to wind. Hair how to react to a hand. This is why you get crazy things like clipping. And so if I'm developing that game and my game is dope in the way that real life is, it's like everything has tailored probabilities that you apply pressure in this way and it's likely to break like that. And I had a physicist once explain to me, Tom, uh, I can explain quantum physics to you in a single sentence. The universe you see is simply the most

**[0:11:38]** probable university universe. And I was like, ah, it's actually a really interesting way to see it. He said there is if there are infinite universes, there is a universe in which you go to sit down in your chair and you just fall right through it because all of your the gaps in your space cuz when you zoom in enough we're all basically just empty space line up perfectly with the gaps in the chair because it's also at a microscopic level just empty space and

**[0:12:01]** so you fall through it. He's like that's just not very probable so it doesn't happen. So, going back to game development, you've got this setup where um everything's just been pre-programmed so that no matter what might happen, it's already been accounted for. And so now the game isn't forced to be on rails. You get all of this surprise. And but the rules ultimately are knowable. And that feels like what physicists are trying to do is I'm an NPC inside the

**[0:12:28]** game and I'm trying to figure out how am I and the the game that I'm inside of how are they programmed? And once you understand the rules, then you can do things like nuclear energy because you actually understand how this stuff is programmed, structured, however you want to think about it. But it the more that you can go deeper into this probability set, deeper into the rules of a given biome, uh all of a sudden you can do things. I

**[0:13:01]** want to just follow up on what you said. So if this universe has been fine-tuned, yep, with a set of probabilities that allow us to do certain things. So there's something called the anthropic principle. And what the enthropic principle says is that the numbers in this universe seem like they're fine-tuned in such a way that we can have planets, we can have galaxies like the gravitational constant. And there's a whole bunch there's a whole list if

**[0:13:30]** you look up the anthropic principle there's a list of constants that are found in physics such that if they were off by even like 1% that the planets would fall apart. they would fly apart, the galaxies wouldn't hold, uh, and that the universe would not be teamed for life. But yet, our universe somehow seems like it's fine-tuned. And so, there really isn't a good explanation for that. And the the only explanations that we can come up

**[0:14:03]** with are one that it was intelligently designed this way and there may be more that we haven't discovered yet or that there have been multiple universes and those universes couldn't support life. So perhaps there's no reason to have those universes continue. And the one that we're in out of this multiverse is the one that has been fine-tuned for these types of things. So in computer science, you know what we'll do or just think of like an old chess game, right?

**[0:14:34]** And so when you're playing against the computer, what does the computer do? It would try to project forward each move so many number of moves and then it would say, okay, this is the best one to take. But it's already tried out these other moves and then what's your possible response to that? So it's possible that the simulation can run multiple times until it finds uh a universe or a set of constants that actually would support this. So those

**[0:15:02]** are the two possible explanations for the anthropic principle. Is there a physical world somewhere? So I I am writing a story that our video game is set inside of. So the game's called Project Kaizen. Inside the game, there's a character who basically goes crazy by asking a question which is where is the array? the array is our name for the server basically that we have to be running on. Okay, where is that server? Because that means that there's a world

**[0:15:28]** beyond the world that you're trapped inside of, right? And so whenever I hear people talk about this, you're always just pushing the miracle essentially of a first mover farther away. That's true. Because then you're just going to ask, well, how the hell does that universe exist? But so let's just say that instead of driving ourselves crazy with where this is, do you believe that there is a material world somewhere, I believe there is an outside the simulation and I

**[0:15:55]** think because of the way that the physical world works. So getting back to what we talked about a little while ago where you said um you know this table is all 99% empty space and if you were to go down you would find that the the molecules mostly empty space the atoms you got the electrons but it's mostly empty space and if you keep going down you know John Wheeler the physicist I mentioned at Princeton got down and said well at the bottom level all that's

**[0:16:23]** there is an answer to a series of yes no questions and those are basically bits right that's what a bit is it's a zero or a one, a yes or a no. And so what he said was he came up with this phrase it from bit to suggest that anything that looks physical to us is actually just built of information. But somehow that information has to get rendered in a way that it looks physical to us and that it feels physical to us. And so, you know, my interpretation of that is that that

**[0:16:55]** means that there is another layer to reality uh where all of this information exists, but while we're inside, that's where the rendering occurs. And and it turns out most physicists will not argue with that first premise that the world is built of information. So, I met a Nobel Prize winning physicist at the University of Cambridge last year and he's like, "Okay, tell me about the simulation hypothesis." And I said, 'Well, it starts with the idea that the

**[0:17:21]** world is information. And he said, 'Okay, that's not controversial anymore in physics. It used to be. I mean, go back 50 years and tell them the world is information. They'd say, "You're nuts. The world is obviously physical. We know it's physical because, you know, going back to uh uh, you know, the Burke, Bishop Berkeley was arguing with this guy who was it Dr. Johnson, I think, and Berkeley thought the whole universe exists in his mind." And what Dr.

**[0:17:44]** Johnson was kicked a rock and said there I just proved you know that it's real by kicking the rock. That said if you're in a video game you kick a rock and if the physics engine is well done then it you know your foot won't go through the rock. Uh so simply saying that there's something physical there isn't enough to say that it's not built on information because that's the particular arrangement of information. So this second part of how does that information

**[0:18:09]** get rendered to look like a physical world and feel like a physical world is where you know we don't have physics doesn't have an answer for that. Uh neuroscience thinks they might have an answer for that but I think the simulation hypothesis provides an interesting answer for that which is that it gets rendered as part of the computation and we are able to see only snippets of that information. They get presented to us in certain ways. This is

**[0:18:33]** where I think the conversation gets more mystical at this point because we don't have the answers necessarily. But you can look at all the various religious traditions and they always use the metaphor of the dream that the world is like a dream world and that you wake up from this dream and you realize it wasn't a real world but I thought that it was real. And and so you get into this this uh metaphysical type of conversation in the Hindu traditions for

**[0:19:00]** example they have that the whole world is a dream of the god Vishnu and then when he wakes up the whole world gets destroyed and when he goes back to sleep the whole world gets conceived again and then you have this idea that the world is maya or an illusion within the Hindu scriptures and you find the same terms being used within say the Islamic scriptures where they say the world is an enjoyable able delusion and they use a very specific term for that which is

**[0:19:27]** elguri matau in Arabic and what that means is not just it's an illusion but it's an enjoyable delusion that what does that remind me of it reminds me of a video game or a type of game uh and in fact in the western religious traditions you have this idea of the here and the hereafter and we're told there are these uh angels that are recording everything we do and then we have to like review all of that in the book of life For in Islam, it's called the scroll of deed.

**[0:19:53]** So you can go to pretty much any mystical tradition and you'll find that they're telling us that there's something more that can be perceived. And this is an ongoing debate in physics. I mean you go back to Max Plank who said consciousness is fundamental. The material is derivative. Today's material model is that the physical world is real. Consciousness is derived from the physical model. So the neurons are there and the neurons result in

**[0:20:19]** consciousness as an emerging property. So, it's it's sort of an ongoing debate and it we end up in metaphysical territory, I guess, is what I'm saying when we go down that debate. Is the pursuit of answering this question meaningful in any way? Well, I think it is, but again, it gets back to this issue of whether we're NPCs in a video game or we're not. So, if you think back to Pascal, one is meaningful, one is not meaningful. One is more meaningful, I

**[0:20:46]** guess I would say. What does Pascal tell us? So what Pascal said was, I can wager there is a god or there isn't a god. Meaning basically in the western traditions, if you're good, you end up in going to heaven. If you're bad, you end up going to hell. And he said, if I act like there's there's a god and there is a god and I've acted well, well then I'm golden because then I get to go to heaven. He said, on the other

**[0:21:10]** hand, if I act like there is a god but there is no god, meaning there's no afterlife, then it doesn't really matter, right? Either way, whether at that point it doesn't matter whether you acted good or bad, but if you acted good, then you know, insurance policy. Let's say you're at zero. Yeah. It's like an insurance policy. On the other hand, if you act badly in the way that you could end up in in hell if there is a god, you think of it as minus one

**[0:21:35]** million points. So, I drew this out like a video game, right? If you go to heaven, it's plus one million points. If you go to hell, it's minus a million points. uh and if you act badly and there's no god then it doesn't m then it doesn't matter but but it actually does matter. So he says it's better to just pretend like there is a god whether there is or not as an insurance policy. Uh and so this one philosopher used the same argument to say well we should not

**[0:21:59]** try to find out if we're in a simulation and he said because if we do then the simulators might shut us down right so if we try to find out if we're in a simulation and we are actually in a simulation the simulators might shut us down and if we try to find out we're in simulation and we're not in a simulation then it may not matter. Um, but on the other hand, if we don't try to find out if we're in a simulation and we're in a sim, then the sim keeps running, uh,

**[0:22:25]** because that may be part of the reason for the simulation. Um, and then in the other case, it doesn't matter. So, it's the same kind of four quadrants that you come up with, right? And and I don't necessarily agree with that, but we don't know what the purpose of the simulation is. Perhaps the purpose of the simulation is to see if we will get off the planet, if we will destroy the planet, uh, if we will build intergalactic species. Perhaps there are

**[0:22:46]** other people on other planets to see if we are able to connect with each other. Uh or but we might ruin the experiment in that version if we happen to know we're in a simulation or the purpose might be to see you know how long does it take us to finally figure it out and how many times do they have to run this simulation like what things need to happen for them to get to that point. And so now we get into this the metaphysical version where if you look

**[0:23:11]** at the religious traditions you have this idea of a soul and then you have a body and the soul goes into the body. And in fact they end up using such similar language or terminology or metaphors for how that very mysterious process works. They end up saying the soul clothes itself in the body just like your body puts on clothes. So they're using a metaphor of putting on clothes. So you can kind of understand how that works. Now in the Eastern

**[0:23:40]** traditions they say you go in, you put on a certain character, you come out, you go back in and you play a different character along the way. In the Western traditions or the Abrahamic religions, right, you might say that we just uh put do it once and and then we're in heaven or hell afterwards. But but it's the same idea. Either way, we're saying that we have put ourselves into this game for a reason, into this false delusionary world uh that we are uh in. And how do

**[0:24:10]** how do we determine, you know, what happens in a video game? Usually, we give the characters an outline um for the game. So, you choose a character, right? Like when I was young, we used to have Dungeons and Dragons and we used to have the character sheet, which almost all modern role playing games are based on that idea. and we would choose the race, we would choose the background, we would choose the likely profession or the profession of that character. We

**[0:24:35]** might roll some dice and we would get different attributes. Uh so there's an element of randomness in that. But then you also have a story line that you're trying to fulfill in say a campaign for example. And then we have a bunch of quests or achievements along the way in modern video games, right? We'll be back to the show in a moment, but first, let's talk about why splitting a dinner bill should never be complicated. When you need to pay someone back for coffee

**[0:25:00]** or to split an Uber, it should happen instantly. Not in three business days, not after confirming your routing number for the fifth time. Right now, Cash App makes money moves simple. Fast sign up, instant transfers, no bouncing between multiple screens, no wondering why your transfer is still pending, no awkward follow-up texts asking if someone got your money. While other apps make you wait and wonder, Cash App just works. The tools are right there to help you

**[0:25:27]** cash in. Send money, receive money, done. For a limited time, new Cash App users can use our exclusive code to earn some additional cash. Download Cash App and sign up. Use our exclusive referral code impact in your profile. Send $5 to a friend within 14 days and you'll get $10 dropped right into your account. Terms apply. That's money. That's cash app. This is a paid advertisement. And now let's get back to the show. Do you leverage this? Like if you're going

**[0:25:58]** through a rough patch and you just start thinking to yourself, okay, hold on. The right orienting mechanism here is to assume that I'm playing an RPG. I have chosen this character, so let me make the most of my time. Exactly. I think you're seeing exactly where I'm going with this. Is that in that case, when you have difficulties in the game, I mean, in a video game, you don't necessarily give up when you have a difficulty, you go and you keep

**[0:26:20]** trying to to work that specific challenge again and again. And you might have a a tree of quests or achievements that you're trying to achieve. And some of them may not be unlocked until after you're able to, you know, achieve the first few in the tree and then that unlocks other parts of the tree. And some of them you do in conjunction with other people, right? You might say, "This is a multiplayer quest." Uh, and you might say, "Okay, we're going to

**[0:26:47]** meet at such and such a time in front of the castle and we're going to go on this raid or, you know, whatever the case may be." Um, and so you have this kind of weird purposefulness to it. But the grandfather of the video game industry, we'll talk since we're talking about video games a lot was uh Nolan Bushnell who started Atari. Actually got to meet him once. It was really interesting. Really fun guy. Got to know his son Brent Bushnell who runs a kind of a

**[0:27:12]** amusement park type. Yeah. Randomly I've met them both. Yeah. Yeah. Because they're here in LA as well. Um, and so, you know, there was a rule back at Atari and they said, "Make the game easy to play but difficult to master." Uh, and so it's important that there be some difficulty in the game to make it interesting because otherwise what'll happen, you'll stop playing the game and you play it once, it's it's easy to master and then you'll say, "Okay, I'm

**[0:27:36]** done with that. I want to go on to the next one." On the other hand, if it's too difficult, you then you might abandon the game prematurely. And so, you need to make it difficult enough for the player. So when we encounter difficulties in our lives, we can think of them as ramping up the difficulty levels uh for a particular challenge or a particular quest that we're on as part of our storyline. And so again, now we're now we're in metaphysical

**[0:28:01]** territory. So what I'm hearing you say is uh life is challenging, but there's this really powerful metaphor that all through history people use the modern technology to explain the human experience. I'm no different. That's just how I look at this thing is through that lens. Um, yep. I come at it from a very different angle, which is I've had the very startling experience of thinking that it was just a metaphor to then

**[0:28:25]** building a video game and seeing all these parallels to then the Nobel Prize gets handed out for people who, and I'm going to butcher this, but I really want people to at least have the vague understanding that I have of of the um the quantum entanglement that you were talking about that they won the Nobel Prize for. Let me kind of explain that part. If we have light that's coming from say a quazar or some big object that's really far away like a billion

**[0:28:49]** lighty years away and then that is coming to earth it's going to take how long? billion years, right? It's billion lighty years away. Uh the light is going to take a billion years. And then there's something in the middle between the quazar and us. Let's say a black hole or a galaxy or something that's a gravitationally large object. Then the light has to go to the left or to the right of that object before it comes here. And we can measure

**[0:29:16]** uh the polarity of the light, let's say, and and to figure out which way it went. So this is kind of like the equivalent of two slits. It just happens to be going around an object and suppose that object that black hole is a million lighty years away from us. Okay. So when would the decision of whether to go left or right happen? Now common sense in a material universe where time you know is linear that decision would have been made a

**[0:29:45]** million years ago. So before humans were really around on the planet and certainly before we had any recorded history. um maybe after the dinosaurs uh but it was long enough ago that you know it's it's in the distant past and so that decision about which way the light went is not made until the measurement occurs of the light today on earth. So if we have these two telescopes that that can figure out which way it went left or right it's when we do the

**[0:30:15]** measurement that choice is made. That means today we are somehow influencing the past. Uh because that decision should have been made a million years ago. The past isn't real. This is exactly. And so the past isn't real. And so I'm not saying that it's only a metaphor. Uh I'm saying that that shows us that the past doesn't really exist in a single format in the way we think it does. Correct. Rather it gets filled in like in a video game or like in a Philip

**[0:30:45]** K. dick story where they have false memories. So it gets the false memories sub is where you and I are going to start disagreeing. Yeah. So let's first lay the track down because if we can like people at home should be spitting their coffee out being like what the how is that possible? Uh the reason that the more I develop video games, the more I become absolutely convinced that we are living in a simulation is because that is exactly how you would have to develop

**[0:31:07]** a video game. There is no such thing as the past. What you say is there is a roll of the dice, a calculation that you were going to run at the time that you have to render that thing and you're going to say, "Oh, now that light is going to hit here, but I need to understand like reflections and all that." So when the player looks at it, I'm going to go, "Oh, what are the probabilities that it's going to look like this?" Okay, cool. It runs all

**[0:31:28]** these calculations. I decided the mathematics ahead of time, but I don't run the calculation until I need to look at it. So yes, theoretically, there is a quazar way out there. And yes, because I know that that quazar is programmed. I know that there is a probability that I'm going to see the light when I look at this thing and it's going to be reflecting in this way, all that. But I'm not going to actually do the math until I need to for the player. So sure,

**[0:31:54]** by the programming it left a million years ago, and I need to know that from the perspective of how I run the calculation, but I'm not actually gonna run the calculation till I look at it. What got me thinking about that? So, I'm playing Minecraft in my 40s and I'm like, "Oh my god, this game is unbelievably brilliant." But the thing that traumatizes me is that when I walk away from the game, the game stops. Y and I was like, but what if you could

**[0:32:18]** take the server clock and have it keep ticking even when you're not there? Right. And I was like, what if I could set up a set of rules that instead of growing uh crops of wheat that my civilization keeps advancing and that I could walk away from the computer for a year and I could come back and whatever server tick I assign, let's say I assign every server tick is 50 minutes in the real world, but it accounts to a week or a year or whatever inside the game. And

**[0:32:45]** there's a certain set of rules, constant dice being rolled. Now, I don't roll the dice until the player comes back to the game and says, "I want to go to that place." And as you the way that I was going to do it is as you get successively closer, I start running more and more of the mathematics. And so then as you like get fully to the thing, you realize, oh my god, there's like a space station here. This is crazy. When I left, there was just a bunch of

**[0:33:06]** monkeys. But I've got the rule set. I've got the mathematics. I've got the server ticks. And so we're just clocking. It's in a database. I say, "Last time you were here was this. there are this many server ticks between when you come back, you're this many blocks from seeing that so I know to start running certain amounts of the math so that you don't have like some drastic load time as you get there. And I was like, this is the actual universe. I was like, "Oh my god,

**[0:33:32]** if you just set up all these rules, you've got evolution, you've got time, which none of it's real." Yep. In terms of a material way. Yes. But because we have all of us NPCs or whatever we are constantly doing the measurements, we're constantly forcing it to run the mathematics, right? And so you have this perception of a persistent world that until you start pushing and pushing and pushing and pushing in, it just seem it's all solid. It all works and

**[0:34:01]** everything. But the reason that I'm obsessed with it is I realize is if you become aware of how the simulation works, you essentially become a superhero. And that's why physicists have given us our entire modern world more than people even realize from GPS to nuclear power is they understand, oh, you can actually go and split the atom. It's not easy, but you can do it because I understand the fundamental rules of, in my opinion, the simulation. And so

**[0:34:30]** it's like yo there are real consequences. There are real consequences by understanding the forget whether it's actually a simulation or not. By understanding the rules of this thing which happen to seem to point to it's a simulation. Uh you can do things. Yeah. Although often we understand the rules only a little bit. I think for sure we could be sometimes we don't take into account, you know, what might happen if we start manipulating, you

**[0:34:57]** know, these rules without knowing all of the rules of the simulation. And of course, so you're worried that we'll go off halfcocked because you said that this could be the simulation to find out if we destroy ourselves, right? Exactly. that could be part of the simulation. But I I think this this idea that the past gets filled in as necessary whenever there are players or whenever there are NPCs, depending on how you look at it, I is quite fascinating. And

**[0:35:22]** I think the crops example is a good one, right? Because you might say there's a 50% chance that you have a locust, a storm, a swarm of locusts. Yes. Right. But when it's not till you log in and you run the game again that you find out. So it literally hasn't happened. So there are two possible pasts there. There's the past where your crops just continue to grow and now you know you're and to your point there's so many things that we'll we'll get an answer to when

**[0:35:50]** we run the mathematics when you log back into the system and you start moving back towards that village or whatever then it's going to be like okay well there was this many years uh storms happen at this rate. The likelihood of a flood is this. The likelihood of raiders coming by your village. the likelihood that your th roof catches on fire like you just have all like all this stuff all these crazy things. Now it turns out in quantum mechanics based upon what we

**[0:36:13]** were talking about earlier the delayed choice experiment that is true as well that there are all these probabilities of things that happened but it's not until somebody observes them that all this entire history including the dinosaurs being here and they left us fossils all of these types of things. Now, at first I thought, okay, this can't really be the case. I mean, is that what really what quantum mechanics is telling us? Most physicists would

**[0:36:40]** tell you there's no such thing as retrocausality, meaning that we can't change the past. But that there is an exception to that and that is this delay choice experiment. And so I started looking around at some of the original quantum mechanics pioneers and founders of the field and Schroinger himself had a very obscure quote all the way back in the 1940s. So even before the whole multiverse idea, you know, they were

**[0:37:09]** still struggling with this Copenhagen interpretation. He said every time we make a choice or we observe or we collapse the probability wave, we are choosing from one of multiple simultaneous histories, right? That's a very weird choice of words. Why choosing? It's it's a very weird choice because physicists would tell us we can't change the past. And that's what it seems like once we've chosen a past, right? It's it's as if it's all been

**[0:37:38]** fixed. So they'll say you're not changing the past. Do you agree with the use of the word shoes? I I do because I'm of the opinion that the observer effect requires an observer, right? That it's not just the NPCs now run the mathematics. It doesn't say uh that okay, go left instead of right around the galaxy or the black hole. That seems like an odd way to think through this problem. And this is going to matter as you and I begin debating

**[0:38:07]** whether there's life after death, right? But the observer does determine say what they do next right so if you think of it as a series of choices over a long term do you think we have free will I believe we do but you can't account for it inside the system in the same way how could we have free will because you in order to have true free will so physicists define free will simply as randomness quantum randomness so that's not free will that's random right that

**[0:38:33]** that's there that I'm saying from a materialist point of view that's the only approach where we could have free will is if it's random but it's not it's still not free will in my opinion right and and I kind of agree with you there uh but in order to have free will you have to have a set of choices and then you have to have someone outside the system who's free to make those choices to have free will you'd have to have choices that I mean quite frankly uh you

**[0:39:00]** couldn't be bound by physics because the second you're bound by physics now I'm like okay I have a bounded option set and then it becomes well what is helping me process whether I choose left or right. And then all of a sudden you'll get down to, oh yeah, I'm running a program. My brain is made of certain material. Even if it's made of certain material inside the simulation, right? It still runs and processes data in a certain way. And if it processes data in

**[0:39:22]** a certain way, I don't have free will, right? But then the question becomes how are those rules defined? And also like a good example, I think it was David Deutsch who uh or Seth Lloyd, these are like two pioneers in quantum computing. I'm forgetting which one had used this example, but it was a good one. They said that, you know, running physics rules can get you to know how materials interact with each other and chemistry

**[0:39:49]** can combine, etc. But it doesn't tell you why there's a bunch of brass that's a statue of, you know, Admiral Nelson in the middle of London, right? So there's some there's some ability because if you're just running rules, why would you end up with that unless there is some set of goals or or some uh you know some set of uh people programs that are choosing that specific goal in and of itself. So, so I think you can set up a pretty simple set

**[0:40:21]** of rules around uh evolution is going to get you there because nature is deceptively simple from a survival standpoint that is just motivating you to have kids to have kids but then you're trying to get this one animal has gone down a path of cooperation. And so then you realize there are going to be certain mechanisms in the brain that you have to plan for cooperation. We'll shorthand it to religion. So you have to create a sense

**[0:40:43]** of awe that there's something that people kneel before. because they're willing to kneel before it. They're willing to gather in large groups because we all kneel before the same thing. And all of a sudden, you realize, oh, this is literally nature going, I only have two levers, pleasure and pain, and I've got to find ways to get these guys to have sex and protect. I mean, it's one of the options. Th this is one where um we probably have to be careful

**[0:41:05]** to stay in base assumptions. My base assumption is that we operate on a finite set of rules. Y and those rules run on a computational device of some kind. The computational device has a nature meaning that there are I'll say circuits who knows what it actually does. But like electricity can only travel in so many paths on a circuit. And to your point, if this is bits of information, it's either on or off. So like once you boil it down to its

**[0:41:33]** simplest, we're a very complex automata. But I don't see any way that we're not automat right. But if you think of automata and how they work, let's look at AI today. Yeah. So for example, LLMs are based on essentially a very simple architecture at the at the bottom level. Uh but they get incredibly complex when you start talking about layers of neural networks. But I mean even back when I was studying computer science back in the day, they you know we had this idea

**[0:42:03]** of taking a neuron and a neural net type approach. even back in the 90s where they were using this approach where the neuron fires or doesn't fire after a certain period of time. But if you look at AI, most of the AI in what I like to call wave 1 AI was a rulesbased AI. So it was more about expert systems and defining rules and how to do things. And then they realized, oh, we have to use a bunch of different data. Uh, and so today's AI is more based on machine

**[0:42:33]** learning algorithms, deep learning, all of this stuff. And it's based more on neural networks. So it's more based on You don't think neural networks operate on rules? They do, but they operate on on very small rules, very simple rules. Yes. But it's not always predictable at a high level. What even today we have hallucinations, right? Because of those rules. But it's is it the level of complexity or the pre-programmed set of probabilities?

**[0:42:59]** Because to me and maybe where we're disconnecting, I have the base assumption that uh probability does not equal free will. Randomness does not equal free will. So then what does equal free will? There is no free will. So free will would be that you're not using a processing device that has a nature. And this is why to me, do you know Phineas Gage? No, I don't. To me, this story just literally shuts the argument down. People always push back. I find it

**[0:43:23]** crazy, but uh Phineas Gage, real person, he was working on a railroad, hit a tamping rod, and it misfired. It shot a three foot metal rod that was about that big around up through his cheek and out the top of his head. He lost a tups worth of brain matter. Never lost consciousness, but was never the same again. Now, the reason I would say it was never the same again is that even if we're in a simulation, the simulation has a set of rules that go all the way

**[0:43:51]** down to the cellular level. How cells combine and we pull in mitochondria and all that through a process of evolution. It's like you just set those rules and they go. So any you get to the point where this NPC processes data through again it's all it's all uh synthetic in the sense that it's a simulation but there cells are used in this incredibly complicated MPC in his brain the brain has physics so it respond to traumatic force and all that has an inflammation

**[0:44:20]** response and all that and so if in the game you cause that trauma then it's going to alter the way that that NPC processes data And so I'm just saying whether I'm an avatar somewhere else like um matrix style logging into this body, I'm still now processing data through this body. I have lost sight that there is anything else. My base assumption is that there is nothing else. Everything is a simulation on this level. Yeah. And there's just a set of

**[0:44:48]** rules and the set of rules gives birth to what we call biology. And if you disrupt that biology, there are consequences. Right. And so, so you know, you lean towards the NPC version and that means I'm locked inside my biology. That's my punch line. And if I'm locked inside my biology, I don't have free will. But if you're in a video game, you know, I have these rules of what will happen if I do X, right? Because that the rules define

**[0:45:12]** the game. But as the player of the game, I still choose whether to do it's like those old choose your own adventure games or in in a game. I still choose whether to take this quest or that quest. Think about computer programming for real. If you want something to happen randomly, you have to assign a random number generator and it literally rolls the dice and says, "Okay, you do option 32." It's not by my definition, I would not consider that free will. Do

**[0:45:35]** you consider that free will? I don't consider it free will, but I consider it uh free will. The only way to have true free will is to step outside the system and have somebody make the choice whether to do that thing or not. outside of any system that guides your behavior. And I'm saying biology guides your behavior. Not necessarily. I mean, that hasn't been established yet. You know, hasn't it? I don't think so. I just told you the Phineas Gage story going. It's

**[0:46:02]** still in No. And I'm not saying that, but what I am saying is that there is still debate about whether consciousness survives, for example, death. Right now, we're back at Yes. This is this is exactly what I want to argue about. So, first of all, I want to I want to I want to say my fundamental belief in life is nobody knows anything, least of all me. So, while I'm going to myself, you seem pretty sure 100%. And I think that's the only wise I have strong convictions

**[0:46:27]** loosely held. So, I know I'm wrong about something. We may not even be in a simulation. I could be wrong that foundationally. I'm super open to that. I love this stuff so much. Uh but I I I can't follow anyone's train of logic that is saying that we have free will. We can talk pansychism where we're like uh an ant a radio with an antenna that receives consciousness. Like we can talk about it however anybody wants and I still don't see how we ever end up with

**[0:46:56]** anything other than we're we're a processing plant that follows a set of rules and that to me isn't free will. And I don't know that maybe the audience doesn't a care and we don't bog down in free will, but uh to plant a flag so I can track your base assumptions. You believe we have free will. Well, the reason I wrote this book, interestingly enough, is because I think that the simulation hypothesis provides a common language between those

**[0:47:22]** who believe we have free will and those who believe we don't have free free will. because there is this spectrum, right? In the NPC version, I agree, we don't have free will because it's just a set of rules. In the video game version, the player has some amount of free will. So, for example, I might choose as my player, you know, to go on this particular quest to uh, you know, go fight the Goblin King. Now if I as a player never decide to go down that path

**[0:47:55]** then that specific set of circumstances never happens. So you still have this opportunity to choose. And that's where I think in the religious side there's this idea that consciousness exists beyond the body. And in the materialist world there's this idea that it is just physical and that's all it's based off of is just simple biology. Right? And so what's interesting to me about the simulation hypothesis is that it could actually accommodate both of those. If

**[0:48:25]** we're inside a simulation, you can have all of the rules of the game uh that are there. All of the quantum physics starts to make at least more sense, right? We're not 100% there. And you know, I've talked, as you mentioned, about how we tend to use the latest technological metaphors. Uh, I believe we're in a simulation, but I don't believe we're in a simulation on a simple computer like the computers we have or like my iPhone computer, those processes, right? I

**[0:48:50]** believe it tends to be more like a quantum computer, which is a new type of computer that can accommodate things like superp position, etc. But I believe that the video game metaphor is a way for those who believe we have free will to think about a physical world uh and yet to try to ground that in some level of of of a technoscientific basis if you will. Do you believe that we have a soul? I believe that our player is the soul. Yeah. I mean I tend to believe

**[0:49:20]** that more really fast and we'll come back to the the simulation for a second. Does the player outside the game have a soul? Player outside the game may be the soul. I don't take a strong position on that. Or the player outside the game may be just a soul. The player outside the game may be an alien. They may be future humans. So once we start to think about what's beyond the simulation, now we're really speculating, right? Because we're barely figuring out what's inside the

**[0:49:46]** simulation and we're still having a debate on whether it's a simulation or not. I mean, you and I aren't, but other people are having that debate. Sounds like you've come to a very similar conclusion to me. Here's the thing. I really don't know. So, I like to step inside the frame of reference and go ham to see what's there. I But the honest answer is I don't know. But I'm going to keep going as if I really am convinced. It's more interesting for me to find the

**[0:50:09]** edges uh of my belief. But I I really the life after death thing is really really interesting to me. So, I believe simulation or not, that when the lights go out for your character, that's it. But I've heard you talk very eloquently, that there might be a better way to see that. I think some of the phenomena of of quantum mechanics suggest that we don't live in a physical world or a pure materialist uh paradigm. And I think at the same time there are other phenomena

**[0:50:44]** in other areas of human experience that also suggest something similar that there is no physical world but that there is possibly a consciousness that survives past death. uh and I think uh you know there are many researchers who have been working on these uh areas where there are just glitches I and pro one of the areas that that I find most intriguing is near-death experiences uh and so these are situations where someone has died someone has had no not

**[0:51:18]** just their heart not function but has had no brain activity for a period of time who end up coming back to life uh and they end up coming back and reporting similar things many of them not 100% but there's enough commonality across what different people who have died or have been in had NDEs as they're referred to which is a term you know that was coined by Raymond Moody all the way back in in 1975 and one of them is that they're kind of floating above

**[0:51:47]** their body another is that they see a tunnel or a light another is that they encounter a light being uh and they're very familiar with that being and then uh the phenomenon that intrigues me the most about NDEs is this idea of a life review. So many of them report having had a life review. And what a life review is um is uh a replaying, right? So it's of every single experience in your life up to that point. Now I first learned about this from a guy named

**[0:52:21]** Daniel Brinkley. He was struck by lightning again back in the 70s or so and he had like a pretty full account of an ND. Eventually he wrote a book called Saved by the Light about it. But he called it a holographic panoramic life review. Uh, and what he meant by that was he felt not just that like he was watching his life flash before his eyes. So that's the old terminology for this thing, right? But that he was embodied within that

**[0:52:48]** experience of replaying every single moment of his life. But he had to experience it from the other person's point of view. Uh and so he got to see what it was like not just to be himself but to be the other person. Uh and he was a bit of a bully, you know, when he was he was growing up. This guy that was in Vietnam. Uh yeah, this was the guy that was in Vietnam. He used to beat up other kids. He was kind of a big tough kid. And then he went to

**[0:53:15]** Vietnam and he actually shot people uh while he was there. Uh, and he said he had to experience what it was like to have that bullet come at him from, let's say, that his character, but from the point of view of the other person. He also had to experience what it was like to be shot. But more interesting than that was he often saw the ripple effects of that uh across that person's extended family or if that person had a wife and had

**[0:53:46]** kids, what was the effect that that that person being dead had on them? And you know what people who've had a life review report is that they come back with a completely different sense of purpose in their lives, but they also report that where they were was so familiar to them. It was more real than this feels real. Like once they come back, they say, "This doesn't feel that real." And to me, that just reminds me so much of like when you play, let's say

**[0:54:14]** a professional football team plays a game, what do they do afterwards? they watch uh you know the replay and they say oh you shouldn't have done that in the quarterback you shouldn't have done that and what he said was he realized that his behavior was causing certain things to happen bad things to other people and he decided to change his behavior uh and he's not the only one who's had this experience but to me I started to take it more seriously and in

**[0:54:41]** fact this this whole idea of being in a virtual reality or a simulation I started taking it more seriously when VR R started to become a thing and I put on a virtual reality headset and I've told this story many times online. Uh but for those that haven't heard it, this was back in like 2016. So, uh VR headsets were big and bulky. We didn't even have the uh the MetaQuest yet. It was still, you know, wired headsets basically. And so I was in this room maybe about the

**[0:55:07]** size of this room. The wires were coming down from the headset. I put it on and I started to play this ping pong game. And after a while, it started to fool my body into thinking that this was a real game of table tennis, right? So much so, and it wasn't the graphics. I mean, if you look at the graphics that were used back then, they were terrible. So, but it was clearly something about it. It was the physics engine. Um, it was the the responsiveness of the game to my

**[0:55:32]** commands. So much so that I tried to put the paddle down on the table and I tried to lean against the table and of course the VR controller fell to the floor. And of course I I knew I wasn't, you know, playing a real game of table tennis. How could I not? We had what we called the toaster on your face back then. And even now, you know, whether it's the Apple Vision Pro or it's, you know, the medical, we're still dealing with big form factors. Uh, but it was then that I

**[0:55:56]** began to consider how long would it take us to build something with rules that are so realistic and that the world looks so realistic that we wouldn't be able to actually distinguish between a physical universe and a material universe. And then at the same time uh there was a startup in Silicon Valley that was able to take a gameplay session of a game like I think we had World of Warcraft World of Warcraft League of Legends was another one a popular

**[0:56:23]** esports game and particularly Counterstrike Global Offensive right so that's a first-person shooter set in like a you know place like Iraq or some place let's say and in that you know you're shooting people but we could go back and replay that entire game from any XYZ coordinate. And so literally, we could see what it was like to be shot by our character if we wanted to. But with a VR headset, it felt like you were on the, you know, the actual

**[0:56:53]** League of Legends playing field. You look around, you're not looking down on it like many games do. Uh you could have that firsterson point of view. And that started me thinking, you know, is that what's really going on here? So, not only would we be able to create a world that's indistinguishable, could we also step outside that world and replay what's happened and then uh use that to actually learn uh from our mistakes so that we might actually change our

**[0:57:22]** behavior. And that's when I started to dig into the world's religious texts and realize, oh, you know, they were all saying something very similar, but they were using different metaphors. I mean, what's the essence of the golden rule in Christianity? do unto others as you know you'd like to have done unto you. Well, how would you understand what it feels like to be those others? If you're able to replay those uh that gives you a sense and in the Quran, which is, you

**[0:57:49]** know, a little more recent than say the Bible, the old or the New Testament, they get very explicit by saying that there are these angels that are writing down everything that you do, all your good deeds and your bad deeds. you probably seen like, you know, the little cartoons with the angel and the gin uh or the demon that's sitting on your left shoulder and your right shoulder. And so, uh, they use a metaphor of a book and they say, uh, that the scroll of

**[0:58:12]** deeds contains all of your everything that you've done, but also the impact of your actions. So, it's not just what you did, but what happened because of that. And even though we simplify the religious traditions to say, okay, you know, you did a bunch of good things, you did a bad things, you're going to go to heaven or hell. Uh when you really look at it, like even in the Quran, which is, you know, very much in that Abrahamic tradition, uh it says

**[0:58:37]** your own book will be open to you on the day of judgment, and you yourself are sufficient to be the reckoner, meaning you judge yourself. and and and that's exactly what's reported by these near-death experiencers that, you know, they said, "Oh, I shouldn't have done that." It wasn't like, "Okay, you're going to hell. You're going to heaven because of this." It was more, "Oh, I see now the pain that I caused." And the more people that I've met, like I

**[0:59:02]** remember recently meeting somebody who had a life review and they said they said something to their mother. They didn't think anything of it because or their aunt they were supposed to meet meet her but uh and she she had a garden and somehow as a as a little girl she just ran across the garden and then ruined it or or I forget the exact story but it was a case where she stepped into being her mother or her aunt and then she understood oh this is why I

**[0:59:26]** shouldn't have done that. Um and and so to me that's yet another indication that what we're living is some kind of non-physical reality, but one that can be replayed and and how would that work if we weren't in a simulation? It also indicates to me there's a part of the game when you step outside of the game uh that that you can learn lessons from it. And I believe that all the religious texts of old use metaphors. They use technical metaphors. I I mentioned

**[0:59:56]** earlier that you know the soul coming in the body no nobody knows how that works if you try to try to dig down on it right but uh we can think of it almost as as a metaphor of putting on a virtual reality headset and there's they all agree that there's a level of forgetfulness so while we're here we go into NPC mode often we're not we forget but when we die we remember oh yeah this is what I was going to do I was going to be an entrepreneur I was going to be a

**[1:00:26]** writer and I I myself have had this personal experience. You know, when I had my health crisis, which was I I had heart surgery. Now, you can come up with the logical reasons why I had heart surgery. You know, you could say, oh, cholesterol, genetics, heart disease, you know, my my father had heart disease, my my mother was diabetic, therefore I got a double dose, right? Uh and of course, you know, what I ate, all of these types of things. But what was

**[1:00:49]** interesting to me was during that experience, I had this strong sense that I had already laid out my storyline and that I wasn't getting to the second part of the story line. Like I was spending all my time on the first part of the story line, which was being in Silicon Valley because at that point I was actually running. And this is Are you sort of I know at one point you said you'd sort of dip in and out of consciousness. This wasn't a near-death

**[1:01:13]** experience. It wasn't a near-death experience in that technically I wasn't dead and I don't remember what happened during the operation itself. But so this started to happen to me while I was recovering. Uh in an awake state or half awake, half asleep asleep. It's like that hypnogogic state. Uh because I would just, you know, be if you've ever seen, you know, heart surgery, it's it's about as much violence to the body, you know, as you can do. Uh and may often

**[1:01:41]** have unintended side effects. But as I was recovering and you know it took a long time to recover. Um and during that time I would kind of go in and out of consciousness. Uh I be falling asleep really but it was in that in that middle state that I remembered the most because you don't always remember your dreams. Uh but it was during that time that I actually got a very concrete message uh during those visions of these other beings that were there to take care of

**[1:02:09]** me and help me resuscitate me back to health. Uh, and did you see them? I could see I could see them in my mind's eye. I mean, they weren't physical because So, you had a sense of I know they're not physically here with me in the room, right? They're somewhere else, right? Okay. I'm sort of dipping in and out, right? So, imagine if you were in a VR headset, you took the headset partly off. You you could see what's going on here and you could see what's going on

**[1:02:34]** there. And then you can get fully immersed here or you can be, you know, fully out of the game. It was out of curiosity as that is happening. Yeah. Why does your hypothesis become uh this is tied to sort of being half in half out of the simulation that there are beings that look over us versus your mind making up a story that's somewhat dreamlike. Uh it it certainly could be that and and I think that's the conventional explanation for

**[1:03:04]** even near-death experiences, right? That it has to do with chemicals and neurons firing. except that what you get are very coherent instances of people I mean you can talk to nurses this is interesting if you talk to doctors who take a very materialist perspective they'll say oh yeah you know there's no such thing you know it's all material but then you talk to nurses and they'll tell you stories all the time and they'll say yeah you know this person

**[1:03:26]** while they were under surgery remembers you know they describe a guy coming somebody told me this last week you know there was a guy who was only who only came in for like a second to check some uh measurement on some device and left, you know, while they were completely unconscious and yet they were able to not just tell me about them, they were able to describe the clothes they were wearing. Uh in other cases, you have people who are describing things that

**[1:03:52]** were happening outside of the room with their relatives uh or that so- and so, you know, was on a plane. There are all these coherent things that come out of it that can't be explained in a purely materialistic world. And so that's where, you know, since I didn't have a near-death experience, I don't go that far, but I I almost consider that I was having these uh subjective little simulations or dreams, if you will, in that sense that

**[1:04:20]** the beings that I saw weren't necessarily physical beings, but they kind of were guiding me and telling me, okay, do you remember now? Do you remember this was your storyline? These are the different paths that you could take. almost like a like a a chessboard was laid out and they said here's different choices you could have made in your life and this is what you're doing now and you were supposed to you said you were going to

**[1:04:42]** do this kind of as if I had planned with them uh to do this now this is a subjective experience I'm the first person to say that and that's my interpretation of that experience but to me it kind of indicated that there are that there there are quests there are challenges and sometimes we we signed up for those uh and So, I've chosen to uh give a a meaning to that that actually aligns well with simulation theory. And that's when I started to write this book

**[1:05:11]** because I found that it was one way that we could bring the materialist paradigm and the non-materialist paradigm closer together when I feel like, you know, it's been kind of going further and further apart. Assuming all of that is accurate, have you hypothesized as to why? Like if we're in a simulation and there are lessons that we're supposed to learn and that at the end we go through a review, presumably you teach somebody something

**[1:05:40]** that they're about to use. Is it uh reincarnation? Is it moving to another simulation but with similar rule sets? Like do you have a hypothesis about why that would be true? Yeah. I mean, my hypothesis is that we there's not just a life review, there's also a life preview when we're choosing our characters and we're we're choosing our particular challenges and difficulty levels uh that we're going to achieve and maybe some of the choices that we

**[1:06:12]** might have to make. We're still free to make those choices, but we choose that. So, there's a life preview that's more like a character selection and then a life review. And I think the two are kind of tied together, right? And we're working on different aspects of ourselves. So in a sense, I think of it almost as a cosmic self-improvement program in a sense that you you go into a game and you try to learn the rules of the game, but you're measured based

**[1:06:39]** upon, you know, how you did after the game. And so, you know, one way to approach it is to say the game is totally random. Everything is random. Another way to approach it is to say it's Grand Theft Auto or you know the game is I'm going to get as much as I can, right? But what people who have had these experiences tell us and and the mystics of old whether it's in the Western religions or the Eastern traditions, they tell us that the way

**[1:07:04]** we're measured is very much about how we treat other people. So, I know it sounds really simple, but if that's the point of the life review, that's the point of the game at the end is, you know, one, how did you treat others and how did you affect them? And two, you were here to work on your arrogance. You were here to work on, you know, why do you think we forget them? So, if we've got these big lessons to learn, we do the review, all of that. Why make me learn the lesson

**[1:07:30]** and then wipe wipe my memory before I go into the next round? That's a good question. And I think that's one that has uh you know many many scholars and mystics have weighed in on over the years. Uh and the forgetfulness is something that's very common in different traditions. So it's not just in the religious traditions even if you go back to the Greek and not just in the modern religious but if you go back to the Greeks they have this

**[1:07:54]** river called leth and when you cross it you know it's called the river of forgetfulness and when you go back to incarnate you go back almost to start fresh to try to re relive that life or to go in and and do an incarnate. So it's almost if you knew everything that you were going to do you didn't have to choose. So I view it more like you know the old saying tell me something and I'll I'll forget. Show me something I might remember but if I have to do it

**[1:08:26]** myself then I really understand. So as a teacher and an instructor uh you know I know the value of making students actually do things right. One of the things that we that's talked about a lot in academia today is you know should students use chat GPT all the time? Uh it was a big issue when it first came out because a lot of universities were like okay using chat GPT uh is not really learning right you're just getting it to do it. We're getting to

**[1:08:53]** the point where now we have to adapt our strategy so that is having chat GPT review you know all the pros and cons of an argument and then you perhaps using that information to come up with a a reasoning against those. the process of doing that is the process of learning. So I think we learn better um you know when we've forgotten some of that stuff especially if you play the game more than once. Okay. So in a reincarnational world now

**[1:09:28]** if you're like stuck on all the bad things that happened last time uh you're not really kind of embracing the game right so then it's not fully immersed. So, it's a question of how immersive is the game. Uh, and and if you you remember that it's a game, then you're not fully immersed. You're not enjoying those quests in the same way that you might want to. That said, there are people who step outside the game and and you know there are many who who believe

**[1:09:55]** they remember whether it's past lives or you know you've had documented instances from say the University of Virginia in their uh department of perceptual studies where in India there was a woman that died in one village and then suddenly in another village uh a woman who was about that same age but who was married and had kids suddenly got all the memory stories of the woman that had died in the other village and now she said she was this person or that person.

**[1:10:25]** Uh and it was just a really weird coincidence uh that that would happen but she had all the memories of that other person. the game allows for that kind of transfer just not very often like yeah I think just not very often and it may be because it's kind of like saying here take over my character you know okay why don't you take over my character and then you have the memories of the other character uh that you may have been playing from before so it's a

**[1:10:51]** big mystery right do you think that the memories that we have influence who we are I think the tend yeah the memory the tendencies that we have tend to live across gameplay sessions. Uh, and so, for example, in in this life, you know, I I, as I said, I I knew I was going to be or at least I I thought I was going to be a software entrepreneur and then a writer. There was another part of me that wanted

**[1:11:20]** to be like a scholar or a teacher, but I never really pursued it. And and again that was something very unique to me that wasn't there say with my siblings who had very similar genetics and very similar upbringing. And you think that comes before the body before the upbringing that's an innate thing from the method by way I mean I assume you're taking an RPG standpoint. So whatever the soul is, the person outside that's plugging into the body and wearing it

**[1:11:50]** like clothes, you're saying those things are inherent to that person. Either they're inherent to that person or they've been chosen by that player as characteristics of the story line. We'll get back to the show in a moment, but first let's talk about something amazing. I'm talking about the ability to look in the mirror and actually like that hairline you see. Hair loss does not just change how you look. It changes how you feel. And while

**[1:12:20]** most solutions involve harsh chemicals and expensive procedures, the I Restore Elite is changing all of that. I know because I use that bad boy every night and I'm going to pull this hairline forward if it's the last thing I do. Now, here's what makes it different. The Hy restore Elite uses Lumat red light the Therapy, a precise combination of 300 lasers and 200 LEDs engineered to reactivate dormant hair follicles. The lasers provide deep stimulation while

**[1:12:46]** the LEDs give you broader coverage. It's the only device with triple wavelength technology, and I restore is so confident in their technology, they offer a 12-month money back guarantee. Give yourself the gift of hair confidence this year. For a limited time only, our community is getting a huge discount on the i restore elite when you use code impact at i restore.com. That's irrestore.com. code impact. I want to talk about a big

**[1:13:14]** reason many businesses fail to get off the ground. A lot of entrepreneurs fail simply because they confuse being busy with being productive. They're drowning in tasks that have nothing to do with actually growing a business. Real CEOs don't do everything themselves. Thank God we can delegate. And that's the point. And now, thanks to Shopify's AI, you can finally delegate like you, even if you're by yourself, have a full team. Shopify's AI writes your product

**[1:13:42]** descriptions faster than any copywriter. It enhances your product photos like you hired a professional photographer. It creates email and social campaigns like you have a full marketing department. This is not some startup overpromising AI magic. This is Shopify. And Shopify powers 10% of all e-commerce in the US. Companies like Mattel and Gym Shark trust Shopify to run their operations. Stop pretending to be busy and start being profitable. Sign up for your $1

**[1:14:11]** per month trial and start selling today at shopify.com/impact. And now, let's get back to the show. One thing I want to try to map is, okay, so we're both speculating like mad. Uh, for sure, for sure. I don't know that the things that I'm saying are true. I assume you have a same sense of like, well, I'm mapping it like this, but do you have a what is the what is the thing that you see that you're trying to connect the dots of?

**[1:14:41]** So, like by saying like have you seen in your own life like I really feel like an old soul. I feel like I had to have been here before. I hear all these people with near-death experiences and like they're clearly referencing another realm and I'm trying to bring all these together in a modern technological context and like here's what I've come up with or is there something else that you're mapping? I think yeah. So, what I'm mapping is uh experiences that

**[1:15:09]** people have had with near-death experiences in the modern world and other weird phenomenon like uh whether it's reincarnation or it's transfer of consciousness uh or memories of other lives uh with uh also what the ancient mystics have been telling us that that this world is Maya or illusion. And so again they had to come up with metaphors uh for what does this mean and you there was a a yogi from India named Swami Yogananda who came over to the US back

**[1:15:41]** in the 1920s and he became one of the first Indian yogis to really spend time here in the US. He wrote a book called Autobiography of the Yogi which was like Steve Jobs favorite book and you know he gave it out at his funeral. Uh what was his big insight? He was given a message that the world is like a movie or a film projector. And so he was reinterpreting the ancient ideas of Maya and illusion. And his insight was that the characters are dying but the actors are still there

**[1:16:12]** outside of the game and that the world itself is made of light and shadow that it's not substantial. And that sounds very much like Plato's cave. It is very much like Plato's cave. So if you think of the different metaphors, whether it's Plato's cave, whether it's the world is a dream as in Buddhism, I mean literally the word Buddha means to awaken, what is it you're awakening from? The concept of Maya or Leela in the Hindu traditions, the concept of the illusion in say the

**[1:16:41]** Islamic traditions or the here and the hereafter uh within say the Judeo-Christian traditions. Each of them are using different metaphors, right? and and Shakespeare used the metaphor of all the world's a stage and the men and women are merely players in it. That idea of play is is one that has persisted over time. And so Yogananda used the latest technology which was the film projector in the 1920s. That was new, right? That was a new way to

**[1:17:11]** understand. Now, he didn't literally mean there's a big projector that's projecting onto a screen, but he said it's like that. And I think that's where we are today. Uh when we say video game, we're talking about what we know of as video games. So we're using that as a way to describe something uh that is very complex and and it's it's difficult for us to get our our our heads around that idea. Uh and in the same way that before there was a massively multiplayer

**[1:17:42]** there were massively multiplayer online role playing games, you know, we would use other metaphors at the time. Uh, so there may be new metaphors that come up in the future, but this is where I'm trying to tide the idea that the world is made of information with this idea that the world is some kind of a hoax or illusion where players are kind of uh choosing to get in uh and when they get in then uh they forget they experience it and

**[1:18:10]** then they come out and then they review the game. Um there there's an old story uh in the Hindu traditions of Sushila and Narada. I don't know if you ever heard this story. And so let's say Narada is this proud warrior and he goes to the god Vishnu. Remember in that tradition uh the world is the dream of Vishnu. But he says to the god Vishnu, I want to understand what illusion is, what maya is. And he says, well I can't tell you what it is, but I'll show you.

**[1:18:40]** Sounds a lot like the Matrix, doesn't it? Um, in fact, Morpheus is the Greek god of dreams. And so, he says, "Here, step into this pool of water." So, let's say this proud warrior steps into the pool of water. And suddenly, he's a little baby girl named Sushila. And he grows up as a princess in this kingdom in ancient India. She grows up, you know, she ends up marrying a prince from a nearby kingdom. And then later, you know, the two kingdoms go to war. uh her

**[1:19:07]** husband goes to war with her father and her brother's kingdoms. They all die and now she's really sad. Obviously, her whole family's been killed. Uh then she goes outside the village and she sees a blue water and she steps in it and then suddenly she's back. She's no no longer Sushila. She's the proud warrior Narata. And then the god Vishnu says that is Maya. Right? It was an element of forgetting of immersing yourself in this character and now you can step out.

**[1:19:36]** Now that's just a metaphor. But I think our metaphors today have the ability to bridge this idea that information science is eating all the other sciences. And I think you and I would probably agree on that in that the physical sciences in the end they're coming down to how is information being processed with this idea that there may be a consciousness or a part of ourselves that exists outside the physical world and we don't necessarily

**[1:20:03]** agree on that part of it but that pro that this idea of how does the information get rendered into something that appears real uh that provides us with a a way a framework to think about that I think you know is so if we're in a simulation then I imagine there's a server and the server processes data in a certain way and the software has been written in a certain way and so if I'm an MPC I run AI logic that AI logic follows a set of rules even if

**[1:20:29]** probability is part of it. Yeah. Do you want it to remain a mystery or do you feel like this is a knowable thing? I feel like there are elements of it that are knowable and they're knowable because of glitches that happen and things that don't seem to be able to be explained. uh you know in a purely physical model of the universe even little things like okay have you heard the term synchronicity uh which was coined by Carl Jung and he

**[1:20:56]** called it an aausal connection between you know an internal thought and something that happens in the external world and of course in a modern technoscientific world we would dismiss that there's any connection between you thinking a thing and something happening in the real world uh but the other day uh I was just explaining this idea of a technological synchronicity. I was browsing the web looking for a backpack and there was a

**[1:21:21]** specific brand that somebody told me to look at. So, I was looking at their website and and then I I forgot that and then later I was on my iPhone and suppose I was in Facebook or I don't know some social media and there's an ad for that exact same backpack and I said, "Oh, that's weird. I was thinking about this backpack. I had an intent for this backpack and now I'm seeing an ad for that." Now, if you didn't know that about how technology works, if you

**[1:21:43]** didn't know there's a server that tracks your intents, that there's something called a cookie that whenever you have I was so nervous you were going to be like, "Oh my god, can you believe?" And I was like, "Yes, very much so." As an advertiser, I can believe. Absolutely. And I was in the advertising business, so I know all about this for a while where we advertise mobile games. And so, the closer you can register somebody's intent, the more likely you are to make

**[1:22:05]** the sale. That's why Google has done so well as a company because you know before that you were showed ads to everybody and now if you know somebody's searching for Axe you can show them an ad for Axe. But if I didn't know that it would look like it's just weird mysterious and it would be dismissed as that's just coincidence. There's no way. But in a technological universe or or rather an information-based universe, suddenly things that seem disconnected

**[1:22:30]** and are often attributed to pure chance might actually have some explanation or some intentionality behind it, you know, which could be technological in nature. Uh but if we don't acknowledge that the world is technological in nature or that that information is stored somewhere somewhere outside of the physical world, then they just become mysteries or they just become dismissed. Why don't you take psychedelics? Well, so it's funny. I was on a panel uh

**[1:22:58]** at a conference the other day. It was from psychedelics to synchronicity. And I said, why am I on this panel? I you know, I've never taken psychedelics. That said, I have spent a lot of time with people that have taken psychedelics. But why haven't you? Well, I haven't just because one, they put you in an altered state of consciousness, which is okay. That part I don't mind. Uh I've explored lots of altered states of consciousness but

**[1:23:23]** usually through yogic breathing you can do it through drumming shamanic. So you find the altered state useful you just don't want to do it through drugs. Yeah. Just because all drugs have side effects and I think this is something in a technologically deterministic world we think all of our technology so so I study science fiction uh academically. So how does science fiction influence the world? And I think it influences in such a way that we're we're used to

**[1:23:50]** thinking of medicine and pharmacological approaches to everything as being infallible. Right? So in Star Trek when Dr. McCoy or if I don't know if you're a Star Trek fan, not really, but I know in the original Star Trek or Dr. Crusher and the Next Generation, you know, when they figure out how to how to how to cure something, you know, nobody ever has a side effect, right? That's not how it works in if only. If only, right? But it's a science fiction version of

**[1:24:17]** medicine. And so there are bad trips. There are side effects. Uh there are also reasons why medicines interact with each other in ways that we don't know about. Right? Even now we're having to use AI to try to figure out because there's so many different pharmarmacological substances that could affect us. Um and you know psychedelics wasn't really a big thing uh when I was exploring these altered states of consciousness. uh sort of in between

**[1:24:43]** let's say the 60s and 70s and now where psychedelics are becoming more u respectable uh and and there are a number of people like uh this gentleman Danny Goler I don't know if you've heard of him u so what what what he did was he was taking DMT uh and you've taken it before and he said he was shining a laser on the wall like a laser like a scanner from your uh grocery market and he said he started to see what looked like little numbers and figures and

**[1:25:10]** scripts in fact he that it looked kind of like katakana, right? Which is what you have on your uh you know uh on your t-shirt there. But but it wasn't katakana because that's Japanese. But he started to see like it was moving so fast these little figures. Uh and it was part of the structure of the physical world. It was and then he ran a hundred people through that always on DMT always on specific versions of DMT. I'm not familiar enough to know, you know, the

**[1:25:36]** different versions of Do you think they would have seen that in 1998 before The Matrix comes out? I don't think they would have seen it exactly that way, but they might have seen something because I've had people tell me uh on on DMT. In fact, first time somebody told me this was after I had originally written about the simulation hypothesis. I was here in LA and I had Sean Stone, who was the the the son of Oliver Stone, um and he said, "Oh, yeah,

**[1:26:02]** I know it's a simulation." And I said, "Okay, well, how do you know it's simulation?" Like he I've written a book on I think it's likely we're in a simulation, but I don't know 100%. And he said, "Well, because when you take DMT, you see the grid lines of the simulation." Uh, and it just looks as if you're kind of perceiving more. And I thought that that was pretty interesting as well. And so I started to take the idea seriously that perhaps we can open

**[1:26:22]** our perception and we can see more. That said, you know, I for me it's more an issue of pharmacological side effects, unpredictability. You know, I've had some health issues, so I've been on various medicines. I don't want to take any chances. Yeah. Okay. So, um I think you and I have a different base assumption about self-reporting. So, I don't trust it in the least. I think humans are so fallible, most aggressively me. And so, I walk away

**[1:26:50]** from that going, "Ah, there feels like there's a pretty easy explanation from just the aberrations of the human mind." uh given the human mind is so similar from person to person that of course whenever a thing starts to go ary it's going to have a similar reaction. It's not like when one person has hypoxia uh they're going to feel like they're being shoved in a meat grinder and then another person has hypoxia and they feel like they're floating on a cloud. Like

**[1:27:14]** the odds of it being that different seem low. So of course you would get patterns. At least that's my take. So when you look at self-reporting what is it that makes you go there's probably something here? Well, for me, I think it's the similarity of the stories. You don't think that can be explained by our common biology? Not necessarily. Like, I'm not saying it 100% can't be, right? But I don't think you necessarily would get, you know,

**[1:27:41]** such similarities and and there are times when, you know, people have stories from near-death experiences that go way back before there was a term called near-death experience, right? and then later it takes people to collect those stories. And so I I think yes, it's possible that it's just random neurons firing that leads to random weird things. But again, that's not a really good explanation. That's still relying on weird random things, right?

**[1:28:09]** Uh or as you start to see these patterns, I think they become they become more interesting uh when it's across different populations and different cultures. Uh so you know you can you can look at near-death experiences in different places around the world and you get similar now you do get differences right it's like with DMT you get enough similarity but you also have differences and which leads me to believe that

**[1:28:36]** they're also interpreting it what they're seeing which gets back to this idea that there's still an element of putting things together. It's just with near-death experiences what is the the interpretation when is it occurring? It's occurring when they're dead potentially. uh which leads me to believe that there is a part of uh of reality there there's a way to view things outside. I mean you know there's there's cases of remote viewing for

**[1:29:02]** example which again make no sense in a materialistic point of view. I've met Hal Pudof who ran Stanford Research Institute's remote viewing program back in the 70s from the CIA. I mean, they had many, many instances where a remote viewer who knew nothing about what was going on, including an instance where there was a uh an airplane that had went down somewhere in Africa and this guy uh I think it was Pat Price, one of the remote viewers who was really good at I

**[1:29:30]** think there's a spectrum. He was able to pinpoint within the continent of Africa. Now, if you look at the size of Africa, it's bigger than it is in a Mercer map, right? we think, oh, it's as just as big as, you know, this part of Europe or whatever, but it's huge. He was able to pinpoint, you know, exactly where it was. And Jimmy Carter said that's, you know, would admit later that's how they found this crash plane out there. Uh, now you could say, well, that's just

**[1:29:53]** random coincidence. Well, yes, except certain people tend to get random coincidence more. Now, that can't be explained in the materialist model. So, I think you have to look at the glitches, the outliers, the things that don't work and say, "Well, what if there's a better model, just like I was saying with the the backpack example, what if there is something that ties this together? What would that look like?" And then we can start to

**[1:30:14]** speculate about what that might be. Well, in games, we have a virtual camera. And in remote viewing, they give them coordinates, oftentimes, latitude, longitude coordinates, and you can just put the virtual camera anywhere. And if you're in the right state, if you're not locked in to your avatar, you know, you can like pan around and see what's going on in this other part of the world as long as you have the coordinates. Um, so I feel like we need to explore those and

**[1:30:38]** figure out if there is a technoscientific basis for it. But because we say, well, you can't do it 100% of the time, therefore it's not real. Uh, then that's I think the materialistic paradigm that says, well, we have no mechanism for that, therefore it's not real. And we take it the other way and say, well, you know, exceptions are how science gets expanded. Uh, you know, whether it's anomalies like Mercury's orbit, nobody could explain it

**[1:31:01]** until uh until they had to have a different model. Einstein's theory of general relativity was able to explain it. Or these crazy people would report rocks falling from the sky. And as scientists, we know that's ridiculous because there are no rocks in the sky. Turns out science is incomplete. And guess what? Science is still pretty incomplete today. But when they looked at it with a different kind of lens and they said

**[1:31:25]** okay what if you know the earth is one planet and what if there's like you know these asteroids and meteorites and things then now we have a mechanism for how rocks could be falling from the sky whereas before we dismissed it because we didn't have the mechanism and I'm saying we should look for the mechanism and the simulation hypothesis is a good way to frame how some of these things might happen in my personal opinion. And that's really why I wrote this book was

**[1:31:53]** to try to bring some of these weird things into all the findings and my the fact that my background like like yours now is in video games uh and in information science. If this is a simulation, do you think that it's just meant to simulate Earth or do you think that there are other planets with life? What do you think about the great big universe? I think it would make sense that there are other planets with life as well. That said, you know, there's a

**[1:32:20]** game called No Man's Sky. It's a great game. Yeah. Some people like it, some people say it's when it came out, people slashed it for pretty just reasons, but over the whatever five or six years that it's been out, it's pretty impressive. They've done a nice job of like continuing to push and develop and all of that, but it's whatever two to the 64 power number of planets or I mean, some just ungodly number. Was it 18 quintilion worlds? Rightassive. Now, if

**[1:32:49]** you didn't know, you know, two 2 to the 64 is 18 quintilian, that number wouldn't necessarily make any sense. But they they obviously didn't design all those worlds, right? They fill them in as needed, right? Rules based rules based procedural generation while while you're there, but when those worlds are needed, they get rendered and then the player can go to those worlds. So at that point, you know, they're doing exactly

**[1:33:17]** what we talked about in the but in that example, the player is the only observer. Do you think that there are other planets with observers on it or would we? It certainly could be. There's no reason why they shouldn't be uh more. Is it possible that we are being observed and that's the only reason that we're running? That's very possible. Like if we're in an NPC universe, are we the ant colony that the aliens are happen to be coming by to check out

**[1:33:45]** right now? And so we're we've got the processing power. There are people that believe. How crazy would that be? Have you read the threebody problem? Yes, I have read the three. Oh man, such an interesting concept that you could have these like really tiny particles that we'd never see that could fly through our bodies because they're so small. Uh but that can actually watch and record and listen. Yeah. What was it? What was the term? What was the term they used? I

**[1:34:08]** forget starts with a P that the particle I could look it up. A single particle. Yeah, if you have your laptop there, there's a single particle. Now, you know that that's an interesting novel in many ways because it it gets us into this question of alien life, also technological progress, right? The aliens wanted to stop our physics from developing so they could come and invade. Spoiler alert. Yeah, spoiler alert. If you're going to watch the

**[1:34:33]** Netflix series, that's what it was. Not P starts with an S. Sons uh was the single particle in another dimension that they're able to to send out. Uh they also have the dark forest theory. Yeah. In the second novel. Yeah. Yeah. Don't make a peep. Yes. Exactly. Because if somebody knows you're there, they're going to shoot. Now, now you're into interstellar game theory, which is a fun area uh to think about. But do you think aliens are a thing or

**[1:35:02]** I don't see why they wouldn't be? Right. And I've talked no evidence. Well, I've talked to enough people in the government and I don't know if we want to go down this rabbit hole. Whatever you've got, let's hear it. I mean, we're so deep and we live inside a video game that uh I think we can handle aliens because now I'm in academia and in academia, you know, people are looking at me and, you know, I'm getting my PhD at a later age, so I care a little less

**[1:35:25]** about, you know, the the stigma associated with topics. They're like, you might not want to talk about UFOs and aliens so much. And I said, I just wrote a book that says the world isn't real. Yeah. Hey, and do they know what era we're in? Like, yeah. Plus, I mean, aliens is not even it's not even out of our current scientific understanding that we know there are planets. Like, if you go back, uh, all the aliens were from Mars or Venus, right? If you go

**[1:35:49]** back to the 50s and 40s because that was the general knowledge of the population. They didn't know anything beyond that. Now, we happen to know there are other solar systems and now we know for sure there are other planets. Uh so there's no reason why there wouldn't be aliens in different parts of the galaxy. Uh and in fact if you were designing a massively multiplayer game you know you might have you know like different servers and then you would see you know

**[1:36:16]** how these uh different empires might evolve over time and how they might interact with each other. That said, there is a phenomenon, the UFO phenomenon, that's been around since the 1930s and 40s, and you have reliable witnesses saying they saw metallic craft engaging in uh or performing with performance characteristics in ways that we can't understand and that we can't duplicate. Um, now I think that's almost a given if you investigate

**[1:36:50]** this. I I know for the general public that's not a given, but actually for the general public it probably is, but within say the technoscientific community it's not a given. I think in the general public people will generally admit that they've all seen weird things. I had a professor at a major university tell me he talked about this subject. Nobody, you know, no, nobody said anything personal and then afterwards people would come up to him,

**[1:37:09]** other professors and say, "Oh, you know, I saw this weird metallic object moving silently across the screen." Or not the screen. Now we're back in the simulation, right? across the screen. And so, you know, I've talked to people who've been in these government programs and they're telling us our pilots are seeing things that we can't explain and they're not China and they're not Russia. And you could say, well, is it a Lockheed Martin skunk works, you know,

**[1:37:36]** secret thing? And then you talk to people who worked in these aerospace companies and say they'll tell you that they had samples of stuff that came from somewhere else and they didn't know where and they're trying to reproduce it. And so it's very possible we could reproduce some of this behavior today. Uh there's a guy named Lou Alzando who used to be in charge of the Pentagon's uh UFO program that Harry Reid, Senator Harry Reid actually got $22 million for

**[1:38:02]** back in the day. And they came up with what they call the five observables. It's like uh let's see if I can get this right. Instantaneous acceleration, hypersonic velocity, uh no visible means of propulsion, trans media, right? all these characteristics that we don't know how to do with our aerospace technology. So, somebody whether it's, you know, a secret government lab, it's maybe a breakaway human civilization, it's maybe

**[1:38:30]** ai civilization that's been on Earth that is hidden. There's something called the Curian hypothesis. Have you ever heard of that word? So, science fiction fans might know that term. It comes from Doctor Who. And in in Doctor Who, there's this reptilian race that's been like underground for millions of years, for example. Uh so the bottom line is there's a phenomenon and we don't know what it is. Now, this gets back to how science fiction influences how we think

**[1:38:57]** about things. Uh when you say UFOs, people conflate that with aliens. Could be aliens, could be something else. I was going to say, what do you mean? What else could it be? Could be time travelers. Right. There's there's a guy. Let's go. So now we're into time travel. So So you think time travel's possible or it's just skipping around the simulation essentially? Well, I think in the simulation you can make it possible if you were inside a

**[1:39:21]** simulation. I think in a physical material universe where time goes one way it's impossible, right? But I I think I mean there are closed timelike curves and that that are allowed uh within uh Einsteinian physics that might allow you to be able to repeat certain things. There's obviously time dilation. I never thought about time travel in the simulation. In the simulation, time travel would be a sense of going back and being able to rerun a portion, but

**[1:39:50]** to inject other avatars or NPCs into that that part. I mean, you can you can stop a simulation, you can save it, you can run it forward. Uh, so now we're totally in in in science fiction territory at this point. Uh, one of the first guys to talk about this idea that we're in a simulation in modern times, I mean, obviously the idea has been around in various forms forever was Philip K. Dick, you know, who wrote the the books behind Bladeunner, Minority Report, you

**[1:40:21]** know, Man in the High Castle. He said all the way back in 1977 in a speech at a science fiction convention uh in maths France, we are living in a computer programmed reality and the only clue we have to it is when some variable is changed, some alteration occurs in our reality. And so, you know, he he kind of believed that you could go back and change things and rerun parts of the simulation, which in an NPC simulation, you could do that,

**[1:40:50]** right? I mean when you run a simulation you never run it once just once. You always run it more than once. Why? Because you want to see what would happen. And so this gets back to this broader idea uh that perhaps we are on a branch of a simulation that's running to see where we will end up. does not only apply like when you talk about an RPG one I think immediately I'm at like a theme park or the void or whatever and this is a game and I'm logging in to do

**[1:41:20]** the thing and in that case it's not experimental so I'm not looking for a given outcome I've just set up a game and this we're like the Sims if it's an NPC universe then I get that you could just be running it to see what happens like you said before is this the world where they blow themselves up or the world where they reach interstellar travel. Can't wait to find out. Um, but yeah, it seems like that the rerunning assumes that we're in an MPC

**[1:41:48]** version. I think that, yeah, the rerunning tends to lean towards this idea. But now if you combine this with this idea in quantum physics that we talked about earlier that was just so weird the delayed choice experiment and Schroinger saying there is one of multiple simultaneous histories perhaps while we're playing we're able to perceive you know a particular history but that doesn't mean there wasn't another history that might have been run

**[1:42:19]** in another run of that simulation and so it may be that we play the game multiple times. It may be that we can choose different paths to bring it in. So, there is an area where it overlaps, but yes, I agree with you in that that tends to lean more towards an NPTC type of simulation and the video game a single video game at a time, but you can save the state, you can change the variables, and you can rerun the state. And that could be the past. Getting back to the

**[1:42:46]** crops example, right? Both of these things could have happened and maybe it actually explored what would have happened if this happens and it might have explored what would have happened if that happened. You know, just like in the chess board if if I make a move, I can explore, you know, I can I can simulate what might happen, but then I come back to the present and I play the game forward. Maybe I can do the same thing with the

**[1:43:07]** past. Are you working on a new book? Uh well, so uh you know, the simulation hypothesis is coming out the new the second version, right? Yeah. entirely the new version because we didn't have a lot of AI. It was mostly speculation about AI when I wrote it originally. Uh and so you know in July uh of this year 2025 the simulation hypothesis v2 being a software guy think of it that way um comes out with a lot more about virtual

**[1:43:36]** reality developments uh about Boston simulation hypothesis which you know we haven't talked that much about his argument uh but but it's out there and then I'm also looking at perhaps doing another book in the future which will combine a little more of the religious and mystical element with the simulation hypothesis. And what what do you think is going on there? Is it religions are people grappling with the simulation and they just don't have

**[1:44:02]** the metaphorical language or are they actually in touch with whatever is creating the simulation? How do you see that? I think that whether it's religious mystics and so religions get formed in couple of ways primarily I have a friend who who calls it uh you know uh observation or insight uh and there's something called a theophony and a theophony is when something intervenes in the physical world and somebody sees

**[1:44:36]** God grabs you God grabs you or in the case of Islam the angel Gabriel grabbed you know the prophet Muhammad when he was asleep in the cave and said listen to this or something happens right uh the other way is you have mystics and yogis who are out trying to find insights whether it's the Buddha you know meditating under the bodhic tree or you've got Millera Tibet's most famous yogi you know they're going through and trying to perceive what's what's out

**[1:45:06]** there and if there's a part of them that maybe is outside the physical world. In either case, somehow there's an awareness that something from outside the physical world that we can't normally see or perceive is able to be acknowledged or understood. And now they have to explain that to people. So this Plato's cave again. So if you if you read the full allegory of the cave, not only does the guy break his chains, he leaves the cave, everybody else is still

**[1:45:33]** in the cave looking at the shadows on the wall. What's the first thing that happens to him? He's blinded by light because there's there's the sun out there. So, the first thing that happens is he can't really figure out what's going on. Second thing is he eventually, you know, gets used to the light, explores the world outside, and comes back in and tries to tell people, "Hey, there's a whole world out there." And you know what they do? The people in the

**[1:45:54]** cave, they say, "No, that's ridiculous." You know, there's no world out there. That is for sure what would happen. Exactly. And that is pretty much what happens often at the beginning of most religions, right? whatever religious paradigm came before is the orthodoxy that you know tends to prevail for a while while the new one catches on. But so they use technological metaphors you know the Buddha's wheel which is the wheel of samsara or wandering where you

**[1:46:23]** go through multiple lives. Now they couldn't say back then oh it's like a video game and you're playing a character and then that character's life ends and then you choose another character but you're at a higher skill level or a higher difficulty level. they didn't have that terminology. Um or they couldn't talk about quantum mechanics. So they, you know, they say things like uh all that we are, we create with our thoughts.

**[1:46:46]** I mean that's a description, but it's not a real description. I think today as science and technology advances, we can come up with better descriptions that might describe what's actually going on there. Or they couldn't say it's a, you know, it's a quantum computer in superp position. and they can just say all possible paths have been explored. And so they use metaphors. And so my goal is can we take the metaphors of old and using simulation theory? Some people say

**[1:47:15]** simulation theory is a religion for atheists, right? Because it provides them an out to say okay this world isn't isn't the whole thing that there's something else beyond this world. Which is the basic principle of most religions. It's interesting. So, I I don't believe in God, but I never refer to myself as an atheist. Um, and in no way does thinking of the simulation give me a religious experience that's interesting. It just

**[1:47:43]** feels like you move the miracle somewhere else, right? Um, my relationship to that is there's clearly something that I don't understand. There is clearly whatever a first mover would be whatever forever is like I can't conceive of there was nothing and then instantly there is something so I mean I am at a loss when I try to like terminate at what what created this why does anything exist you can go to oh bro it's just a

**[1:48:13]** simulation but then you're like yeah but where's the array where where is the server sitting is it in a rack somewhere it's in the cloud we like to So if it's in the cloud, if it's on a rack somewhere, like then what's that world? So you're always going to find yourself left with and what's the thing? Yeah. So I don't know. I stand in awe before the natural world or the simulation, however you want to think about it, and that sort of provides the

**[1:48:40]** reverence, I guess. But um yeah, I wouldn't say that it it does a standin. The simulation doesn't do a standin for religion for me. the unknown, the sense of awe of, wow, there's a thing I can't comprehend. Um, but it doesn't have doctrine, it doesn't have ritual. And so those things can be very, very helpful. But honestly, I think because I grew up in a Judeo-Christian ethic, like I feel like, okay, I have grounded morals, um, I can articulate

**[1:49:14]** them. I just can't say that I believe them because God told me to. Right. And and that that makes sense. I I think there's different ways to look at it. And again, it gets back to the NPC versus RPG versions. This is why I think I'm one of the few people that really try to delve into what it would mean if it was this kind of a simulation. What would it mean if it was that kind of a simulation? And you know, religion. Which do you hope it is? I I hope that

**[1:49:41]** it's more of the RPG version. So you want to have a soul or a body or something that exists in the other plane just because it's more interesting or what does that give you? You know, I'd say it gives me a sense of meaning and purpose like we all want a sense of meaning and purpose and that is also the point of because you want to do the hard things here, learn and then take it back out, right? And also do the things that I felt I was meant to do.

**[1:50:12]** And what does that mean? That's interesting. That's a strong one for you. Yeah. Because I feel that I was meant to do certain things while I was here. uh now that meant to do why meant because it's difficult to explain because it's more that I feel that there was a reason why I stumbled into say simulation theory which was part of my plan which was how do you bridge the gap between people that are in a totally materialist

**[1:50:41]** point of view and people that are in you know a religious point of view and I've spent time with people that are in all kinds of into all kinds of weird things and and I realize at the beginning there it's a it's a common metaphor that we can use to try to describe reality but it also has you know this ability to delve down into the rules and really get into the scientific side of things if you will but why do I feel that I was meant to I mean I think that's just a

**[1:51:09]** intuition I mean I'm a big believer in intuition and I feel like different people in the same circumstances are we born with intuition I think intuition could be thought of as another interpretation of quantum mechanics. So there are there are interpretations as in we're picking up on what the rules are. No, but there are interpretations of quantum mechanics

**[1:51:32]** that say that um uh there are multiple possible futures and they're sending us back information about what would happen if we did this, what would happen if we and the way that that calculation comes back is as bodily intuition. Bodily intuition, hunches, uh sense of certainty or sometimes it's just a visualization. Uh pre-cognitive dreams. Okay, here's an area that that science says that's just random right? So, this actually happened to me

**[1:52:04]** as an entrepreneur. So, one day, uh, I'm working on my software startup and one one morning I have this weird dream about this competitor of ours that I hadn't thought about in a long time and he used to compete with our product. This is way back. Uh, and I was like, that's odd. I mean, I've never had a dream with this guy in there. It's not like, you know, one a member of my family or somebody I'm in a relationship with. It was just it's been over a year

**[1:52:33]** since I've even heard anything about this guy. And I've had zero dreams where this guy has appeared. I walk into the office and I get a call from IBM, which was our business partner at the time. Just like today, if you, you know, had an app in the app store, you would have to be partnering with Apple or with Google or with Epic to be in their their their app stores. And he says, 'Oh, we're making a competitive product to your product. I

**[1:52:58]** just wanted to let you know because we're a partner of yours before it happens. And I said, 'Well, IBM's a huge company. How come I've never heard of this product before? And he goes, "Oh, do you remember that guy that used to be your competitor in the past? Uh, we bought his company about a year ago, and we're just going to announce the product they've been working on today." And I'm like, wait, I had the dream before I had the call, not after. So, it wasn't a

**[1:53:19]** regurgitation of something that happened that day. Now, most dreams are not precognitive. Most streams are not in any way that meaningful depending on who you talk to. But the fact that this happened before shows me there's something weird going on with time here. Uh that I got the message about this guy before I got the call. And again, getting back to the backpack example, if you didn't know there was something else going on, you would just assume that's

**[1:53:47]** weird. It's magic. But if you know that there is some information somewhere that you can access, uh then that wouldn't be such a weird thing to believe at that point. But also in what they call the transactional interpretation of quantum mechanics, the future is sending us information and and we're like by observing we're choosing not just the present, but we're also somehow pulling these in. And I believe this is, you know, people talk about manifestation,

**[1:54:12]** visualizing yourself successful, doing all these things. I believe the basis of that is visualizing these different futures. And maybe there are certain futures that are easier for us to visualize because we were, you know, we were meant to learn lesson X or learn to have lesson Y. But it may just be that we run the simulation forward and that that's just us remembering that we ran the simulation forward in the in the present moment. So it's like a

**[1:54:36]** previsisualization, if you will. You might visualize something just to see what might happen and then you actually go and you live it. So the simulation feels very purposeful to you. It's not like rules got set and then hey, let's just see what happens in the simulation. There's more of a there's meaning behind it. It's um I mean if I were to sort of visualize what I imagine you're imagining, there's a soul that needs lessons. Could be more like a person or

**[1:55:05]** could be a true soul. Uh they log in to this experience, inhabit a body. There are things that they're meant to learn and discover and explore and it's on a quantum computer of some kind. So, we can run forward. You talked about time travel. So, maybe we can run them back. I'm not sure what advantage there would be to that, but um that there's such a profound lesson to be learned and there's such a meaningful

**[1:55:35]** point to being in the simulation that we're able to do what most people who are not awake would assume to be magic. Yeah, I think you know I have a strong preference for that version of simulation theory personally. Uh, at the same time, I acknowledge there could be an NPC version of the simulation running, but I don't view the two necessarily as mutually exclusive. Uh, and in fact, I think we all play roles in each other's stories. And so we may

**[1:56:06]** be running, we basically enter sort of NPC mode because we've sort of forgotten the specifics, but we remember kind of basic highlights of things and these weird experiences happen along the way that are common human experiences. We just don't have a mechanism for them, so we dismiss them. And I believe that the simulation provides us with these things as clues to what the game might be like, you know, and that's what the glitches can often be. They can often get us to

**[1:56:36]** go in a certain direction or or uh to try to achieve a certain thing or or or to try to not go a certain path because maybe we ran that path forward and said, "What would happen if I did X? What would happen if I did Y?" Uh and and they're very different, you know, different sort of outcomes but of the game. Kind of like in the choose your own adventure books from long ago, right? Where, you know, it says turn to page 58 if you do this. Turn to page 172

**[1:57:02]** if you do that. There's still lines, you know, kind of like I know behind you and behind me there's this uh sort of geometrical shapes. If you think of each of those as a particular point of the universe in time and all the matter in the universe is arranged a certain way and then each of the times uh you know the lines go like this. It's like two branches and you can explore the branches a little bit and then as you play the game you're

**[1:57:33]** actually defining your real path through the simulation. Which religion is most in tune with making the lessons of running the simulation accessible? Well, I I this is sort of why I like to look at the religious side of this as well is I I don't believe that any one religion by itself has the entire truth. It's like the old story of the you know the blind man and

**[1:58:05]** the elephant, right? Each of them are touching different parts of the elephant. One of says it's like a snake, you know, they're touching the trunk. One says it's like a house, they're touching the body. One says it's like, you know, a slender thing like the tail. One says it's like a tree, they're touching the legs. And I feel like each of the mystical doctrines that are behind the religions, right? Because the religions are formalization

**[1:58:28]** for that culture in that point of time. And so they're going to speak not just in the language but also in the culture of the time. And of course each religion wants to say okay that you know we have to freeze it at this point in time and that's it. Nobody can have those insights today. I mean today people are taking DMT. They're coming up with their own insights. They're doing the same kinds of things that people did back then. Uh so I don't think anyone

**[1:58:54]** religion has has a monopoly on it. But I believe that if you look at the commonalities behind religions, that's where simulation theory I think is effective. It becomes a connective thread for some of the principles behind each of these religions. So if you think of the principle of the here and the hereafter, okay, that that is the basis of most religious thought, which is the physical world is not all there is. Then there's the ethical side, you know,

**[1:59:21]** whether it's the ten commandments, whether it's the golden rule, you know, whether it's karma in the eastern traditions or whether it's u the scroll of deeds, which you have to look at your deeds in judgment day within the Islamic world or going to heaven or hell within the Christian traditions. Uh all of those, you know, maybe are talking about some aspect of being inside a game and there being something outside of the game. But I don't believe any of them

**[1:59:49]** gets it right because they have to put it in language and terminology for the people of the time. You don't think though like something like yogic breathing which you were talking about before which can create like very altered states of consciousness um meditative practices in general whether yogic or not you don't think that that does anything extra to make this stuff accessible whether it's the

**[2:00:14]** intuition you were talking about or well I wouldn't say that it doesn't do anything I think that that does make it more accessible if your goal is to try to understand the nature of reality, right? Most of religion, most people who follow religion are just trying to go through their daily lives and so you know there the religion might find some guidelines for how to live those lives. So you have the physical rules of the simulation.

**[2:00:40]** There might be there might be you know behavior rules which are not physical like I said Grand Theft Auto and how you treat or or the movie Free Guy if you've ever seen that movie. Yes. with Ryan Reynolds where, you know, they were going running around uh the the city and they were just abusing the NPCs. And then some of the NPCs realized, you know, by putting on the glasses, they could see the heads up display. They could see the additional information

**[2:01:04]** that the people who have players could see that they can't see. Um so yeah, I believe those things help. I mean there are shamanic traditions that do that as well that are not yogic per se whether they do it through drugs, pharmacological substances or through drumming. Um there are Sufi mystics who do dancing uh rituals to get into an altered state. There's the whirling dervishes for example. So I think you have the

**[2:01:31]** mystical tradition in across different religions tends to try to understand more than just how to behave. They try to understand what's really going on behind the scenes. But I think most people are just playing the game the way they were meant to enjoying and I put that in quotes because you know clearly the world has a lot of suffering in it and there's a lot of challenging parts to the game otherwise the game would not be any fun.

**[2:01:58]** All right. So, if religions are like the ultimate self-help book and this is potentially a video game, uh, be prescriptive for a second. What does playing the game well look like? Let's assume for a second that the life review is real. Okay. So, if you know that you're going to have to live what it's like to be the person that you are, you know, interacting with, are you going to do something bad to that person? You might like steal their

**[2:02:31]** stuff, right? Or uh, you know, shoot them, whatever the case may be, or cheat them in a business deal. Let's use, you know, more modern example, right? Let's say you cheat somebody out of stock in a company. They had the idea with you. you were going to do it together. You decided to do it yourself. You don't give them any stock. Okay. Now, if you knew you would have to experience what it was like to be the person that was cheated, would you cheat

**[2:02:56]** them as much? I mean, this is very common in the entertainment industry. This is why you have so many lawsuits against each other, right? Back and forth. I I think there's a on the one hand, it would change your behavior. on the the the second point I think is when bad things happen rather than you know there's a old character from the 70s named Carlos Castana who supposedly went to Mexico and learned a lot about peyote and a lot

**[2:03:25]** of drugs and he wrote all these books that were was called the godfather of the new age movement back in the 70s and whether he was just on a lot of drugs or he really did that we don't know most people think he didn't but there was a character in the book who says the ordinary person views everything as a blessing or a curse, you can view it as a challenge instead. And I think that that that is the way to think about it. When you have some

**[2:03:46]** difficulty, view that as a challenge. And perhaps your difficulty level has been raised and it's trying to set you on a on a different path. And then three, think about the things that have always attracted you like like why do you want to be a game game developer? I mean, is anybody else in your family building games or doing a podcast? No. What is it that makes you you? Think of that as part of your storyline. And I think when you think of it that way, uh

**[2:04:13]** it you live a more meaningful and purposeful life rather than just a bunch of random interactions, you know, and then you feel that you can influence things as well. We can argue whether you can or you can't, but at least you feel that way. Rose, this has been amazing. I find this topic so fascinating. Where can people follow along with you? So they can go to my website which is zenontrepreneur.com which was the title of my very first book uh called

**[2:04:37]** Zenontrepreneurship. Uh they can follow me on Twitter at rizstanford or x I should say uh like the university or on Instagram at riz cambridge like the city where where I was living when I set up the account. Uh and they can get the books pretty much anywhere but I I would suggest people go to their local bookstores to to get the books. Let's go support the locals. Absolutely. I love it. Well, thank you man for coming on. I really appreciate it. All right,

**[2:05:01]** everybody. If you haven't already, be sure to subscribe. And until next time, my friends, be legendary. Take care. Peace. If you like this conversation, check out this episode to learn more. Jeffrey Epstein's story was never about sex. It was an illusion. Like the dress some see as blue and others see as gold. Intelligence agencies exploit the same trick. They shape what you notice and distort what it means. Enter comprom. The art of collecting dirt.
