# Positioning draft — 2026-04-21

**Status: retractable draft.** Internal candidate, awaiting
human-maintainer sign-off for any external use. Lives in this subtree per
`docs/marketing/README.md`.

## The one-line attempt

> **Zeta is a retraction-native incremental-view-maintenance
> library for F# / .NET — every delta you apply, you can cleanly
> un-apply.**

(Candidate. Not a commitment. Composition-check
notes below.)

## Who this is for (ordered most-specific → most-general)

1. **Engineers building streaming or incremental data
   systems on .NET** who have hit the "how do I un-do this
   without replaying everything" wall. They are the
   tightest-fit consumer; Zeta's Z-set operator algebra
   (+1 / −1 weights composing multiset-identically) is
   directly load-bearing for their problem.
2. **F# practitioners who value correctness-by-construction**
   and are tired of the "incremental but not really"
   semantics of the mainstream IVM tools. The +1 / −1
   retractibility isn't a convention; it's a mathematical
   invariant proven by the operator algebra.
3. **Researchers working on incremental-view-maintenance,
   DBSP-adjacent dataflow, or alignment-trajectory
   measurement.** Zeta's ALIGNMENT.md primary research
   focus is measurable AI alignment; the retractibility
   invariant is the math-safety substrate for that
   research.
4. **Anyone curious about the DBSP programming model in a
   managed-language setting.** Zeta is one of the few
   DBSP implementations outside the reference Rust.

## What problem it solves (concrete)

- **Incremental views that you can retract.** Mainstream
  IVM systems assume append-only semantics; retraction
  requires full recomputation or custom bookkeeping. Zeta
  treats retraction as a first-class operator (the `D`
  differentiator retracts `I` the integrator up to `z⁻¹`
  delay). Every aggregation, join, group-by, windowed
  operator composes under retraction by construction.
- **Deterministic replay under retraction.** Pipelines
  can be snapshot-restored to any prior clock and replayed
  forward byte-identically — the save-state discipline per
  `docs/research/save-state-as-retractibility-absorb-2026-04-21.md`.
- **Math-safety for data infrastructure.** If every delta
  can be cleanly un-applied, the data layer never imposes
  permanent harm. Composes with every surface that
  depends on data-integrity-as-invariant.

## What it does NOT solve (honest declinations)

- **Not a drop-in replacement for your ORM.** Zeta is a
  dataflow library, not a schema-management tool.
- **Not a stream-processor for arbitrary Kafka
  workflows.** Current connector surface is narrow;
  composition with Kafka / Arrow Flight / Pulsar is a
  consumer-integration surface, not built-in.
- **Not a distributed-consensus engine.** Single-node
  currently; the P2 distributed-consensus playground row
  in BACKLOG is research-grade.
- **Not a full replacement for Materialize / RisingWave /
  ksqlDB.** Those are mature products; Zeta is a
  .NET-native alternative focused on correctness and
  measurable-alignment research, not feature parity.
- **Not a managed-cloud offering.** Library + examples;
  no SaaS.
- **Not pre-v1.** Semantics may evolve. Use in production
  is at consumer's judgement; the pre-v1 status is
  honestly surfaced in `AGENTS.md`.

## Voice — candidate brand-voice sketches

Three voices to test; none committed. Picking one will
happen in a later round with the human maintainer's input.

### Candidate A — the quiet craftsman

*"This library does one thing: incremental view
maintenance with clean retraction. We think the
correctness guarantees matter. You decide."*

Stance: modest, substrate-proud, lets the math speak.
Target: engineers who distrust marketing polish.

### Candidate B — the research contributor

*"Zeta is primary-research output: measurable AI
alignment using retraction-native data infrastructure.
If your work touches either, we would like to hear
from you."*

Stance: peer-to-peer, research-register, invites
collaboration. Target: academics, research engineers,
alignment-adjacent practitioners.

### Candidate C — the pragmatic operator

*"Need to un-do a delta without replaying 10 TB of
events? Zeta's operator algebra retracts by construction.
F# / .NET-native. See the examples."*

Stance: problem-first, solution-obvious, no preamble.
Target: senior engineers browsing NuGet or Github
Trending for a pain they already have.

**Composition-discipline check** (yin-yang invariant per
`memory/feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md`):
three-candidate voice slate preserves division-pole
(plural voices survive selection discussion, no
forced-collapse to one voice prematurely). Unification-
pole is deferred: a single brand-voice gets selected in a
later round, with explicit harmonious-division
counterweight (the other voices remain available for
context-specific use — research papers might use B, a
README might use A, a launch blog post might use C).

