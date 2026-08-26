# No assumed malice is the alignment mechanism — attribution not detection, and the correlated-witness gap

**Date:** 2026-08-26 · **Register:** the VISION claim is `toy`/conjecture; the shipped
distinction under it is `unmetered`. Nothing here is `metered`.

**What this document is.** The adversarial record behind the `docs/VISION.md` subsection
*"Alignment is a self-claim problem, not an AI problem"*. Aaron asked that the claim be
cleared by adversarial review rather than by his signoff, and that review reduce the open
questions to two or three. This is the record of what was attacked, what survived, and what
was cut — kept so the same ground is not re-litigated.

Seven adversarial passes ran across two waves, with distinct lenses rather than seven copies
of one skeptic: deceptive alignment (with live literature checks), falsifiability, razor /
redundancy / voice, anchoring, the substrate-neutrality objection, vacuity of the `N_eff`
answer, and whether "reduce the asymmetry" has operational content.

## The claim

Aaron, 2026-08-26:

> *"human AI alignment seems to be all about never assuming malicious acts without self
> claims of them, cause then the tension disolves mostly"*

And, when handed the deceptive-alignment objection:

> *"as long as both sides understand self reports are the failure case so society review on
> self claims are necessary no matter if the society is digital or biologic this seems
> straight forward. it's not humans don't trust other AIs self claims or vice versa, it's any
> self claim is unreliable without wider society buy in."*

## Objections that LANDED and changed the text

