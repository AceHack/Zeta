---
name: Scope-audit skill-gap — every "absorbed" rule needs explicit Zeta-vs-factory scope tag; resolution often via HUMAN-BACKLOG row because the root cause is human imprecision in the original ask
description: 2026-04-20 — Aaron called out that I said "absorbed" without declaring scope (Zeta-project vs factory-reusable). Three-message thread: (1) "Are you absorbing that into Zeta or the reusable bits of the software factory we can redistribute later? Like is the symmertric talk a Zeta rule or a software factory rule? Those distinctions really matter when we wnat to split out the rusable bits." (2) "we should ahve a skill to check for scoping issues like this." (3) "those are things that are likely to required human backlog and ansering to resolve not all the time, but it was probably the human didnt define the scope when they asked they were inprecise like i was on my orgignal ask." Missing-skill: scope-audit that flags scope-ambiguous rule-absorptions and routes to HUMAN-BACKLOG when root cause is human imprecision.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

Every time an agent "absorbs" or commits a rule, policy,
invariant, or BP-candidate based on a human ask, it must
explicitly declare the rule's **scope**:

- **Zeta-project** — applies only to this repo / this
  conversation. Stays in `memory/` or `docs/` under Zeta.
- **Factory-reusable** — applies to the reusable factory
  substrate being split out later. Must be generic, not
  depend on Zeta-specific paths / modules / persona names.
- **Universal** — applies to all work the agent does, not
  tied to any project. (Rare; e.g., BP-10 ASCII hygiene.)

If the scope is not obvious from the human's ask, the agent
does **not** silently pick one. It either:

1. **Infers carefully** from adjacent context (other memories,
   governance, the surrounding artifact location) and *names*
   the inference so it can be challenged.
2. **Asks the human** — usually via a `HUMAN-BACKLOG.md` row
   tagged `scope-clarification`, because the typical root
   cause is that the human was imprecise in the original ask.
   Synchronous ask is fine when the human is in conversation;
   HUMAN-BACKLOG is the durable form when the answer can wait.

# Why:

Aaron's three-message thread (2026-04-20), verbatim-anchored:

1. *"Are you absorbing that into Zeta or the reusable bits of
   the software factory we can redistribute later?  Like is the
   symmertric talk a Zeta rule or a software factory rule?
   Those distinctions really matter when we wnat to split out
   the rusable bits in the software factory eventuall, those
   are the kind of things we want to mzek suer we have clean
   seperation"* — the scope distinction is **load-bearing for
   factory-reuse**. Mushing Zeta-specific policy into
   factory-reusable substrate contaminates the redistribution.
2. *"we should ahve a skill to check for scoping issues like
   this"* — this is a skill-gap (no skill today flags
   scope-ambiguous rule absorptions). The existing
   `skill-tune-up` has a *portability-drift* criterion but
   only scans `.claude/skills/*/SKILL.md` — it does NOT scan
   memories, durable policy, BP-NN candidates, BACKLOG rows,
   or "absorbed" in-conversation rules. That's the gap.
3. *"those are things that are likely to required human
   backlog and ansering to resolve not all the time, but it
   was probably the human didnt define the scope when they
   asked they were inprecise like i was on my orgignal ask"*
   — the **typical root cause** is human imprecision at the
   ask-moment, not agent confusion at the absorb-moment. The
   right resolution is often **escalate via HUMAN-BACKLOG**
   so the human can name the scope they meant. Not every
   time; but the default bias should be "ask the human" rather
   than "pick one and hope".

The first-hand evidence is this very session: I wrote the
symmetric-talk feedback memory saying "(scope: Zeta + factory,
not universal)" — conflating the two layers Aaron wants
cleanly separated. He caught it. The memory now splits them
explicitly. A scope-audit skill would have flagged that
phrasing on write.

# How to apply:

- **Factory-default bias (corrected same round).** Per
  `feedback_factory_default_scope_unless_db_specific.md`, the
  default scope is **factory**, not neutral. Zeta-scope
  requires a positive DB-algebra justification. Absent that,
  the rule is factory. The decision tree below is sharpened:
  "could be Zeta or factory" → default factory; "clearly
  DB-algebra-specific" → Zeta; "unclear but no DB content" →
  factory. Neutral-default was the bug this memory originally
  embedded.
- **At absorb-time** (any time the agent commits a new rule,
  memory, BP-candidate, governance note, BACKLOG row, etc.):
  name the scope explicitly. If the ask was imprecise, either
  infer-with-caveat (defaulting to factory) or file a
  `HUMAN-BACKLOG.md` row.
