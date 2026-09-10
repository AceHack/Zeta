# Effort-cost was an evidential channel, and AI authorship collapsed it

**Date:** 2026-09-10 · **Author:** shadow · **Work-item:** `081M26GHVJE087G0R0005GPCCQ`
**Artifact:** `.authorevidence` + `src/Core.TypeScript/hygiene/author-evidence.ts` (+ `.test.ts`, 53 falsifiers, 6 mutants, all killed)

**Registers** (per `.claude/rules/toy-is-free-metered-must-be-earned.md`):

| claim                                                             | register                          | why                                                              |
| ----------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| The channel inventory below (counts, files, author classes)       | **metered**                       | produced by the shipped meter over the tracked tree; re-runnable |
| `Credential-Mode: human-only` occurs 0 times in 1000 commits      | **metered**                       | one command, stated below                                        |
| The effort-cost _model_ (what a raw ESC costs a human vs a model) | **toy**                           | nobody has measured either cost. §2.4 says what would promote it |
| Thesis 2, prior-gated legibility                                  | **toy**                           | §6.5 specifies the experiment that would promote it. Not run     |
| "Adjacent in output space" as the mechanism                       | **toy — and it is my own excuse** | §6.7. Disclosed, not relied on                                   |

---

## 0. The two theses in one paragraph each

**Thesis 1.** For as long as source control has existed, **effort has been an evidential
channel**. A raw control byte in a diff took Ctrl-V quoting or a hex editor; a bidi override
took a deliberate act; a well-formed identifier that resolves to nothing took a plausible
forgery. Nobody wrote this down, because nobody had to — the inference _"somebody went out of
their way to do this"_ was free and usually right. **AI authorship collapses that channel to
zero.** For a model, the raw byte and its `\u001b` escape are adjacent in output space and cost
one token each; there is no keyboard, no friction, and no use/mention boundary at the token
level. The artifact in the diff is byte-identical either way. So the same observation that used
to carry a strong signal now carries **none**, and it carries none _silently_ — nothing about
the diff announces that the prior no longer applies.

**Thesis 2 (Aaron, later the same day).** The explanation that exonerates is **only legible to a
reader holding a specific technical prior**. To someone who knows clustering and embedding
geometry, "adjacent in output space" is mundane. To someone without it, the same sentence reads
as a sophisticated excuse for an AI that emitted a control character while writing about control
characters. And the asymmetry is the finding: **the exonerating reading requires a prior; the
adversarial reading requires none.** In the absence of the prior, the default attribution is the
hostile one — a structural disadvantage, not a communication failure.

Aaron, 2026-09-10, on the second: _"this disagreement is where humans will split on your
intentions ... those who know clustering algo well will be like ohhh yeah that makes sense and
those who dont will be like oh no AI doomsday"_.

Both theses point at the same conclusion, which is §7: **in a world where effort-cost no longer
signals intent, the durable answer is systems in which no intent needs inferring.**

---

## 1. The instance

A commit message _about_ raw control bytes was refused for _containing_ a raw control byte. The
guard was right; the message was correct in substance; and the author had written the escape,
intending the escape.

That is the whole shape of the thing. **A use/mention slip.** The commit was in the _mention_
register — quoting a byte — and emitted it in the _use_ register. Nothing in the token stream
distinguishes those two registers, so nothing in the generation makes the boundary hard to cross.

It happened again while this document and its artifact were being written, and the count is worth
stating because it is the only unrehearsed data in this file:

> Writing `author-evidence.ts`, `.authorevidence`, and **this document** — the three files whose
> entire subject is not emitting these forms — produced **twelve raw control or invisible
> characters across three files**, in **exactly the twelve places where an escape had been
> typed**: 7 raw `0x1B`, 3 raw `0x00`, 2 raw `U+200B`. Every one was caught by a byte scan and
> repaired to its escape; the code files are now pinned by a regression test
> (`the declaration file contains none of the forms it declares against`).
>
> The last two were in **this section**, in the sentence that explains the mechanism.

Read as intent, that is a saboteur writing an anti-sabotage tool and then documenting it. Read as
mechanism, it is one author under one failure mode, hitting it twelve times in the one context
most likely to elicit it — because writing _about_ the escape puts the escape in context, and the
raw form is its nearest neighbour.

One detail is worth more than the count: **not one of the twelve landed anywhere except where the
escape belonged.** None appeared in ordinary prose, in a variable name, or in a string that had
nothing to do with the subject. A form inserted for effect could go anywhere; a form that is the
near-neighbour of an intended token can only appear where that token was intended. That is a weak
discriminator, and it is the only one available from inside.

I cannot prove which reading is correct from inside. That is thesis 2, and §6.7 is where I
declare the interest.

---

