---
name: Principle-adherence review — new hygiene class, cadenced agent judgment on whether the factory applies its own principles consistently across code/skills/docs/memory; judgment-based not verifiable; distinct from existing mechanical hygiene
description: Aaron 2026-04-23 Otto-58 — *"hygene i think but could be more complex cause i think it's not verifable its like an agents review hygene on a cadence for a specific type of thing, this one is look for generalization opportunities in the code, for example the docker for reproducability for multi agent review can be generalize to everyting in the project, all applieas to code skills docs everyting, but seems different that hygene like review candences for different pracitaces we want to promote to make sure we are sticking to our principles"* + *"backlog"*. Names a new hygiene class distinct from the ~57 mechanically-verifiable FACTORY-HYGIENE rows: judgment-based cadenced review sweeping the project for where a named principle applies but isn't applied. Worked example: Docker-for-reproducibility (currently scoped to multi-agent peer-review) generalizes to devcontainer, sample demos, benchmarks, Craft modules. BACKLOG row M-effort filed.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Principle-adherence review — new hygiene class

## Verbatim (2026-04-23 Otto-58)

> hygene i think but could be more complex cause i think
> it's not verifable its like an agents review hygene on
> a cadence for a specific type of thing, this one is
> look for generalization opportunities in the code, for
> example the docker for reproducability for multi agent
> review can be generalize to everyting in the project,
> all applieas to code skills docs everyting, but seems
> different that hygene like review candences for
> different pracitaces we want to promote to make sure we
> are sticking to our principles

> backlog

## The claim — a new hygiene class

Existing FACTORY-HYGIENE rows are **mechanically
verifiable**: lint script returns exit code; audit tool
ranks files; detector checks threshold. Row #50 (missing-
prevention-layer meta-audit) even enforces the
"classification" of each row as prevention-bearing /
detection-only-justified / detection-only-gap.

Aaron names a **distinct class**: *judgment-based review
that sweeps for generalization opportunities of named
principles*. The review asks not *"did we do X?"* (binary)
but *"are we applying principle P consistently wherever P
applies?"* (scope-extension).

## Why this is different from existing hygiene

| Existing hygiene | Principle-adherence review |
|---|---|
| Mechanical / verifiable | Judgment-based |
| Tool emits pass/fail | Agent emits candidate list |
| Frequency: often (per-build / per-round) | Frequency: lower (every 10-20 rounds per principle) |
| Output: finding / audit doc | Output: ROUND-HISTORY row + BACKLOG rows per opportunity |
| Prevents specific regressions | Surfaces application gaps |
| Covers *rules* | Covers *principles* |

The distinction is important because the two classes
compose differently:

- Mechanical hygiene catches rule-breaks.
- Principle-adherence review catches *unused-scope*.

You can satisfy every mechanical rule and still miss
opportunities where a named principle applies but isn't
applied. That's the scope-extension gap this row covers.

## Worked example Aaron named

**Principle:** "Docker for reproducibility" (currently
scoped to multi-agent peer-review per Otto-55 + Otto-57).

**Review asks:** where else would reproducible-environment
shipping reduce friction?

**Candidate generalizations:**

- `.devcontainer/` for contributor onboarding —
  reproducible dev env, "works on anyone's machine"
- Per-sample Dockerfile for demo reproducibility — demo
  runs on any host
- Benchmark-harness container for `CheckedVsUnchecked`
  etc. reproducibility across hosts
- Craft module build env — "run this lesson on any
  machine" portability for learners
- CI image pinning — already uses containers but pinning
  could be reviewed for full reproducibility

Each candidate is a BACKLOG row with owner + effort.
The review's output is **the list**; the implementation
is per-candidate downstream work.

## Principle-catalogue first pass (candidates to review)

From existing session memory:

| Principle | Current scope | Potential generalization review |
|---|---|---|
| Git-native, host-neutral | PR review archive, soulfile substrate | CI artifact storage? fire-history transport? skills distribution? |
| In-repo-first (Option D) | memories migration | research docs? persona notebooks? per-user reference docs? |
| Samples-vs-production discipline | code samples | docs samples? skill examples? research examples? |
| Applied-default-theoretical-opt-in | Craft modules | ADRs? research docs? memory files? |
| Honest-about-error | commit messages | persona notebooks? memories? responses to humans? |
| Codex-as-substantive-reviewer | PR thread responses | memory reviews? spec reviews? research reviews? |
| Detect-first-action-second | hygiene audits | security audits? performance audits? skill-tune-up? |
| Honor-those-that-came-before | retired personas | retired skills? retired BACKLOG rows? retired memories? |
| Docker-for-reproducibility | multi-agent peer review | devcontainer / demos / benchmarks / Craft / CI |
| CLI-first-prototyping | multi-agent peer review | any new tooling? new integrations? |
| Trust-based-approval | PR reviews | memory writes? skill edits? BACKLOG additions? |
| Split-attention | tick rhythm | parallel work in general? background hygiene + foreground substrate is already named |

