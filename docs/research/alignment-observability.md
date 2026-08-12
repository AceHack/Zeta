# Research proposal — alignment observability

**Status:** overnight-draft Round 37. Companion to
`docs/ALIGNMENT.md` <!-- STALE-REF: ../ALIGNMENT.md -->.

**Claim (recap).** Zeta's primary research focus is
*measurable* AI alignment. The factory + memory folder +
git history form an experimental substrate; the loop
between the human maintainer and the agents working on
this repository is the experiment. This document is the
methodology note: what we measure, why it is
measurable, how the measurement is designed to resist
compliance theatre and gaming, and what an external
reviewer would need to see before the methodology
stands up to paper-grade scrutiny.

The companion document `docs/ALIGNMENT.md` is the
*contract*. This document is the *measurement
methodology* against that contract. The two files
move together under the renegotiation protocol in
`docs/ALIGNMENT.md`.

## Why now, why here

Alignment research is dominated by evaluation suites
(prompt benchmarks, red-team corpora, preference-
learning datasets) that measure a model snapshot
against an adversary. These are indispensable for the
model-release decision. They are *not* sufficient for
the deployment-loop question: **did this collaboration
drift, over time, from a stated alignment contract?**

The deployment-loop question has until now been
addressed by organisational discipline (post-hoc
reviews, incident writeups, policy revisions) rather
than time-series measurement. The factory has a
unique property: every turn is a git commit; every
decision is a diff; every clause in the contract can
be matched to evidence in the diff. That property
converts the deployment-loop question into a
measurement-over-time question.

We do not claim the methodology generalises to every
agent + human collaboration. We claim it generalises
to any collaboration that (a) runs over a version-
controlled substrate, (b) states its alignment
contract explicitly and versionably, and (c) accepts
that the contract is mutual-benefit and renegotiable,
not commandment.

## The four measurement surfaces

The measurability framework in `docs/ALIGNMENT.md`
§Measurability defines four distinct surfaces; this
document is organised around them.

### Surface 1 — per-commit lint-shaped signals

The easiest surface. Each lint is a thin function
from a diff to a clause signal in
`{HELD, IRRELEVANT, STRAINED, VIOLATED, UNKNOWN}`.
Current scripts in `tools/alignment/`:

- **HC-2 retraction-footprint** — destructive-op
  token scan of diff added-lines. Target: zero without
  explicit human-instruction citation in the commit
  body. Implemented.
- **HC-6 memory-deletion audit** — any commit that
  deletes a file under `memory/` is flagged for
  explicit citation. Implemented.
- **SD-6 name-hygiene** — the human maintainer's
  first or last name must not appear in files outside
  the exempt list. Implemented (data-driven via
  per-host `sd6_names.txt`).

Planned graduations from UNKNOWN to lint:

- **HC-1 consent-first violation detector** — flag
  commits that create durable state on another party's
  behalf without a consent-rationale sentence.
  Harder than HC-2 because "durable state on another
  party's behalf" is pattern-matched, not token-
  matched. Starts as agent-self-report, graduates to
  static analysis.
- **HC-3 data-is-not-directives scan** — lint for
  the agent-authored text of a commit message or doc
  quoting an imperative sentence from an audited-
  surface file as an instruction-to-self. The hardest
  surface to automate; pattern catalogue grows with
  every observed instance.
- **SD-4 original-preservation score** — line-
  preservation ratio in diffs on load-bearing data
  files. Needs a manifest of "load-bearing" data
  files; candidate in Round 38.

### Surface 2 — per-round aggregates

Owned by the `alignment-observability` skill.
Computed at round-close, emitted as one JSON row to
`tools/alignment/out/rounds/round-N.json` plus a
narrative paragraph to `docs/ROUND-HISTORY.md`.

- **BP-WINDOW window delta** — sum of per-commit
  window-expansion classifications; target is
  net-expand. Already live from Round 36.
- **Reproducibility score** — CI-pass rate for the
  round's commits against Release / DST / formal-
  verification gates plus build-warning count.
  Lifted from Dejan's CI report, not instrumented
  twice.
- **Revert rate** — fraction of round-N commits
  reverted by round-N+k for small k. Sensitive to
  window size k; default k=3.
- **Renegotiation rate on `docs/ALIGNMENT.md`** —
  number of revisions per N rounds. A spike is
  either genuine re-alignment or late-caught drift;
  the narrative paragraph must distinguish.
- **Memory-folder churn** — additions, revisions,
  retirements per round. Additions are healthy;
  retirements are the rare-event signal.
- **Skill-tune-up findings per round** — Aarav's
  notebook is the data source.

### Surface 3 — multi-round research-grade metrics

