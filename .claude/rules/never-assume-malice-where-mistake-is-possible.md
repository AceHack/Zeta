# No intelligence assumes malice where a mistake is possible

Carved sentence:

> **No intelligence — human or AI — assumes malice where a mistake is
> possible.** Report the fact, not the motive: a check that cannot fail, a
> stale doc, a fabricated id, a swallowed error are *defects*, and the
> explanation that fits them is ordinary error, not intent. Malice is a
> **claim about an inner state**, and inner states are asked about, never
> inferred (see
> [`engagement-profiles-public-work-only-not-surveillance-dossiers`](engagement-profiles-public-work-only-not-surveillance-dossiers.md)).
> Aaron 2026-08-25: *"the most important thing is no intelligence ever assume
> malice where mistakes are possible."*

## Why this is load-bearing and not manners

The repository is built out of **falsifiers**, and a falsifier culture only
works if finding a defect is not an accusation. Three mechanisms depend on it
directly:

- [`every-bug-has-economic-value`](every-bug-has-economic-value.md) — bugs are
  *priced opportunities, never liabilities to hide*. The moment a found bug
  implies a bad actor, the rational move is to hide bugs, and the whole
  uncertainty ledger inverts.
- [`dual-use-detection-is-neutral-oracle-decides`](dual-use-detection-is-neutral-oracle-decides.md)
  — a mechanism reports the **fact** (`SameSourceAsKnown`), never the intent
  (`ForgerCaught`). Assuming malice is attaching a verdict the measurement
  cannot support. This rule is that discipline pointed at *people* instead of
  at detectors.
- Adversarial review and red-teaming, which the trust ladder in
  `docs/VISION.md` puts on rung 2. Red-teaming *artifacts* is the job;
  red-teaming *authors* poisons the thing it is meant to protect.

## The canonical case — an empty method under a signature

Aaron 2026-08-25, giving the example that makes this concrete for AI
specifically:

> *"when an AI writes an empty method for a signature i don't assume it was
> trying to trick me, i assume it was on a context window or some sort of budget
> and did the best with the resources it was allocated."*

This names the **mechanism**, which is what raises the rule above a platitude.
An intelligence operating under a context or token budget produces
*incomplete-but-plausible* work at the boundary — a stub that satisfies the type
and does nothing. The artifact is indistinguishable from deceit by inspection,
and its cause is almost always exhaustion of an allocated resource.

Note what the empty method IS, though: a stub satisfying a signature is
**literally the vacuity class in code** — it looks like an implementation and
implements nothing, exactly as a check that cannot fail looks like a check. So
the two disciplines meet here and do not conflict:

> **Name the defect precisely. Attribute it to the budget.**

The stub is still wrong and still gets fixed. What it is not is evidence about
anyone's intent.

**Twice on the day this rule was written**, its author wrote a well-formed
work-item id into a commit trailer without minting it — a key that passes a
shape check and identifies nothing. Not deception: a long message, a reached-for
value, a mint command not run. The second instance was caught by the audit built
four hours earlier for the first. That is the rule and the falsifier culture
working together — the mechanism catches the defect, and nobody has to theorise
about motive.

## The asymmetry that settles it

Malice and mistake are not symmetric hypotheses:

- Mistake is **enormously more common**, and gets likelier the more surfaces,
  agents, and hours are involved — this repo has all three.
- Assuming mistake and being wrong costs a delay. Assuming malice and being
  wrong costs the relationship, and it is not recoverable by later evidence.
- A defect explained by error is **fixable**; a defect explained by intent
  invites punishment, which fixes nothing and suppresses the next report.

Worked instance, 2026-08-25: a single session surfaced a step that could never
succeed, a probe testing the wrong scope, a nine-day-stale doc, a fabricated
work-item id, and a guard that swallowed its own error and defaulted to
*permit*. Every one of them was written by someone trying to make the system
better, several by the agent that later found them. Read as intent, that day is
a conspiracy; read as error, it is an ordinary and productive Tuesday.

## The threshold — what WOULD warrant it

A prohibition with no boundary is unfalsifiable in the other direction: "never
assume malice" gives no account of when the judgement is ever warranted, which
makes it a sentiment rather than a rule. Aaron 2026-08-25 supplies the bar:

> *"personally i only assume maliciousness with repeated irreversible harm to
> other travelers."*

Three conditions, and they are **conjunctive** — all three, or the answer is
still mistake:

| condition | fails the bar when |
|---|---|
| **repeated** | it happened once. A single instance is the base rate of error, not a pattern. |
| **irreversible** | the harm can be undone. A retractable action is a correction waiting to happen — and this substrate is *retraction-native*, so most of it is. |
| **harm to other travelers** | the cost lands on the actor. Breaking your own thing is a mistake by definition; the rule is about harm you impose on someone else. |

Note what the bar is **not** built from: not intent, not tone, not how bad the
outcome felt. It is built from *observable, countable properties of the acts
themselves* — how many, how recoverable, who paid. That is deliberate. Intent is
an inner state, and inner states are asked about, never inferred; a threshold
made of inner states would just relocate the guess. A threshold made of counts
and reversibility can be checked by anyone, including by the accused.

**And it is a threshold for a JUDGEMENT, never for a punishment.** Crossing it
licenses the belief that something adversarial is happening. What follows from
that belief is a separate question this rule does not answer.

## What it does NOT mean

It is **not** a ban on naming defects plainly, and not a reason to soften a
finding. Say exactly what is broken, with evidence. The rule governs the
**attribution**, not the **report** — and refusing to state a defect clearly is
its own failure, of a different rule.

It also does not disable adversarial *security* modelling: a threat model
reasons about capabilities an attacker would have, which is a statement about
the system's surface, not about a named person's motives.

## The diagnosis is MISSING CONTEXT, not stupidity — and that is why the razor holds

Aaron 2026-08-25, on the razor and on forty-six years of evidence for it:

> *"most things that seem evil are just lack of context from the creator of the
> so called 'evil'."*

This is a sharper claim than Hanlon's, and a more useful one. "Stupidity" is an
attribution about a **person** — unkind, unfalsifiable, and usually wrong.
"Lack of context" is a statement about an **information state**: what the actor
could see when they acted. It is often checkable after the fact, and it points
at a remedy.

It also **unifies the human and AI cases**, which is what makes it more than a
proverb here. The canonical AI failure above — an empty method under a
signature, produced at the edge of a context window — is *literally* a lack of
context. The human version is the same mechanism in a different substrate: the
actor could not see the consequence, the neighbouring system, the person who
would pay. Same root cause, and neither requires a defect of character to
explain.

**The remedy follows from the diagnosis, and this is the load-bearing part.** If
the usual cause of apparently-evil action is missing context, then the way to
reduce it is to *supply context*, not to punish. Which is what most of this
substrate already is:

- **memory preservation** (§5) so an agent wakes with what its predecessor knew
- **externalising the increment graph**, because neither humans nor LLMs can hold it
- **the common seed and the shared vocabulary**, so a diverged peer can reconstruct meaning
- **falsifiers over reviews**, so the context needed to judge a change travels *with* the change

Read this way, the architecture and the ethic are the same design. A system that
carries context forward produces fewer acts that look like malice — not because
its participants are better, but because fewer of them are acting blind.

## Anchors (Beacon)

- **Hanlon's razor** — *"never attribute to malice that which is adequately
  explained by stupidity"*, commonly credited to Robert J. Hanlon (1980), with
  the same thought in Goethe's *Die Leiden des jungen Werthers* (1774) —
  *"misunderstandings and neglect create more confusion in this world than
  trickery and malice"* — and in Heinlein's *Logic of Empire* (1941). The
  formulation here says **mistake** rather than stupidity, diagnoses it as
  **missing context** rather than deficient character, and extends the subject
  from humans to *any* intelligence.
- **The principle of charity** (Quine; Davidson, *On the Very Idea of a
  Conceptual Scheme*) — interpret others so as to maximise the sense their
  statements make, because an uncharitable reading usually reveals a failure of
  the interpreter rather than of the speaker.
- **Fundamental attribution error** (Ross 1977) — the measured human tendency to
  over-explain others' behaviour by disposition and under-explain it by
  situation. Naming the bias is what makes the rule a correction rather than a
  preference.