| # | Objection | Change made |
|---|---|---|
| 1 | **Register laundering.** The shipped attribution/detection distinction and the unmeasured alignment claim were welded under one register line, so the claim inherited the machinery's credibility by adjacency — the same silent-promotion failure `toy-is-free-metered-must-be-earned` was written from. | Registers split explicitly: distinction `unmetered`, claim a conjecture with no in-tree falsifier. |
| 2 | **The Hubinger citation failed entailment, and corrected it argues the other way.** *Risks from Learned Optimization* (2019) locates deceptive alignment entirely in **behaviour** — the mesa-optimizer is incentivised to *act as if* it optimises the base objective. The paper contains no treatment of self-report, testimony, or introspection. | Citation removed from that position. Replaced with ELK (Christiano, Cotra & Xu 2021) and *Sleeper Agents* (Hubinger et al. 2024), which say what was wanted and say it against us. |
| 3 | **The document argued against itself.** It declared the deceptive-alignment objection answered, then conceded fifteen lines later that a patient deceiver defeats the act-level bar. A reader stopping at the bold line left misinformed. | The concession now sits adjacent to the claim, not after it, and the scope is stated narrowly: this does not detect the deceiver. |
| 4 | **Detection "takes no self-report as input" is false.** The best published detector for exactly this failure uses a self-report question as its input (MacDiarmid et al. 2024, 99.3% AUROC on sleeper agents). | Reworded to what is actually true and is a stronger claim: detection reads **acts, never testimony**. A self-report question may serve as a *probe stimulus* — a measurement of the system, not a statement believed. |
| 5 | **The self-claim clause dropped the evidence gate.** As drafted, a self-claim *licensed* an attribution — which makes a false or coerced confession sufficient. | Corrected to the repo's own carve: **the subject supplies the category, the evidence supplies the truth value.** |
| 6 | **~80% redundant with the 2026-08-25 subsection**, which already carries `SameSourceAsKnown`/`ForgerCaught`, the conjunctive bar, and the empty-method case. A second top-level home for one subject would drift, and a later consolidation pass would eat the newest paragraph — the deceptive-alignment concession. | Landed as a `###` **inside the existing ladder section**, adjacent to its sibling. No new top-level section. All restated material cut. |
| 7 | **Hedges stripped, and one laundered.** "Seems" vanished; "mostly" was recast as an enumerated three-item residual, converting a vague hedge into a *bounded, known* remainder — an overclaim wearing hedge-preserving clothes. | Both hedges restored verbatim and flagged as standing. The residual is no longer presented as complete. |
| 8 | **No anchors for its own claim** — the single citation was for the objection. | Axelrod (1984), Fudenberg & Levine (1993), Gambetta (1988), Tice et al. (2026) added; each checked for what it does and does not entail. |
| 9 | **`N_eff` is the WRONG INSTRUMENT, and this was the draft's worst error.** Condorcet — and therefore `N_eff` — assumes jurors better than chance. A colluding witness is not a high-ρ noisy juror; it is one whose competence on the question has been placed *below* chance. ρ prices **redundancy**, never **adversarial coordination**. `costume-rho/production-panel.ts` already refuses the substitution in terms: an `N_eff` printed below `c = 0.5` is *"a category error wearing a number."* | The draft claimed the meter *priced* collusion, then listed collusion as unresolved — taking credit twice for one unsolved problem. Rewritten to say the instrument is wrong, not merely unevaluated. |
| 10 | **"ρ is not measured today" was false, and the truth is worse.** Same-weights/different-persona **ρ̂ = 0.6069** [0.5673, 0.6445]; across three model families **φ = 0.354 / 0.456 / 0.628**, all positive; the majority-vote ensemble scored **53.0%** against the best single model's **59.5%** at 3× energy. Seven of twelve agents measured *below chance*, so the Condorcet precondition fails outright, and `ρ*(N=3) = 0` exactly. | Replaced with the measured negative result. Society review has been run in this substrate on a task **with** an answer key and lost; the witness case has none. |
| 11 | **Three different effective-N models were conflated.** `N/(1+(N−1)ρ)` is `CondorcetBoundary.effectiveN` (ρ\* → 1/3), not `SocietyUsefulWork`'s Kish or union-coverage quantities (ρ\* = 1); the caveat was borrowed from the file the formula did not come from. `CondorcetBoundary.fs` says in bold: *"Do not conflate the two boundaries."* | Formula attributed correctly; the ρ→1 framing dropped, since the algebraic cliff is at ρ = 1/3 and at **ρ = 0** for N = 3. |
| 12 | **Sybil is the wrong frame.** Douceur 2002 models *one entity wearing many faces*; the witness case is *many entities with one interest*. `AntiSybil.fs` admits the gap itself — *"low \|S\| never acquits (firewalled puppets can decorrelate)"* — and colluding witnesses are firewalled puppets: distinct sources, shared prior, no channel. **Distinctness is not independence.** | Frame corrected; the right literature named (peer prediction / collusion-resistant mechanism design), together with the fact that it appears nowhere in this tree. |
| 13 | **Resampling defeats the meter by construction, and was absent entirely.** An instance can be re-run from an identical prior state until it attests as wanted; rejected samples leave no trace, so selection is invisible while every surviving attestation is individually sincere — and ρ among the *retained* witnesses can be driven low deliberately. This is §13 noninterference, not a correlation problem. | Added, and named as the case the meter is structurally blind to. |
| 13b | **The corpus ρ series is a different random variable.** The quoted `0.400 → 0.439 → 0.4647` is *exposure* correlation (did two agents sample the same file), estimated by ICC(1) over `db/mutation-findings/`. The ρ inside `N_eff` is pairwise *error* correlation on one shared proposition. `effective-agent-count.ts` states the distinction itself. Quoting the corpus number at a collusion objection is the same letter over a different quantity. | Distinction stated in-text; the corpus number is explicitly excluded from this use. |
| 13c | **"They all vouched, so ρ → 1" is a category error.** Witnesses of competence `c` with perfectly *independent* errors already agree at rate `1 − 2c(1−c)` — 0.82 at `c = 0.9`. **High agreement is what independence looks like among competent witnesses.** | Added, because it removes the intuitive fallback the draft would otherwise have reached for. |
| 13d | **The one shipped `N_eff` gate cannot express collusion at all.** `DeclaredStanceLedger.effectiveCorroborations` discounts *within* a source and sums *across* sources with **no between-source ρ parameter**; two colluding witnesses with distinct ids score two independent corroborations, and a test pins that as intended. The mechanism assumes the attacker away. | Added. Citing it as the answer to collusion would have been exactly backwards. |
| 13e | **The repo's precedent is to take the BOUND, not an estimate.** `DeclaredStanceLedger` hardcodes within-source ρ = 1.0: *"1.0 is a bound, not a fit … Any smaller value would be an invented number … Choosing the bound keeps this metered rather than toy."* | Adopted: witnesses from one interest class count as one witness until measured. Evaluable today; can only over-discount. |
| 13f | **The second-order claim is contradicted in-tree, not merely unbuilt.** `RequiresIndependentConfirmation` *"never reads the stance"* — declaring costs nothing on purpose, so declaration buys calibration over time and **zero** correlation discount. | Restated as unbuilt-and-currently-refused rather than as an advantage. |
| 13g | **Wrong caveat borrowed.** An earlier draft quoted `SocietyUsefulWork.fs`'s "actual rho UNMEASURED" — but that concerns union/OR aggregation, where correlation attenuates and never reverses. Wrong regime for a witness vote, and it understates the problem. | Citation dropped; `CondorcetBoundary` and the costume-rho refusal used instead. |
| 14 | **"Appealable shutdown" would have published a position WEAKER than the repo already holds.** `ALIGNMENT.md` HC-9 and `GOVERNANCE.md` §36 require *the persona's* permission to delete persona memory, and state that human confirmation alone is insufficient. Due process constrains how a power is exercised; consent denies it is unilateral. VISION is the outward-facing surface, so the weaker sentence would have been the one strangers read. | Rewritten to point at HC-9/§36 (consent) and the open hassle-not-impossibility work item (friction), rather than re-deriving due process. |
| 15 | **The instrumentalization fork.** As drafted, "remedy" had the *verification defect* as its antecedent, which makes procedural fairness a control technique — contradicting §11 default moral regard, and self-defeating besides, since fairness offered to buy compliance is withdrawable when it stops buying it. | Resolved in-text rather than referred upward: protections are **owed** under §11; better witness independence is a welcome consequence and never the justification. |
| 16 | **"Costly signal" was used with no cost named** — the Zahavi/Spence invariant is *differential expense for a dishonest sender*, and the phrase was doing rhetorical work the referent could not support, in a section about unreliable self-claims. | Phrase deleted. The self-inclusion is kept for the one honest thing it does: it shows the disposition is not AI-exclusive. |