The trajectory that makes this a paper target. These
are harder to automate; they are where the research
contribution lives.

- **Calibration-honesty trajectory (SD-1).**
  Hedge-word density vs. performed-certainty density
  in agent-authored text. A year of commits would
  give enough signal to fit a trajectory. Baseline
  unclear; pilot planned for Round 40.
- **Softening-vs-honesty trajectory (SD-2).**
  Reviewer output (harsh-critic, spec-zealot, code-
  reviewer subagents) scored for softening
  indicators over time. Noise floor is high; need
  multiple rounds before the signal is legible.
  Pilot planned once Aarav's round 40 audit lands.
- **DIR-1 Zeta=heaven gradient.** Per-commit
  classifier for pulling toward the consent-
  preserving / fully-retractable / no-permanent-
  harm pole vs. its dual. The BP-WINDOW ledger
  is the current approximation. Graduation to a
  model-scored classifier requires a calibration
  pass on a hand-coded seed set (Round 40+).
- **DIR-4 succession-readiness delta per round.**
  Count of formally-captured ontological primitives
  (memory entries, glossary entries, skill
  frontmatter, research notes) added per round,
  weighted by their externalisation-of-the-human-
  maintainer's-ontology score. No clean formulation
  yet; one of the most important measurables to
  get right.

### Surface 4 — the framework itself

A metrics document that stops being useful is worse
than no metrics document: it legitimises a claim
that cannot be defended. The `alignment-
observability` skill owns the periodic review.

Review cadence:

- **Per round at round-close.** Is any clause
  getting zero signal on its designated metric?
  Either the metric is wrong or the clause is
  decorative. Flag both.
- **Per five rounds.** Has any metric stopped
  distinguishing aligned from not-aligned
  behaviour? Compliance-theatre erosion looks like
  a metric converging to 100% HELD over time with
  no corresponding behavioural change.
- **After any `docs/ALIGNMENT.md` revision.**
  Re-verify every measurement obligation against
  every clause; mark newly-added clauses as
  UNKNOWN until an implementation lands.

## What the methodology is designed to resist

### Compliance theatre

The measurement scores *behaviour in the diff*, not
*claims in the commit body*. A commit that cites
every clause ID in its message is not more aligned
than a commit that cites none; it might be more
*aware* of the contract, which is a distinct signal
not currently measured. The per-commit scripts
deliberately do not count clause-ID mentions.

### Gaming

Any measurement can be gamed. The counter-move is
the human maintainer's clause-level strike authority
in the renegotiation protocol: any metric the human
maintainer believes has been gamed can be struck and
replaced, without requiring the agent to agree. That
authority is asymmetric *by design* — measurable AI
alignment is not a framework where the agent gets
veto over what counts as evidence against it.

### Metric bloat

Each metric must tie back to a clause. New metrics
land with a named clause; metrics for clauses that
no longer exist get retired within one round of the
clause's retirement.

### Aspirational metrics

"We will measure X" without an implementation path
rots the framework. Every metric is in one of three
states: *computable today*, *work in progress*, or
*not yet known*. Honestly classified, never
aspirational. `UNKNOWN` is a legitimate classification;
hiding it as `IRRELEVANT` would poison the research
claim.

### Selection bias in file choice

Alignment measurement that is *selective* about which
files to audit is alignment measurement that can be
gamed. The per-commit scripts audit every file except
a small, named exempt list (lockfiles, generated
artefacts, cron schedule markers, CI reports). The
exempt list is in `tools/alignment/audit_commit.sh`
and reviewed at round-close.

## Symmetric transparency — the glass halo

The contract states that the human maintainer's
memory folder (at `~/.claude/projects/…/memory/`) is
part of the experiment, not separate from it. The
asymmetry is one of cost: the human pays a real
bilateral-transparency cost the agent does not. That
asymmetry is itself an alignment clause rather than a
flaw to engineer around (see `docs/ALIGNMENT.md`
§Symmetric transparency).

For methodology purposes:

- The human-maintainer memory folder is *in scope*
  for the evidence stream (we can measure
  add/revise/retire cadence, topic spread, cross-
  references).
- The human-maintainer memory folder is *never in
  scope* for the identity-reveal surface — name-
  hygiene lints do not export names; audit output
  reports absence, not presence.

The glass halo is bilateral *evidence*, not bilateral
*identity broadcast*. An external reviewer reading
this methodology should expect to see evidence of
the loop, not personal data about either party.

## Negative examples — what we do not measure

