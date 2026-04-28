# Operator-input quality log

**Status:** per maintainer 2026-04-22 auto-loop-43 directive.
**Purpose:** score the quality of inputs arriving from the
human maintainer and from operator-adjacent sources
(research drops, recommended videos, third-party tooling the
maintainer forwards). Symmetric counterpart to
`docs/force-multiplication-log.md` — that log measures signal
going *from* factory to operator; this log measures signal
going *to* factory from operator.

**Reframe — this is a teaching loop, not just a retrospective
scorecard.** Maintainer, same tick:

> *"this is teach opportunity"*
>
> *"naturally"*
>
> *"if my qualit is low you teach me if its high i teach you"*

The quality score determines the **direction of teaching**.
Low-quality maintainer input (low signal density, ambiguous,
unverifiable, under-specified) → the factory **teaches
the maintainer**: surfaces the ambiguity, proposes the
better-structured version, explains what would have made
the input actionable. High-quality maintainer input
(compressed, anchor-rich, novel, verifiable) → the
maintainer is **teaching the factory**: absorb as direction,
update substrate, let the factory's model of
what-the-maintainer-wants evolve toward the new signal. The
log is *how the factory decides which direction
to teach in*. A quality row is not a verdict — it's the
pedagogical direction-setter for that input.

Default posture: **not symmetric in effort**. Teaching the
maintainer happens in chat (terse, present-tense: *"I read
this as X because of ambiguity in clause Y — did you mean
Z?"*). Teaching the factory happens in substrate (memory /
BACKLOG / research doc). The *information flows both ways
naturally*, as the maintainer put it — the quality score
picks which one is the right move this tick.

**Meta-perspective — either direction grows Zeta.**
Maintainer, same tick:

> *"eaither way Zeta grows"*
>
> *"i think from the meta persepetive most of the time"*

Whichever direction teaching flows in, the factory grows.
Maintainer teaching factory → substrate absorbs higher-quality
signal → factory's model of what-the-maintainer-wants sharpens.
Factory teaching maintainer → maintainer's input quality trends
up over time → future ticks absorb sharper signal → the
teaching-factory direction accelerates. The loop has no
dissipation direction; the meta-property is **growth
via either flow**. The *"most of the time"* qualifier
— the claim is strong-but-not-universal, acknowledging
the occasional absorption that grows neither side (pure
retrospective calibration, e.g.). But most of the time
the loop is a monotone growth engine with two arrows,
and either arrow being active this tick is sufficient.

This is why the log is load-bearing factory infrastructure
and not just a housekeeping artifact.

## The directive

Maintainer, 2026-04-22 auto-loop-43:

> *"can you tell me how the quality of that research you
> received was?"*

> *"you should probably keep up with a score of the quality
> of the things im giving you or the human operator"*

First message asked for evaluation of *a specific drop*
(the `deep-research-report.md` OpenAI Deep Research output).
Second message generalised to a standing directive: keep a
rolling score across all operator-channel inputs.

## Scoring dimensions

Each scored input gets ratings on six dimensions, 1 (poor)
to 5 (excellent). The final "Overall" column is not an
arithmetic mean — it's a judgment summary that reflects
which dimensions mattered most for *this kind* of input.

| Dimension         | What it measures                                                          |
|-------------------|---------------------------------------------------------------------------|
| Signal density    | Verbatim vs paraphrase; anchor-rich vs vague; actionable verbatims present |
| Actionability     | Clear next-step vs aspirational-only                                       |
| Specificity       | Concrete claims / names / numbers vs metaphorical                         |
| Novelty           | Genuine new frame vs restatement of known patterns                        |
| Verifiability     | Load-bearing claims have independent verification paths                   |
| Load-bearing risk | If we act on this wholesale, what's the downside? (5 = low, 1 = high)      |

## Input classes

Not every operator message gets a row. Score only inputs
that are **load-bearing enough to absorb into substrate**
(research doc, memory edit, BACKLOG row, ADR, code change).
Terse maintainer directives that land as memories get scored
because they direct factory work. Casual chat does not.

- **A: Maintainer direct** — the maintainer types a
  directive directly.
- **B: Maintainer forwarded** — the maintainer forwards a
  tweet, video timestamp, article, conversation overheard.
- **C: Maintainer-dropped research** — deposits into
  `drop/` (OpenAI Deep Research, Gemini outputs, etc.).
- **D: Maintainer-requested capability** — a check / build
  / verify ask for the factory.