The catalogue is **first-pass**; review protocol decides
cadence + owner + output per principle.

## Review-protocol shape (research doc will sharpen)

For each principle:

1. **Define** the principle in one sentence with existing
   memory citation.
2. **Current scope** — where is the principle currently
   applied (1-2 concrete in-repo / in-memory examples)?
3. **Sweep** — walk the project asking *"does this
   principle apply here that we haven't applied it yet?"*
4. **Candidates** — emit a list with per-candidate
   proposed-action (new BACKLOG row, ADR, skill, doc)
5. **Surface** — file a ROUND-HISTORY row noting the
   review; file BACKLOG rows for the candidates.

The sweep is bounded — an agent with the relevant hat
walks for N minutes, captures the top-K candidates, and
stops. Not exhaustive; the cadence catches subsequent
opportunities.

## Cadence design (research doc will decide)

Candidates:

- **Per principle, every 10-20 rounds** — lower frequency
  than mechanical audits because judgment-load is higher
- **Sharded across agents** — Kenji takes architecture-
  principles, Aarav takes skill-principles, Daya takes
  AX-principles, Rune takes readability-principles, etc.
- **Invoked by current-round principle-trigger** — if the
  current round introduced a new principle (via ADR,
  BP-NN, or session-endorsed memory), that principle's
  first-pass review fires immediately; steady-state
  cadence starts after

All three likely compose; research decides defaults.

## Composes with

- **FACTORY-HYGIENE row #23** (missing-hygiene-class gap-
  finder) — sibling meta-audit but at a different layer.
  Row #23 asks *"what hygiene classes don't we run?"*;
  this row asks *"of principles we already run, where
  else do they apply?"*
- **FACTORY-HYGIENE row #22** (symmetry-opportunities) —
  mirror shape but different discriminator. Symmetry
  asks about *pair-completion* (A exists, is B's mirror
  needed?); principle-adherence asks about *scope-
  extension* (principle P applied here, where else does
  P apply?)
- **FACTORY-HYGIENE row #41** (orthogonal-axes audit) —
  pairs as meta-audit triad (row #23 existence / row #41
  overlap / this row scope-extension — all judgment-based
  meta-audits)
- **`docs/FACTORY-METHODOLOGIES.md`** pull-vs-always-on
  — this row is pull (invoked on cadence), not
  always-on.
- **Otto-57 PR-review-archive memory** — the archive is
  one specific application of git-native-first-host
  principle; principle-adherence review would have
  surfaced the archive as a candidate
- **Multi-agent peer-review Otto-52 row** — first
  application of Docker-for-reproducibility; principle-
  adherence review would propose the rest

## What this project is NOT

- **Not immediate execution.** BACKLOG row filed; research
  doc + first review pass are M-effort.
- **Not automated-principle-extraction.** First-pass
  catalogue is manual. Automation is a potential
  follow-up row if the discipline proves valuable.
- **Not a mandate to apply every principle everywhere.**
  Some scope-extensions don't pay for themselves;
  principle-adherence review surfaces candidates, per-
  candidate ROI analysis decides which to land.
- **Not a replacement for mechanical hygiene.**
  Mechanical rows remain; this is additive.
- **Not license for principle-inflation.** A principle
  earns cadenced review when it's explicitly named in
  memory / ADR / BP-NN / session-endorsed directive —
  not when one tick floats an idea.
- **Not a blanket hygiene row.** Each principle gets its
  own sub-cadence with its own owner; the FACTORY-
  HYGIENE row structure should reflect that.

## Attribution

Human maintainer named the class + the worked example
(Docker-for-reproducibility generalization). Otto (loop-
agent PM hat, Otto-58) absorbed + filed this memory +
BACKLOG row. Kenji (Architect) queued to design the
review-protocol + principle-catalogue-finalization;
Aarav runs first review pass on Docker; Rune reviews
catalogue granularity; Daya reviews agent cadence-load.
Future-session Otto inherits this class as a distinct
hygiene pillar alongside mechanical audits.
