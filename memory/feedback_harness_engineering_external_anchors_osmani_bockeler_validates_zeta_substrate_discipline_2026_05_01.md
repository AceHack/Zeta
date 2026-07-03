---
name: Harness engineering external anchors — Osmani + Böckeler validate Zeta's substrate discipline (the human maintainer 2026-05-01)
description: The human maintainer 2026-05-01 shared two articles on agent harness engineering — Addy Osmani 2026-04-19 (https://addyosmani.com/blog/agent-harness-engineering/) and Birgitta Böckeler / Martin Fowler 2026-04-02 (https://martinfowler.com/articles/harness-engineering.html). Both are direct external anchors for architectural decisions wrestled with this session (CLAUDE.md MVP trim, multi-harness reframe, substrate-discovery, ratchet-via-caused_by). Osmani's "every line in AGENTS.md should trace back to a specific failure" IS our `caused_by:` frontmatter discipline. His "AGENTS.md under 60 lines, pilot's checklist not style guide" is direct calibration for our CLAUDE.md (sat at ~576 lines / ~27k bytes when this memo was authored 2026-05-01 and growing each tick; dramatically over the 60-line target regardless of exact count). His "multi-agent convergence" observation (Claude Code + Cursor + Codex + Aider + Cline converge on harness patterns) validates the multi-harness reframe. Böckeler's two-dimension control taxonomy (Computational/Inferential × Guides/Sensors) maps to our hooks/lint/validators infrastructure. Her "harness templates" concept maps to substrate-discovery.ts proposal.
type: feedback
caused_by:
  - "The human maintainer 2026-05-01 shared two URLs in same tick: Addy Osmani 'Agent Harness Engineering' 2026-04-19 + Birgitta Böckeler / Martin Fowler 'Harness Engineering for Coding Agent Users' 2026-04-02"
  - "WebFetch on both articles confirmed direct hits with this session's architectural decisions (MVP CLAUDE.md trim, multi-harness reframe, substrate-discovery proposal, caused_by-as-failure-trace)"
  - "External-anchor-lineage discipline (per feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md) — these articles are high-credibility external anchors (Osmani is a Google engineer / industry voice; Böckeler is Thoughtworks Distinguished Engineer; Martin Fowler hosts the article)"
composes_with:
  - feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md
  - feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md
  - feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md
  - feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md
---

# Rule

Two industry-voice articles published in April 2026
independently arrive at framings that align with — and
sharpen — Zeta's substrate discipline. Both are now durable
external anchors for the work-in-progress on:

1. CLAUDE.md MVP trim (the 40k threshold + content-move-out
   question)
2. Multi-harness substrate-discovery (substrate-discovery.ts
   proposal in the loading-taxonomy memo)
3. Memory-file `caused_by:` field as the lineage discipline
4. Hooks / lint / validators as feedback-and-feedforward
   controls

The articles converge on **agent harness engineering** as a
named discipline — "Agent = Model + Harness" — and treat
the scaffolding around the model as a first-class artifact.

# Why

## Addy Osmani — "Agent Harness Engineering" (2026-04-19)

> *"A decent model with a great harness beats a great
> model with a bad harness."*

Direct hits with our work:

### The Ratchet Pattern = our `caused_by:` discipline

Osmani:

> *"Every line in a good `AGENTS.md` should be traceable
> back to a specific thing that went wrong."*

Our `caused_by:` frontmatter field on every memory file
captures exactly this — the failure-trace lineage. The
discipline we've been operating under unconsciously now has
an industry-voice name: **the Ratchet Pattern**. Every
agent mistake becomes a permanent rule.

Implication: when authoring new memory files, the
`caused_by:` field is THE substrate discipline, not just
documentation hygiene. Without it, the memo is folklore;
with it, the memo is a ratchet step.

### "AGENTS.md under 60 lines" = direct CLAUDE.md MVP calibration

Osmani recommends keeping AGENTS.md under 60 lines,
treating it as **"a pilot's checklist, not a style guide."**

Our CLAUDE.md sat at **~576 lines / ~27k bytes** when this
memo was authored (2026-05-01); the file grows each tick as
new ground-rule bullets land, and the exact count drifts
quickly — but the order-of-magnitude relationship to
Osmani's 60-line target is what matters. Verify current
state with `wc -l CLAUDE.md` before citing a specific
number; the directional claim (an order of magnitude over
the recommendation, on the way to Anthropic's 40k
"excessive" threshold) is stable.

The maintainer 2026-05-01 calibration challenge ("the
smaller that file the cheaper you are and anything above
40k anthropic considers excessive... what should NOT be in
claude code if we are trying to do MVP bootstrap") is
externally validated by Osmani's data point. Two
independent voices: keep wake-time bootstrap small,
push detail to discoverable substrate.

This sharpens the MVP trim work: target should be ~60-100
lines for CLAUDE.md ground rules, with detail in
`.claude/rules/` (if canary verifies auto-load),
`.claude/skills/`, or memory files reachable via skill
router / substrate-discovery.

### Multi-agent convergence validates multi-harness reframe

Osmani notes top coding agents (Claude Code, Cursor, Codex,
Aider, Cline) converge on harness patterns despite
different underlying models, suggesting the industry is
discovering load-bearing architectural primitives.

This is direct external validation for the maintainer's
2026-05-01 framing: *"we are going to have to solve this
for every harness, maybe the right general solution is
substrate-discovery.ts in claude.md and agents.md."* The
convergence implies cross-harness substrate is a real
investment with industry payoff, not just Zeta-specific.

### Other Osmani components mapping to our infrastructure

| Osmani Component | Zeta Counterpart |
|---|---|
| State & Persistence (filesystem + Git) | The repo itself; LFG-canonical workflow |
| Execution (Bash, sandboxed code) | tools/, peer-call/, gh CLI |
| Knowledge Management (AGENTS.md, web search, MCP) | CLAUDE.md + AGENTS.md + memory/ + WebSearch + plugin MCPs |
| Context Engineering (compaction, progressive disclosure) | Skill router + memory-on-demand + tick-history compaction |
| Loop Control (hooks, type-checking, approval gates) | dotnet build gate + bun test + pre-commit + branch protection |
| Long-Horizon Work (planning, Ralph loops, multi-session) | Autonomous loop + cron + tick-history |

Validates the existing infrastructure shape; suggests
ratchet steps for missing pieces (e.g., Ralph-loop pattern
worth investigating).

## Birgitta Böckeler / Martin Fowler — "Harness Engineering for Coding Agent Users" (2026-04-02)

> *"Agent = Model + Harness."*

Same foundational framing as Osmani.

### Two-dimension control taxonomy

Böckeler classifies controls along two axes:

**Execution Type:**

- **Computational** (deterministic): linters, type
  checkers, tests, static analysis
- **Inferential** (semantic): LLM-based review, custom
  code judges

**Direction:**

- **Guides (feedforward)**: prevent unwanted outputs before
  generation (e.g., docs, LSP, code mods)
- **Sensors (feedback)**: observe and self-correct after
  generation (e.g., test suites, architecture validators)

Maps cleanly to our infrastructure:

| Control | Type | Direction | Zeta Example |
|---|---|---|---|
| `dotnet build -c Release` gate | Computational | Sensor | F# build must produce 0 warnings |
| `bun test` | Computational | Sensor | DST-grade-A test runs |
| `markdownlint-cli2` | Computational | Sensor | Document hygiene |
| `tools/lint/no-directives-otto-prose.sh` | Computational | Guide | Persona-name discipline lint |
| Codex / Copilot review | Inferential | Sensor | PR threads |
| CLAUDE.md / AGENTS.md / memory pointers | Inferential | Guide | Wake-time discipline |
| Skill router substrate inventory | Inferential | Guide | Pre-action substrate-discovery |
| Pre-commit hooks (BP-10 ASCII clean) | Computational | Guide | Block bad commits |
| poll-pr-gate-batch.ts | Computational | Sensor | Refresh world model |

The two-dimension matrix is a useful audit framework — for
each new tool / discipline, classify on both axes and check
whether existing coverage is balanced.

### "Harness templates" maps to substrate-discovery.ts

Böckeler introduces *"harness templates"* — pre-packaged
guide-and-sensor bundles for common service topologies. The
concept: portability through standardized patterns rather
than explicit transfer mechanisms.

This maps to Zeta's substrate-discovery.ts proposal: a
factory-owned, portable, deterministic discovery layer that
can be pointed at from any harness's bootstrap doc
(CLAUDE.md, AGENTS.md, GEMINI.md, .cursor/rules/, .codex/).
Both ideas converge on "factory-owned portable substrate
beats per-harness reinvention."

### Human-steering > agent-autonomy

Böckeler:

> *"The human's job... is to steer the agent by iterating
> on the harness."*

Calibrates against Aaron's "no directives" framing
(`feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`).
Both can be true: Aaron + Otto operate as accountable peers
on Aaron's input ("framing" not "directives"), AND Aaron
steers via harness iteration (ratchet steps via memory file

+ CLAUDE.md bullet authoring). The "steering" happens at

the substrate layer, not the per-action layer.

# How to apply

When making architectural decisions on substrate / discovery
/ context loading:

1. **Cite these two articles** as external anchors when the
   decision aligns with their framing. Reduces Aaron-as-anchor
   load (per
   `feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`).
2. **For CLAUDE.md trim**, target Osmani's 60-line guidance
   for ground rules. Push detail to discoverable substrate.
3. **For new tooling**, classify on Böckeler's two-dimension
   matrix (Computational vs Inferential, Guide vs Sensor).
   Surface gaps in coverage.
4. **For multi-harness work**, lean into Osmani's
   convergence observation — the multi-harness substrate-
   discovery investment compounds across all five mentioned
   agents.
5. **For ratchet discipline**, every memory file's
   `caused_by:` is the load-bearing field. Without a real
   failure trace, the memo is folklore.

# Composes with

- `feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md`
  — meta-rule on substrate landing. Osmani's "AGENTS.md under
  60 lines" sharpens that rule's CLAUDE.md trim implication.
- `feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md`
  — multi-harness reframe section. Both Osmani and Böckeler
  validate substrate-discovery.ts as factory-owned portable
  fallback.
- `feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md`
  — factory-first-class principle. Böckeler's "harness
  templates" is the same principle expressed externally.
- `feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`
  — both articles are mechanical/external anchors that reduce
  Aaron-as-anchor load.
- `feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`
  — Böckeler's human-steering framing composes (substrate-
  layer steering, not per-action directive).

# What this rule does NOT do

- **NOT a license to rewrite Zeta substrate around external
  framings.** The articles validate what we're doing; they
  don't demand we adopt their exact terminology. Use them
  as calibration, not gospel.
- **NOT a claim Osmani's 60-line target is THE answer for
  CLAUDE.md.** It's an external data point. The actual
  Zeta target is a separate maintainer decision; 60 lines
  is one anchor among others.
- **NOT a deprecation of Aaron's 40k Anthropic-threshold
  data point.** Both calibrations matter — 60 lines (Osmani)
  is the cheaper-is-better target; 40k (Anthropic) is the
  excessive-is-bad ceiling. Aim for the lower; don't exceed
  the upper.
- **NOT a directive to immediately implement Ralph loops or
  the other patterns Osmani names.** Each pattern needs its
  own ratchet step (specific failure → specific rule). The
  articles are inventory of what's known to work; we adopt
  via our own ratchet discipline, not bulk-import.

# Carved sentence (candidate, not seed-layer yet)

*"Agent harness engineering is the discipline; the ratchet
pattern is the loop; caused_by is the trace; convergence
across harnesses is the validation. Every wake-time line
earns its place by tracing to a specific failure."*
(Synthesis from Osmani + Böckeler 2026-04 + the human
maintainer 2026-05-01.)

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence,
not by maintainer fiat.)

# Sources

- [Addy Osmani — "Agent Harness Engineering" 2026-04-19](https://addyosmani.com/blog/agent-harness-engineering/)
- [Birgitta Böckeler / Martin Fowler — "Harness Engineering for Coding Agent Users" 2026-04-02](https://martinfowler.com/articles/harness-engineering.html)