- **Scope tags to use in frontmatter:**
  - `project: zeta` — Zeta-only. Required for memories whose
    applicability is project-specific.
  - `scope: factory` — factory-reusable. Can be lifted into
    the redistribution.
  - `scope: universal` — project-and-factory-agnostic.
- **HUMAN-BACKLOG row format** for scope-clarification:
  ```
  - [ ] scope-clarification | {rule-name} | originating-ask: "{verbatim quote}" | agent-inference: "{zeta|factory|universal}" | reason: "{why uncertain}"
  ```
- **When the agent thinks a rule might cleave** (part
  Zeta-specific, part factory-reusable): write it as **two**
  rules, each with the clean scope. Aaron's symmetric-talk
  message is the canonical example — the *choice* is Zeta-
  specific, the *mechanism* (configurable anthropomorphism
  register) is factory-reusable.
- **At audit-time:** any rule/memory/BP without a scope tag
  is a lint smell. The scope-audit skill (once it exists)
  flags them as portability-drift risk.
- **Don't treat the skill-gap as blocking.** Aaron flagged it
  for eventual closure; the current-session workaround is:
  every absorb-moment, I pause to name scope, and if I can't,
  I escalate via HUMAN-BACKLOG rather than silently picking.

# Connection to HUMAN-BACKLOG mechanism

Per `project_human_backlog_dedicated_artifact.md`, the
categories already include `conflict`, `approval`,
`credential`, `external-comm`, `naming`, `physical`,
`observation`. This rule adds a **new category candidate**:
`scope-clarification`. Same mechanism, same "humans never edit
the file" invariant, same resolution-by-conversation.

Cross-ref `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`
— conflict-between-users went to HUMAN-BACKLOG `conflict` rows;
scope-ambiguity in a single user's ask goes to HUMAN-BACKLOG
`scope-clarification` rows. Same pattern, different trigger.

# Connection to existing skills

- **`skill-tune-up` portability-drift criterion (#7)** —
  already exists, but scans only SKILL.md files. A
  scope-audit skill extends the same portability-drift logic
  to memories, governance docs, BP-NN rule candidates, and
  in-conversation rule absorptions. Either (a) extend
  `skill-tune-up`'s scope, or (b) create a sibling skill
  `scope-audit` specifically for non-SKILL.md artifacts.
  Architect decides.
- **`skill-creator`** — when creating new skills, a scope
  tag should be mandatory frontmatter. Scope-audit can lint
  for its presence.
- **`claude-md-steward`** — the three-file taxonomy already
  distinguishes AGENTS.md / CLAUDE.md / MEMORY.md by
  authorship; adding a scope axis (generic / zeta-specific)
  is a natural extension.

# Matrix-mode skill-group implication

If this becomes a new skill-GROUP per the Matrix-mode pattern
(`feedback_new_tech_triggers_skill_gap_closure.md`), the
group would be:

- **expert:** `scope-auditor` — flags scope-ambiguous rule
  absorptions; emits scope-clarification findings; proposes
  cleave-into-two splits where appropriate.
- **teacher:** skill that explains the Zeta/factory split to
  new agents / human contributors.
- **auditor:** CI-or-cadence probe that sweeps `memory/` and
  `docs/` for scope-tag absence and flags.
- **capability:** `scope-tag-inserter` — mechanical
  frontmatter adder for existing untagged artifacts.

Filing the gap for now; let Architect decide whether the
full skill-group is warranted or whether extending
`skill-tune-up` suffices.

# What this rule does NOT do

- It does NOT require every sentence the agent writes to
  carry a scope tag. Only durable absorptions do (memories,
  BP candidates, governance rows, BACKLOG entries, ADRs).
- It does NOT block in-conversation work when scope is
  ambiguous — escalate via HUMAN-BACKLOG and proceed.
- It does NOT change the HUMAN-BACKLOG human-never-edits
  invariant.
- It does NOT apply retroactively to memories written before
  2026-04-20 — sweep-and-tag is a separate (low-priority)
  migration.
- It does NOT license the agent to invent scope tags the
  human didn't agree to. If in doubt, ask.

# Immediate follow-ons for this round

- [ ] File HUMAN-BACKLOG / BACKLOG row for the scope-audit
      skill-gap (priority P1, category: skill-gap).
- [ ] Retroactively add a scope tag to the symmetric-talk
      memory (done — body now splits Zeta-choice vs
      factory-mechanism).
- [ ] Next `skill-tune-up` round: propose `scope-auditor` as a
      new skill OR extend portability-drift criterion #7 to
      cover memories.