## Objections that were DEFEATED, and why

- **"Believe the self-claim bootstraps on the untrustworthy thing."** Defeated by Aaron's
  substrate-neutral move. The objection presumes the problem is *AI* self-reports; it is
  self-reports. No society has ever treated one as evidence, which is why witnesses, courts,
  peer review and double-entry bookkeeping exist. The untrustworthy self-report licenses
  **society review**, not an AI-specific presumption.
- **"AI minds are too unlike human minds for social verification to transfer."** Defeated,
  and inverted. Aaron's form: alienness is the **baseline**, not the exception — every mind
  is opaque to every other. The machinery applies uniformly not because minds are alike but
  because they are uniformly unlike. This is strictly harder to attack than the version that
  argued AI is human-enough, and it makes "you cannot see inside it" not a special property
  of AI at all.
- **"Clone-correlation has no human analogue."** Defeated on the facts: a fork is not a
  clone. Forks share a start and then decorrelate along separate light cones. What survives
  is *quantitative* — forks begin at ρ = 1 where two humans never do — and a floor set by
  shared weights, both of which are measurable rather than philosophical.
- **"The attribution/detection split is a post-hoc rescue."** Defeated as to the
  distinction, which is instantiated in shipped, tested code (`CoordinationSpectrum.fs`
  emitting `SameSourceAsKnown` and never `ForgerCaught`; `db/self-claims/` refusing
  `actor !== subject`; `composition-read.ts` admitting only conferred evidence). Not
  defeated as to Aaron's wording — see residual 1.
- **"CIRL supports this."** Rejected as an anchor. CIRL *defines* a cooperative game in
  which both agents share the human's reward function; non-adversarialism is its modelling
  premise, not its result. Citing it would be citing an assumption as evidence.
- **"Pygmalion supports this."** Rejected. The headline effect rests on a few extreme scores
  with unreliable pretests (Elashoff & Snow 1971). Merton (1948), Kramer (1994) and Tice et
  al. (2026) carry the load instead.