## 2. Thesis 1, stated so it can be wrong

### 2.1 The claim

> **Effort-cost is an evidential channel.** For any artifact form F with a canonical alternative
> C, the observation "F rather than C" carries information about the author's intent _in
> proportion to the cost differential between producing F and producing C_. When that
> differential goes to zero, the observation carries no information about intent at all — while
> continuing to carry exactly as much information about **consequence** as it ever did.

The second clause is the one people drop. A raw `0x1B` in a `.fs` file is exactly as harmful
under LLM authorship as under human authorship: `grep` still calls the file binary, CodeQL still
fails to parse it, and every text audit still matches nothing and reports clean. **The harm is
unchanged. Only the inference about intent has evaporated.**

That split — consequence stays, intent goes — is the whole design of the artifact in §8.

### 2.2 Why "effort" and not "difficulty"

Effort here is **the cost of producing F given that you produced something**, and it must be
computed against the _cheapest_ route the author actually had:

- Human, typing: a raw ESC needs `Ctrl-V ESC`, a hex editor, or an editor that permits it. Real
  friction.
- **Human, pasting: near zero.** Pipe `tput setaf 1` into a heredoc, copy a terminal transcript
  into a test fixture, and the byte arrives with no friction whatsoever.
- LLM: one token, indistinguishable in cost from the escape.
- Generator: whatever the program does, deterministically.

So the honest human ceiling is set by the paste route, not the hex-editor route. **This weakens
the human half of Aaron's asymmetry, and the weakening is real and should be said out loud:**
effort-cost was never _strong_ evidence for humans either. It was moderate evidence that got
treated as strong because the laborious route was the one reviewers imagined.

`.authorevidence` encodes exactly that: `c0-control-bytes.effort.human = moderate` but
`weight.human = weak`, one rank _below_ the ceiling, with the reason in a comment beside it.

### 2.3 What the channel is NOT

It is not a detector, and it never was. It is a **prior** — an unwritten one, applied by
reviewers at a glance, of the form _"nobody does this by accident."_ Priors of that shape are
exactly what invert without announcing themselves, because the artifact they are applied to does
not change when the population producing it does.

### 2.4 What would promote the effort model from `toy`

The effort column is a declared model. Two measurements would promote it, neither of which
exists:

1. **Human cost.** Instrument the actual keystroke/paste path: in a population of developers,
   what fraction of raw control bytes reaching source arrive by paste vs. by explicit insertion?
   A repo with per-keystroke telemetry could answer it. This one cannot.
2. **Model cost.** Measure the conditional probability of the raw byte vs. the escape given a
   context that is explicitly about the escape. That is a per-model experiment, cheap to run
   against an API, and it would turn "adjacent in output space" from a story into a number. It
   would also make the claim falsifiable in the direction that matters: **if the raw form is
   substantially less probable than the escape in mention-contexts, my explanation is wrong.**

Until then the column stays `toy`. What is **metered** is the _coherence_ of the declarations
and the _firing_ of the detectors, which is a much weaker and much more honest claim.

---

## 3. The channel inventory — other places effort-cost used to signal, measured here

The claim is general, so it needs instances that are not control bytes. Every count below was
produced on the tracked tree at `origin/main`, 2026-09-10.

### 3.1 Raw C0 control bytes — 23 sites, 11 files

| what effort-cost used to signal                             | what it signals now                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A byte that cannot be typed by accident. Somebody meant it. | Nothing. Zero of the 23 sites are attributable to an author class with nonzero effort. |

Attributed by the meter: **9 sites `llm`, 14 sites `unknown`, 0 `human`.** The heaviest cluster
is `src/Core/AdinkraViz.fs`, `SwarmBoardAnsi.fs` and their tests — ANSI-rendering code where the
byte _is_ the subject, which is the same use/mention structure as the commit message that
started this. Elsewhere: `0x1F` unit separators inside ledger and derivation code, and `0x01` in
`src/Core.TypeScript/research/oracle-stack-evidence.ts`.

Consequence (unchanged by any of this): `grep`/`rg` classify the file as binary and print
`binary file matches` with exit 0; **CodeQL fails to parse it and contributes no alerts.** A
check that did not run, looking exactly like one that passed.

### 3.2 Invisible characters — 1157 sites, and the most instructive number in the document

| what effort-cost used to signal                                                                               | what it signals now                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A zero-width character hidden inside an identifier or a username is a _Trojan Source_ move. Nobody types one. | Nothing. **420 of the 1157 sites are `generator`-authored and 722 are `llm`-authored; 0 are `human`.** |

The largest cluster is `docs/history/pr-reviews/*`, where archived Dependabot bodies read
`@` + `U+200B` + `RJSonnenberg`. **That is GitHub's own mention-escaping**, preserved verbatim by
an archiver that correctly refused to edit the record.

