---
name: Research Claude + Claude Code + Claude Desktop on a cadence; design the factory for latest features, not legacy ones
description: Aaron 2026-04-20 verbatim "part of our stay up to date on everything we should always research claude and claude code and desktop difference an changes on a cadence so we can design our factory for the latest changes and featuers." Durable factory-wide policy — the factory runs on Anthropic surfaces (Claude the model, Claude Code CLI, Claude Desktop app, Claude Agent SDK, Claude API) and those surfaces ship features on a continuous cadence. The factory must instrument cadenced research to stay current; otherwise it designs around obsolete assumptions. Direct trigger — my 2026-04-20 miss where AutoMemory (Anthropic Q1-2026 built-in feature) was being described as if it were factory-native infrastructure until Aaron corrected the framing. That's the failure mode this rule prevents.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Rule: **every 5-10 rounds (same cadence as
skill-tune-up and agent-QOL), run a cadenced audit
of Anthropic's Claude surfaces — Claude the model,
Claude Code (CLI), Claude Desktop (app), Claude
Agent SDK, Claude API. Document new features, cut
features, and behavioural changes in a living
inventory; update factory rules / skills / BP-NN
where the factory's assumptions have drifted from
the platform.**

**Why (Aaron 2026-04-20 verbatim):**

> *"part of our stay up to date on everything we
> should always research claude and claude code and
> desktop difference an changes on a cadence so we
> can design our factory for the latest changes and
> featuers."*

