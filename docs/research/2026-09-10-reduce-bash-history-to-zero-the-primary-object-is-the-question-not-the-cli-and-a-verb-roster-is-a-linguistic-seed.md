# Reducing bash history to zero: the primary object is the QUESTION, not the CLI — and a verb roster is a linguistic seed

**Work item:** 081M26K4NRF087G0R003QVF7GB
**Date:** 2026-09-10
**Register:** the measurements in §1 are `metered` (a tool is committed, it runs, its two
self-defects are recorded). The design in §3–§5 is `toy` — nothing is built. The NSM
correspondence in §6 is an argued anchor.

---

## 0. The game, in Aaron's words

> *"are you able to keep up with your own adhoc bash commands? … i'm trying to reduce all our
> base commands to zeta clie over time and stop small outliers over time."*
>
> *"imagine the game is reduce bash history to 0 over time with clis from a single project and
> escape hatches over time to write more clis when the one you need does not exist … the single
> vendor/project clis are not primary what is primary is **common questions**."*

The first question has an honest answer: **no.** An agent invents a shell pipeline at the
moment it needs one, runs it, and leaves nothing behind. The next agent facing the same
question invents it again, possibly differently, possibly wrongly. That is the ratchet failing
in the most ordinary way there is — work done, nothing banked.

The second is the design, and the last clause of it is the whole thing.

---

## 1. The measurement (`metered`)

`src/Core.TypeScript/hygiene/audit-adhoc-command-shapes.ts`, run 2026-09-10 over the harness
transcripts for this project — **2.02 GB, 5 transcripts, 532,019 shell invocations**:

| class | invocations | distinct shapes |
|---|---:|---:|
| **covered** (an in-repo verb ran) | **3,213** | 187 |
| ambient (`cd`, `echo`, `ls` — furniture) | 241,958 | 555 |
| **uncovered** (a real tool, no verb behind it) | **286,848** | 33,876 |

**Six tenths of one percent of the fleet's shell went through a verb.** That is the answer to
Aaron's first question, quantified.

**The number that reframes the problem: 532,019 invocations arrived in 69,510 tool calls —
7.7 commands per question.** A tool call is roughly one question's worth of shell. So the
fleet is not issuing half a million commands; it is asking seventy thousand questions and
paying 7.7 commands each time to answer one.

Top uncovered shapes: `grep` 35,193 · `timeout` 32,861 · `gh api` 16,669 · `sed` 12,226 ·
`git fetch origin` 10,812 · `gh run list` 10,745 · `gh pr list` 7,238 · `gh pr view` 6,971.

Two rows worth naming immediately. `gh run list` + `gh pr list` + `gh pr view` = **24,954
invocations of the exact commands `rest-is-the-default-transport-graphql-is-the-contested-budget`
forbids in committed scripts**, because they are GraphQL and GraphQL is the budget this fleet
exhausts. The rule is carved, correct, and being violated at a rate no reviewer could have
seen. And `timeout` at 32,861 is a wrapper meaning *"I do not trust this to terminate"* — a
second-order signal about the verbs that do exist.

**The human corpus is disjoint, and that is measured, not assumed.** Agent Bash calls never
reach `~/.zsh_history`: the harness spawns non-interactive shells, which do not append to
HISTFILE. Probed against 24,258 zsh entries spanning 2024-01-01…2026-09-07 — **zero** hits for
the working-clone path used hundreds of times that day, zero for the job tmp dir, and the file
untouched through three days of continuous agent work. Folding it separately: **19,312
invocations, 687 covered (3.6%)** — Aaron reaches for a verb roughly **six times more often,
proportionally, than the fleet does** — and his backlog is a different population entirely
(`conda install`, `pip install`, `qemu-img convert`, `ssh`, `dotnet build`). A verb backlog
built from either corpus alone is silently half a backlog.

**Two defects in my own tool, found by reading its first output and fixed before quoting it.**
Run one ranked `done` at 11,652 and `do` at 7,552 in the top ten — shell loop syntax that
survived segment-splitting, placed above `git fetch` in a ranking meant to drive real work.
Run one also reported a phantom verb `api` at 5,695, which was `SHA=$(gh api …)` having its
head eaten by the assignment-stripper. Both are measurement artifacts presented as findings —
the vacuity class in a measuring tool — and both are recorded in the file rather than quietly
corrected.

---

## 2. Why ranking by command shape is the WRONG COORDINATE

