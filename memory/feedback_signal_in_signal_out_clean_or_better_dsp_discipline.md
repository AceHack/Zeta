---
name: Signal-in, signal-out — as clean or better; DSP-discipline invariant for transformations across the factory
description: The human maintainer 2026-04-22 auto-loop-38 directive *"if you receive a signal in the signal out should be as clean or better"* — DSP framing of a cross-factory discipline: any transformation (doc rewrite, refactor, memory-extension, commit, PR description) must preserve the signal it receives, emitting something equal-or-cleaner rather than lossier. Not "append to everything" — the *signal* is what matters (intent, prior context, anchors, verbatims), not the literal byte-stream. Composes with capture-everything, honor-those-that-came-before, verify-before-deferring. Occurrences recognized: atan2 (preserve input arity while resolving quadrant), retraction-native (preserve sign through incremental maintenance), K-relations (preserve provenance through semiring evaluation), gap-preservation (auto-loop-41 — when recovery is infeasible, name the gap honestly with authoritative-source pointer rather than emit placeholder-pending). Four occurrences = structural-not-stylistic.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Migrated to in-repo memory/ on 2026-04-23** via the
first execution of AutoDream Overlay A
(`docs/research/autodream-extension-and-cadence-2026-04-23.md` (lands via PR #155)).
Content preserved verbatim from the per-user source; the
per-user source retains a pointer at its top per the
in-repo-preferred migration discipline
(`feedback_in_repo_preferred_over_per_user_memory_where_possible_2026_04_23.md`
in per-user memory). Rationale: multiple in-repo docs
(`docs/FACTORY-HYGIENE.md`, the AutoDream research doc)
cite this memory at a `memory/` path, so migration
resolves dangling citations and makes the discipline
readable by any factory adopter cloning LFG.

**Verbatim 2026-04-22 auto-loop-38:**
*"if you receive a signal in the signal out should be as clean
or better"*

**Context of arrival:** auto-loop-37 had rewritten
`docs/force-multiplication-log.md` from char-ratio-scoring
(vanity) to outcome-scoring (DORA + BACKLOG + external
validations) per the maintainer's Goodhart-resistance correction. The
rewrite left the doc in a half-state: new outcome-scoring
section at top, legacy char-ratio sections below. I considered
four options (revert / full rewrite / leave / banner+revert)
and asked the maintainer which. His reply was the DSP framing above —
the signal from the legacy sections (histograms, per-tick
reconstruction, anomaly-detection utility) is worth preserving,
not erasing. The "clean or better" part is: the preservation
must improve readability, not just accumulate.

**Rule:** Any transformation on factory substrate — doc
rewrite, file refactor, memory edit, commit message,
tick-history row, PR description, code change — should emit
a signal that is **as clean as or cleaner than** the signal
it received. Specifically:

- **Preserve what the input carried** that the output consumer
  will still need (prior context, anchors, verbatims, cross-
  references, reasoning-about-decisions, pre-validation
  timestamps).
- **Improve what can be improved** (structure, ordering,
  section headers, removing duplication, surfacing hidden
  composition).
- **Never silently drop** information without explicit
  reasoning recorded (deletion log, "moved to X" pointer, or
  "intentionally removed because Y" note in commit body /
  doc header).

**Why (three reinforcing reasons):**

1. **DSP-discipline framing (the maintainer's voice).** Signal
   processing treats signal-preservation as a first-order
   property of transformations. Good filters attenuate noise
   without attenuating signal; good codecs compress without
   losing reconstruction fidelity; good anti-aliasing
   preserves spectrum below Nyquist while suppressing above.
   The factory is also a signal-processing system — the maintainer's
   directives are signal, the factory's outputs are the
   filtered-but-preserved downstream. Information loss at the
   boundary is a factory failure mode, not a clean-up.

2. **Cross-layer occurrence (structural, not stylistic).**
   The "preserve what matters through a transformation"
   shape appears in at least three technical places in the
   factory's prior art:
   - **atan2** preserves input arity (2D → angle) while
     resolving the quadrant ambiguity that `atan` alone
     cannot. Cleaner signal (disambiguated quadrant), same
     fundamental arity (angle-from-two-coords). The
     MathWorks reference the maintainer shared as a wink
     (`https://www.mathworks.com/help/matlab/ref/double.atan2.html`)
     sits at occurrence-3 of this pattern for the factory.
   - **Retraction-native operator algebra (Zeta
     D/I/z⁻¹/H over ZSet)** preserves *sign* (positive
     weights = additions, negative weights = retractions)
     through incremental maintenance, rather than collapsing
     to set-semantics and losing the retract-able signal.
     The algebra is *literally* a signal-preservation
     discipline applied to database state changes.
   - **K-relations (Green–Karvounarakis–Tannen, PODS 2007)**
     preserves provenance through semiring evaluation —
     annotations carry through joins and projections with
     semiring arithmetic rather than collapsing to `{0,1}`
     truth values. Signal (provenance) preserved through
     the transformation (query evaluation).

   Three domain-distinct examples of the same shape =
   the principle is structural, not coincidental. At
   occurrence-3+, per the second-occurrence-discipline memory,
   the pattern is worth named. "Signal-in, signal-out as
   clean or better" is the named form of the shared invariant.

3. **Composes with existing factory disciplines (not
   redundant).**
   - **Capture-everything** says: don't drop information the
     factory received. Signal-preservation is the general
     principle; capture-everything is the specific-to-
     maintainer-disclosure instance.
   - **Honor-those-that-came-before** says: preserve prior
     substrate during refactors; check git-history before
     overwriting. Signal-preservation generalizes this from
     "prior work" to "any input the transformation receives."
   - **Verify-before-deferring** says: claim deferred-target
     exists before pointing at it; don't create phantom
     handoffs. Signal-preservation generalizes: don't
     silently drop the anchor.
   - **Rodney's Razor** (essential-vs-accidental complexity)
     appears to conflict — Rodney says cut accidental
     complexity; signal-preservation says don't drop input
     information. Resolution: Rodney cuts *accidental*
     complexity (things that are not signal); signal-
     preservation preserves *essential* signal. They are
     orthogonal axes, not in tension. The composition is:
     "preserve essential signal, cut accidental complexity."

**How to apply:**

- **Doc rewrites** (the triggering occurrence): when a doc
  is being restructured, preserve the prior sections either
  in-place (with clear "legacy" markers + transition
  narrative) or in a separate file (with pointer from the
  new doc). Never silently delete a section that was doing
  real work — readers have memory of it, downstream docs
  may cross-reference it, git-blame becomes noisier, and the
  reconstruction-from-history cost goes up.
- **Memory edits** (per `memory/*.md`): when updating or
  revising a prior memory, include a dated revision line
  rather than overwriting; the prior claim is signal that
  future-self may need to calibrate against. This is already
  codified in CLAUDE.md "future-self is not bound" — signal-
  preservation is the underlying principle.
- **Commit messages**: body should carry the *why* (signal)
  not just the *what* (bytes). The diff shows what changed;
  the body explains what the change preserves from prior
  commits and what it improves.
- **PR descriptions**: when extending a prior PR's scope
  (e.g. PR #132 carrying auto-loop-31→38 tick-history),
  the description should name all compositional arcs, not
  just the latest. Signal-preservation = reader of PR can
  reconstruct the arc; signal-loss = reader needs to read
  every commit to recover the story.
- **Tick-history rows**: already follow this discipline
  implicitly (compoundings-per-tick, observations list,
  cumulative counts preserved across ticks). Making the
  principle explicit reinforces the existing practice.
- **Refactors / deletions**: a deletion that is a cleanup
  is positive (Rodney's Razor); a deletion that is
  signal-loss is negative. Test: "if a future-self or
  the maintainer asks where X went, can they find the answer in
  git-log or a pointer?" If yes, the deletion preserved
  signal (via git-history). If no (buried in massive
  diff, no pointer, no commit-body explanation), the
  deletion lost signal.
- **Tool output summarization**: when reporting what a
  subagent or tool did, preserve the specific findings
  (file paths, line numbers, verbatim errors) rather than
  only a summary. "Agent found 3 issues" is signal-lossy;
  "Agent found 3 issues: X at foo.fs:42, Y at bar.fs:17,
  Z at baz.fs:99" is signal-preserving.
- **Cross-CLI hand-offs**: when Codex/Gemini/Claude pass
  work between CLIs (parallel-CLI-agents skill), the
  hand-off envelope (model + effort + sandbox + invocation
  args + verbatim prompt) is signal; dropping it = signal-loss.
  Codex self-report already follows this discipline.

**Contrast cases (signal-lossy behaviors to avoid):**

- **Silent erasure**: removing a section during a rewrite
  without a "moved to X" pointer or a "removed because Y"
  commit-body note. Readers and future-self have no
  reconstruction path.
- **Lossy summarization**: "the maintainer said we should improve
  the scoring model" (lossy) vs. "the maintainer 2026-04-22 auto-
  loop-37: *'FYI we are not optimizing for keystokes to
  output ratio ...'* + corrections" (preserved).
- **Flattening compositions**: treating four distinct
  multiple distinct messages as one merged claim, losing the chain's
  sequentiality and each message's specific weight.
- **Over-compression**: replacing a verbatim with a
  paraphrase. The paraphrase is acceptable IN ADDITION to
  the verbatim; acceptable AS A REPLACEMENT only when the
  verbatim is preserved elsewhere (git-log, prior memory,
  round-history).

**Composition with outcome-based scoring:**

- Signal-preservation is a *qualitative* outcome that
  doesn't fit cleanly on any DORA key. It lives adjacent
  to the scoring model, not inside it. The force-mult-log
  edit that preserved legacy char-ratio sections is an
  example: the outcome is "readers can still reconstruct
  the pre-pivot state" — measurable only by absence-of-
  confusion in future reads.
- Proposed: add a tertiary anomaly-detection signal:
  *signal-loss-rate per tick* = fraction of ticks in which
  substrate was rewritten without a preservation path.
  Target: ~zero. Spike = factory is erasing context.

**NOT:**

- NOT an instruction to append without pruning. Accidental
  complexity still gets the Rodney cut. Signal is what
  matters; noise can go.
- NOT a mandate to preserve every byte. The rule is
  "signal preserved," not "all bytes preserved." A verbose
  paragraph can legitimately collapse to a short sentence
  *as long as the signal (the essential claim, the anchor,
  the verbatim-source) is either preserved in-place or
  pointed to*.
- NOT a claim that the three occurrences (atan2, retraction-
  native, K-relations) exhaustively characterize the
  principle. More occurrences likely exist and can be added
  as found.
- NOT a promotion to ADR or BP-NN. This is feedback-memory
  territory. If the principle earns further occurrences or
  gets cited repeatedly in reviews, ADR promotion is
  Architect's call.
- NOT in tension with outcome-based-scoring (Goodhart-
  resistance). Outcomes = world-response; signal-preservation
  = agent-side discipline. Both apply; neither subsumes the
  other.
- NOT a license to bloat. "Clean OR BETTER" is the phrase —
  the output should be EQUAL-OR-CLEANER than the input, not
  larger. Compression that loses no signal is a win.

**Extension (auto-loop-41, 2026-04-22) — gap preservation.**

The principle generalizes to a fourth case: when input signal
*cannot* be fully recovered into the output (the signal was
live but copy-capture didn't keep pace), the discipline is to
**name the gap honestly in the output** rather than leave a
placeholder that implies future-fill-that-will-not-land.

Triggering occurrence: `docs/research/amara-network-health-
oracle-rules-stacking-2026-04-22.md` carried 5
`[VERBATIM PENDING]` markers for sections where Amara's exact
prose was pasted live in the session but not copy-captured
into the doc before the tick closed. The underlying transcript
(`1937bff2-017c-40b3-adc3-f4e226801a3d.jsonl`) is ~276MB,
which makes in-tick grep-and-extract impractical. Left as-is,
the placeholders imply "future-fill pending" — but the
future-fill will not feasibly happen.

**Fix:** replace each `[VERBATIM PENDING]` with a blockquote
callout:

```
> **Verbatim source:** Amara's original phrasing of the <X>
> lives in the 2026-04-22 auto-loop-39 session transcript only.
> Distillation above preserves the claim; exact wording is in
> the paste.
```

This is the DSP analog of marking data MISSING explicitly
rather than interpolating zero: **missing-known-and-named
beats missing-implicit-pending**. The gap is still a gap, but
it's now a named gap with an authoritative-source pointer,
which is *cleaner* signal than a placeholder that degrades
over time into ambient noise.

**Rule (generalized):** when a transformation cannot preserve
input signal fully, emit an honest gap-marker that (a) names
what is missing, (b) points to the authoritative source if
one exists, (c) distinguishes structural-distillation (what
the transformation did preserve) from verbatim-capture (what
it did not). Do NOT emit placeholder-pending markers unless
future-fill is actually scheduled.

**Fourth occurrence — reinforces structural-not-stylistic.**
The three prior occurrences (atan2 / retraction-native / K-
relations) were about *transformation-cleanliness* under
normal operation. This fourth occurrence is about *gap-
honesty* when preservation is infeasible — different case,
same underlying invariant (output should accurately represent
what input carried, including explicitly naming what was
lost). Pattern holds across a wider class than initially
named.

**Cross-references:**

- `docs/force-multiplication-log.md` — the doc whose
  half-rewritten state triggered the maintainer's DSP directive.
  Legacy sections preserved in the current state per this
  principle.
- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
  — sibling correction (same tick pair) on the scoring-
  model side; composes with this one on the discipline side.
- `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md`
  — Rodney's Razor / deletion-discipline; the other axis
  (cut accidental complexity while preserving essential
  signal).
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  — K-relations occurrence of signal-preservation (provenance
  through semiring).
- `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  — occurrence-discipline that governs when patterns get
  promoted; three occurrences of signal-preservation
  (atan2 / retraction-native / K-relations) is the anchor
  for naming this principle.
- Oppenheim & Schafer, *Discrete-Time Signal Processing*
  (standard DSP reference) — general signal-processing
  theory where the preservation principle is formalized
  (Nyquist–Shannon, Parseval, z-transform invertibility,
  etc.). The factory borrows the framing, not the
  mathematical apparatus.
- MathWorks `double.atan2` documentation
  (https://www.mathworks.com/help/matlab/ref/double.atan2.html)
  — the maintainer's wink anchor for the arity-preservation occurrence.