**The triggering incident:** during the same round,
I'd described Anthropic's AutoMemory feature as if
it were factory-native infrastructure (in the
scope-frontmatter schema research doc's "what this
touches" section). Aaron corrected: *"AutoMemory is
a buit in featue antropic added in Q1 for you."*
See `reference_automemory_anthropic_feature.md`.

This wasn't malice or laziness — it was ambient
drift. The feature shipped (Q1 2026), I'd been
using it across hundreds of sessions, and without a
cadenced research discipline the factory never
catches up with the provenance of what it's
actually running on. Multiply that over Claude's
feature-release cadence (weeks-to-months) and the
factory's model of its own substrate rots quietly.

**How to apply:**

- **Cadence:** every 5-10 rounds, alongside
  skill-tune-up and agent-QOL. Same rhythm as other
  retrospective audits. The cadence is *data-driven*
  (per `feedback_data_driven_cadence_not_prescribed.md`)
  — tune up or down once instrumented signal
  justifies it.
- **Owner:** Architect (Kenji) — interim — runs
  the cadenced audit. The plugin-provided
  `claude-code-guide` agent (loaded from the
  Anthropic official plugin cache, **not a local
  `.claude/agents/` file**) is a question-
  answering reference resource consulted during
  the audit but is not the audit runner. A
  dedicated harness-guide role is a TBD decision
  pending (a) a second harness being populated
  and (b) Aaron/Architect sign-off on whether a
  single shared multi-harness guide or one guide
  per harness is the right architecture.
  (Correction 2026-04-20 of an earlier overclaim
  in this memory that named the plugin agent as
  a local persona whose remit could be extended.)
- **Surface list:**
  1. **Claude (the model)** — versions, knowledge
     cutoff, context window, tool use, extended
     thinking, system-prompt caching, multimodal.
  2. **Claude Code (CLI)** — hooks, slash commands,
     MCP servers, skills system (SKILL.md),
     subagent dispatch, plugins, settings,
     AutoMemory, AutoDream, IDE integrations,
     `/loop` cron, output styles.
  3. **Claude Desktop (app)** — features that
     differ from Code CLI (especially
     projects, file attachments, MCP integrations).
  4. **Claude Agent SDK** — TypeScript + Python
     SDKs; any shape change affects factory
     patterns.
  5. **Claude API** — model IDs, new tools,
     pricing tiers, rate limits.
- **Inventory artifact:** `docs/CLAUDE-SURFACES.md`
  — living doc listing every known feature, its
  adoption status in this factory
  (adopted / watched / untested / rejected), and
  the factory rule or skill that governs its use
  (if any). Updated on each audit.
- **Research sources (ordered by authority):**
  Anthropic docs (`platform.claude.com`,
  `code.claude.com`, `claude.com/claude-code`),
  changelogs, official blog posts, Anthropic SDK
  repos, then community signals (r/ClaudeAI,
  r/claudexplorers, peer-reviewed arXiv).
- **When the audit finds drift** — the factory
  either adopts the new feature (via ADR if the
  change is Tier-3), retires a workaround the new
  feature makes obsolete, or explicitly declines
  adoption (`docs/WONT-DO.md`).
- **When the audit finds a factory assumption was
  already wrong** (the AutoMemory case) — log a
  correction in the misattributed docs / memories,
  save a reference memory for the real attribution,
  and file a `docs/research/meta-wins-log.md` entry
  noting what the factory learned.

**Why a new living inventory rather than extending
TECH-RADAR:**

`docs/TECH-RADAR.md` tracks **factory tech choices**
(languages, libraries, tools the factory selects).
Claude surfaces are the **host runtime** the factory
runs on — features Anthropic provides to us, not
choices the factory makes. Different axes. Separate
docs keep each one focused.

**Why factory-wide scope:**

Any adopter of this factory kit uses Claude Code (or
a close variant). The cadenced surface audit is
equally valuable for a future adopter as it is for
Zeta. The inventory doc is adopter-facing
documentation of the substrate the factory assumes.

**Interaction with existing discipline:**

- `skill-tune-up` already runs a 3-5-query live-search
  for agent/skill/prompt best practices per invocation.
  This new audit is **wider** (covers Anthropic's full
  surface area) and **less frequent** (5-10 rounds vs.
  per-invocation). The two don't duplicate — they
  compose.
- FACTORY-HYGIENE row (new; added this round) is the
  Control-phase artifact. The running inventory doc
  is the Measure-phase baseline. This matches the
  Six Sigma Measure/Control pairing in
  `docs/FACTORY-METHODOLOGIES.md`.
- ADR-gating applies when the audit surfaces a
  feature whose adoption would be Tier-3 — follow
  the usual `docs/research/**` → ADR → implement
  flow.

**Cross-references:**

- `reference_automemory_anthropic_feature.md` — the
  triggering miss (AutoMemory framed as factory-
  native until Aaron corrected).
- `reference_autodream_feature.md` — AutoDream, a
  prior example of an Anthropic feature the factory
  tracks (inventory doc should cite both).
- `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  — sibling discipline on cadenced external research
  for *new patterns*; this rule is the
  *Anthropic-surface* counterpart.
- `feedback_data_driven_cadence_not_prescribed.md`
  — tune the 5-10-round cadence once instrumented
  signal exists.
- `docs/TECH-RADAR.md` — factory tech choices
  (distinct axis).
- `docs/FACTORY-HYGIENE.md` — cadenced control
  rows.
- `docs/HARNESS-SURFACES.md` — the living
  inventory (was `CLAUDE-SURFACES.md`; renamed
  multi-harness 2026-04-20; Claude is the first
  populated section).
- `.claude/agents/claude-code-guide.md` — the
  natural owner for the Claude section;
  cadenced audit extends the persona's existing
  remit. Other harnesses (Codex / Cursor /
  Copilot / Antigravity / Amazon Q / Kiro) get
  their own owners or a shared multi-harness
  guide when populated.
- `feedback_multi_harness_support_each_tests_own_integration.md`
  — extends this rule to every harness the
  factory supports and codifies the
  capability-boundary rule that each harness's
  factory integration must be externally
  tested by a different harness.

**Multi-harness extension (2026-04-20):**

The cadenced-research discipline established
above is not Claude-specific. It applies to
every harness the factory supports
(immediate queue: Codex / Cursor / GitHub
Copilot; watched queue: Antigravity / Amazon Q /
Kiro). See
`feedback_multi_harness_support_each_tests_own_integration.md`
for the per-harness priority, ownership, and
the capability-boundary rule that integration
tests for each harness must be owned by a
*different* harness (a harness cannot self-
verify its own factory integration from
within itself).

**Scope:** factory-wide. Any adopter of this factory
kit inherits the cadenced harness-surface audit; the
substrate documentation is adopter-facing.
