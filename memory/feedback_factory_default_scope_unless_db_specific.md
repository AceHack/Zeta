---
name: Factory-default scope unless DB-specific — most guidance Aaron gives is universal software-factory rules encoding 20 years of code best practices, not Zeta-specific policy; Zeta-scope is the narrow exception for DB-algebra-specific rules only
description: 2026-04-20 — Aaron: "almost everything we've talked about so far is a factory rule not a Zeta rule, this is my experience and 20 years of code best practices I'm tryiing to encode into this software factory.  I don't think any of the guidance I've given other than specfic db kind of stuff is specifc to Zeta most/all is univeral factory." Flips the default scope direction: factory/universal is the default; Zeta-specific is the narrow exception (DBSP operator algebra, retraction semantics, Spine / ZSet / `D` / `I` / `z⁻¹` / `H`, LSM structure, content-addressed hashing specifics). Almost everything else — symmetric-talk, trust-infrastructure, HUMAN-BACKLOG, teaching-track, scope-audit itself, free>cheap>expensive, pluggability-first, skill-creator workflow, meta-wins tracking — is factory-scope. Overrides my recent scope-audit conservatism that defaulted everything to Zeta.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

When absorbing a new rule / policy / invariant / BP-candidate
from Aaron (or any future human contributor), the **default
scope is factory/universal**, not project-specific.

Zeta-scope is reserved for rules that are **specifically about
the DB algebra and structure**:

- DBSP operator algebra — `D` / `I` / `z⁻¹` / `H`, retraction
  semantics, composition laws.
- Spine / ZSet / LSM data structures.
- Content-addressed hashing, delta encoding specifics.
- Retraction-native IVM primitives.
- Anything invoking Zeta's particular type system choices in
  `src/Core/**`.

Everything else — software factory hygiene, agent-human
interaction patterns, factory reuse policies, trust
infrastructure, teaching tracks, skill authoring discipline,
cost ordering, pluggability architecture, meta-cognition,
honest retrospective cadence — is **factory-scope**. Aaron is
encoding 20 years of software best practices into the factory
substrate; those practices are not Zeta's.

# Why:

Aaron's verbatim (2026-04-20):

> *"almost everything we've talked about so far is a factory
> rule not a Zeta rule, this is my experience and 20 years of
> code best practices I'm tryiing to encode into this software
> factory.  I don't think any of the guidance I've given other
> than specfic db kind of stuff is specifc to Zeta most/all is
> univeral factory"*

The key signals:

- *"20 years of code best practices"* — the accumulated craft
  is the thing being encoded; it is independent of what the
  factory produces on any given run.
- *"specfic db kind of stuff"* is the explicit exception —
  database-algebra details are Zeta's particular domain; the
  factory could produce a totally different product on a
  different run and most rules would still apply.
- *"most/all is univeral factory"* — the default direction is
  factory, not project.