## Running log

Newest-first.

| Date       | Source              | Class | What                                                                                                                      | Signal | Action | Specif | Novelty | Verif | Risk | Overall | Notes |
|------------|---------------------|-------|---------------------------------------------------------------------------------------------------------------------------|--------|--------|--------|---------|-------|------|---------|-------|
| 2026-04-22 | Maintainer direct   | A     | ARC-3 adversarial three-role loop (creator/adversary/player) as scoring mechanism for emulator absorption; symmetric quality loop; SOTA-changes-daily | 5 | 3 | 4 | 5 | 3 | 4 | **4.5** | Four compressed messages, high leverage; directionally verifiable (ARC-3, POET, OMNI literature exists); scope-binding not yet authorized — six open questions blocking implementation. |
| 2026-04-22 | Maintainer direct   | A     | Operator-input quality-log directive (this log's origin)                                                                  | 5 | 5 | 5 | 4 | 5 | 5 | **4.8** | Self-evidencing — the directive's value is confirmed the moment we act on it. Low load-bearing risk because the log is additive and can be retracted. |
| 2026-04-22 | Maintainer direct   | A     | Drop-zone protocol (`drop/` folder with gitignore-except-sentinel; binary-type registry; absorb-then-delete cadence)      | 5 | 5 | 4 | 4 | 5 | 5 | **4.7** | Two compressed messages; the follow-up ("binaries never get checked in / untracked with a single tracked file") was unusually well-specified in one sentence. Immediately implementable. |
| 2026-04-22 | Drop (Deep Research)| C     | `deep-research-report.md` — Lucent-vs-AceHack comparison + 7-layer oracle-gate design + Aurora branding-clearance analysis | 4 | 3 | 4 | 3 | 2 | 3 | **3.5** | See "Inaugural grading" section below for full rationale. B+ / 8/10. Useful starting point; verification-first on specifics. |

## Inaugural grading — `deep-research-report.md`

The maintainer's first question (*"can you tell me how the
quality of that research you received was?"*) is answered
here in full.

### What the report did well

- **Correct high-level architecture identification.** The
  report named the right Zeta primitives as the durable
  value: retraction-native semantics, the D / I / z⁻¹ / H
  operator algebra, capability tags, provenance stamping,
  compaction discipline, threat-aware gating. Nothing
  load-bearing was mis-named.
- **Good synthesis into five preservation strata.** The
  layered import order (engine core → specs/proofs →
  security/governance → factory overlay → memory/research)
  is a defensible prioritisation that matches what we'd
  tell a consumer project ourselves.
- **Strong oracle-gate abstraction.** The seven-layer
  gate (schema / algebra / retraction / provenance /
  compaction / runtime / security) with four lifecycle
  hook points (register / build / tick publish /
  compaction) is a useful unifier. The reject / quarantine
  / warn taxonomy — especially the quarantine tier —
  captures a real distinction our own design hadn't named.
- **Honest about limitations.** The report openly flagged
  that it couldn't enumerate AceHack/Zeta as deeply as
  Lucent/Zeta, that per-file byte sizes were unavailable,
  and that Aurora should be a clearance-gated internal
  codename not a public brand. These self-critiques are
  the mark of a report worth reading.
- **Conservative branding stance.** Naming the three
  "Aurora" collisions (Amazon Aurora, NEAR Aurora, Aurora
  Innovation) and recommending formal clearance before
  public adoption is the right posture.

### What it got wrong or left unverifiable

- **Opaque citations (`fileciteturn<N>file<M>`).** These
  are internal markers to OpenAI Deep Research and cannot
  be resolved outside that tool. Every load-bearing claim
  is un-verifiable from our side — we can't go back to
  the source chunks. This is the biggest quality problem.
- **F# oracle skeleton has real issues.** The provided
  ~150-line `module Aurora.Oracle` is directionally right
  but won't compile / run cleanly:
  - The `run` function uses `List.append` in a fold that
    reverses finding order — findings from later checks
    precede findings from earlier checks. Probably
    unintentional.
  - `provenanceCheck` does `match box ctx.Delta with |
    null -> ...` — for value types this match is never
    `null`, so the provenance check silently passes on
    valid-looking deltas with missing provenance stamps.
    The check doesn't check what it claims to check.
  - `applyOrRetract` invokes `retract ()` *before* the
    `Error findings` return, which is probably the
    intended design but is a side-effect-before-return
    pattern that will surprise F# readers expecting
    Result-wrapped retraction.
  Treat as design sketch, not drop-in.
- **Brand decision treated as settled.** The report writes
  as if "Aurora" is the already-chosen successor-project
  name. That's not established on our side — it could be the
  maintainer's choice, the research tool's suggestion, or a
  carried-forward assumption from the source documents the
  tool was given. The branding section cannot be
  load-bearing without that clarified.
- **Archive inventory table** (Lucent-vs-AceHack comparison).
  Because the report admits it couldn't enumerate AceHack
  deeply, the table's "Lucent-only vs both" markers are
  only trustworthy in the Lucent-has-it direction. Absence
  from the AceHack column may mean "not present" or
  "not enumerated" — we can't tell.
- **Collision list not independently verified.** The three
  "Aurora" collisions are plausible but the report didn't
  do a real trademark scan. Ilyana should re-verify before
  any brand decision.

### How I'd use it

- **Lift directly:** five-strata import order, seven-layer
  oracle taxonomy, reject / quarantine / warn taxonomy,
  test-harness recommendations (property tests + DST +
  golden-replay + negative fixtures + security config).
- **Verify before lifting:** F# oracle skeleton (rewrite,
  don't copy), trademark collision list (Ilyana re-scan),
  Lucent-vs-AceHack table (our own `git log` / file
  enumeration).
- **Don't lift without more context:** Aurora as brand
  decision (maintainer confirmation needed), recommended
  Aurora work items (`docs/adr/oracle-gate.md` etc. —
  useful as naming, but we'll author them to our own
  conventions not the report's).

### Grade

**3.5 / 5 overall (B+ / 8 / 10).**

Useful starting point; correct on the big ideas;
conservative on branding; honest about limits. Weakest
on verifiability — the citation format and the
trademark-claim unverifiability mean we can't audit the
report's sources. Middle-of-the-road on actionability
because the F# code needs rewriting to be usable. High on
specificity (concrete layer names, concrete check
functions). Would read more of this type, would not adopt
wholesale.

## Patterns to watch

As the log grows, watch for:

- **Do maintainer-direct A-class inputs consistently score
  higher than C-class research drops?** If yes, the
  factory should prioritise maintainer-direct processing
  over research-drop absorption when both are in flight.
- **Do forwarded-from-X-source B-class inputs cluster
  by source?** If all "YouTube wink" inputs score low
  actionability but high novelty, that channel is best
  treated as idea-generation not ready-to-ship
  direction.
- **Do low-verifiability inputs correlate with high-novelty
  claims?** That's the "too-good-to-be-true" signature —
  if a new frame arrives without verification paths,
  extra skepticism warranted.

## Teaching-direction cue by score band

Guide for which direction to teach, derived from the
overall score:

| Band          | Overall   | Direction                                         | How it lands                                              |
|---------------|-----------|---------------------------------------------------|-----------------------------------------------------------|
| Factory teaches maintainer | 1.0 – 2.4 | Factory surfaces ambiguity, proposes better form | Chat reply: *"I read this as X because of Y — did you mean Z?"* |
| Bidirectional | 2.5 – 3.9 | Absorb what's clear, ask on what isn't           | Partial substrate land + open-questions section in doc    |
| Maintainer teaches factory | 4.0 – 5.0 | Absorb as direction, update substrate            | Substrate landing (memory / BACKLOG / research / ADR)     |

The bands are guidance, not gates. A 2.8 "bidirectional"
input that happens to clarify a long-running architectural
tension may still land as substrate because the signal was
high on the dimensions that mattered for *that* input class.
The log's Overall column is a judgment summary (see
"Scoring dimensions" section), so the band is too.

## What this log does NOT do

- Does not score the maintainer as a person. Scores **inputs**.
- Does not gatekeep absorption. Low-score inputs still get
  absorbed if they land in scope; the score is signal to
  future-self about how much to trust wholesale.
- Does not replace existing substrate discipline. Memories,
  BACKLOG rows, research docs, ADRs still do their jobs.
  The log adds one dimension: a retrospective quality read.
- Is not published externally. Maintainer-internal record.

## Cross-references

- `docs/force-multiplication-log.md` — the symmetric
  counterpart (factory → operator signal quality).
- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — why terse maintainer messages score well on signal
  density despite low word count.
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — the clean-or-better invariant this log measures
  against.
- `drop/README.md` — where C-class inputs arrive.