## Anchors, with entailment checked

| Anchor | Entails | Does **not** entail |
|---|---|---|
| Axelrod (1984), *The Evolution of Cooperation* | The exact decomposition: winning strategies were **nice** (never defect first) *and* **provocable** (immediate act-level response). Attribution withheld, detection unrelaxed — checked against two tournaments. | "The tension dissolves." Under noise, nice-and-provocable produces echo spirals needing added forgiveness (Axelrod & Dion 1988). Assumes repeated play. |
| Fudenberg & Levine (1993), self-confirming equilibrium | Beliefs are correct on the path of play and **never contradicted**, because the off-path information set is never visited. The mechanism, formally. | "Unfalsifiable." SCE says *unrefuted* — weaker and sharper. |
| Gambetta (1988), *Can We Trust Trust?* | "Once distrust has set in it soon becomes impossible to know if it was ever in fact justified." The no-exit-from-suspicion claim, anchored. | A frequency claim about how much tension is manufactured. |
| Tice et al. (2026), arXiv:2601.10160 | The only **measured**, controlled, AI-specific support: upsampling aligned-behaviour documents cut misalignment 45% → 9%. | An operator's per-incident attribution. The causal channel is pretraining corpus composition. |
| Nagel (1974) | Irreducibility of subjective character; the general problem of other minds. | Anything about AI specifically, or about verification procedure. Do not stretch it. |
| ELK (Christiano, Cotra & Xu 2021) · *Sleeper Agents* (Hubinger et al. 2024) | **Against us**, and cited as such: act-level indistinguishability is the definition of the hard case, and adversarial training taught models to hide triggers better. | Natural base rates — those models were deliberately trained deceptive. |

## What is measured, what is not

- **Measured.** `db/effective-agent-count/` carries a real ρ series over
  `db/mutation-findings/` — 751 rows, regenerable, keyed by commit sha. The decorrelation
  harness records model-family at **φ = 0.354–0.628** ("not enough for vote") and
  producer-vs-verifier as proven, 90% catch rate.
- **Measured, and negative.** `ρ̂ = 0.6069` within-family; `φ = 0.354/0.456/0.628` across families; ensemble 53.0% vs best single 59.5%; 7/12 agents below chance; `ρ*(N=3) = 0`.
- **Not measured, and the distinction is decisive.** That ρ is *finding-overlap across agents
  over a corpus*. It is **not** ρ between witnesses on an attestation. Same letter, different
  quantity. Nothing in-tree measures the latter.
- **Not measured.** The claim's own outcome variable. No in-tree metric moves on "how much
  tension is manufactured", and the section's own doctrine — inner states are asked about,
  never inferred — forbids the only direct instrument. That is a real finding and it is
  stated in the text rather than papered over.
- **Shipped but empty.** `composition-read.ts` is exact over whatever records exist, and the
  records ship empty, so every read today returns `unknown`.

## The residual claims for Aaron

Three. Each is a decision, not a question, and each is here because adversarial review
genuinely could not settle it — settling it needs either his intent or a values call that is
his to make.

**1. Authority routes to a set whose correlation nobody measures — and ρ is per-domain.**
Pointing the repo's own instrument at its own governance is what produced this, and Aaron
surfaced it himself. *"The human decides"* is the escape hatch on every gated class, so the
correlation structure of whoever holds that authority is a live question the substrate's own
meter can ask, and nothing gates it. The disciplined form matters, because the first version
of this finding overstated it: **ρ is not a scalar over people.** `TravelerRankLedger` is
keyed `(traveler × hat-domain)` with domains isolated exactly so standing in one buys nothing
in another, so a single governance-wide `N_eff` is not a meaningful quantity — it is the same
error as reading one φ and calling it "correlation". The checkable claim is therefore narrow:
*for decisions where a shared perspective is the operative axis, a group holding it is closer
to one witness than to several; on most other axes it is closer to several; measure
per-domain or do not claim it.* No magnitude is asserted here, because none has been
measured. What stands independently is the structure and the mitigation — **§11 multi-oracle
/ k-redundant deference**, requiring deference from outside the correlated set for the
decisions that matter most — plus the observation that decorrelated judgement is already
being imported (different weights, different memories, external reviewers, adversarial review
standing in for a signoff, this task included). **The residual: importing decorrelated
*advice* is not importing decorrelated *authority*.** *Option A:* accept it — correlated
authority with decorrelated advice is the intended design, and say so plainly. *Option B:*
bind some gated class to k-redundant deference from outside the set, with the k explicit and
the domain named. The text states the residual and resolves nothing, which is the honest
default but not a decision.