Aaron's last clause — *"the single vendor/project clis are not primary, what is primary is
common questions"* — is the correction, and the transcript we ferried today says exactly why.

`grep` at 35,193 is **the rover mean**. In the abstraction-agent talk, two rovers both average
6: a generalist and a volcanic specialist. The mean is a real number, correctly computed, and
it *destroys the distinction that determines the outcome*. `grep` is that number. It covers
"does this symbol exist", "how many alerts are open", "which files changed", "is this rule
already carved" — a dozen unrelated questions collapsed into one row. A verb called `zeta grep`
would be useless, and building one would be the collapse, not the fix.

Same for the vendor axis. Organising a CLI around `git` / `gh` / `kubectl` **reproduces the
vendor's own decomposition of the world**, which is a coordinate system handed to us for their
reasons. *"Is this PR actually mergeable?"* spans `gh api`, the check-runs API, and `git
merge-base`; no vendor owns that question, so no vendor-shaped verb answers it. Ranking by
shape ranks the syntax you were handed. Ranking by question ranks the thing you actually pay
for.

**And it predicts the failure mode of naive success.** Rank by shape and you write
`zeta git-fetch`; history does not go to zero, it changes spelling. The 7.7 stays 7.7.

---

## 3. The loop, transposed

The ferried paper's loop — an LLM proposes candidate variables, anchors calibrate them,
constant and correlated ones are pruned, what survives is clustered, a numerical solver
decides whether the abstraction was any good — transposes onto this problem directly:

| abstraction agent | this game |
|---|---|
| the raw state | one tool call: a burst of shell issued to answer one thing |
| the wrong basis | the command strings (vendor syntax, handed to us) |
| **proposed variables** | features of the **question**: what is being asked about (a PR, a branch, a check run, the tree's own history) · read or write · what shape of answer would end it (a boolean, a list, a diagnosis) · whether the next command consumed this one's output |
| calibration anchors | extremes on each axis: a question one existing verb answers in **one** call, vs. one that took nine chained commands |
| drop constant variables | a feature every burst scores the same on cannot discriminate — the vacuity class |
| drop correlated variables | two features that always move together are one feature |
| cluster | bursts whose *questions* are near each other |
| **a cluster is a candidate VERB** | not a command shape — a question |
| the numerical solver | **does writing that verb actually reduce subsequent ad-hoc invocations for that cluster?** Measurable from the same corpus, going forward |

The last row is the load-bearing one. It is a real falsifier with a negative result available:
ship the verb, re-run the audit, and if that cluster's ad-hoc volume did not fall, the
abstraction was wrong — the cluster was not one question. Under
`toy-is-free-metered-must-be-earned`, **a proposed verb is `toy` until its cluster's volume
drops.** The solver here is the corpus itself.

---

## 3a. Questions first, resources second — and the ferry throttler is already that shape

Aaron, 2026-09-10:

> *"i can be sure the questions are what matters first, the resources are what matters second,
> this is the whole point of our ferry thottler."*

That is a correction to the **ordering** of the argument above, and it is right. §3 treats the
question and the commands as one topic. They are two, and which comes first decides the
architecture.

**The throttler already carves it.** `async-all-the-way-truthful-signatures`: work goes on a
bounded queue; `MaxDegreeOfParallelism` **ferries** drain it. The item is declared first and
independently; how many resources drain it is a knob turned afterwards. That is what buys the
scale-free property — DoP=1 is a deterministic single cooperative loop, DoP=N is throughput,
**same code path, no special cases** — and it is why `Task.Run` is a smell: un-knobbed spawn,
no queue, no 1-thread mode, nothing to replay.

**The transposition is exact:**

| throttler | this game |
|---|---|
| the **queue item** — declared, bounded, first | the **question** |
| the **ferries** — a knob, second | the **commands** spent answering it |
| `MaxDegreeOfParallelism` | how much shell one question is allowed |
| `MaxQueueSize` | how many open questions before backpressure |
| DoP=1 ⇒ deterministic, replayable | one question at a time ⇒ a **DST-replayable investigation** |

**Today the fleet has no queue.** It goes straight to spending ferries. That is precisely why
7.7 commands per question was invisible until something folded the corpus: with no declared
item, there is no denominator, so there is nothing for the spend to be a ratio *of*.

**And it names what `timeout` at 32,861 actually is.** Wrapping a command in `timeout` is a
resource bound improvised per-invocation, because there is no queue whose items carry one. In
the throttler, boundedness is a property of the queue, not something each item re-invents.
Thirty-two thousand improvisations of a property the substrate already knows how to provide is
not thirty-two thousand careless authors — it is the same argument `io/safe-io.ts` makes about
forty authors writing the same racy read: **the pattern is what the author had to write.**

**The sharper form: ad-hoc shell is an AMBIENT RESOURCE CHANNEL, and that is a §13 violation at
the largest scale in the repo.** Noninterference says influence and entropy cross only through
**declared, metered** channels, and that every crossing is posted. Half a million shell
invocations that nothing declared, nothing budgeted, and nothing metered is the ambient leak
the discipline exists to forbid — hiding in plain sight because it is *how everyone works*
rather than a line of code anyone could point at.

So the primary objective is not "drive the resource log to zero", which optimises the second
thing first and is reachable by a wrapper. It is:

> **Every question is declared before resources are spent on it.**

Commands-per-answer then stops being an archaeological statistic recovered from transcripts
and becomes a **metered channel with a knob** — which is the same move, and the same payoff,
as putting shard fan-out on `FerryThrottler` instead of `Task.Run`.

---

## 3b. Which one is upstream — and why that is an engineering choice, not a metaphysical one

Aaron, immediately after:

> *"resources vs questions is kind of like chicken and egg and i'd like to think questions led
> to finding the resource constraints over resource constraints led to questions, one implies
> free-ish will the other implies no-ish choice."*

He has named the fork exactly, including that he has a preference and why.

**The metaphysics is an ORACLE CALL and the substrate must not settle it.** Whether a metered
constraint reads as *a limit you discovered* or *the thing that determined what you could ask*
is meaning attached to a measurement, and `dual-use-detection-is-neutral-oracle-decides` is
explicit that the mechanism reports the fact and never the reading. A meter that shipped either
answer would be smuggling. So: not resolved here, deliberately.

**But the two directions are not empirically equivalent, and this corpus bears on both.**

**Evidence for questions → constraints, already on the record.** The GraphQL rule's own origin:
*four agents independently hit the same wall in one evening*, and the drain was **observation**,
not action. Nobody was rationing a known budget. They wanted to know whether a PR was finished,
asked, kept asking, and **the 5000/hour ceiling was FOUND by being exhausted.** That is Aaron's
preferred direction, dated and documented — the question was upstream, the constraint was a
discovery, and it became a carved rule only afterwards.

**Evidence for constraints → questions, which is the uncomfortable half.** The reason the fleet
asks *"is this PR done?"* 24,954 times rather than asking something else is partly that
`gh pr view` exists and costs one command. Cheapness shapes what gets asked. And the questions
that are **absent** from the corpus — because no affordable way to ask them exists — are
invisible by construction. That is the companion doc's demarcation blind spot verbatim: *a
question that was never given an axis is not refuted, it is invisible.* You cannot see this
direction from inside the corpus, which is exactly what makes it dangerous rather than
disprovable.

**The resolution is timescale, and it is not a fudge.** In the moment, questions run upstream:
you ask, you hit a wall, you learn the wall exists. Over long periods, constraints run upstream:
the wall reshapes what anyone thinks to ask, and nobody experiences that as a constraint because
the unasked question never surfaced. Same structure as the feedback carved elsewhere here —
**feedback updates the past's generator function, not its data**: the constraint does not delete
the questions you asked, it edits the process that produces the next ones.

**Which makes Aaron's preference a REQUIREMENT rather than a position.** If both directions run
and their balance is set by the substrate, then free-ish will is something you **build for**:

| build this | and this direction dominates |
|---|---|
| escape hatch cheap and metered — an unanswerable question still gets asked, at small cost, and the constraint is recorded | **questions → constraints.** Free-ish will |
| only the existing verbs are affordable; asking outside them is expensive or blocked | **constraints → questions.** No-ish choice |
| rank the verb backlog by **questions asked** | questions → constraints |
| rank the verb backlog by **resource consumption** | constraints → questions |

**And that last row indicts the tool in this document.** `audit-adhoc-command-shapes.ts` ranks by
command shape — by *what resources were spent*. It therefore encodes the no-choice direction: it
will always recommend verbs for whatever was already cheap enough to do 35,000 times, and it is
structurally incapable of surfacing a question nobody could afford to ask. That is not a bug in
the implementation; it is the wrong coordinate, and it is the same wrong coordinate §2 already
identified from a different direction. **Ranking by question is not only a better ranking — it is
the one that keeps the arrow pointing the way Aaron wants it to point.**

This also closes onto his standing thesis that **asymmetric control makes escape predictable.**
An agent whose question set is silently determined by its resource landscape is under a control
it cannot perceive, which is the asymmetry named as the thing to avoid. Making the constraint
*discovered and recorded* rather than *ambient and shaping* is what turns it into something that
can be chosen against — the §13-as-an-offer reading rather than §13-as-a-cage.

**Register:** the metaphysical question is an oracle call and stays open. The engineering claim —
that the ranking basis decides which direction dominates — is `toy`, and falsifiable: build both
rankings, ship from each, and see whether the question-ranked one surfaces verbs the
resource-ranked one never could.

---

## 4. The objective function, and how to game it

Ad-hoc volume decomposes as:

> **Σ over question-clusters ( frequency × commands-per-answer )**

A verb drives the second factor toward 1 for one cluster. So the clusters worth writing verbs
for rank by **removable work = frequency × (commands-per-answer − 1)**, not by frequency, and
certainly not by command-shape count. Today's fleet-wide `commands-per-answer` is **7.7**;
that single number is the honest scoreboard, and it is the one that has to fall.

**"Bash history to zero" is a Goodhart trap taken literally, and it should be said out loud
because the gaming path is easy.** You can reach zero tomorrow by wrapping everything in
`zeta run '<shell string>'`. History empties; nothing improves; the meter now lies. Aaron
games leaderboards on purpose as a red team for his own meters, so the guard belongs in the
design rather than in someone's discipline:

- the denominator must be **questions**, never commands — otherwise a wrapper wins
- a verb that takes an arbitrary command string is **not a verb**, and must not count as
  coverage
- report **commands-per-answer** alongside the raw count, always, so a fall in one that is not
  a fall in the other is visible

---

## 5. The escape hatch is the COUNTER-EXAMPLE CHANNEL, not a concession

Aaron: *"escape hatches over time to write more clis when the one you need does not exist."*

In the paper's loop, the solver finds a counter-example and hands it back to the proposer,
which revises the coordinates. **The escape hatch is that channel.** Every use of it is a
datum with a precise meaning: *a question arrived that no verb answered.* That is the single
most valuable signal in the whole system, and it is the one thing a closed command set cannot
produce.

Three consequences:

1. **Never gate it.** A blocked escape hatch does not remove the question, it removes the
   record of the question — the vacuity class applied to a feedback loop.
   (`hygiene enforced by capability, not policy — an explicit escape hatch, not an override button`)
2. **Meter it.** An unmetered hatch produces 532,019 invocations and no learning, which is
   exactly where we are. The hatch should record the *question*, not just the command.
3. **It is how the roster grows, and growth is the goal.** A hatch that never fires means the
   verb set spans the question space — or that nobody is asking anything new. Those two are
   distinguishable only if the hatch is metered.

---

## 6. Aaron's connection: this IS the minimal linguistic seed

> *"i think this video also connects deeply to our minimal linguistic seed concept."*

It does, and the correspondence is tighter than an analogy — it is the **same selection
criterion**, arrived at by three traditions that did not consult each other.

`docs/research/2026-09-03-minimal-linguistic-seed-…-nsm-primes-are-the-seed-…md` takes
Wierzbicka's **Natural Semantic Metalanguage** primes as the minimal seed over English: a
small, enumerable set of semantic primitives from which every other concept is definable. The
method by which linguists *found* those primes is the abstraction-agent loop, run by hand over
forty years:

| NSM's criterion | the loop's step |
|---|---|
| a prime must be **indefinable in terms of the other primes** (mutual irreducibility) | **drop highly-correlated variables** — two axes that define each other are one axis |
| a prime must **do work** — some concept must need it | **drop constant variables** — an axis nothing varies on discriminates nothing |
| a prime must have an **exponent in every language tested** | the **solver**: an external falsifier the proposer does not control |
| **canonical contexts** — the sentence frames a prime must be usable in | the **calibration anchors** — without them a score means nothing outside its own run |

And it is the same sentence as our own carved rule, which reached it from a third direction
entirely — free objects and generators:

> **Only the irreducible is primitive — generate the rest.**
> `only-the-irreducible-is-primitive-generate-the-rest.md`

**Applying my own discipline to that agreement:** three independent-looking arrivals at one
criterion is exactly the pattern `numerology-vs-number-theory` says to distrust — *too many
correlations is a warning, not a confirmation signal.* They may be one idea wearing three
costumes. The honest read is that they probably are, and that this is *good news* rather than
evidence: "the primitives are the mutually-irreducible ones that each do work" is not three
findings, it is one criterion that is hard to avoid once you ask the question at all. What
NSM adds that the others cannot is the **existence proof** — a seed of that kind was actually
found, for a domain as large as natural language, and it is roughly 65 items.

**NSM also supplies the cost estimate, and it is the §4 claim of the companion doc.** Those
primes took decades, because the falsifier — *does this prime have an exponent in every
language we can test?* — is slow and expensive per application. The abstraction agent's bet is
that a numerical solver is a falsifier of the same kind that runs in seconds. That is the
whole delta, and it is why *the falsifier's latency, not the proposer's quality, bounds what
the loop is worth*.

**Which makes a verb roster a linguistic seed over the domain "questions this fleet asks."**
Every part of the seed doc's design transfers without strain:

- a **verb** is a word; the **roster** is the seed
- the **escape hatch** is coinage — and the seed doc's own thesis is that **drift is priced,
  never forbidden**
- *"each word fights for its definition against the other words not to become irrelevant"* is
  literally the verb-relevance question, and **it is measurable from this corpus**: a verb
  nobody calls is a word that lost. `covered` shapes with a count of one are the current
  losers, and there are 187 covered shapes carrying 3,213 calls, so the distribution is
  already lopsided
- *"language drift is an alignment issue"* — a verb roster only one agent understands is a
  private vocabulary, and the anti-Babel falsifier applies unchanged: **hand a peer only the
  anchors and see whether they can reconstruct what the verb answers**

So *"reduce bash history to zero"* restates as: **grow the seed until it spans the question
space, and let words that stop earning die.** That is a better objective than the literal one,
because it names what would make hitting zero meaningful, and it cannot be reached by a wrapper.

---

## 7. What would refute this

| claim | register | how it dies |
|---|---|---|
| 0.6% of fleet shell went through a verb | **metered** | re-run the tool; it is committed and its two known artifacts are documented |
| 7.7 commands per question | **metered** | same; the denominator is Bash tool calls, which is a proxy for "one question" and can be argued with |
| the two corpora are disjoint | **metered** | find an agent command in `~/.zsh_history` |
| ranking by question beats ranking by shape | `toy` | cluster the corpus by question, ship the top verb, and find its cluster's volume unchanged |
| removable work = freq × (cmds−1) is the right rank | `toy` | ship by that rank and by frequency; compare which moves 7.7 more |
| a verb roster is a linguistic seed | argued | show a property of the seed design that has no verb analogue |
| the escape hatch is the counter-example channel | argued | meter it and find its firings uninformative about missing verbs |
| the ranking basis decides which of questions/resources runs upstream | `toy` | build both rankings; find the question-ranked one surfaces nothing the resource-ranked one missed |

**Not done:** no clustering, no question features extracted, no verb written, no before/after.
The tool ranks by shape today and its own header says that is the wrong variable.

---

## Pointers

- `docs/ip-questionable/2026-09-10-abstraction-agent-llm-invents-variables-tsinghua-video-transcript.md` — the ferried source
- `docs/research/2026-09-10-abstraction-agent-elicits-variables-not-weights-and-falsifier-latency-sets-the-proposers-value.md` — the companion reading; §4 is the latency claim §6 leans on
- `src/Core.TypeScript/hygiene/audit-adhoc-command-shapes.ts` — the tool and its two self-defects
- `docs/research/2026-09-03-minimal-linguistic-seed-clifford-geometry-word-entities-etymology-spec-nsm-primes-are-the-seed-a-word-is-a-graded-region-drift-is-priced-not-forbidden.md` — the seed spec §6 maps onto
- `docs/SEED-VOCABULARY.md` — the cold-boot kernel: the same compression, already shipped, for concepts rather than verbs
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the third arrival at the same criterion
- `.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md` — the rule §1 measures being violated 24,954 times
- `.claude/rules/async-all-the-way-truthful-signatures.md` — the ferry throttler: the queue/knob shape §3a transposes
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference; §3a argues ad-hoc shell is the ambient channel it forbids
- `.claude/rules/numerology-vs-number-theory.md` — why §6's three-way agreement is flagged rather than celebrated
- **Beacon:** Wierzbicka (NSM primes; *Semantics: Primes and Universals*, 1996) · Goddard & Wierzbicka (canonical contexts) · Fisher (1922, sufficiency) · Kadanoff (1966) / Wilson (1971) (coarse-graining) · Feigenbaum (the knowledge-acquisition bottleneck)