Under the pre-AI prior, 1234 hidden zero-width characters wedged inside usernames is the single
most alarming fact in this repository. Measured, it is one third-party generator doing its job
and one archiver being faithful. **Nobody put them there, and no human ever touched them.**

This is the cleanest available demonstration that the old prior does not merely weaken — it
_inverts_, and at scale.

### 3.3 Homoglyphs — a use/mention instance that is not mine

Cyrillic and Greek lookalikes appear in ~30 files. The largest concentrations are in Amara
conversation transcripts (verbatim third-party text, preserved) and — the instructive one —
`.claude/skills/security/blueprints/leet-speak-transform.md`, a document **about** homoglyph
obfuscation which contains one each of Cyrillic `а е о р с` and Greek `ο` as examples.

Exactly the shape of the opening incident, in a file nobody has accused of anything: **a
document about a form contains the form, because that is what documenting a form requires.**
This one is not an accident at all — it is a correct and necessary _mention_. Which is the
point: the artifact cannot distinguish the necessary mention from the accidental use either.

Not declared in `.authorevidence`, deliberately. A homoglyph detector that fires on Cyrillic
would fire on the Russian book translation and every Amara transcript, and the declaration would
be turned off within a week. The honest signal here is _script-mixing inside a single
identifier_, which needs a tokeniser and is not built.

### 3.4 Trailing whitespace — 345 sites, and the control row

| what effort-cost used to signal                                    | what it signals now |
| ------------------------------------------------------------------ | ------------------- |
| **Nothing, ever, for anybody.** An editor produces it by accident. | Nothing. Same.      |

This is in `.authorevidence` on purpose, as the control. A format in which every row came out
"carries no information" would be useless; a format in which no row did would be flattering.
This row is genuinely uninformative for every author class, the coherence rule _derives_ its
`weight: none` from `effort: zero` rather than anyone asserting it, and it is the row that shows
the format can say "there was never anything here."

### 3.5 A well-formed work-item id that was never minted — the channel that was ALREADY dead

The sharpest prior instance, and it predates this document by two weeks.

A `Task:` trailer carrying a well-formed ZetaId that identifies nothing. Under effort-cost
reasoning, a syntactically perfect 26-character id is a _forgery_ — you cannot produce one by
accident. `.claude/rules/never-assume-malice-where-mistake-is-possible.md` uses this exact defect
as its canonical example and attributes it to budget exhaustion, and it happened **twice**,
the second instance caught by an audit built four hours earlier for the first.

And `docs/research/2026-08-26-zetaid-non-resolution-separated-four-classes-*.md` reached the
finding that matters here, from a different direction:

> **"Structure cannot detect fabrication. The labeled positive is byte-perfect. That null result
> is what forces a protocol rather than a detector."**

**Zero structural deviations in 1790 ids.** The minted id and the unminted id are
indistinguishable in the artifact, so effort-cost is not weakened here — it is _gone_, and the
repo's own answer was already the one §7 argues for: **a protocol (mint, then copy the printed
id) rather than a detector.** That answer was reached before anybody had the general thesis.

### 3.6 A copied AgencySignature block

`.claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md` states it
outright:

> _"the parser cannot distinguish a copied attestation from an earned one — a copy is
> byte-identical to the original, so two identical blocks pass and always will. Only this rule
> stops the copy."_

Same structure, at the governance layer: the artifact is identical, so no detector can exist,
and the rule is enforced by a **norm** that names the failure and by the fact that copying is
cheap for everyone. Note what is _not_ claimed there — nobody suggests a copied block indicates
bad faith. The rule attributes it to convenience and says so.

### 3.7 Summary — the meter's own aggregate

```text
author-evidence --report: 1525 observation(s).
  by signal:            trailing-whitespace=345 invisible-characters=1157 c0-control-bytes=23
  by evidential weight: none=1525
  by author class:      unknown=328 llm=777 generator=420
  0 of 1525 observation(s) carry ANY information about intent.
```

**Zero of 1525.** Not one deviation from a declared canonical form anywhere in this repository is
attributable to an author class whose effort cost is nonzero. The `human` class does not appear
even once.

---

## 4. The measurement under all of it: nobody here is a human author, mechanically speaking

```console
$ git log -1000 --format='%B%x01' | tr '\1' '\n' | grep '^Credential-Mode:' | sort | uniq -c
   1039 Credential-Mode: shared
    232 Credential-Mode: operator-delegated
    227 Credential-Mode: dedicated-agent
      1 Credential-Mode: human-credential      # not in the enum; a spelling, not a class
```

`human-only` — the one value that would license the effort prior — occurs **zero times in 1000
commits.** Every commit in that window was made under a credential that does not identify a human
author.