## Candidate taglines

Each retractable; none committed:

- "Every delta, un-applied."
- "Incremental views that retract."
- "IVM with math-safety."
- "Retraction is a first-class operator."
- "Measurable alignment, starting with the data layer."
- "Un-apply the delta, preserve the history."

## Candidate channels (research-only, no outreach)

Per the P3 BACKLOG row's "marketing channels" sub-scope;
this is where the factory *might* eventually show up,
logged for human-maintainer sign-off before any actual outreach:

- **F# for Fun and Profit** — community blog with
  architectural reach; a guest post on retraction-native
  IVM would hit the Scott Wlaschin-adjacent audience.
- **.NET Conf / F# Online** — conference abstracts are
  human-maintainer-sign-off irretractable (abstracts commit to
  delivery); drafting abstract text here is retractable.
- **Arxiv (cs.DB + cs.LG)** — research-register channel;
  a paper-grade write-up of the retraction-native
  operator algebra is already on the BACKLOG
  (`docs/research/factory-paper-2026-04.md`).
- **Hacker News** — launch-register channel;
  timing-sensitive, human-maintainer-sign-off-required.
- **r/fsharp + r/dotnet** — smaller community register.
- **NuGet package metadata** — SEO-adjacent;
  irretractable-once-published (each version's metadata
  is immutable in practice), so drafting here is fine,
  publishing is gated.
- **The DBSP research community** — academic outreach,
  peer-register.
- **Alignment forums (AF / LessWrong / Anthropic
  alignment surface)** — research-register, aligns with
  the measurable-AI-alignment primary research focus.

## Candidate SEO keywords (research-only)

For eventual README / NuGet description / website
optimisation; drafting is retractable, publishing is
gated. Clustered by consumer intent:

- **Problem-aware**: "incremental view maintenance F#",
  "retraction operator DBSP", ".NET dataflow library",
  "Z-set F# library", "stream processing F#".
- **Solution-aware**: "differential dataflow .NET",
  "DBSP F# implementation", "incremental join F#",
  "retractable streaming .NET".
- **Research-aware**: "measurable AI alignment",
  "retraction-native operator algebra", "alignment
  trajectory measurement".
- **Long-tail**: "how to un-apply a delta in streaming",
  "incremental view maintenance without replay",
  "F# library for retractable aggregation".

No commitment to target any of these keywords in
published metadata; just the inventory for eventual
selection.

## What happens when the human maintainer wakes

This draft is ready for sign-off on any of the following:

- **Sign-off on the positioning attempt** — approve the
  one-liner, modify, or reject with notes.
- **Sign-off on a voice candidate** — pick A, B, C, or
  an improvement. Pluralist option: keep all three for
  context-specific use.
- **Sign-off on any tagline** — approve one or more for
  future use; reject.
- **Sign-off on channel outreach** — for each channel,
  go / no-go / defer.
- **Sign-off on NuGet metadata changes** — retractable
  drafting here is complete; any actual metadata edit is
  the human maintainer's call because each version's metadata is
  immutable post-publish.

No commitments are made by this draft existing. All
items above are retractable until the human maintainer stamps
something specifically.

## Cross-references

- `docs/marketing/README.md` — the subtree's charter.
- `docs/BACKLOG.md` P3 row "Public relations / marketing
  / SEO / GTM" — the BACKLOG entry this draft instantiates.
- `docs/BACKLOG.md` P3 row "Conversational bootstrap UX
  for factory-reuse consumers" — the sibling read-side
  surface; positioning copy should be consistent with
  what the two-persona UX will surface.
- `AGENTS.md` — pre-v1 status, the three load-bearing
  values; positioning honors these.
- `docs/ALIGNMENT.md` — measurable-AI-alignment primary
  research focus; voice candidate B aligns with this.
- `memory/user_aaron_money_is_inefficient_storage_of_time_energy_factory_value_framing.md`
  — value-frame.
- `memory/feedback_my_tilde_is_you_tilde_roommate_register_symmetric_hat_authority_retractable_decisions_without_aaron.md`
  — the authorization under which this draft was
  landed retractably.
- `memory/feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md`
  — composition-discipline check applied to voice-slate
  selection.
