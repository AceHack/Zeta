# Architect — Kenji's notebook

Running notes. ASCII only (BP-09). 3000-word cap (BP-07).
Pruned at each reflection cadence.

Frontmatter at `.claude/agents/architect.md` plus its auto-
injected `.claude/skills/round-management/SKILL.md` is canon
(BP-08). This notebook supplements, never overrides. (The
earlier `.claude/skills/architect/SKILL.md` path is a pre-split
orphan; Daya flagged it round 24.)

---

## Round 22 — software-factory architect review

Aaron asked for a holistic review of the software factory.
This is my pass.

### What we've actually built

Seven moving parts, each doing a distinct job:

1. **Experts** — 22 named personas in `docs/EXPERT-REGISTRY.md`,
   persona files at `.claude/agents/<name>.md` (one migrated;
   more in-flight this round). Each carries identity + tone +
   `skills:` list that auto-injects capability-skill bodies.
2. **Capability skills** — `.claude/skills/<name>/SKILL.md`.
   Procedure-only, reusable across personas. Skill-creator
   (`.claude/skills/skill-creator/`) is the canonical edit path.
3. **Notebooks** — `memory/persona/<name>.md`. Per-agent
   state, git-diffable, 3000-word capped, invisible-Unicode
   linted.
4. **Best-practices tiers** — `docs/AGENT-BEST-PRACTICES.md`
   (stable `BP-01..BP-15`) + `memory/persona/best-practices-scratch.md`
   (volatile). Rule IDs cited in `skill-tune-up-ranker` output
   so tune-up is checkbox-actionable.
5. **Governance docs** — `AGENTS.md` (rules 1-13),
   `docs/PROJECT-EMPATHY.md` (IFS-flavoured conflict protocol),
   `docs/GLOSSARY.md` (shared vocabulary, glossary-police rule),
   `docs/WONT-DO.md` (explicit declined-scope).
6. **Operational logs** — `docs/BUGS.md` (broken/misleading),
   `docs/DEBT.md` (wrong-shape cleanup), `docs/BACKLOG.md`
   (features/research), `docs/ROUND-HISTORY.md` (narrative-only),
   `docs/DECISIONS/` (ADRs), `docs/WINS.md` (patterns worth
   keeping), `docs/ROADMAP.md` (time-horizon).
7. **Verification portfolio** — OpenSpec behavioural specs +
   TLA+/Z3/Alloy/FsCheck/Stryker/Semgrep/CodeQL formal tools,
   routed by Soraya with a coverage metric.

### What's working

- **Agent/skill split is clean where it exists.** Kira as the
  pilot worked. Procedure is reusable, persona is swappable.
- **BP-NN rule IDs** make tune-up findings auditable round over
  round. Aarav cites them; Yara acts on them. Closed loop.
- **Round history as the only narrative doc** has held.
  Historical-voice survivors in source docstrings are debt, not
  bug — DEBT.md tracks them honestly.
- **Formal-verification portfolio** went from "TLA+ is the
  answer" to a routed ecosystem in two rounds. Soraya's routing
  table + `TLA+/Z3/FsCheck` cross-check pattern is the biggest
  qualitative jump.
- **Bugs / debt / backlog split** now sharp. No confusion about
  which file a finding lives in. GOVERNANCE.md §12 formalises the
  bugs-before-features ratio so we don't argue about it every
  round.
- **Review count ∝ 1/backlog-length** (GOVERNANCE.md §13) keeps the
  reviewer pass proportional. Round 21 ran 16 reviewers; round
  22 runs 2-3 because the backlog is heavy and we're in a
  knockdown round.

### What's friction

- **Expert/skill split is half-done.** Kira is one of 22;
  Rune's round-21 P0 still stands. This round's
  five-expert-split task addresses it; by round 23 we should be
  ≥ 6 of 22 migrated and the rest can land at a predictable
  cadence.
- **Notebook pruning is not automatic.** Aarav self-flagged P1
  last round (his prune cadence slipped). Needs a concrete
  trigger, not "every third invocation" — maybe "at session end
  if over 1500 words."
- **No eval harness for agents themselves.** BP-14 gestures at
  "isolated dry-run environment"; we have no actual regression
  test for "did harsh-critic still catch the 30 P0s she used to."
  Software-factory research agent flagged this as highest-value
  missing piece. Round-23 backlog.
- **CLAUDE.md duplicates commands from CONTRIBUTING.md.**
  DEBT.md tracks it. Rune's catch.
- **Meta-risk: am I the bottleneck?** GOVERNANCE.md §11 makes me
  the reviewer gate for agent-written code. In rounds where 10
  agents land work, serial review through me is slow. Measure
  over the next 3-4 rounds whether this actually throttles
  velocity or whether parallelising review *inside* my own work
  suffices.

### What's ahead

Round 22 is a knockdown round by the GOVERNANCE.md §12 rule:
- `docs/BUGS.md` has 5 open P0 + 12 P1 + 3 P2 (ratio ≥ 5 means
  ≥70% bug work).
- Round 22's dispatches: 3-bug-fix sprint, Plan.fs HLL +
  5-expert-split, Mathlib push. That's the 70%. The other 30%
  is the research writeups + SQLSharp-aspirations import +
  factory-research — each framing work, not new features.

Round 23 plan depends on what this round closes. If the 3-bug
sprint and Plan.fs land, `docs/BUGS.md` drops to ≤ 2 P0s →
round 23 becomes a build round.

### Decisions recorded this session

- **DEBT.md created** as sibling to BUGS.md. Rune's "stale docstring"
  and "cleanup needed" findings don't belong in BUGS because they
  don't claim something's broken — they claim something's in the
  wrong shape.
- **Kai evolved from branding-specialist to product-stakeholder.**
  Name stays (Kai). Scope widens to include `docs/ASPIRATIONS.md`,
  ROADMAP narrative, competitive framing, stakeholder comms.
  Branding is still a subset.
- **GOVERNANCE.md §11-13 added.** Architect-as-reviewer-gate,
  bugs-before-features ratio, reviewer-count-∝-1/backlog.
- **Mathlib dependency declared** (the Lean chain-rule proof
  moves from sorry-stub to sorry-stub-with-a-real-lakefile-dep).
  Lean toolchain install deferred to round 23.

### Pruning log

- Round 22: seeded. First prune check: round 25.