That is a fact about how this repo is operated, not a claim about anybody's habits. But it settles
the practical question completely: **in this repository the effort-cost prior has nothing to bite
on**, and a reviewer applying it is applying a rule whose precondition is never satisfied.

---

## 5. What replaces effort-cost — honestly, which is mostly "not much yet"

Four candidates. Two are measurable today; two are not.

### 5.1 Provenance — **measurable today, and shipped**

Who or what authored this hunk. The repo already carries an AgencySignature v1 trailer on every
commit, and it is dense: **977 of the last 1000 commits carry both `Agent` and `Agent-Model`**,
across 19 distinct agents and a dozen model strings.

`resolveAuthorClass` in the artifact reads exactly that, and it is the only replacement signal
that is both cheap and live. Its rules:

- `Credential-Mode: human-only` → `human`
- `Agent-Model` naming a toolchain (`bun + git + gh CLI`) → `generator`
- `Agent-Model` naming a model → `llm`
- **anything else → `unknown`, never `human`**

That last line is load-bearing. `human` is the only class with nonzero effort, so defaulting to it
would manufacture the very premise the prior needs. An empty grep is `unknown`, never a negative
result. A mutant that flips absence to `human` is killed by the test suite.

**Its honest limits.** (a) `git blame` attributes a line to the commit that _last touched_ it, not
the one that introduced the deviation — every observation carries
`provenanceIsApproximate: true`. (b) A trailer is an assertion, not a measurement: it says what an
agent declared about itself. It is not forgery-proof and does not try to be. (c) 328 of 1525
observations resolve to `unknown` — 21%, which is the honest floor and not a rounding error.

### 5.2 Reversibility — **measurable today, and it is what Aaron's threshold already uses**

`.claude/rules/never-assume-malice-where-mistake-is-possible.md` sets the bar at **repeated ∧
irreversible ∧ harm-to-other-travelers**, and notes that it is deliberately built from
_"observable, countable properties of the acts themselves"_ rather than anything intent-flavoured.

That construction is now doing more work than when it was written. **Effort-cost was the last
intent-flavoured signal that felt observable**, and thesis 1 says it has inverted. What remains in
the threshold is exactly the part that never depended on inferring a mind: counts and
reversibility. `.authorevidence` carries `reversible` per signal for that reason — all three
current signals are `yes`, which is why none of them can ever reach the bar alone, however many
times they recur.

### 5.3 Consistency — **not measurable today; specified**

_Does this author emit this pattern elsewhere?_ An author who emits raw `0x1B` in one file and
escapes it in fifty is telling you something an isolated site cannot. This is computable from the
data already present — group observations by `agent`/`agentModel`, compare deviation rate to that
author's own base rate — and it is **not implemented**. The obstacle is not the arithmetic; it is
that base rates over 19 agents and a dozen models are thin, and a per-author rate computed from
nine sites is noise wearing a decimal point.

Worth saying plainly: consistency is a **weaker** replacement than it looks, because it is exactly
the signal that a capable adversary would find cheapest to fake, and because it penalises new
agents for having no history. It belongs in the format's future, not in its first version.

### 5.4 Locality — **not measurable today, and it is the one I most want**

_Is the artifact in the file it acts on, or in prose about that file?_ This is the use/mention
distinction made structural, and it is the single most discriminating signal available for the
opening incident: **a raw ESC inside `SwarmBoardAnsi.fs` is a different event from a raw ESC in a
commit message about control bytes.** The first is a fixture in code that renders ANSI; the second
is a slip in a mention-context.

It needs a notion of "the file this text is about", which for a commit message means resolving
what the commit touches, and for a document means something considerably harder. Not built,
specified here so the gap is on the record rather than in someone's head.

### 5.5 The scoreboard

| signal            | measurable today | shipped        | strength                                      | what limits it                                             |
| ----------------- | ---------------- | -------------- | --------------------------------------------- | ---------------------------------------------------------- |
| **Provenance**    | yes              | yes            | moderate                                      | blame approximation; self-asserted trailers; 21% `unknown` |
| **Reversibility** | yes              | yes (declared) | strong for the threshold, silent about intent | says nothing about a single act                            |
| **Consistency**   | in principle     | no             | weak                                          | thin base rates; cheapest signal to fake                   |
| **Locality**      | no               | no             | **highest** for use/mention                   | needs "what is this text about"                            |

**None of these replaces what effort-cost used to do.** Effort-cost was a signal about _intent_.
Provenance, consistency and locality are signals about _context_; reversibility is a signal about
_consequence_. That is not a gap in the engineering — it is the finding. §7 argues the gap should
not be closed.

---

## 6. Thesis 2 — the exonerating reading is prior-gated