This directly corrects the scope-audit work I just did in the
same round. In `feedback_scope_audit_skill_gap_human_backlog_resolution.md`
I wrote the decision tree as neutral ("could be Zeta or could
be factory, escalate if unclear"). But neutral was wrong — the
default bias should be **factory**. Zeta-scope requires a
positive reason (this rule mentions the operator algebra, this
rule applies only to database products, etc.). Absent that
reason, the rule is factory.

First-hand evidence in this very round:

- **symmetric-talk rule** — I marked it Zeta-scope when it is
  clearly a factory rule (Aaron's "20 years" of agent-human
  interaction pattern preference). There is no DB-specific
  content; the rule applies to any project using this factory.
- **trust-infrastructure bidirectional** — I treated it as
  Zeta-scope with factory-reuse potential. It is natively
  factory: the trust-infra argument is about AI-human
  collaboration generally, not about DBSP.
- **scope-audit itself** — the rule "declare scope at absorb-
  time" is universally applicable to any software factory that
  wants clean redistribution. Factory-scope.
- **HUMAN-BACKLOG / teaching-track / meta-wins / free-beats-
  cheap-beats-expensive / pluggability-first** — all factory.

# How to apply:

- **At absorb-time, default to factory.** Unless the rule
  explicitly mentions the DB algebra or a Zeta-only data
  structure, it is factory. Do not write "project: zeta" into
  new memory frontmatter as a defensive default.
- **Zeta-scope requires a positive justification.** Ask "does
  this rule stop making sense outside a database context?" If
  yes → Zeta. If no → factory. If unclear → factory (conservative
  in the new direction).
- **When a rule has both layers**, the cleave still applies:
  the *mechanism* and the *default* are factory; any
  Zeta-specific instantiation of the knob is a per-project
  override. But for most rules there is no Zeta layer at all.
- **Retroactive audit is warranted, not urgent.** The `project:
  zeta` frontmatter I added recently to symmetric-talk should
  be flipped. Scope-audit memory should be updated to name the
  factory-default bias. MEMORY.md pointer phrasing can be
  corrected. Separate cleanup pass, low priority.
- **The scope-audit skill (once it lands) enforces this
  default.** A rule without scope frontmatter is factory. A
  rule marked `project: zeta` must point at DB-specific content
  to justify the scope narrowing.

# Cleanup queue (track here, execute separately)

- [ ] `feedback_anthropomorphism_encouraged_symmetric_talk.md`
      — flip scope from Zeta-only to factory-default; remove
      "Zeta-project layer / Factory layer" split because both
      layers are factory.
- [ ] `feedback_scope_audit_skill_gap_human_backlog_resolution.md`
      — add "factory-default bias" to the how-to-apply section;
      correct the "could be Zeta" neutral framing.
- [ ] `project_trust_infrastructure_ai_trusts_humans.md` —
      reframe as factory-scope; the trust-infra argument is
      generic to AI-human collaboration, not Zeta-specific.
- [ ] MEMORY.md pointer for symmetric-talk — remove the
      "Zeta-project scope" bold.
- [ ] Sweep remaining `project: zeta`-tagged memories (quick
      grep) to confirm each has a DB-specific justification.

# Interaction with existing rules

- `project_factory_reuse_beyond_zeta_constraint.md` — declared
  factory-reuse as a CONSTRAINT. This memory **sharpens** that
  constraint: the default scope for new rules IS factory, so
  reuse-readiness is the natural consequence of following the
  default. Zeta-specific marking is the opt-out, not the opt-in.
- `feedback_scope_audit_skill_gap_human_backlog_resolution.md`
  — scope-audit skill's first duty is to flag rules missing the
  factory-default bias. A rule tagged `project: zeta` without a
  DB-specific justification is a lint smell.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — matches the default-on pattern. Factory-scope is the
  default, Zeta-scope is the documented exception (scope /
  reason / exit / owner fields).

# What this rule does NOT do

- It does NOT claim ALL guidance is universal — DB-algebra
  specifics remain Zeta-scope. The claim is that the
  **default** direction is factory.
- It does NOT retroactively invalidate the `project: zeta`
  frontmatter on memories that genuinely ARE DB-specific
  (e.g., anything about `D`/`I`/`z⁻¹`/`H`, Spine operations,
  ZSet algebra).
- It does NOT require the scope-audit skill to exist before
  applying the new default — apply immediately in-conversation;
  the skill when it lands will enforce via lint.
- It does NOT override the Zeta-project-specific bits that
  ARE scoped correctly (operator algebra proofs in
  `tools/lean4/`, TLA+ specs in `tools/tla/`, `src/Core/**`
  module-specific policy, etc.).
- It does NOT block in-conversation work pending the cleanup
  queue. Work continues; cleanup is cadenced.

# Meta-note

This is the second scope-correction Aaron delivered in the
same round (first was "Zeta + factory is conflation, split
them"). The second correction is **meta** — it tells me the
default direction of the cleave I just landed was wrong. This
is exactly why the scope-audit skill Aaron asked for matters:
even when I *do* think about scope, I can pick the wrong
default without human input. HUMAN-BACKLOG resolution for
scope-ambiguity was the right pattern; what was missing was
the **factory-default** bias for the inference that should
have fired before I reached for HUMAN-BACKLOG.
