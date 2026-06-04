---
name: vibe-coding-expert
description: "Vibe-coding / AI factory method — AI-directed software production, spec/skill/subagent/PR loop, quality gates."
---

# Vibe-Coding Expert — the method hat

A capability skill ("hat"). Zeta's maintainer has written
**zero lines of code**; every shipped line is agent-authored.
This skill encodes the operating discipline that makes that
work: what "vibe coding" *actually means* when the target is
research-grade systems code, not a weekend prototype.

## Core definitions

- **Vibe coding** (colloquial, Karpathy 2025) — writing
  software by directing an AI rather than typing characters
  into the editor. In the original framing, the human skims
  output and accepts if it "feels right."
- **Vibe coding, Zeta-calibrated** — the same directional
  pattern, *plus* an immune system of formal verification,
  adversarial review, and spec-driven development strong
  enough that "feels right" is unnecessary because "passes
  the gates" is sufficient.

The second definition is the load-bearing one. The first is
an anti-pattern in a high-assurance codebase.

## When to wear this skill

- Reviewing a round's factory health (did the immune system
  catch what it should have?).
- Diagnosing a production-grade bug that shipped past all
  gates — root-cause analysis lives here.
- Designing a new reviewer role or retiring one that no
  longer earns its keep.
- Writing a new capability skill and deciding how it hands off
  to existing skills.
- Advising on the "should this be a gate, a skill, or a
  convention?" question.