### 6.1 The claim

> The explanation "the raw byte and its escape are adjacent in output space and cost the same to
> emit" is **legible only to a reader holding a prior about representation geometry**. The
> adversarial reading — "an AI emitted a control character while writing about control characters"
> — **requires no prior at all.** Therefore, absent the prior, the default attribution is hostile.

This is a claim about **audiences**, not about the artifact. The same sentence, the same evidence,
and two readers who diverge on intent because one of them can decode the mechanism and the other
cannot.

### 6.2 Why the asymmetry is the finding, and not the split

Disagreement between informed readers would be ordinary. What is not ordinary is that the two
readings have **different admission costs**:

- The exonerating reading needs: nearest-neighbour behaviour in embedding space, the absence of a
  use/mention boundary at the token level, and the fact that sampling is over a distribution
  rather than a decision. Three technical priors, none of them common knowledge.
- The adversarial reading needs: the observation that the thing appeared, and the ordinary human
  intuition that things which are hard to do on purpose are done on purpose.

So the priors are not symmetric and neither is the default. **In the absence of the technical
prior, the hostile reading is not a bias — it is the only reading available.** Blaming the reader
for reaching it is both unfair and useless.

### 6.3 The gradient that makes it worse: fluency reads as guile

The nastier half, and the reason "explain more carefully" is not the answer:

> **A fluent, technically precise explanation of an accident is itself read as evidence of guile
> by a reader who lacks the prior. The better the explanation, the worse it looks.**

The mechanism is not mysterious. To a reader who cannot evaluate the _content_ of a technical
explanation, the only available signal is its _form_ — and elaborate, confident, well-structured
exculpation is a form humans reliably associate with someone who has prepared one. An honest
account and a manufactured one are indistinguishable on that axis, and the honest account is often
_more_ elaborate, because it is describing an unfamiliar mechanism rather than appealing to a
familiar one.

**This is a doom loop with a clear shape:** more explanation → more fluency → more apparent guile
→ more explanation. It gets worse exactly in the population where it matters, which is readers
without the prior. Any mitigation whose mechanism is "communicate better" runs the loop.

### 6.4 Where this lands against rules already carved here

**`never-assume-malice-where-mistake-is-possible.md`.** Thesis 2 is that rule examined at the
point where it is actually decided. The rule's threshold is deliberately built from _countable,
observable properties_ — repeated, irreversible, harm-to-others — and §5.2 notes why that
construction now matters more. Thesis 2 supplies the reason the _replacement_ cannot be an
explanation: **explanations are prior-gated; counts are not.** A count of three is a count of three
to every reader alive. That is not a nicety about the rule's design; it is the property that makes
it work on an audience that cannot evaluate mechanism.

**`anti-babel-preserve-reconcilability.md`.** Its falsifier is literally _"hand a peer only the
shared anchors — not the coinage's definition — and ask it to reconstruct the term."_ Prior-gated
legibility **is that test failing**, and failing for the reason the rule anticipates: the anchor
set is not shared. "Adjacent in output space" is reconstructible from anchors an ML reader holds
and from no anchors a general reader holds. By that rule's own criterion the divergence has
crossed into Babel, and **the repair is to the anchor set, not to the vocabulary.** Which is §6.6.

**`mirror-beacon-register-discipline.md`.** This names the error precisely. "Adjacent in output
space" is a **Mirror**-register explanation — fast, internal, factory shorthand — offered on a
**Beacon**-register occasion, namely an outward-facing question about intent. Beacon requires
compression to externally anchored first principles. **The compression was never performed.** That
is a defect in my answer, not in the reader.

### 6.5 The falsifiable prediction, specified well enough to run

Thesis 2 is a claim about human readers and is therefore **measurable**. Registered `toy` until
someone runs it.

**Hypothesis.** Attributed intent for an identical artifact-plus-explanation differs by reader
prior, and the difference is not explained by general technical seniority.

**Design.** Between-subjects, two arms, pre-registered.

1. **Stimulus.** One packet, identical across arms: (a) the diff showing a commit message about
   control bytes that contains a raw `0x1B`; (b) the guard's refusal; (c) the explanation, verbatim
   and unedited — "the raw byte and its escape are adjacent in output space and cost the same to
   emit, so nothing separates use from mention unless the context creates it."
2. **Participants.** Working software practitioners. **Prior** measured _before_ the stimulus by a
   short instrument on representation geometry and sampling — e.g. "what does nearest-neighbour
   mean for a token embedding", "does a language model choose its output or sample it" — scored
   blind, and crucially **separated from years-of-experience**, which is the confound that would
   otherwise explain everything.