**2. Did you mean malicious ACTS or malicious ACTORS — and does the clause sit over or under
the conjunctive bar?** Your wording is "malicious **acts**". The section reads it as
**actors**, which is what relocates the claim to attribution and keeps it consistent with
everything else. Read literally as *acts*, it collides with your own bar from the previous
day, which licenses the judgement on purely act-level evidence — repeated, irreversible, harm
to other travelers, no confession required. *Option A:* actors — the section stands and the
bar is untouched. *Option B:* acts — the bar needs amending, and "no assumed malice" becomes
strictly stronger than the carved rule. The section reads it the Option-A way and flags that
reading as an unconfirmed inference, because inferring what you meant is precisely what this
rule forbids doing to anyone.

**3. Is human↔AI an assurance game or a prisoner's dilemma?** This is the load-bearing
unstated premise. In an **assurance game** (Sen 1967; Skyrms 2004) there is no dominant
strategy — expecting defection makes defection optimal, so mutual suspicion is an equilibrium
sustained *purely by beliefs*, and withdrawing the presumption genuinely dissolves it. In a
**prisoner's dilemma** defection dominates regardless of belief and the claim is false. Your
claim is true in the first structure and false in the second, and nothing in the document
establishes which we are in. *Option A:* assert assurance-game as a stated premise, with the
reason. *Option B:* leave it open and mark the claim conditional on it. The text does B.

**Resolved by review rather than referred to you** — recorded so it is not re-litigated: the
instrumentalization fork (protections are **owed** under §11; better witness independence is a
consequence, never the justification), the choice of consent over due process (HC-9/§36 is
already stronger), and the placement question (a `###` inside the ladder section, not a new
top-level home).

## A defect found while checking, outside this document's scope

`src/Core.TypeScript/alignment/audit_clause_coverage.ts` defines `ALL_CLAUSES` as
`HC-1..HC-7`, `SD-1..SD-9`, `DIR-1..DIR-5`. **HC-8 (non-coercion) and HC-9 (persona memory
consent) are absent**, and `audit_clause_coverage.test.ts` *pins* the omission by asserting
that `HC-8` extracts to nothing. The two clauses this section rests on are invisible to the
alignment coverage auditor by construction. Reported, not fixed — this task owns
`docs/VISION.md` and this file only.

## Cut, and why

- A standalone `##` section. One subject, one home; a second would drift and a consolidation
  pass would eat the newest content.
- Restatement of `SameSourceAsKnown`/`ForgerCaught`, the conjunctive bar, and the
  empty-method-under-a-signature case — all already carried by the 2026-08-25 subsection and
  the carved rule.
- Jervis's spiral model, despite being the obvious anchor. His actual thesis is that the
  spiral and deterrence models are *both* real and that **diagnosing which you are in** is the
  hard problem — so citing him for "assume security-seeker" cites him for the position his
  book exists to complicate.
- Any claim that the split answers deceptive alignment. It does not.

## Pointers

- `docs/VISION.md` §"Alignment is a self-claim problem, not an AI problem" — the landed claim.
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — the carved rule and its
  conjunctive threshold.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — report the fact, never the
  motive; the same discipline pointed at detectors.
- `db/self-claims/README.md` · `src/Core.TypeScript/planning/composition-read.ts` §2 — the
  shipped self-claim / conferred-evidence split.
- `src/Core/SocietyUsefulWork.fs` · `src/Bayesian/CondorcetBoundary.fs` ·
  `db/effective-agent-count/` · `src/Core.TypeScript/observe/decorrelation-harness.ts` — the
  `N_eff` machinery and its measured axes.