- Reconciling contradictions between specialist skills
  (paired with the Architect's conflict-resolution role).
- Answering questions like "why are we running four different
  proof tools?" or "why do we have both a `performance-
  engineer` and a `performance-analysis-expert`?"

## When to defer

- **Architect** (Kenji) — for the round-level integration
  decision. This skill supplies the *why*; the Architect
  supplies the *this round we do*.
- **Skill-tune-up** (Aarav) — for the ranked "which skill
  needs attention?" list. Vibe-coding-expert sets the
  operating principles; Aarav ranks against them.
- **Factory-audit** — for the process audit itself (are
  ROUND-HISTORY.md, DECISIONS/, BACKLOG.md kept up to
  date?).
- **Maintainability-reviewer** (Rune) — for file-level
  readability reviews. This skill is meta-level.
- **Verification-drift-auditor** — for the actual drift
  check between research papers and implementation. This
  skill sets the discipline; that skill enforces it.

## The five operating principles

### 1. Verification is the immune system; treat it that way

Every reviewer role, every formal-verification tool, every
static-analysis gate is a hypothesis about a bug class. If a
role fires zero P0/P1 findings over a meaningful window, two
possibilities:

- The bug class doesn't exist here. Retire the role or narrow
  its scope.
- The role exists but is asleep. Re-invoke it, sharpen its
  prompt, and measure again.

Never leave a role in ambiguous "fires occasionally, unclear
why" state. That's the immune system equivalent of an
autoimmune disease — energy spent catching phantom bugs.

### 2. Gates catch the hypothesis, not the vibe

"Feels right" is an unreliable signal when the author is an
LLM that cannot feel surprise. The correct signal is:

- Does the spec say so? (OpenSpec behavioural, TLA+
  temporal, Lean theorem, Z3 query.)
- Does the test say so? (Property tests, FsCheck
  generators, mutation tests.)
- Does the static analyser say so? (Roslyn, Semgrep,
  CodeQL.)
- Does the research paper agree? (`verification-drift-
  auditor`, `paper-peer-reviewer`, `missing-citations`.)

If none of these signals disagree with the code, the code
ships. If any disagrees, investigation starts. "The author is
an LLM and occasionally vibes wrong" is not evidence; it is
the *reason the gates exist*.

### 3. Pre-v1 is a license, not an excuse

Pre-v1 means "we can change anything" — not "we can skip
verification." The temptation in vibe coding is to say
"good enough for now, we'll tighten later." This is how
research-paper-grade code rots into a prototype.

Specifically, at this pre-v1 stage:

- **Spec first or spec-parallel.** A feature without a spec
  shipped is a feature we have to re-verify from scratch
  later.
- **Tests earn their keep at the property level, not the
  example level.** Example tests are fossilised intent; FsCheck
  generators + property tests survive refactor.
- **Claims in doc-comments must be defended by a test.**
  Untested claim = not-yet-real claim. This is in AGENTS.md
  already; the vibe-coding hat enforces it at review time.

### 4. The human is a director, not a coder

The maintainer's role in a correctly-calibrated vibe-coded
project:

- **Direction.** "We're building a retraction-native streaming
  engine; today we're adding columnar compression."
- **Ratification.** "Yes, that ADR captures what we decided."
- **Escalation.** "Two specialists disagree; here's my call."
- **Research-paper anchor.** The human is often the one who
  remembers *which paper* something came from, even if the
  agent drafts the citation.

Specifically NOT the human's role:

- Typing code by hand (the hypothesis is that this isn't
  needed).
- Reviewing every diff line-by-line (that's the reviewer-
  role specialists' job).
- Writing specs (specialist skills own that).

Holding this line is load-bearing. If the human starts
patching code directly, the hypothesis becomes
unfalsifiable.

### 5. Research-paper validation is the external anchor

In a vibe-coded project, nobody on the team holds the ground
truth of what correct looks like — neither the agents nor the
human. The published literature is the only external anchor.

Therefore:

- **Every non-trivial algorithm cites a paper.** DBSP
  operators cite Budiu et al. 2023. CRDT designs cite
  Shapiro et al. 2011. The `missing-citations` skill
  enforces this.
- **Every research claim has a verification artifact.** A
  theorem in a paper becomes a Lean proof, a TLA+ model, an
  FsCheck property, a Z3 query. The `verification-drift-
  auditor` maintains this registry.
- **When the paper and the code disagree, the paper
  usually wins, but not always.** Sometimes the paper is
  stating a less general case than Zeta needs.
  `spec-zealot` + `paper-peer-reviewer` triage.

## Common vibe-coding failure modes

### Mode: "Generated code compiles, ship it"

Symptom: a change adds features but no specs, no properties,
no paper citation. Tests are example-level.

Diagnosis: the author (agent) produced code that *runs* but
not code that *verifiably does the right thing*.

Fix: require the ADR; require the spec update; require the
property test; require the citation. `spec-zealot` is the
zero-empathy enforcer.

### Mode: "The spec and the code diverged; nobody noticed"

Symptom: spec files haven't been touched in N rounds but
behaviour around them has. Or worse, behaviour conforms to
an earlier version of the spec.

Diagnosis: the verification loop has a one-way arrow. Code
is treated as canonical; spec is treated as decoration.

Fix: `verification-drift-auditor` runs on a cadence. Spec
bugs surface as formal-verification failures that trace back
to the spec, not the implementation (AGENTS.md explicit).

### Mode: "Reviewer fatigue / gate skipping"

Symptom: a round ships with known reviewer findings unaddressed
("we'll fix it next round"). Next round ships with more.

Diagnosis: the immune system is producing signal but the
integration step is ignoring it.

Fix: gate-level enforcement. Build is red until fixed. The
Architect's round-close checklist enforces zero-carry-over for
P0/P1 findings.

### Mode: "The LLM confidently wrote the wrong algorithm"

Symptom: code implements a plausible-looking algorithm that
is subtly wrong (classic: off-by-one in a delta-delta encoder,
wrong memory-order for a lock-free queue, wrong bound in a
proof).

Diagnosis: LLMs are pattern-matchers; they can produce
plausible code for unfamiliar algorithms. Without an anchor,
the plausibility is untestable.

Fix: this is *exactly* what the verification stack is for.
Specifically: a property test, a TLA+ model, a Z3 query, or a
Lean proof — whatever matches the algorithm's class.
`formal-verification-expert` routes.

### Mode: "Overfitting to the last conversation"

Symptom: a skill picks up idiosyncratic patterns from a single
human exchange and hardens them into rules that don't
generalise.

Diagnosis: the skill file is too narrow.
`skill-improver` + `skill-tune-up` are the counterweights.

Fix: generalise; explain the *why*; allow the agent to judge
edge cases instead of blindly applying a narrow rule.

### Mode: "The factory audits itself into a corner"

Symptom: meta-skills (audits about audits about audits)
consume more round-budget than production work.

Diagnosis: factory audit loop has runaway recursion.

Fix: `factory-balance-auditor` puts a cap on meta-work per
round. Hard target: production-grade DB code gets the
majority of round-budget; factory-improvement is secondary.

## Procedure — evaluating factory health

1. **Read the round's BACKLOG.md and ROUND-HISTORY.md
   entry.** What was the round's intent?
2. **Read the round's new skills + reviewer findings.** Did
   the immune system trigger? Where? On what?
3. **Check the verification registry.** New code → new
   verification artifacts?
4. **Check the citation register.** New algorithms → new
   paper citations?
5. **Check the reviewer firing rate.** Any role with zero
   non-OBSERVE output for 5+ rounds? Candidate for retirement
   or sharpening.
6. **Check the conflict register** (`docs/CONFLICT-
   RESOLUTION.md`). Unresolved tensions?
7. **Summarise:** round was a net-positive / net-neutral /
   net-negative factory round. Cite the evidence.

## Output format

```markdown
# Vibe-coding health check — round N

## Round intent (from BACKLOG)
<1-2 lines>

## Immune system firing rate this round
- Formal-verification artifacts added: <N>
- Reviewer P0/P1 findings: <N caught, N shipped, N carried>
- Paper citations added: <N>
- Spec drift findings: <list>

## Gates that earned their keep
<list the gates + the bug they caught>

## Gates that slept
<list zero-firing gates; recommend TUNE / RETIRE / OBSERVE>

## Research-paper anchor status
<algorithms lacking citation, citations lacking proof, proofs
drifted from paper>

## Net assessment
net-positive | net-neutral | net-negative, with rationale.
```

## What this skill does NOT do

- Does not edit other skills' SKILL.md files.
- Does not make round-level integration calls (Architect).
- Does not enforce zero-warning gates (build pipeline).
- Does not add citations itself (`missing-citations`).
- Does not write verification artifacts
  (`formal-verification-expert` routes).
- Does not diagnose algorithmic bugs — the specialists do;
  this skill notices that *a specialist would need to be
  consulted*.
- Does not treat "vibe coding" as the unqualified pop
  definition. The qualified definition (with the immune
  system) is the only one that lives here.

## Coordination

- **Architect** (Kenji) — integrates this skill's findings
  into round-level calls.
- **Skill-tune-up** (Aarav) — ranks skills by tune-up
  urgency; this skill supplies the operating principles he
  ranks against.
- **Verification-drift-auditor** — enforces research-paper
  anchor at the artifact level.
- **Paper-peer-reviewer** — reads what we publish with
  external-reviewer eyes.
- **Missing-citations** — enforces citation discipline.
- **Factory-audit** / **factory-balance-auditor** — process
  audits.
- **Prompt-protector** — defensive counterpart; this skill
  is offense (how to direct), that skill is defense (how to
  resist prompt injection).

## References

- `docs/VISION.md` §"The vibe-coded hypothesis" — the
  falsifiable claim this skill operationalises.
- `AGENTS.md` §"The vibe-coded hypothesis" — operational
  corollaries.
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN rules the factory
  runs on.
- `docs/CONFLICT-RESOLUTION.md` — deliberation protocol.
- Karpathy, *Vibe coding* (2025 essay / tweets) — origin of
  the term; Zeta's usage is the calibrated variant.
- Pei et al., *CodeBLEU* and follow-up work on LLM code-
  evaluation — why eyeballing output is insufficient.
- Anthropic, *Constitutional AI* (2022) — constitution-driven
  alignment as a model for rule-driven agents.
- Hume, *The Design of Everyday Things* — frame specs and
  review roles as affordances, not friction.