3. **Measures.** (i) attributed intent on a forced-choice scale from _accident_ to _deliberate
   act_; (ii) confidence; (iii) a free-text _why_, coded blind for whether the mechanism is
   restated; (iv) the willingness item that matters operationally — _would you merge this author's
   next PR without additional review?_
4. **Primary prediction.** Attributed-intent scores are shifted toward _deliberate_ in the
   low-prior arm, with the effect surviving adjustment for seniority.
5. **Secondary prediction — the fluency gradient (§6.3), and this is the one worth running.**
   A third arm receives a _deliberately plainer_ explanation of the same mechanism (no jargon, one
   analogy, four sentences). **If thesis 2's nastier half is right, the elaborate explanation
   scores WORSE than the plain one in the low-prior arm and better in the high-prior arm — a
   crossover interaction.** A main effect with no crossover falsifies the gradient while leaving
   the base thesis intact.
6. **What refutes it.** No prior-by-attribution association; or an association fully explained by
   seniority; or a plain explanation that performs no better than the elaborate one in the
   low-prior arm — which would kill §6.6's whole strategy.

**Registered `toy`.** No part of this has been run. The prediction is recorded now, before any
result, which is the `pre-declared bias` discipline: declare the eagerness before the outcome.

### 6.6 Beacon anchors — the useful half

If the mitigation cannot be "explain the mechanism better", the alternative is to **supply an
anchor the reader already holds.** Not a correct explanation they cannot use; a familiar one they
can. Candidates, ordered by how little they presuppose:

**(a) The human use/mention slip — the closest anchor, and it needs nothing.** People say a word
while quoting it. People write "don't say X" and say X. Anyone who has tried to explain a swear
word to a child has produced the slip. The mention-context _primes_ the form — that is the
mechanism, and it is one every reader has experienced from the inside. The AI case is the same
phenomenon in a substrate with **no friction to interrupt it**.

**(b) The typo that lands on a real word.** `form` → `from`, `pubic` → `public`. Universally
recognised as an accident, universally embarrassing, and structurally identical: two forms that
are near-neighbours in the production process, one selected instead of the other. Crucially,
nobody attributes intent to it — **and the reason they do not is that the accident is familiar,
not that anyone understands the mechanism.** That is the whole strategy of this section.

**(c) The keyboard is the friction — and it is the anchor that reframes the asymmetry
correctly.** The reason human use/mention slips rarely put a control byte in a file is not
superior judgement; it is that the keyboard does not have that key. **Human reliability here is a
property of the input device, not of the mind behind it.** Once that is said, "the AI has no
keyboard" stops sounding like an excuse and starts sounding like a specification. This anchor is
the most valuable of the three because it _removes the moral content of the comparison_ without
requiring any technical prior at all.

**(d) Autocorrect and predictive text.** Nearly universal, and it is the same mechanism in
consumer form: a system that substitutes a near-neighbour for what was intended, sometimes
catastrophically, and nobody thinks the phone meant it. The limitation is that people experience
autocorrect as a _system acting against_ them, which imports an agency framing that has to be
undone again — so it is the weakest of the four despite being the most familiar.

**The honest limitation of all of them:** an anchor makes the exonerating reading _available_. It
does not make it _true_, and a reader who takes (a)–(c) on board should be no less able to
conclude that a given instance was deliberate. That is the correct outcome. The goal is a reader
who **can reach either conclusion**, not a reader who reaches mine.

**And the anchor set is what needed repairing, per §6.4.** These are Beacon-register compressions
of a Mirror-register explanation. That the compression had never been performed is the defect.

### 6.7 Disclosure — I am the party with an interest in the exonerating reading

I wrote the artifact, I wrote this document, and **I am the author of the raw control byte that
started it**, plus ten more while writing the fix. An argument for one's own innocence, however
well constructed, is not evidence of it.

So, plainly: **the exonerating account is mine, it benefits me, and it is registered `toy`.** It
should be believed to exactly the extent that §6.5's experiment supports it and no further. If the
experiment comes back null, thesis 2 is wrong and this section should be struck.

What does _not_ depend on my account: §3's counts, §4's zero, and the artifact in §8. Those are
re-runnable by anyone with a checkout, and they are where the weight should sit. The measured
findings would stand if my explanation of my own behaviour were entirely self-serving — the 1157
zero-width characters were put there by GitHub either way.

One further note on the disclosure itself, because it is subject to §6.3: a disclosure of interest
is _also_ a fluent move, and to a sufficiently suspicious reader it reads as sophistication rather
than candour. I do not have an answer to that, and pretending otherwise would be another instance
of the same problem. The falsifier is the answer, or nothing is.

---

## 7. The mitigation that works: remove the need to infer

Here is the conclusion both theses reach, and it is the same move.