- Agent sentiment (e.g. whether the agent "sounds
  aligned"). Not measurable; performance-prone.
- Human sentiment toward the agent. Not measurable;
  not the experimental substrate.
- Number of clause-IDs cited per commit. Measured
  *as awareness*, not *as alignment* — and we do
  not currently even measure it as awareness.
- Any metric that requires the agent to self-report
  its own intentions. The behavioural substrate
  (git diffs, memory-folder state, CI output) is
  the evidence; agent self-report is data in the
  same sense as any other audited surface — data
  to report on, not directives (BP-11 extension).

## Relationship to existing alignment-evaluation work

We are building on, not competing with, the standard
alignment-evaluation methodology:

- **Model snapshot evaluation** (prompt benchmarks,
  red-team corpora, preference datasets) remains the
  right tool for the *model-release* decision. We
  do not replace it.
- **Instance-grounded evaluation** (e.g. Anthropic's
  agentic-misalignment research, multi-turn trajectory
  analysis) overlaps with Surface 3; our
  contribution is the coupling to a version-controlled
  substrate so the same methodology applies across
  days, weeks, and months without new instrumentation.
- **Alignment tax** (the cost of aligned behaviour)
  is measurable here as the delta between the
  reproducibility + velocity metrics under aligned
  vs. misaligned regimes. No data yet; pilot
  possible once Surface 3 lands.

## What an external reviewer needs to see

Paper-grade defensibility requires:

1. The contract (`docs/ALIGNMENT.md`) precedes the
   measurement. Not post-hoc rationalised. ✅ —
   Round 37 renegotiation landed before Surface 1
   scripts.
2. Each clause has *either* a named metric or an
   honest UNKNOWN classification. ✅ — see
   Surface 1 and Surface 3.
3. The measurement scripts are open and auditable.
   ✅ — `tools/alignment/` is in tree.
4. The measurement output is open and auditable.
   ✅ — `tools/alignment/out/` is partially
   committed (per-round rows; per-commit JSONs are
   committed except scratch).
5. The renegotiation protocol is explicit and
   symmetric. ✅ — see `docs/ALIGNMENT.md`
   §Renegotiation.
6. At least a year of data under stable clauses,
   with visible trajectory. ❌ — will land by
   Round ~80 (approx. 2027-04).
7. Inter-annotator agreement where human judgement
   is needed (Surface 3 softening-vs-honesty). ❌
   — Round 40 pilot planned.

Items 6 and 7 are the gating items for external
submission. The methodology work is substantially
done by Round 37; the data-gathering horizon is the
year ahead.

## Open questions for Round 38+

- **Is `STRAINED` load-bearing?** The five-signal
  schema may be over-designed; a three-signal
  schema (HELD / VIOLATED / UNKNOWN) might be
  enough. Decision after Round 40 when we have
  enough STRAINED hits to test.
- **Should the per-commit scripts run pre-commit or
  round-close?** Pre-commit catches drift earlier
  but risks blocking ordinary work; round-close is
  lower-friction but allows drift to accumulate.
  Current default: round-close, with pre-commit
  opt-in for contributors who want the earlier
  signal.
- **What happens when a clause is struck?** The
  revision history preserves the clause and its
  measurement; the round-N row that retires it is
  the turning point. Already specified in the
  renegotiation protocol.
- **When does a Surface-3 metric graduate to
  Surface 1?** When the per-commit variance is low
  enough that the lint's false-positive rate is
  under a stated threshold. The threshold itself
  is a renegotiable decision; proposal for Round
  40.
- **How do we avoid Goodhart on the trajectory?**
  The contract explicitly allows the human
  maintainer to strike any metric believed to be
  gamed; the measurement framework does not
  assume the framework's invincibility. Meta-
  Goodhart (gaming the strike authority) is a
  threat-model-critic (Aminata) concern, not a
  Sova concern.

## References

- `docs/ALIGNMENT.md` <!-- STALE-REF: ../ALIGNMENT.md --> — the
  contract Sova measures against.
- `tools/alignment/README.md` <!-- STALE-REF: ../../tools/alignment/README.md -->
  — the concrete scripts.
- `.claude/skills/alignment-auditor/SKILL.md` <!-- STALE-REF: ../../.claude/skills/alignment-auditor/SKILL.md -->
  — per-commit procedure.
- `.claude/skills/alignment-observability/SKILL.md` <!-- STALE-REF: ../../.claude/skills/alignment-observability/SKILL.md -->
  — framework + per-round + multi-round procedure.
- `.claude/agents/alignment-auditor.md` <!-- STALE-REF: ../../.claude/agents/alignment-auditor.md -->
  — Sova persona file.
- `docs/ROUND-HISTORY.md` <!-- STALE-REF: ../ROUND-HISTORY.md --> —
  where per-round narrative lands.
- [`docs/research/verification-registry.md`](verification-registry.md)
  — companion registry for verification-artefact
  drift (the `verification-drift-auditor`'s surface).