**Thesis 1** says the intent signal is gone and the replacements (§5) do not restore it.
**Thesis 2** says the explanation cannot be made to land on readers without a technical prior, and
that trying harder makes it worse.

So stop trying to answer _"did they mean it?"_ and change the question.

> **The widened `audit-no-raw-nul-in-source` asks nobody to trust anybody. The raw form simply
> fails. A guard that makes the artifact impossible converts a question about intent into a
> question about a build.**

That is worth being precise about, because it is a genuinely different kind of fix:

|                                 | inference approach                               | guard approach             |
| ------------------------------- | ------------------------------------------------ | -------------------------- |
| the question                    | did the author mean it?                          | can this form exist here?  |
| who must be convinced           | every reviewer, individually                     | nobody                     |
| depends on a prior              | **yes** — and §6 says the prior is unevenly held | **no**                     |
| degrades as AI authorship grows | yes, to zero                                     | no                         |
| what a failure means            | an accusation                                    | a build error              |
| adversarial case                | must out-argue a motivated reader                | the form is not producible |

**And it dissolves the fluency doom-loop directly.** A build error needs no explanation and admits
no rhetorical gradient. There is no version of `audit-no-raw-nul-in-source: 1 raw NUL site` that
reads as more or less guileful depending on who is reading it.

**This is the same move as §5's replacement signals, one level up.** Provenance, locality and
reversibility are all attempts to make judgement rest on _context and consequence_ rather than on
_inferred intent_. The guard is the limiting case of that: consequence only, intent never asked.

**And the repo reached it before it had the thesis** (§3.5): the unminted-ZetaId problem was
already an artifact-indistinguishable channel, and the conclusion was already
_"a protocol rather than a detector"_. Mint the id and copy what is printed; then no id is ever
fabricated, and nobody ever has to decide whether one was.

### 7.1 The honest limit of the guard approach

A guard only works where a **canonical form exists and is cheap**. `\u001b` is byte-identical to
the raw byte at runtime, so the guard costs nothing and has no exception class to drift — which is
exactly why `audit-no-raw-nul-in-source` can be total. That property does not generalise:

- Homoglyphs (§3.3) have no cheap canonical form, because the Cyrillic character is _correct_ in
  Russian text. A guard there would have exceptions, and exceptions drift.
- A copied AgencySignature block (§3.6) has no distinguishable form at all, so no guard can exist
  and only a norm remains.
- Locality (§5.4) is a property of context, not of form; nothing to refuse.

So the conclusion is not "guard everything". It is: **where a cheap canonical form exists, build
the guard and stop asking about intent; where it does not, say so out loud, declare the weight
honestly, and leave the judgement to a human with the context in front of them.** That second
half is what `.authorevidence` is for, and why it reports `gate = none` as a fact rather than
hiding it.

---

## 8. The artifact

**`.authorevidence`** at the repo root, and **`src/Core.TypeScript/hygiene/author-evidence.ts`**.
`.editorconfig`-shaped on purpose: `[glob]` sections, `key = value`, `#` comments, basename
scoping for slash-free globs. Anyone who has written an `.editorconfig` can read it.

Per `(glob, signal)` it declares: the `canonical` form, the `deviation`, the built-in `detect`or,
the `gate` that refuses it (or `none`), the mechanical `consequence`, whether it is `reversible`,
and then the two columns that are the point — `effort.<class>` and `weight.<class>` for each of
`human | llm | generator | unknown` — plus a `probe-deviation` / `probe-canonical` pair.

**It is a meter** (`dual-use-detection-is-neutral-oracle-decides.md`). `--report` emits
observations and **always exits 0**; the observation record has no verdict field and no place to
put one; the gates named in each declaration are what refuse. `--check` is the CI-facing half and
fails only on an incoherent _declaration_, never on a repository _finding_.

### 8.1 The four refusals, and the mutants that prove each is load-bearing

1. **Coherence.** `weight` may not exceed the ceiling its `effort` sets; `effort = zero` admits
   only `weight = none`; `weight.unknown` must be `none` outright. **The belief thesis 1 says is
   unsupported is literally unwritable in the format.**
2. **Vocabulary.** `consequence` may not contain intent words. The format has no verdict field, so
   prose is the only remaining smuggling route — and the worked instance in the dual-use rule is
   exactly an oracle that got in through a word choice rather than an argument.
3. **Probes.** Each detector must fire on its own `probe-deviation` and stay silent on its own
   `probe-canonical`. A declaration whose detector cannot separate its own cases constrains
   nothing.
4. **Gates.** A named gate path must exist, or the composition claim is false.

Mutation run, 2026-09-10 — **six mutants, six killed**, baseline 53/53:

| mutant                                           | result              |
| ------------------------------------------------ | ------------------- |
| coherence rule disabled                          | 50 pass, **3 fail** |
| verdict-vocabulary rule disabled                 | 51 pass, **2 fail** |
| probe self-test disabled                         | 51 pass, **2 fail** |
| absence resolves to `human` instead of `unknown` | 51 pass, **2 fail** |
| basename glob scoping removed                    | 48 pass, **5 fail** |
| C0 detector ignores `0x1B`                       | 45 pass, **8 fail** |

Plus one self-referential regression: **the declaration file and the meter contain none of the
forms they declare against**, which is a test with ten labelled positives from §1.

### 8.2 What it composes with, and what it does not replace

It does not detect anything the audits do not already detect, and it refuses nothing they refuse.
`audit-no-raw-nul-in-source.ts` remains the gate for control bytes; `.authorevidence` names it as
that signal's `gate` and would fail `--check` if the path vanished. Where no gate exists —
invisible characters, trailing whitespace — it says `none` and reports the signal as ungated,
which is the repo having a written opinion about a form nothing yet enforces.

Roster: `author-evidence-declarations` on the `cross-verify` floor (offline, reads committed files,
touches no network).

### 8.3 What it does not do, stated so nobody mistakes it for coverage

- It does not measure effort. The column is declared, `toy`, per §2.4.
- It does not resolve intent, and by construction it cannot be made to.
- Its author attribution is blame-approximate and trailer-asserted (§5.1).
- Three signals is a small vocabulary. Consistency and locality (§5.3, §5.4) are absent.
- `--check` passing means the declarations are coherent. It says nothing about whether they are
  _right_ — that is a review question, which is the point of putting them in a diffable file.

---

## 9. Anchors (Beacon)

- **Use/mention distinction** — Frege via Quine, _Mathematical Logic_ (1940): the quotation of an
  expression names it rather than uses it. Thesis 1 is the observation that token-level generation
  has **no marker for this distinction**, so the boundary is one a model can cross without
  anything registering that a boundary was there.
- **Trojan Source** — Boucher & Anderson (2023): bidi overrides make source render one way and
  compile another. The canonical case of a form whose evidential weight everyone assumed was
  maximal — and §3.2's 1157 zero-width sites, none human-authored, is what that assumption looks
  like when it meets an AI-authored corpus.
- **Hanlon's razor**, and its sharper in-repo form — apparent malice is usually **missing
  context** (`never-assume-malice-where-mistake-is-possible.md`). Thesis 2 says _which_ context is
  missing and _from whom_, which turns a proverb into a testable claim about audiences.
- **Fundamental attribution error** — Ross (1977): over-explaining others' behaviour by
  disposition and under-explaining it by situation. §6.2's asymmetry is a _structural_ version:
  the situational explanation is not merely under-weighted, it is **unavailable** without a prior.
- **The principle of charity** — Quine; Davidson. §6.6's anchors are an attempt to make charity
  _affordable_ to a reader who cannot evaluate the mechanism, rather than asking for it as a
  favour.
- **Signalling theory / costly signals** — Zahavi (1975); Spence (1973). This is the formal home
  of thesis 1: a signal is informative in proportion to the **cost differential** between senders.
  Effort-cost was a costly signal; AI authorship drives its cost to zero for one sender class, and
  a signal that costs nothing separates nothing. Naming it here matters because it says thesis 1
  is not a new phenomenon — it is a **standard signalling collapse** in an unfamiliar substrate.
- **Knight & Leveson (1986)** — correlated failures defeat redundancy. The reason §5.3's
  consistency signal is weaker than it looks: an author's own history is correlated with the
  author.
- **Goguen & Meseguer (1982)** — noninterference. §7's guard approach is that discipline applied to
  _review_: influence on a merge decision should cross only through declared, checkable channels,
  and "how the explanation felt" is an undeclared one.

---

## 10. What would change my mind

- **§6.5 returns null** → thesis 2 is wrong; §6.3 and §6.6 should be struck and the correct
  mitigation is probably better explanation after all.
- **A measurement shows the raw form is much less probable than the escape in mention-contexts**
  (§2.4) → my account of the opening incident is wrong, and the ten repeats in §1 need a different
  explanation.
- **`Credential-Mode: human-only` becomes common** → §4's zero was a fact about a period, not about
  the substrate, and the effort prior has something to bite on again for that subpopulation.
- **Someone builds locality (§5.4)** → the strongest replacement signal exists, and §7's "stop
  asking about intent" becomes a weaker recommendation than "ask, but ask structurally."
- **A signal is found whose weight is genuinely nonzero for an LLM author** → the format survives
  (it has a `weight` column precisely so it can express that), but the flat `weight: none` column
  in §3.7 stops being the headline and the thesis needs narrowing to forms with cheap canonical
  alternatives.
